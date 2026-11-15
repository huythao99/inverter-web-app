import { ScanSearch } from "lucide-react";
import { LoadingSpinner } from "../../LoadingSpinner";
import {
  getHybridAdvanced,
  readHybridAdvanced,
  sendHybridCommand,
} from "../../../services/api";
import type { HybridAdvanced as Adv } from "../../../types";
import { versionAtLeast } from "../../../utils/version";
import { BTN_SECONDARY } from "../styles";
import { sleep } from "./helpers";

/** Kết quả lần đo Lf gần nhất ($ADV LFST, STM32 >= 5.4.23). */
const LFST_TEXT: Record<string, string> = {
  "2": "Còn tải ở cổng Load, hãy tháo hết rồi đo lại.",
  "3": "Không đo được, kiểm tra lại cài đặt Cf và biến áp.",
  "4": "Còn thiết bị có tụ ở cổng Load, hãy tháo rồi đo lại.",
  "5": "Còn điện ở AC Input: hãy ngắt aptomat AC Input rồi đo lại.",
  "6": "Không đo được, kiểm tra lại biến áp và tụ lọc.",
};

/** Máy từ chối $CMD,LFMEAS. */
function lfNakText(err?: string): string {
  switch (err) {
    case "MODE":
    case "RUNNING":
      return "Máy chưa ở chế độ Tắt hoặc chưa dừng hẳn. Tắt máy rồi đo lại.";
    case "LOCAL":
      return "Máy đang ở chế độ chỉnh tay. Trên máy chọn Cai dat tu = APP.";
    case "BUSY":
      return "Có người đang thao tác menu trên máy. Thử lại sau vài giây.";
    case "UNSUP":
      return "Firmware máy chưa hỗ trợ đo tự động (cần STM32 5.4.23 trở lên).";
    default:
      return `Máy từ chối lệnh đo (${err ?? "?"}).`;
  }
}

/** Firmware chưa biết: vẫn cho đo (máy cũ trả NAK UNSUP, trang báo). */
export const lfMeasSupported = (fw?: string | null) =>
  !fw || versionAtLeast(fw, "5.4.23");

export type LfOutcome =
  { ok: true; lfid: string } | { ok: false; text: string };

/**
 * $CMD,LFMEAS rồi đọc $ADV (giao thức "Thay đổi ở firmware 5.4.23"): kết quả
 * là $ADV hoặc $NAK mới hơn mốc lấy ngay trước khi gửi (giờ của server).
 */
export async function runLfMeasure(deviceId: string): Promise<LfOutcome> {
  const before = await getHybridAdvanced(deviceId).catch(() => null);
  const advAt0 = before?.advAt ?? null;
  const nakAt0 = before?.lastNak?.at ?? null;
  try {
    await sendHybridCommand(deviceId, "LFMEAS");
  } catch {
    return { ok: false, text: "Không gửi được lệnh đo." };
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
    if (nak && nak.at !== nakAt0 && nak.of.startsWith("CMD"))
      return { ok: false, text: lfNakText(nak.err) };
    if (m.advAt && m.advAt !== advAt0) {
      adv = m.adv;
      break;
    }
    if (i === 6) void readHybridAdvanced(deviceId).catch(() => {}); // hỏi lại một lần
  }
  if (!adv)
    return {
      ok: false,
      text: "Máy không trả kết quả. Mở lại trang để xem Lf máy đang dùng.",
    };
  const st = adv.LFST ?? "0";
  const lfid = adv.LFID ?? "";
  if (st !== "1" || !(Number(lfid) > 0))
    return { ok: false, text: LFST_TEXT[st] ?? `Không đo được (mã ${st}).` };
  return { ok: true, lfid };
}

/** Khối "Máy tự đo Lf" (dưới nhóm Biến áp). */
export function LfMeasure({
  busy,
  onMeasure,
}: {
  busy: string | null;
  onMeasure: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-3 sm:p-4">
      <p className="text-sm font-semibold text-gray-900">
        Máy tự đo điện cảm rò Lf
      </p>
      <p className="mt-1 text-xs text-gray-500">
        Đặt Lf cao hơn thật thì máy báo F1/F2 lúc khởi động. Máy đo trong ~10 ms
        rồi gợi ý giá trị nên đặt. Cần tắt máy, ngắt aptomat AC Input và tháo
        hết tải ở cổng Load.
      </p>
      <button
        type="button"
        onClick={onMeasure}
        disabled={busy !== null}
        className={`${BTN_SECONDARY} mt-3`}
      >
        {busy === "lf" ? (
          <LoadingSpinner size="sm" />
        ) : (
          <ScanSearch className="w-4 h-4" />
        )}
        Đo ngay
      </button>
    </div>
  );
}
