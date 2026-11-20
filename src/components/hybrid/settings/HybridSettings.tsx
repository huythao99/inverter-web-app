import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CheckCircle2, RefreshCw, Wrench } from 'lucide-react';
import { updateHybridSetting } from '../../../services/api';
import type { HybridConfig, HybridLatest, HybridMode, HybridNumberKey, HybridSetting } from '../../../types';
import {
  FIELD,
  FIELDS,
  HWTEST_HINT,
  HWTEST_TEXT,
  LADDER_KEYS,
  LIMIT_KEYS,
  MODE_LABEL,
  NAK_LABEL,
  READONLY,
  configFromCfg,
  fieldText,
  isHwTest,
  modeEffect,
  modeFields,
  modeUsesKey,
  pullAlong,
  rangeHint,
  validate,
} from '../../../services/hinvlf';
import { fmtVolt, fmtWatt } from '../../../utils/fmt';
import { HybridAdvancedSection } from '../advanced/AdvancedEntry';
import { CARD } from '../styles';
import { Collapsible, PendingBadge } from '../ui';
import { useConfirm } from '../useConfirm';
import { Ladder } from './Ladder';
import { ApplyStatus, ModeCard, ModePicker } from './ModeCard';
import { NumInput, PowerField } from './inputs';

const ALL_KEYS = new Set<string>(FIELDS.map((f) => f.key));

/**
 * Tab "Cài đặt" của hybrid, cùng bố cục với app: thẻ chế độ (đổi qua bảng
 * chọn, ô công suất của chế độ ngay bên dưới), khối các mục thu gọn (thang
 * điện áp pin, giới hạn công suất, thông tin máy), thanh Lưu chỉ hiện khi có
 * thay đổi. Lưu thì server gửi xuống máy một lần, máy tự lưu.
 */
export function HybridSettings({
  deviceId,
  setting,
  latest,
  online,
}: {
  deviceId: string;
  setting: HybridSetting;
  latest?: HybridLatest;
  online: boolean;
}) {
  const queryClient = useQueryClient();
  // $CFG mới nhất: live MQTT trước, rồi API.
  const cfg = latest?.cfg ?? setting.cfg ?? null;
  // Giá trị đang hiệu lực = $CFG của máy, đè bởi cấu hình server đã lưu.
  const effective = useMemo<HybridConfig>(() => ({ ...configFromCfg(cfg), ...setting.config }), [cfg, setting.config]);
  // STM32 >= 5.4.30: máy đang tự test phần cứng (IST=HWTEST): chỉ xem.
  const hwTest = !!setting.hwTest || (online && isHwTest(latest?.tlm?.IST));

  const [mode, setMode] = useState<HybridMode | undefined>(effective.MODE);
  const [draft, setDraft] = useState<Partial<Record<HybridNumberKey, string>>>({});
  const [edited, setEdited] = useState<Set<string>>(new Set());
  /** Ô đang gõ (đã gõ, chưa rời ô): chưa kéo theo / chưa báo lỗi. */
  const [typing, setTyping] = useState<HybridNumberKey | null>(null);
  const [focused, setFocused] = useState<HybridNumberKey | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [ladderOpen, setLadderOpen] = useState<boolean | null>(null);
  const [limitsOpen, setLimitsOpen] = useState<boolean | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [, setTick] = useState(0);
  // Nút Áp dụng từng hàng (STM32 5.4.30): hàng đang gửi, các hàng vừa áp dụng
  // xong ("Đã áp dụng" tới khi sửa lại).
  const [applying, setApplying] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [rowFail, setRowFail] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLInputElement | null>());
  const { ask, dialog } = useConfirm();

  const reset = () => {
    setMode(effective.MODE);
    setDraft({});
    setEdited(new Set());
    setTyping(null);
    setServerErrors({});
    setLadderOpen(null);
    setLimitsOpen(null);
  };

  // Chưa sửa gì: theo giá trị mới (máy vừa áp dụng / người khác sửa).
  useEffect(() => {
    if (edited.size === 0) setMode(effective.MODE);
  }, [effective.MODE, edited.size]);

  // Đang chờ máy áp dụng: hỏi lại mỗi 30 s (trạng thái, "sau n phút").
  const pendingKeys = useMemo(() => new Set<string>(setting.pending), [setting.pending]);
  useEffect(() => {
    if (pendingKeys.size === 0) return;
    const t = setInterval(() => {
      setTick((x) => x + 1);
      void queryClient.invalidateQueries({
        queryKey: ['hybrid-setting', deviceId],
      });
    }, 30_000);
    return () => clearInterval(t);
  }, [pendingKeys.size, queryClient, deviceId]);

  /** Bản nháp đã áp quy tắc kéo theo; freeze = đang gõ, chưa kéo theo. */
  const build = (freeze: boolean): HybridConfig => {
    const c: HybridConfig = { ...effective };
    if (mode) c.MODE = mode;
    for (const f of FIELDS) {
      if (!edited.has(f.key)) continue;
      const raw = (draft[f.key] ?? '').trim();
      const v = raw === '' ? NaN : Number(raw.replace(',', '.'));
      c[f.key] = f.unit === 'V' ? Math.round(v * 10) / 10 : Math.round(v);
    }
    return pullAlong(c, freeze ? new Set([...edited, ...ALL_KEYS]) : edited, setting.fw);
  };
  const parsed = build(typing !== null);

  const errors: Partial<Record<HybridNumberKey, string>> = {
    ...validate(parsed, cfg, setting.fw),
  };
  for (const [k, m] of Object.entries(serverErrors)) if (m) errors[k as HybridNumberKey] = m;
  if (typing) delete errors[typing]; // báo khi rời ô

  const changesOf = (c: HybridConfig): HybridConfig => {
    const out: HybridConfig = {};
    if (c.MODE && c.MODE !== effective.MODE) out.MODE = c.MODE;
    for (const f of FIELDS) {
      const v = c[f.key];
      if (v !== undefined && Number.isFinite(v) && v !== effective[f.key]) out[f.key] = v;
    }
    return out;
  };
  const changes = changesOf(parsed);
  const changeCount = Object.keys(changes).length;

  const order: HybridNumberKey[] = [...modeFields(mode).map((f) => f.key), ...LADDER_KEYS, ...LIMIT_KEYS];
  const firstError = order.find((k) => errors[k]) ?? (Object.keys(errors)[0] as HybridNumberKey | undefined);

  const save = useMutation({
    mutationFn: (c: HybridConfig) => updateHybridSetting(deviceId, c),
    onSuccess: (data, c) => {
      queryClient.setQueryData(['hybrid-setting', deviceId], data);
      setApplied((s) => new Set([...s, ...Object.keys(c)]));
      void queryClient.invalidateQueries({
        queryKey: ['device-activity', 'hybrid', deviceId],
      });
      reset();
    },
    onError: (e) => {
      const list = isAxiosError(e)
        ? (e.response?.data?.errors as { key: string; message: string }[] | undefined)
        : undefined;
      setServerErrors(Object.fromEntries((list ?? []).map((x) => [x.key, x.message])));
    },
  });

  /** Cấu hình khi chỉ áp dụng [key]: ô khác giữ giá trị máy, trừ ô bị kéo theo để giữ thứ tự. */
  const rowConfig = (key: HybridNumberKey | 'MODE'): HybridConfig => {
    const final = build(false);
    const c: HybridConfig = { ...effective };
    if (key === 'MODE') {
      if (final.MODE) c.MODE = final.MODE;
      return c;
    }
    c[key] = final[key];
    return pullAlong(c, new Set([key]), setting.fw);
  };
  const rowChanged = (key: HybridNumberKey | 'MODE') =>
    (key === 'MODE' || edited.has(key)) && changesOf(rowConfig(key))[key] !== undefined;

  /** Nút "Áp dụng" cạnh một tham số: chỉ gửi khóa đó (+ ô bị kéo theo). */
  async function applyRow(key: HybridNumberKey | 'MODE') {
    if (hwTest || applying) return;
    setTyping(null);
    setRowFail(null);
    const c = rowConfig(key);
    const ch = changesOf(c);
    if (Object.keys(ch).length === 0) return;
    const errs = validate(c, cfg, setting.fw);
    if (Object.keys(errs).length > 0) {
      setServerErrors((x) => ({ ...x, ...errs }));
      return;
    }
    if (ch.MODE) {
      const ok = await ask({
        title: `Chuyển sang ${MODE_LABEL[ch.MODE]}?`,
        text: `Đang chạy: ${MODE_LABEL[effective.MODE ?? ''] ?? '—'}.\n\n${modeEffect(ch.MODE, c)}`,
        ok: 'Chuyển chế độ',
        danger: ch.MODE === 'OFF',
      });
      if (!ok) return;
    }
    setApplying(key);
    try {
      const data = await updateHybridSetting(deviceId, ch);
      queryClient.setQueryData(['hybrid-setting', deviceId], data);
      void queryClient.invalidateQueries({ queryKey: ['device-activity', 'hybrid', deviceId] });
      const keys = Object.keys(ch);
      setEdited((s) => new Set([...s].filter((k) => !keys.includes(k))));
      setDraft((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !keys.includes(k))));
      setServerErrors((x) => Object.fromEntries(Object.entries(x).filter(([k]) => !keys.includes(k))));
      setApplied((s) => new Set([...s, ...keys]));
    } catch (e) {
      const list = isAxiosError(e)
        ? (e.response?.data?.errors as { key: string; message: string }[] | undefined)
        : undefined;
      if (list?.length) setServerErrors((x) => ({ ...x, ...Object.fromEntries(list.map((v) => [v.key, v.message])) }));
      else
        setRowFail(
          (isAxiosError(e) ? (e.response?.data?.message as string | undefined) : undefined) ??
            'Không áp dụng được, hãy thử lại.'
        );
    } finally {
      setApplying(null);
    }
  }

  /** Nút Áp dụng / Đã áp dụng của một hàng. */
  const applyBtn = (key: HybridNumberKey | 'MODE') => {
    const changed = rowChanged(key);
    const done = !changed && applied.has(key);
    return (
      <button
        type="button"
        onClick={() => void applyRow(key)}
        disabled={!changed || applying !== null || save.isPending}
        className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap ${
          changed
            ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
            : done
              ? 'bg-green-50 text-green-700'
              : 'bg-gray-100 text-gray-400'
        }`}
      >
        {applying === key ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : done ? (
          <CheckCircle2 className="w-3.5 h-3.5" />
        ) : null}
        {done ? 'Đã áp dụng' : 'Áp dụng'}
      </button>
    );
  };

  /** Lỗi máy trả cho đúng hàng ($NAK,SET,ERR=…,KEY=…). */
  const nakOf = (k: string) => {
    const n = setting.lastNak;
    if (!n || n.of.startsWith('CMD') || n.key !== k || edited.has(k)) return undefined;
    return `Máy từ chối: ${NAK_LABEL[n.err] ?? n.err}`;
  };

  const setField = (key: HybridNumberKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setEdited((s) => new Set(s).add(key));
    setApplied((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    });
    setTyping(key);
    setServerErrors((s) => ({ ...s, [key]: '' }));
  };

  const undo = (key: HybridNumberKey | 'MODE') => {
    setEdited((s) => {
      const n = new Set(s);
      n.delete(key);
      return n;
    });
    if (key === 'MODE') setMode(effective.MODE);
    else setDraft((d) => ({ ...d, [key]: undefined }));
  };

  /** Mở mục chứa ô, cuộn tới và đặt con trỏ vào ô. */
  const jumpTo = (key: HybridNumberKey) => {
    if (LADDER_KEYS.includes(key)) setLadderOpen(true);
    if (LIMIT_KEYS.includes(key)) setLimitsOpen(true);
    requestAnimationFrame(() => {
      const el = refs.current.get(key);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.focus({ preventScroll: true });
    });
  };

  async function onSave() {
    if (hwTest) return;
    setTyping(null);
    const final = build(false);
    const c = changesOf(final);
    if (Object.keys(c).length === 0 || Object.keys(validate(final, cfg, setting.fw)).length > 0) return;
    if (c.MODE) {
      const ok = await ask({
        title: `Chuyển sang ${MODE_LABEL[c.MODE]}?`,
        text: `Đang chạy: ${MODE_LABEL[effective.MODE ?? ''] ?? '—'}.\n\n${modeEffect(c.MODE, final)}`,
        ok: 'Chuyển và lưu',
        danger: c.MODE === 'OFF',
      });
      if (!ok) return;
    }
    save.mutate(c);
  }

  // Giá trị hiển thị: ô đã sửa = chữ đang gõ; ô khác = giá trị (kể cả tự chỉnh).
  const textOf = (k: HybridNumberKey) => (edited.has(k) ? (draft[k] ?? '') : fieldText(FIELD[k], parsed[k]));
  const isPulled = (k: HybridNumberKey) => !edited.has(k) && parsed[k] !== effective[k];
  const canUndo = (k: HybridNumberKey) => edited.has(k) && parsed[k] !== effective[k];
  const inputProps = (k: HybridNumberKey) => ({
    value: textOf(k),
    field: FIELD[k],
    error: errors[k],
    inputRef: (el: HTMLInputElement | null) => {
      refs.current.set(k, el);
    },
    onChange: (v: string) => setField(k, v),
    onCommit: () => {
      setTyping((t) => (t === k ? null : t));
      setFocused(null);
    },
  });
  const powerField = (k: HybridNumberKey) => (
    <div key={k} onFocus={() => setFocused(k)}>
      <PowerField
        {...inputProps(k)}
        hint={rangeHint(k, parsed, cfg, edited, setting.fw)}
        pending={pendingKeys.has(k)}
        pulled={isPulled(k)}
        canUndo={canUndo(k)}
        onUndo={() => undo(k)}
        action={applyBtn(k)}
        nak={nakOf(k)}
      />
    </div>
  );

  const touched = (keys: HybridNumberKey[]) =>
    keys.some((k) => edited.has(k) || errors[k] || pendingKeys.has(k) || parsed[k] !== effective[k]);
  const ladderShown = ladderOpen ?? (LADDER_KEYS.some((k) => modeUsesKey(mode, k)) || touched(LADDER_KEYS));
  const limitsShown = limitsOpen ?? touched(LIMIT_KEYS);

  const local = setting.src === 'LOCAL' || cfg?.SRC === 'LOCAL';
  // Lỗi có khóa hiện ngay tại hàng đó (nakOf); ở đây chỉ lỗi chung.
  const nak = setting.lastNak && !setting.lastNak.of.startsWith('CMD') && !setting.lastNak.key ? setting.lastNak : null;
  const notices = [
    ...(local ? ['Máy đang chỉnh tại chỗ: trên máy chọn "Cai dat tu = APP" để áp dụng cài đặt từ web.'] : []),
    ...(nak
      ? [
          `Máy từ chối${nak.key ? ` ${FIELD[nak.key as HybridNumberKey]?.label ?? nak.key}` : ''}: ${NAK_LABEL[nak.err] ?? nak.err}`,
        ]
      : []),
  ];

  if (hwTest) {
    // 5.4.30: máy đang test phần cứng: chỉ xem, ẩn mọi ô nhập, không gửi gì.
    return (
      <div className="space-y-3">
        <div className={`${CARD} p-4 sm:p-5`}>
          <p className="flex items-center gap-2 text-base font-semibold text-blue-800">
            <Wrench className="w-5 h-5" /> {HWTEST_TEXT}
          </p>
          <p className="mt-1 text-sm text-gray-600">{HWTEST_HINT}</p>
          <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Trang tự hiện lại cài đặt khi máy test xong.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rowFail && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{rowFail}</p>}
      <ModeCard
        mode={mode}
        current={effective.MODE}
        pending={pendingKeys.has('MODE')}
        status={
          <ApplyStatus
            pending={pendingKeys.size > 0}
            online={online}
            requestAt={setting.requestAt}
            cfgAt={setting.cfgAt}
          />
        }
        notices={notices}
        onPick={() => setPicking(true)}
        onUndo={() => undo('MODE')}
        action={mode !== effective.MODE || applied.has('MODE') ? applyBtn('MODE') : undefined}
      >
        {modeFields(mode).length > 0
          ? modeFields(mode).map((f) => powerField(f.key))
          : mode === 'OFFGRID' && (
              <p className="text-xs text-gray-500">
                Chế độ này dùng Pin ngắt xả / Pin chạy lại ở mục Ngưỡng điện áp pin.
              </p>
            )}
      </ModeCard>

      <section className={`${CARD} px-4 sm:px-5 divide-y divide-gray-100`}>
        <Collapsible
          title="Ngưỡng điện áp pin"
          summary={`Ngắt xả ${fmtVolt(parsed.VCUT)} · chạy lại ${fmtVolt(parsed.VRES)} · dừng xả ${fmtVolt(parsed.VEXP)}`}
          open={ladderShown}
          onToggle={() => setLadderOpen(!ladderShown)}
          badge={LADDER_KEYS.some((k) => pendingKeys.has(k)) ? <PendingBadge /> : undefined}
        >
          <Ladder
            cfg={cfg}
            parsed={parsed}
            effective={effective}
            mode={mode}
            edited={edited}
            errors={errors}
            pending={pendingKeys}
            focusKey={focused}
            hint={(k) => rangeHint(k, parsed, cfg, edited, setting.fw)}
            input={(k) => (
              <div onFocus={() => setFocused(k)} className="flex flex-col items-end gap-1.5">
                <NumInput {...inputProps(k)} compact />
                {applyBtn(k)}
              </div>
            )}
            onUndo={undo}
            nakOf={nakOf}
          />
        </Collapsible>
        <Collapsible
          title="Giới hạn công suất"
          summary={`Phát tối đa ${fmtWatt(parsed.PMAX)} · sạc tối đa ${fmtWatt(parsed.PCMAX)}`}
          open={limitsShown}
          onToggle={() => setLimitsOpen(!limitsShown)}
          badge={LIMIT_KEYS.some((k) => pendingKeys.has(k)) ? <PendingBadge /> : undefined}
        >
          <div className="space-y-4">{LIMIT_KEYS.map(powerField)}</div>
        </Collapsible>
        <Collapsible
          title="Thông tin máy"
          summary={`Hệ pin ${cfg?.SYS ?? '--'} V · ${cfg?.FHZ ?? '--'} Hz · áp sạc ${fmtVolt(cfg?.VCV)}`}
          open={infoOpen}
          onToggle={() => setInfoOpen((v) => !v)}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {READONLY.map((r) => (
              <div key={r.key} className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-[11px] text-gray-500">{r.label}</p>
                <p className="text-sm font-semibold text-gray-900 tabular-nums">
                  {cfg?.[r.key] ? `${cfg[r.key]} ${r.unit ?? ''}` : '—'}
                </p>
              </div>
            ))}
          </div>
        </Collapsible>
      </section>

      <HybridAdvancedSection deviceId={deviceId} online={online} />

      {/* Mỗi hàng có nút Áp dụng riêng (5.4.30): thanh dưới chỉ khi còn từ 2 thay đổi hoặc có lỗi. */}
      {(changeCount > 1 || save.isPending || firstError) && (
        <div className={`sticky bottom-3 z-20 ${CARD} bg-white/95 p-3 shadow-lg`}>
          <p className="mb-2 text-xs text-gray-500">
            Mỗi mục có nút Áp dụng riêng. Thiết bị gửi xuống máy, máy tự lưu lại.
          </p>
          <div className="flex items-center gap-3">
            {changeCount > 0 && (
              <button
                type="button"
                onClick={reset}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
              >
                Hoàn tác
              </button>
            )}
            <button
              type="button"
              disabled={save.isPending || (!firstError && changeCount === 0)}
              onClick={() => (firstError ? jumpTo(firstError) : void onSave())}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-white disabled:opacity-50 ${
                firstError ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {save.isPending && <RefreshCw className="w-4 h-4 animate-spin" />}
              {firstError
                ? `${Object.keys(errors).length > 1 ? `Còn ${Object.keys(errors).length} lỗi` : 'Sửa lỗi'}: ${FIELD[firstError]?.label ?? firstError} ›`
                : changeCount > 1
                  ? `Áp dụng tất cả (${changeCount})`
                  : 'Áp dụng'}
            </button>
          </div>
          {save.isError && Object.keys(serverErrors).length === 0 && (
            <p className="mt-2 text-xs text-red-600">Không lưu được cài đặt, hãy thử lại.</p>
          )}
        </div>
      )}

      {picking && (
        <ModePicker
          mode={mode}
          fw={setting.fw}
          onClose={() => setPicking(false)}
          onSelect={(m) => {
            setMode(m);
            setEdited((s) => new Set(s).add('MODE'));
            setLadderOpen(null); // mở lại theo chế độ mới
            setPicking(false);
          }}
        />
      )}
      {dialog}
    </div>
  );
}
