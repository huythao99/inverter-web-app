import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Play, Power, Save, SlidersHorizontal } from 'lucide-react';
import { LoadingSpinner } from '../../LoadingSpinner';
import {
  getHybridAdvanced,
  readHybridAdvanced,
  sendHybridCommand,
  setHybridAdvanced,
  updateHybridSetting,
} from '../../../services/api';
import type { HybridMode } from '../../../types';
import { ADV_GROUPS, MODE_LABEL, advErrorText } from '../../../services/hinvlf';
import { BTN_PRIMARY, BTN_SECONDARY } from '../styles';
import { Sheet } from '../ui';
import { useConfirm } from '../useConfirm';
import type { ConfirmAsk } from '../ui';
import { AdvGroups, Calibration, FactoryReset, LockForm, Note } from './AdvancedParts';
import { errText, sleep, waitResult } from './helpers';
import { LfMeasure, lfMeasSupported, runLfMeasure } from './LfMeasure';
import { versionAtLeast } from '../../../utils/version';
import type { Result } from './helpers';

/**
 * Cài đặt nâng cao (STM32 >= 5.4.12, $GET,ADV / $SETADV): mật khẩu, hệ pin, tần
 * số, biến áp, ngưỡng pin, cửa sổ lưới, hiệu chỉnh 5 kênh đo, cài đặt gốc.
 * Mật khẩu chỉ giữ trong bộ nhớ khi menu đang mở (không lưu ở đâu).
 */
export function AdvancedDialog({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const pwRef = useRef(''); // chỉ trong bộ nhớ, xóa khi đóng
  const [unlocked, setUnlocked] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [prevMode, setPrevMode] = useState<HybridMode | null>(null);
  // Máy đang được giữ tắt bằng $CMD,STOP (STM32 >= 5.4.27) do trang này.
  const [heldByStop, setHeldByStop] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [calDraft, setCalDraft] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const { ask: askRaw, dialog } = useConfirm();
  const ask = (q: Omit<ConfirmAsk, 'danger'>) => askRaw({ ...q, danger: true });

  useEffect(
    () => () => {
      pwRef.current = '';
    },
    []
  );

  // Số đo: mỗi 1 s khi đang mở trang hiệu chỉnh, không thì mỗi 3 s.
  const { data: adv } = useQuery({
    queryKey: ['hybrid-advanced', deviceId],
    queryFn: () => getHybridAdvanced(deviceId),
    enabled: unlocked,
    refetchInterval: calOpen ? 1000 : 3000,
  });
  // Chỉ dùng $ADV máy gửi SAU lệnh gần nhất (máy là nguồn sự thật): bản cũ hơn
  // có thể là của trước khi nạp lại firmware (vd LF đã về mặc định).
  const fresh = !!adv?.advAt && (!adv.requestAt || new Date(adv.advAt).getTime() >= new Date(adv.requestAt).getTime());
  const a = fresh ? (adv?.adv ?? null) : null;

  // Trang hiệu chỉnh mở: máy hỏi $GET,ADV mỗi giây (gia hạn mỗi 20 s).
  useEffect(() => {
    if (!unlocked || !calOpen) return;
    void readHybridAdvanced(deviceId, 30).catch(() => {});
    const t = setInterval(() => void readHybridAdvanced(deviceId, 30).catch(() => {}), 20_000);
    return () => clearInterval(t);
  }, [unlocked, calOpen, deviceId]);

  // STM32 >= 5.4.27: $SETADV nhận khi máy bị giữ tắt bằng $CMD,STOP (chỉ trong
  // RAM, không đổi chế độ, $CMD,SAVE không ghi chế độ 0 vào flash; mất kết nối
  // thì tắt bật nguồn là máy chạy lại đúng chế độ cũ). Bản cũ / chưa biết: chế độ 0.
  const useStop = !!adv?.fw && versionAtLeast(adv.fw, '5.4.27');
  const modeOff = adv?.mode === 'OFF' && adv?.ist === 'STANDBY';
  // STM32 >= 5.4.29: Lf 0,5 – 50 (bỏ 0 = tự đo); đổi SYS thì máy đặt lại N và Lf = 1,0.
  const fw529 = !!adv?.fw && versionAtLeast(adv.fw, '5.4.29');
  // Đã giữ tắt bằng $CMD,STOP. Máy còn bị nút nguồn trên màn hình tắt (5.4.29+) thì
  // $TLM có thể vẫn báo ST=OFF: STOP đã gửi là đủ để $SETADV.
  const stopHeld = (st?: string | null) => st === 'STOP' || (heldByStop && st === 'OFF');
  const running = !(modeOff || (useStop && stopHeld(adv?.st)));

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
    void queryClient.invalidateQueries({
      queryKey: ['hybrid-advanced', deviceId],
    });
    void queryClient.invalidateQueries({
      queryKey: ['hybrid-latest', deviceId],
    });
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
        setDraft({}); // không mang giá trị đã gõ từ phiên trước lên máy
        setCalDraft({});
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

  async function apply(set: Record<string, string>, label: string): Promise<boolean> {
    // 5.4.29: Lf 0,5 – 50 mH, không còn 0 = tự đo (máy trả RANGE).
    const lf = set.LF !== undefined ? Number(set.LF) : NaN;
    if (fw529 && Number.isFinite(lf) && (lf < 0.5 || lf > 50)) {
      setMessage({ ok: false, text: 'Điện cảm rò Lf phải từ 0,5 đến 50 mH.' });
      return false;
    }
    const sysChange = fw529 && set.SYS !== undefined && set.SYS !== a?.SYS;
    const needConfirm = ADV_GROUPS.flatMap((g) => g.fields).filter((f) => f.confirm && set[f.key] !== undefined);
    if (set.FACT) {
      const ok = await ask({
        title: 'Khôi phục cài đặt gốc?',
        text: 'Cài đặt người dùng về mặc định. Máy sẽ ở chế độ Tắt sau khi khôi phục.',
        ok: 'Khôi phục',
      });
      if (!ok) return false;
    } else if (needConfirm.length) {
      const ok = await ask({
        title: 'Xác nhận thay đổi',
        text: sysChange
          ? 'Đặt sai các mục này có thể làm hỏng pin. Đổi hệ pin: máy đặt lại tỉ số biến áp N theo hệ mới và Lf = 1,0 mH.'
          : 'Đặt sai các mục này có thể làm hỏng pin:',
        list: needConfirm.map((f) => `${f.label}: ${set[f.key]} ${f.unit}`),
        ok: 'Áp dụng',
      });
      if (!ok) return false;
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
            ? fw529
              ? 'Đã áp dụng. Máy đã đặt tỉ số biến áp N theo hệ pin mới và Lf = 1,0 mH: kiểm tra N (nhóm Biến áp) đúng với biến áp đang lắp, đo lại Lf, và xem lại ngưỡng pin trong trang Cài đặt.'
              : 'Đã áp dụng. Hệ pin mới đã nạp lại các ngưỡng pin, hãy kiểm tra lại trong trang Cài đặt.'
            : 'Đã áp dụng. Bấm "Lưu vào máy" để giữ lại sau khi máy khởi động lại.',
        });
        return true;
      }
      setMessage({ ok: false, text: advErrorText(r.err, r.key) });
      if (r.err === 'PW' || r.err === 'PWLOCK') {
        pwRef.current = '';
        setUnlocked(false);
      }
      // Người dùng đang bấm menu trên máy (STM32 5.4.24: có thể vừa tự đo Lf
      // trên LCD): đọc lại $ADV khi hết BUSY thay vì tin giá trị cũ.
      if (r.err === 'BUSY') {
        setTimeout(() => {
          void readHybridAdvanced(deviceId).catch(() => {});
          setTimeout(
            () =>
              void queryClient.invalidateQueries({
                queryKey: ['hybrid-advanced', deviceId],
              }),
            2000
          );
        }, 6000);
      }
      return false;
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** Dừng máy để đổi mục phần cứng: $CMD,STOP với máy mới, chế độ 0 với máy cũ. */
  const turnOff = () => (useStop ? stopHold() : turnOffMode());

  /** $CMD,STOP rồi đợi $TLM báo ST=STOP (STM32 >= 5.4.27). */
  async function stopHold(): Promise<boolean> {
    setBusy('off');
    setMessage(null);
    try {
      await sendHybridCommand(deviceId, 'STOP');
      setHeldByStop(true);
      for (let i = 0; i < 20; i++) {
        await sleep(1000);
        const s = await getHybridAdvanced(deviceId);
        queryClient.setQueryData(['hybrid-advanced', deviceId], s);
        if (s.st === 'STOP' || s.st === 'OFF') {
          setMessage({
            ok: true,
            text: 'Máy đã dừng tạm thời, chế độ giữ nguyên. Sửa xong bấm "Chạy lại". Nếu mất kết nối, tắt bật lại nguồn là máy chạy bình thường.',
          });
          return true;
        }
      }
      setMessage({ ok: false, text: 'Máy chưa dừng. Kiểm tra lại "Cài đặt từ = APP" trên máy.' });
      return false;
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function turnOffMode(): Promise<boolean> {
    if (!adv?.mode) return false;
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
          return true;
        }
      }
      setMessage({
        ok: false,
        text: 'Máy chưa tắt. Kiểm tra lại trạng thái máy.',
      });
      return false;
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
      return false;
    } finally {
      setBusy(null);
    }
  }

  // $CMD,LFMEAS (STM32 >= 5.4.23): tắt máy → cảnh báo → đo → gợi ý đặt LF = LFID.
  async function measureLf() {
    // Đo Lf cần chế độ 0 (giao thức §7), $CMD,STOP không đủ.
    if (!modeOff) {
      const off = await ask({
        title: 'Cần tắt máy',
        text: 'Máy phải ở chế độ Tắt và dừng hẳn mới đo được. Tắt máy bây giờ?',
        ok: 'Tắt máy',
      });
      if (!off || !(await turnOffMode())) return;
    }
    const go = await ask({
      title: 'Đo điện cảm rò Lf',
      text:
        'Trước khi đo: ngắt aptomat AC Input và tháo hết tải ở cổng Load (nhất là thiết bị có tụ lọc: nguồn máy tính, UPS, bộ sạc). ' +
        'Để nguyên tải thì kết quả sai, máy sẽ báo lỗi và không nhận kết quả.',
      ok: 'Đã ngắt, đo ngay',
    });
    if (!go) return;
    setBusy('lf');
    setMessage(null);
    const r = await runLfMeasure(deviceId);
    setBusy(null);
    void queryClient.invalidateQueries({
      queryKey: ['hybrid-advanced', deviceId],
    });
    if (!r.ok) {
      setMessage({ ok: false, text: r.text });
      return;
    }
    setMessage({ ok: true, text: `Đo xong: nên đặt Lf = ${r.lfid} mH.` });
    const set = await ask({
      title: 'Đo xong',
      text: `Nên đặt Lf = ${r.lfid} mH (đã nhân hệ số an toàn 0,6). Đặt giá trị này và lưu vào máy?`,
      ok: 'Đặt Lf',
    });
    if (set && (await apply({ LF: r.lfid }, 'lf'))) await saveToMachine();
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
    if (heldByStop) {
      setBusy('run');
      try {
        await sendHybridCommand(deviceId, 'RUN');
        setHeldByStop(false);
        setMessage({ ok: true, text: 'Đã gửi lệnh chạy lại.' });
      } catch (err) {
        setMessage({ ok: false, text: errText(err) });
      } finally {
        setBusy(null);
      }
      return;
    }
    if (!prevMode) return;
    setBusy('run');
    try {
      await updateHybridSetting(deviceId, { MODE: prevMode });
      setMessage({
        ok: true,
        text: `Đã gửi lệnh chạy lại (${MODE_LABEL[prevMode] ?? prevMode}).`,
      });
      setPrevMode(null);
    } catch (err) {
      setMessage({ ok: false, text: errText(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet
      onClose={close}
      title={
        <>
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-600 shrink-0" />
            Cài đặt nâng cao
          </span>
          <span className="block text-sm font-normal text-gray-500 mt-0.5 truncate">{deviceId}</span>
        </>
      }
    >
      <div className="space-y-6">
        {message && <Note tone={message.ok ? 'ok' : 'error'}>{message.text}</Note>}

        {!unlocked ? (
          <LockForm
            value={pwInput}
            onChange={setPwInput}
            showPw={showPw}
            onToggleShow={() => setShowPw((v) => !v)}
            busy={busy}
            onSubmit={unlock}
          />
        ) : (
          <>
            {running && (
              <Note tone="warn">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {useStop
                      ? 'Máy đang chạy. Phải dừng máy để đổi các mục dưới đây (trừ hiệu chỉnh: làm hiệu chỉnh trước khi dừng). Máy chỉ dừng tạm thời, chế độ giữ nguyên.'
                      : 'Máy đang chạy. Phải tắt máy để đổi các mục dưới đây (trừ hiệu chỉnh).'}
                  </span>
                  <button
                    type="button"
                    onClick={() => void turnOff()}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {busy === 'off' ? (
                      <LoadingSpinner size="sm" className="text-white" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                    {useStop ? 'Dừng máy' : 'Tắt máy'}
                  </button>
                </div>
              </Note>
            )}

            {(unsaved || prevMode || heldByStop) && (
              <div className="flex flex-wrap gap-2">
                {unsaved && (
                  <button
                    type="button"
                    onClick={() => void saveToMachine()}
                    disabled={busy !== null}
                    className={BTN_PRIMARY}
                  >
                    {busy === 'save' ? (
                      <LoadingSpinner size="sm" className="text-white" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Lưu vào máy
                  </button>
                )}
                {(prevMode || heldByStop) && (
                  <button
                    type="button"
                    onClick={() => void runAgain()}
                    disabled={busy !== null}
                    className={BTN_SECONDARY}
                  >
                    {busy === 'run' ? <LoadingSpinner size="sm" /> : <Play className="w-4 h-4" />}
                    {heldByStop ? 'Chạy lại' : `Chạy lại (${prevMode ? (MODE_LABEL[prevMode] ?? prevMode) : ''})`}
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
                <AdvGroups
                  a={a}
                  draft={draft}
                  setDraft={setDraft}
                  changes={changes}
                  busy={busy}
                  onApply={() => void apply(changes, 'apply')}
                  fw529={fw529}
                />
                {lfMeasSupported(adv?.fw) && <LfMeasure busy={busy} onMeasure={() => void measureLf()} />}
                <Calibration
                  a={a}
                  draft={calDraft}
                  setDraft={setCalDraft}
                  open={calOpen}
                  onToggle={() => setCalOpen((v) => !v)}
                  busy={busy}
                  onApply={async (set, key) => {
                    await apply(set, key);
                  }}
                />
                <FactoryReset busy={busy} onApply={() => void apply({ FACT: '1' }, 'fact')} />
              </>
            )}
          </>
        )}
      </div>
      {dialog}
    </Sheet>
  );
}
