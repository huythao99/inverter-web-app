import { ScanSearch } from 'lucide-react';
import { LoadingSpinner } from '../../LoadingSpinner';
import { getHybridAdvanced, readHybridAdvanced, sendHybridCommand } from '../../../services/api';
import type { HybridAdvanced as Adv } from '../../../types';
import { versionAtLeast } from '../../../utils/version';
import { BTN_SECONDARY } from '../styles';
import { sleep } from './helpers';

/** Kết quả lần đo Lf gần nhất ($ADV LFST, STM32 >= 5.4.23). */
const LFST_TEXT: Record<string, string> = {
  '2': 'Còn tải ở cổng Load, hãy tháo hết rồi đo lại.',
  '3': 'Không đo được, kiểm tra lại cài đặt Cf và biến áp.',
  '4': 'Còn thiết bị có tụ ở cổng Load, hãy tháo rồi đo lại.',
  '5': 'Còn điện ở AC Input: hãy ngắt aptomat AC Input rồi đo lại.',
  '6': 'Không đo được, kiểm tra lại biến áp và tụ lọc.',
};

/** Máy từ chối $CMD,LFMEAS: lý do nằm ở NAK (LFST vẫn giữ 0), giao thức 5.4.27. */
function lfNakText(err?: string): string {
  switch (err) {
    case 'MODE':
      return 'Hãy chuyển máy về chế độ 0 (Tắt) rồi đo lại.';
    case 'RUNNING':
      return 'Máy chưa dừng hẳn, đợi tắt rồi đo lại.';
    case 'BUSY':
      return 'Có người đang dùng menu trên máy, thử lại sau.';
    case 'LOCAL':
      return 'Máy đang đặt Cài đặt từ = LCD, không điều khiển từ app được.';
    case 'LOCKED':
      return 'Máy đang ở màn hình khoá an toàn.';
    case 'UNSUP':
      return 'Firmware máy chưa hỗ trợ đo tự động (cần STM32 5.4.23 trở lên).';
    default:
      return `Máy từ chối lệnh đo (${err ?? '?'}).`;
  }
}

/**
 * Lý do đo hỏng theo LFST, kèm số đo / số kiểm chéo (LFRAW / LFVS, 5.4.27) để
 * người dùng thấy lệch bao nhiêu. Không có NAK mà LFST vẫn 0: pin dưới 44 V.
 */
export function lfFailText(adv: Record<string, string>): string {
  const st = adv.LFST ?? '0';
  if (st === '0') return 'Điện áp pin thấp, không đo được.';
  const raw = Number(adv.LFRAW) || 0;
  const vs = Number(adv.LFVS) || 0;
  const nums = raw > 0 || vs > 0 ? ` (đo ${raw.toFixed(2)} mH / kiểm chéo ${vs.toFixed(2)} mH)` : '';
  const base = LFST_TEXT[st] ?? `Không đo được (mã ${st}).`;
  return base.endsWith('.') ? `${base.slice(0, -1)}${nums}.` : `${base}${nums}`;
}

/** Firmware chưa biết: vẫn cho đo (máy cũ trả NAK UNSUP, trang báo). */
export const lfMeasSupported = (fw?: string | null) => !fw || versionAtLeast(fw, '5.4.23');

export type LfOutcome = { ok: true; lfid: string } | { ok: false; text: string };

/**
 * $CMD,LFMEAS rồi đọc $ADV (giao thức "Thay đổi ở firmware 5.4.23"): kết quả
 * là $ADV hoặc $NAK mới hơn mốc lấy ngay trước khi gửi (giờ của server).
 */
export async function runLfMeasure(deviceId: string): Promise<LfOutcome> {
  const before = await getHybridAdvanced(deviceId).catch(() => null);
  const advAt0 = before?.advAt ?? null;
  const nakAt0 = before?.lastNak?.at ?? null;
  try {
    await sendHybridCommand(deviceId, 'LFMEAS');
  } catch {
    return { ok: false, text: 'Không gửi được lệnh đo.' };
  }
  // Máy đo ~10 ms; chờ lệnh tới máy rồi hỏi $ADV.
  await sleep(1500);
  void readHybridAdvanced(deviceId).catch(() => {});
  let adv: Record<string, string> | null = null;
  for (let i = 0; i < 14; i++) {
    await sleep(700);
    let m: Adv;
    try {
      m = await getHybridAdvanced(deviceId);
    } catch {
      continue;
    }
    const nak = m.lastNak;
    if (nak && nak.at !== nakAt0 && nak.of.startsWith('CMD')) return { ok: false, text: lfNakText(nak.err) };
    if (m.advAt && m.advAt !== advAt0) {
      adv = m.adv;
      break;
    }
    if (i === 6) void readHybridAdvanced(deviceId).catch(() => {}); // hỏi lại một lần
  }
  if (!adv)
    return {
      ok: false,
      text: 'Máy không trả kết quả. Mở lại trang để xem Lf máy đang dùng.',
    };
  const st = adv.LFST ?? '0';
  const lfid = adv.LFID ?? '';
  if (st !== '1' || !(Number(lfid) > 0)) return { ok: false, text: lfFailText(adv) };
  return { ok: true, lfid };
}

/** Khối "Máy tự đo Lf" (dưới nhóm Biến áp). */
export function LfMeasure({ busy, onMeasure }: { busy: string | null; onMeasure: () => void }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 sm:p-4">
      <p className="text-sm font-semibold text-gray-900">Máy tự đo điện cảm rò Lf</p>
      <p className="mt-1 text-xs text-gray-500">
        Đặt Lf cao hơn thật thì máy báo F1/F2 lúc khởi động. Máy mới hoặc vừa về cài đặt gốc: Lf mặc định có thể cao hơn
        biến áp thật, nên đo trước khi chạy. Cần tắt máy, ngắt aptomat AC Input và tháo hết tải ở cổng Load.
      </p>
      <button type="button" onClick={onMeasure} disabled={busy !== null} className={`${BTN_SECONDARY} mt-3`}>
        {busy === 'lf' ? <LoadingSpinner size="sm" /> : <ScanSearch className="w-4 h-4" />}
        Đo ngay
      </button>
    </div>
  );
}
