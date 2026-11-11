// Cập nhật firmware mạch công suất (STM32, nạp qua ESP32): nhãn, lý do,
// % tiến trình, dịch thông báo ESP32. Dùng chung cho inverter
// (FirmwareSection) và hybrid (HybridFirmwareTab). Cùng nội dung với app
// (lib/models/stm_ota.dart).

export const STM_OTA_LABEL: Record<string, string> = {
  sent: 'Đã gửi lệnh, đang chờ thiết bị',
  starting: 'Đang kiểm tra bản firmware',
  downloading: 'Đang tải firmware',
  verifying: 'Đang kiểm tra file firmware',
  flashing: 'Đang nạp mạch công suất (máy tạm ngừng phát)',
  installing: 'Đang nạp mạch công suất (máy tạm ngừng phát)',
  success: 'Cập nhật mạch công suất thành công',
  failed: 'Cập nhật mạch công suất thất bại',
  rescue_needed: 'Nạp lỗi giữa chừng — mạch đang chờ nạp lại',
};

export const STM_OTA_REASON: Record<string, string> = {
  esp_firmware_too_old: 'Cần cập nhật bộ điều khiển (ESP32) trước',
  version_unknown: 'Chưa biết phiên bản mạch công suất (máy chưa báo)',
  no_firmware: 'Chưa có bản firmware cho loại mạch này',
};

export const OTA_TERMINAL = new Set(['success', 'failed', 'rescue_needed']);

/** Một thanh cho cả quá trình: tải 0-20 %, kiểm tra ~22 %, nạp 25-100 %. */
export function stmOtaPercent(status?: string, progress?: number | null): number {
  const p = Math.max(0, Math.min(100, progress ?? 0));
  switch (status) {
    case 'downloading':
      return Math.round(p * 0.2);
    case 'verifying':
      return 22;
    case 'flashing':
    case 'installing':
      return Math.round(25 + p * 0.75);
    case 'success':
      return 100;
    default:
      return 0;
  }
}

const MESSAGES: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Checking STM32 firmware/, () => 'Đang kiểm tra bản firmware'],
  [/^Downloading (\S+)/, (m) => `Đang tải bản ${m[1]}`],
  [/^Image OK/, () => 'File firmware hợp lệ'],
  [/^Stopping/, () => 'Đang dừng phát điện và nạp mạch'],
  [/^Flashing STM32/, () => 'Đang nạp mạch công suất'],
  [/^Update failed, restoring (\S+)/, (m) => `Nạp lỗi, đang khôi phục bản ${m[1]}`],
  [/^STM32 updated to (\S+)/, (m) => `Mạch công suất đã lên bản ${m[1]}`],
  [/^Flashed (\S+), waiting/, (m) => `Đã nạp bản ${m[1]}, đang chờ mạch báo phiên bản`],
  [/^Already up to date/, () => 'Mạch công suất đã ở bản mới nhất'],
  [/restored (\S+)$/, (m) => `Nạp không thành công, đã khôi phục bản ${m[1]} — máy chạy bình thường`],
  [/: busy/, () => 'Mạch đang ghi dữ liệu, hãy thử lại sau ít phút'],
  [/: no_ack/, () => 'Mạch công suất không phản hồi lệnh nạp'],
  [/: no_bootloader/, () => 'Mạch công suất không vào chế độ nạp'],
  [/: (variant|product)/, () => 'File firmware không đúng loại mạch / điện áp — đã huỷ, máy chạy bản cũ'],
  [/waits in bootloader/, () => 'Nạp lỗi giữa chừng, mạch đang chờ nạp lại. Bấm "Thử nạp lại"'],
  [/^STM32 flash failed/, () => 'Nạp mạch công suất lỗi'],
  [/No STM32 firmware/, () => 'Chưa có bản firmware cho loại mạch này'],
  [/version unknown/, () => 'Chưa biết phiên bản mạch công suất'],
  [/does not match board|Image says/, () => 'Bản firmware không khớp loại mạch'],
  [/CRC32|Download|Size mismatch|Bad firmware URL|Cannot get STM32/, () => 'Tải firmware lỗi, hãy thử lại'],
  [/busy/i, () => 'Thiết bị đang bận, hãy thử lại sau'],
  [/No WiFi/, () => 'Thiết bị mất kết nối WiFi'],
  [/Storage/, () => 'Lỗi bộ nhớ của thiết bị'],
];

/** Thông báo tiếng Anh của ESP32 (esp32-common stm_fota_runner) -> tiếng Việt. */
export function stmOtaMessage(msg?: string | null): string | undefined {
  if (!msg) return undefined;
  for (const [re, fn] of MESSAGES) {
    const m = re.exec(msg);
    if (m) return fn(m);
  }
  return msg;
}
