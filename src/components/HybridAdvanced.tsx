import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  KeyRound,
  Lock,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Save,
  SlidersHorizontal,
  X,
} from 'lucide-react';
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
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={local || !online}
        className="w-full flex items-center justify-between gap-3 p-4 text-left disabled:opacity-60"
      >
        <span className="flex items-center gap-3">
          <SlidersHorizontal className="w-5 h-5 text-gray-500" />
          <span>
            <span className="block text-sm font-semibold text-gray-900">Cài đặt nâng cao</span>
            <span className="block text-xs text-gray-500">
              {local
                ? 'Chọn "Cai dat tu = APP" trên máy để mở mục này'
                : !online
                  ? 'Thiết bị đang mất kết nối'
                  : 'Hệ pin, biến áp, ngưỡng pin, cửa sổ lưới, hiệu chỉnh — cần mật khẩu'}
            </span>
          </span>
        </span>
        <Lock className="w-4 h-4 text-gray-400" />
      </button>
      {open && <AdvancedDialog deviceId={deviceId} onClose={() => setOpen(false)} />}
    </section>
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
      if (!window.confirm('Đưa cài đặt người dùng về mặc định? Máy sẽ ở chế độ Tắt sau khi khôi phục.')) return;
    } else if (needConfirm.length) {
      const list = needConfirm.map((f) => `${f.label}: ${set[f.key]} ${f.unit}`).join('\n');
      if (!window.confirm(`Đặt sai các mục này có thể làm hỏng pin. Xác nhận?\n\n${list}`)) return;
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">Cài đặt nâng cao</h3>
          <button type="button" onClick={close} aria-label="Đóng" className="p-2 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {message && (
            <div
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                message.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {message.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
              <p>{message.text}</p>
            </div>
          )}

          {!unlocked ? (
            <form onSubmit={unlock} className="space-y-3">
              <p className="text-sm text-gray-600">
                Các mục này ảnh hưởng tới an toàn pin và phần cứng. Nhập mật khẩu menu nâng cao của máy (giống trên LCD).
              </p>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Mật khẩu</span>
                <input
                  type="password"
                  autoComplete="off"
                  inputMode="numeric"
                  value={pwInput}
                  onChange={(e) => setPwInput(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 16))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-blue-200"
                  autoFocus
                />
              </label>
              <button
                type="submit"
                disabled={!pwInput || busy !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy === 'unlock' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                Mở menu
              </button>
            </form>
          ) : (
            <>
              {running && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                  <p>Máy đang chạy. Phải tắt máy để đổi các mục dưới đây (trừ hiệu chỉnh).</p>
                  <button
                    type="button"
                    onClick={() => void turnOff()}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {busy === 'off' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                    Tắt máy
                  </button>
                </div>
              )}

              {(unsaved || prevMode) && (
                <div className="flex flex-wrap gap-2">
                  {unsaved && (
                    <button
                      type="button"
                      onClick={() => void saveToMachine()}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" /> Lưu vào máy
                    </button>
                  )}
                  {prevMode && (
                    <button
                      type="button"
                      onClick={() => void runAgain()}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <Play className="w-4 h-4" /> Chạy lại ({MODE_LABEL[prevMode] ?? prevMode})
                    </button>
                  )}
                </div>
              )}

              {!a ? (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Đang đọc cài đặt từ máy…
                </p>
              ) : (
                <>
                  {ADV_GROUPS.map((g) => (
                    <section key={g.title}>
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">{g.title}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {g.fields.map((f) => {
                          const value = draft[f.key] ?? a[f.key] ?? '';
                          const changed = changes[f.key] !== undefined;
                          return (
                            <label
                              key={f.key}
                              className={`block rounded-xl border p-3 ${changed ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'}`}
                            >
                              <span className="text-xs font-medium text-gray-600">{f.label}</span>
                              <div className="mt-1 flex items-center gap-2">
                                {f.options ? (
                                  <select
                                    value={value}
                                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base bg-white"
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
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base tabular-nums"
                                  />
                                )}
                                {f.unit && <span className="text-sm text-gray-500 w-8">{f.unit}</span>}
                              </div>
                              <span className="mt-1 block text-[11px] text-gray-400">
                                {f.key === 'LF' && a.LFID ? `Máy đo được: ${a.LFID} mH · ` : ''}
                                {f.hint ?? ''}
                              </span>
                              {f.key === 'HALL' && value === 'YES' && a.HALLF === '0' && (
                                <span className="mt-1 block text-[11px] text-red-600">
                                  Không thấy Hall, máy sẽ báo lỗi cảm biến.
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void apply(changes, 'apply')}
                      disabled={Object.keys(changes).length === 0 || busy !== null}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {busy === 'apply' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Áp dụng {Object.keys(changes).length ? `(${Object.keys(changes).map((k) => ADV_LABEL[k] ?? k).join(', ')})` : ''}
                    </button>
                    {Object.keys(changes).length > 0 && (
                      <button type="button" onClick={() => setDraft({})} className="text-sm text-gray-500 hover:text-gray-700">
                        Hoàn tác
                      </button>
                    )}
                  </div>

                  <section className="rounded-xl border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setCalOpen((v) => !v)}
                      className="w-full flex items-center justify-between p-3 text-left"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">Hiệu chỉnh số đo</span>
                        <span className="block text-xs text-gray-500">
                          Đo bằng đồng hồ chuẩn rồi nhập số đọc được. Áp dụng ngay, không cần tắt máy.
                        </span>
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${calOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {calOpen && (
                      <div className="border-t divide-y">
                        {ADV_CAL.map((c) => {
                          const measured = a[c.measured];
                          const v = calDraft[c.key] ?? measured ?? '';
                          return (
                            <div key={c.key} className="p-3 flex flex-wrap items-end gap-3">
                              <div className="min-w-[8rem] flex-1">
                                <p className="text-sm font-medium text-gray-900">{c.label}</p>
                                <p className="text-[11px] text-gray-500 tabular-nums">
                                  Máy đo: {measured ?? '—'} {c.unit} · hệ số {a[c.factor] ?? '—'}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step={c.decimals === 2 ? 0.01 : 0.1}
                                  value={v}
                                  onChange={(e) => setCalDraft((d) => ({ ...d, [c.key]: e.target.value }))}
                                  className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-base tabular-nums"
                                />
                                <span className="text-sm text-gray-500">{c.unit}</span>
                                <button
                                  type="button"
                                  disabled={!v || busy !== null}
                                  onClick={() =>
                                    void apply({ [c.key]: String(v).replace(',', '.') }, c.key).then(() =>
                                      setCalDraft((d) => {
                                        const n = { ...d };
                                        delete n[c.key];
                                        return n;
                                      })
                                    )
                                  }
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {busy === c.key ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Hiệu chỉnh'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/40 p-3">
                    <p className="text-sm text-gray-700">
                      <b>Cài đặt gốc</b>: đưa cài đặt người dùng về mặc định, giữ hệ pin, tần số, biến áp và hiệu chỉnh. Máy để ở chế độ Tắt.
                    </p>
                    <button
                      type="button"
                      onClick={() => void apply({ FACT: '1' }, 'fact')}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {busy === 'fact' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      Cài đặt gốc
                    </button>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
