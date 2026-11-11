import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { RefreshCw } from 'lucide-react';
import { updateHybridSetting } from '../../../services/api';
import type { HybridConfig, HybridLatest, HybridMode, HybridNumberKey, HybridSetting } from '../../../types';
import {
  FIELD,
  FIELDS,
  LADDER_KEYS,
  LIMIT_KEYS,
  MODE_LABEL,
  NAK_LABEL,
  READONLY,
  configFromCfg,
  fieldText,
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
      void queryClient.invalidateQueries({ queryKey: ['hybrid-setting', deviceId] });
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
    return pullAlong(c, freeze ? new Set([...edited, ...ALL_KEYS]) : edited);
  };
  const parsed = build(typing !== null);

  const errors: Partial<Record<HybridNumberKey, string>> = { ...validate(parsed, cfg) };
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
    onSuccess: (data) => {
      queryClient.setQueryData(['hybrid-setting', deviceId], data);
      void queryClient.invalidateQueries({ queryKey: ['device-activity', 'hybrid', deviceId] });
      reset();
    },
    onError: (e) => {
      const list = isAxiosError(e)
        ? (e.response?.data?.errors as { key: string; message: string }[] | undefined)
        : undefined;
      setServerErrors(Object.fromEntries((list ?? []).map((x) => [x.key, x.message])));
    },
  });

  const setField = (key: HybridNumberKey, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setEdited((s) => new Set(s).add(key));
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
    setTyping(null);
    const final = build(false);
    const c = changesOf(final);
    if (Object.keys(c).length === 0 || Object.keys(validate(final, cfg)).length > 0) return;
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
        hint={rangeHint(k, parsed, cfg, edited)}
        pending={pendingKeys.has(k)}
        pulled={isPulled(k)}
        canUndo={canUndo(k)}
        onUndo={() => undo(k)}
      />
    </div>
  );

  const touched = (keys: HybridNumberKey[]) =>
    keys.some((k) => edited.has(k) || errors[k] || pendingKeys.has(k) || parsed[k] !== effective[k]);
  const ladderShown = ladderOpen ?? (LADDER_KEYS.some((k) => modeUsesKey(mode, k)) || touched(LADDER_KEYS));
  const limitsShown = limitsOpen ?? touched(LIMIT_KEYS);

  const local = setting.src === 'LOCAL' || cfg?.SRC === 'LOCAL';
  const nak = setting.lastNak && !setting.lastNak.of.startsWith('CMD') ? setting.lastNak : null;
  const notices = [
    ...(local ? ['Máy đang chỉnh tại chỗ: trên máy chọn "Cai dat tu = APP" để áp dụng cài đặt từ web.'] : []),
    ...(nak
      ? [`Máy từ chối${nak.key ? ` ${FIELD[nak.key as HybridNumberKey]?.label ?? nak.key}` : ''}: ${NAK_LABEL[nak.err] ?? nak.err}`]
      : []),
  ];

  return (
    <div className="space-y-3">
      <ModeCard
        mode={mode}
        current={effective.MODE}
        pending={pendingKeys.has('MODE')}
        status={
          <ApplyStatus pending={pendingKeys.size > 0} online={online} requestAt={setting.requestAt} cfgAt={setting.cfgAt} />
        }
        notices={notices}
        onPick={() => setPicking(true)}
        onUndo={() => undo('MODE')}
      >
        {modeFields(mode).length > 0
          ? modeFields(mode).map((f) => powerField(f.key))
          : mode === 'OFFGRID' && (
              <p className="text-xs text-gray-500">Chế độ này dùng Pin ngắt xả / Pin chạy lại ở mục Ngưỡng điện áp pin.</p>
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
            hint={(k) => rangeHint(k, parsed, cfg, edited)}
            input={(k) => (
              <div onFocus={() => setFocused(k)}>
                <NumInput {...inputProps(k)} compact />
              </div>
            )}
            onUndo={undo}
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

      {(changeCount > 0 || save.isPending || firstError) && (
        <div className={`sticky bottom-3 z-20 ${CARD} bg-white/95 p-3 shadow-lg`}>
          <p className="mb-2 text-xs text-gray-500">Thiết bị gửi thay đổi xuống máy, máy tự lưu lại.</p>
          <div className="flex items-center gap-3">
            {changeCount > 0 && (
              <button type="button" onClick={reset} className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
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
                  ? `Lưu ${changeCount} thay đổi`
                  : 'Lưu'}
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
