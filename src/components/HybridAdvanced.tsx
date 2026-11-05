import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  BatteryCharging,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Play,
  Power,
  RotateCcw,
  Ruler,
  Save,
  ShieldAlert,
  SlidersHorizontal,
  UtilityPole,
  X,
} from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import {
  getHybridAdvanced,
  readHybridAdvanced,
  sendHybridCommand,
  setHybridAdvanced,
  updateHybridSetting,
} from '../services/api';
import type { HybridAdvanced as Adv, HybridMode } from '../types';
import { ADV_CAL, ADV_GROUPS, ADV_LABEL, MODE_LABEL, advErrorText } from '../services/hinvlf';

/**
 * Cài đặt nâng cao (STM32 >= 5.4.12, $GET,ADV / $SETADV): mật khẩu, hệ pin, tần
 * số, biến áp, ngưỡng pin, cửa sổ lưới, hiệu chỉnh 5 kênh đo, cài đặt gốc.
 * Mật khẩu chỉ giữ trong bộ nhớ khi menu đang mở (không lưu ở đâu).
 */

type Result = { ok: boolean; err?: string; key?: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chờ kết quả của lệnh vừa gửi (ACK / NAK), tối đa ~8 s. */
async function waitResult(deviceId: string, requestAt: string): Promise<{ r: Result; a: Adv | null }> {
  const since = new Date(requestAt).getTime();
  let last: Adv | null = null;
  for (let i = 0; i < 12; i++) {
    await sleep(700);
    try {
      last = await getHybridAdvanced(deviceId);
      if (last.result && new Date(last.result.at).getTime() >= since) return { r: last.result, a: last };
    } catch {
      // thử lại
    }
  }
  return { r: { ok: false, err: 'TIMEOUT' }, a: last };
}

function errText(e: unknown): string {
  if (isAxiosError(e)) {
    const m = e.response?.data?.message;
    if (typeof m === 'string') return m;
  }
  return 'Không gửi được lệnh, hãy thử lại.';
}

export function HybridAdvancedSection({ deviceId, online }: { deviceId: string; online: boolean }) {
  const { data } = useQuery({
    queryKey: ['hybrid-advanced', deviceId],
    queryFn: () => getHybridAdvanced(deviceId),
    staleTime: 30_000,
  });
  const [open, setOpen] = useState(false);
  if (data && !data.supported) return null; // STM32 cũ: không có menu nâng cao
  const local = data?.src === 'LOCAL';
  const disabled = local || !online;
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-60 disabled:hover:border-gray-200 disabled:hover:bg-white"
      >
        <span className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
          <SlidersHorizontal className="w-5 h-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            Cài đặt nâng cao <Lock className="w-3.5 h-3.5 text-gray-400" />
          </span>
          <span className="block text-xs text-gray-500 mt-0.5">
            {local
              ? 'Chọn "Cai dat tu = APP" trên máy để mở mục này'
              : !online
                ? 'Thiết bị đang mất kết nối'
                : 'Hệ pin, biến áp, ngưỡng pin, cửa sổ lưới, hiệu chỉnh'}
          </span>
        </span>
        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
      </button>
      {open && <AdvancedDialog deviceId={deviceId} onClose={() => setOpen(false)} />}
    </section>
  );
}

type Ask = { title: string; text: string; list?: string[]; ok: string };

const GROUP_ICON: Record<string, typeof Cpu> = {
  'Hệ thống': Cpu,
  'Biến áp': Cable,
  'Ngưỡng pin': BatteryCharging,
  'Cửa sổ lưới': UtilityPole,
};

const INPUT =
  'w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const BTN = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors';
const BTN_PRIMARY = `${BTN} bg-blue-600 text-white hover:bg-blue-700`;
const BTN_SECONDARY = `${BTN} border border-gray-300 text-gray-700 hover:bg-gray-50`;
const BTN_DANGER = `${BTN} border border-red-200 text-red-600 hover:bg-red-50`;

function SectionTitle({ icon: Icon, children }: { icon: typeof Cpu; children: React.ReactNode }) {
  return (
    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
      <Icon className="w-4 h-4 text-gray-500" /> {children}
    </h4>
  );
}

function Note({ tone, children }: { tone: 'info' | 'ok' | 'error' | 'warn'; children: React.ReactNode }) {
  const cls = {
    info: 'text-gray-500 bg-blue-50 border-blue-100',
    ok: 'text-green-700 bg-green-50 border-green-100',
    error: 'text-red-700 bg-red-50 border-red-100',
    warn: 'text-amber-700 bg-amber-50 border-amber-100',
  }[tone];
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'info' ? ShieldAlert : AlertTriangle;
  return (
    <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${cls}`}>
      <Icon className="w-4 h-4 mt-px shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

function AdvancedDialog({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const pwRef = useRef(''); // chỉ trong bộ nhớ, xóa khi đóng
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [prevMode, setPrevMode] = useState<HybridMode | null>(null);
  const [unsaved, setUnsaved] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [calDraft, setCalDraft] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [confirm, setConfirm] = useState<(Ask & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = (q: Ask) => new Promise<boolean>((resolve) => setConfirm({ ...q, resolve }));

  useEffect(() => () => { pwRef.current = ''; }, []);

  // Số đo: mỗi 1 s khi đang mở trang hiệu chỉnh, không thì mỗi 3 s.
  const { data: adv } = useQuery({
    queryKey: ['hybrid-advanced', deviceId],
    queryFn: () => getHybridAdvanced(deviceId),
    enabled: unlocked,
    refetchInterval: calOpen ? 1000 : 3000,
  });
  const a = adv?.adv ?? null;

  // Trang hiệu chỉnh mở: máy hỏi $GET,ADV mỗi giây (gia hạn mỗi 20 s).
  useEffect(() => {
    if (!unlocked || !calOpen) return;
    void readHybridAdvanced(deviceId, 30).catch(() => {});
    const t = setInterval(() => void readHybridAdvanced(deviceId, 30).catch(() => {}), 20_000);
    return () => clearInterval(t);
  }, [unlocked, calOpen, deviceId]);

  const running = !(adv?.mode === 'OFF' && adv?.ist === 'STANDBY');

  const changes = useMemo(() => {
    const out: Record<string, string> = {};
    if (!a) return out;
    for (const g of ADV_GROUPS) {
      for (const f of g.fields) {
        const v = draft[f.key];
        if (v === undefined || v === '') continue;
        const cur = a[f.key];
        const same = f.options ? v === cur : Number(v.replace(',', '.')) === Number(cur);
        if (!same) out[f.key] = f.options ? v : v.replace(',', '.');
      }
    }
    return out;
  }, [draft, a]);

  const close = () => {
    pwRef.current = '';
    onClose();
  };

  async function send(set?: Record<string, string>): Promise<Result> {
    const r0 = await setHybridAdvanced(deviceId, pwRef.current, set);
    const { r } = await waitResult(deviceId, r0.requestAt);
    void queryClient.invalidateQueries({ queryKey: ['hybrid-advanced', deviceId] });
    void queryClient.invalidateQueries({ queryKey: ['hybrid-latest', deviceId] });
    return r;
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!pwInput) return;
    setBusy('unlock');
    setMessage(null);
    pwRef.current = pwInput;
    try {
      void readHybridAdvanced(deviceId).catch(() => {});
      const r = await send();
      if (r.ok) {
        setUnlocked(true);
        setPwInput('');
      } else {
        pwRef.current = '';
        setMessage({ ok: false, text: advErrorText(r.err, r.key) });
      }
    } catch (err) {
      pwRef.current = '';
      setMessage({ ok: false, text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function apply(set: Record<string, string>, label: string) {
    const needConfirm = ADV_GROUPS.flatMap((g) => g.fields).filter((f) => f.confirm && set[f.key] !== undefined);
    if (set.FACT) {
      const ok = await ask({
        title: 'Khôi phục cài đặt gốc?',
        text: 'Cài đặt người dùng về mặc định. Máy sẽ ở chế độ Tắt sau khi khôi phục.',
        ok: 'Khôi phục',
      });
      if (!ok) return;
    } else if (needConfirm.length) {
      const ok = await ask({
        title: 'Xác nhận thay đổi',
        text: 'Đặt sai các mục này có thể làm hỏng pin:',
        list: needConfirm.map((f) => `${f.label}: ${set[f.key]} ${f.unit}`),
        ok: 'Áp dụng',
      });
      if (!ok) return;
    }
    setBusy(label);
    setMessage(null);
    try {
      const r = await send(set);
      if (r.ok) {
        setUnsaved(true);
        setDraft({});
        setMessage({
          ok: true,
          text: set.SYS
            ? 'Đã áp dụng. Hệ pin mới đã nạp lại các ngưỡng pin, hãy kiểm tra lại trong trang Cài đặt.'
            : 'Đã áp dụng. Bấm "Lưu vào máy" để giữ lại sau khi máy khởi động lại.',
        });
      } else {
        setMessage({ ok: false, text: advErrorText(r.err, r.key) });
        if (r.err === 'PW' || r.err === 'PWLOCK') {
          pwRef.current = '';
          setUnlocked(false);
        }
      }
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function turnOff() {
    if (!adv?.mode) return;
    setBusy('off');
    setMessage(null);
    try {
      if (adv.mode !== 'OFF') setPrevMode(adv.mode as HybridMode);
      await updateHybridSetting(deviceId, { MODE: 'OFF' });
      for (let i = 0; i < 20; i++) {
        await sleep(1000);
        const s = await getHybridAdvanced(deviceId);
        queryClient.setQueryData(['hybrid-advanced', deviceId], s);
        if (s.mode === 'OFF' && s.ist === 'STANDBY') {
          setMessage({ ok: true, text: 'Máy đã tắt, có thể đổi cài đặt.' });
          return;
        }
      }
      setMessage({ ok: false, text: 'Máy chưa tắt. Kiểm tra lại trạng thái máy.' });
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function saveToMachine() {
    setBusy('save');
    try {
      await sendHybridCommand(deviceId, 'SAVE');
      setUnsaved(false);
      setMessage({ ok: true, text: 'Đã gửi lệnh lưu vào máy.' });
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  async function runAgain() {
    if (!prevMode) return;
    setBusy('run');
    try {
      await updateHybridSetting(deviceId, { MODE: prevMode });
      setMessage({ ok: true, text: `Đã gửi lệnh chạy lại (${MODE_LABEL[prevMode] ?? prevMode}).` });
      setPrevMode(null);
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
      onClick={close}
    >
      <div
        className="bg-white w-full sm:max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-blue-600 shrink-0" />
              Cài đặt nâng cao
            </h3>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{deviceId}</p>
          </div>
          <button onClick={close} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {message && <Note tone={message.ok ? 'ok' : 'error'}>{message.text}</Note>}

          {!unlocked ? (
            <form onSubmit={unlock} className="space-y-4">
              <Note tone="info">
                Các mục này ảnh hưởng tới an toàn pin và phần cứng. Nhập mật khẩu menu nâng cao của máy (giống trên
                màn hình LCD). Sai 5 lần thì máy khóa 5 phút.
              </Note>
              <section className="space-y-3">
                <SectionTitle icon={Lock}>Mật khẩu</SectionTitle>
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type={showPw ? 'text' : 'password'}
                      autoComplete="off"
                      value={pwInput}
                      onChange={(e) => setPwInput(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 16))}
                      placeholder="Mật khẩu menu nâng cao"
                      className={`${INPUT} pr-10`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="submit" disabled={!pwInput || busy !== null} className={`${BTN_PRIMARY} whitespace-nowrap`}>
                    {busy === 'unlock' ? <LoadingSpinner size="sm" className="text-white" /> : <KeyRound className="w-4 h-4" />}
                    Mở menu
                  </button>
                </div>
              </section>
            </form>
          ) : (
            <>
              {running && (
                <Note tone="warn">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Máy đang chạy. Phải tắt máy để đổi các mục dưới đây (trừ hiệu chỉnh).</span>
                    <button
                      type="button"
                      onClick={() => void turnOff()}
                      disabled={busy !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      {busy === 'off' ? <LoadingSpinner size="sm" className="text-white" /> : <Power className="w-3.5 h-3.5" />}
                      Tắt máy
                    </button>
                  </div>
                </Note>
              )}

              {(unsaved || prevMode) && (
                <div className="flex flex-wrap gap-2">
                  {unsaved && (
                    <button type="button" onClick={() => void saveToMachine()} disabled={busy !== null} className={BTN_PRIMARY}>
                      {busy === 'save' ? <LoadingSpinner size="sm" className="text-white" /> : <Save className="w-4 h-4" />}
                      Lưu vào máy
                    </button>
                  )}
                  {prevMode && (
                    <button type="button" onClick={() => void runAgain()} disabled={busy !== null} className={BTN_SECONDARY}>
                      {busy === 'run' ? <LoadingSpinner size="sm" /> : <Play className="w-4 h-4" />}
                      Chạy lại ({MODE_LABEL[prevMode] ?? prevMode})
                    </button>
                  )}
                </div>
              )}

              {!a ? (
                <div className="flex justify-center items-center gap-2 py-6 text-sm text-gray-500">
                  <LoadingSpinner size="sm" /> Đang đọc cài đặt từ máy…
                </div>
              ) : (
                <>
                  {ADV_GROUPS.map((g) => (
                    <section key={g.title} className="space-y-3">
                      <SectionTitle icon={GROUP_ICON[g.title] ?? SlidersHorizontal}>{g.title}</SectionTitle>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {g.fields.map((f) => {
                          const value = draft[f.key] ?? a[f.key] ?? '';
                          const changed = changes[f.key] !== undefined;
                          return (
                            <label key={f.key} className="block">
                              <span
                                className={`flex items-center gap-1 text-xs font-medium mb-1 ${changed ? 'text-blue-700' : 'text-gray-600'}`}
                              >
                                {f.label}
                                {f.confirm && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                              </span>
                              <div className="flex items-center gap-2">
                                {f.options ? (
                                  <select
                                    value={value}
                                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                    className={`${INPUT} ${changed ? 'border-blue-400' : ''}`}
                                  >
                                    {!f.options.some((o) => o.value === value) && <option value={value}>{value || '—'}</option>}
                                    {f.options.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step={f.step}
                                    value={value}
                                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                    className={`${INPUT} tabular-nums ${changed ? 'border-blue-400' : ''}`}
                                  />
                                )}
                                {f.unit && !f.options && <span className="text-sm text-gray-500 w-8 shrink-0">{f.unit}</span>}
                              </div>
                              {(f.hint || (f.key === 'LF' && a.LFID)) && (
                                <span className="mt-1 block text-[11px] text-gray-400">
                                  {f.key === 'LF' && a.LFID ? `Máy đo được: ${a.LFID} mH · ` : ''}
                                  {f.hint ?? ''}
                                </span>
                              )}
                              {f.key === 'HALL' && value === 'YES' && a.HALLF === '0' && (
                                <span className="mt-1 block text-[11px] text-red-600">Không thấy Hall, máy sẽ báo lỗi cảm biến.</span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void apply(changes, 'apply')}
                        disabled={Object.keys(changes).length === 0 || busy !== null}
                        className={BTN_PRIMARY}
                      >
                        {busy === 'apply' ? <LoadingSpinner size="sm" className="text-white" /> : <Check className="w-4 h-4" />}
                        Áp dụng
                      </button>
                      {Object.keys(changes).length > 0 && (
                        <button type="button" onClick={() => setDraft({})} className={BTN_SECONDARY}>
                          Hoàn tác
                        </button>
                      )}
                    </div>
                    {Object.keys(changes).length > 0 && (
                      <p className="text-xs text-gray-500">
                        Sẽ đổi: {Object.keys(changes).map((k) => ADV_LABEL[k] ?? k).join(', ')}
                      </p>
                    )}
                  </div>

                  <section className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setCalOpen((v) => !v)}
                      className="w-full flex items-center justify-between gap-2 text-left"
                    >
                      <SectionTitle icon={Ruler}>Hiệu chỉnh số đo</SectionTitle>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${calOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <p className="text-xs text-gray-500">
                      Đo bằng đồng hồ chuẩn rồi nhập số đọc được. Áp dụng ngay, không cần tắt máy.
                    </p>
                    {calOpen && (
                      <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                        {ADV_CAL.map((c) => {
                          const measured = a[c.measured];
                          const v = calDraft[c.key] ?? measured ?? '';
                          return (
                            <li key={c.key} className="flex flex-wrap items-center gap-3 px-3 py-2">
                              <div className="min-w-[8rem] flex-1">
                                <p className="text-sm text-gray-900">{c.label}</p>
                                <p className="text-xs text-gray-400 tabular-nums">
                                  Máy đo {measured ?? '—'} {c.unit} · hệ số {a[c.factor] ?? '—'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step={c.decimals === 2 ? 0.01 : 0.1}
                                  value={v}
                                  onChange={(e) => setCalDraft((d) => ({ ...d, [c.key]: e.target.value }))}
                                  className={`${INPUT} w-24 tabular-nums`}
                                />
                                <span className="text-sm text-gray-500 w-3">{c.unit}</span>
                                <button
                                  type="button"
                                  disabled={!v || busy !== null}
                                  aria-label={`Hiệu chỉnh ${c.label}`}
                                  onClick={() =>
                                    void apply({ [c.key]: String(v).replace(',', '.') }, c.key).then(() =>
                                      setCalDraft((d) => {
                                        const n = { ...d };
                                        delete n[c.key];
                                        return n;
                                      })
                                    )
                                  }
                                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shrink-0 disabled:opacity-50"
                                >
                                  {busy === c.key ? <LoadingSpinner size="sm" className="text-white" /> : <Check className="w-4 h-4" />}
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>

                  <section className="space-y-3">
                    <SectionTitle icon={RotateCcw}>Cài đặt gốc</SectionTitle>
                    <p className="text-xs text-gray-500">
                      Đưa cài đặt người dùng về mặc định, giữ hệ pin, tần số, biến áp và hiệu chỉnh. Máy để ở chế độ Tắt.
                    </p>
                    <button type="button" onClick={() => void apply({ FACT: '1' }, 'fact')} disabled={busy !== null} className={BTN_DANGER}>
                      {busy === 'fact' ? <LoadingSpinner size="sm" /> : <RotateCcw className="w-4 h-4" />}
                      Khôi phục cài đặt gốc
                    </button>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {confirm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{confirm.title}</h3>
            <p className="text-gray-600 mb-2">{confirm.text}</p>
            {confirm.list && (
              <ul className="mb-4 text-sm text-gray-800 list-disc pl-5">
                {confirm.list.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            <div className="flex space-x-3 mt-4">
              <button
                type="button"
                onClick={() => {
                  confirm.resolve(false);
                  setConfirm(null);
                }}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => {
                  confirm.resolve(true);
                  setConfirm(null);
                }}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
              >
                {confirm.ok}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
