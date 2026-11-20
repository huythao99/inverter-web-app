// HINVLF: nhãn hiển thị (trạng thái, chế độ, lỗi, NAK, lệnh).
import type { HybridCommand, HybridMode } from '../../types';
import { versionAtLeast } from '../../utils/version';

export const ST_LABEL: Record<string, string> = {
  RUN: 'Đang chạy',
  IDLE: 'Đang chờ',
  OFF: 'Chế độ tắt',
  STOP: 'Đã dừng từ app',
  FLT: 'Đang lỗi',
};

export interface ModeDef {
  id: HybridMode;
  label: string;
  desc: string;
  /** Firmware STM32 tối thiểu (không có = mọi bản). */
  minFw?: string;
  needsCt?: boolean;
}

export const MODES: ModeDef[] = [
  {
    id: 'LOAD',
    label: 'Bám tải',
    desc: 'Hòa lưới, phát đủ cho tải trong nhà',
    needsCt: true,
  },
  {
    id: 'LOADACC',
    label: 'Bám tải + sạc dư',
    desc: 'Bám tải; khi inverter PV khác trong nhà phát dư ra lưới thì sạc pin phần dư',
    minFw: '5.4.10',
    needsCt: true,
  },
  {
    id: 'EXPORT',
    label: 'Đẩy lưới',
    desc: 'Hòa lưới, đẩy công suất cố định lên lưới',
  },
  {
    id: 'ACCOUPLE',
    label: 'Sạc điện dư',
    desc: 'Không xả pin; chỉ sạc phần điện dư đang đẩy ra lưới từ inverter PV khác',
    minFw: '5.4.5',
    needsCt: true,
  },
  { id: 'CHG', label: 'Sạc từ lưới', desc: 'Lấy điện lưới sạc pin' },
  {
    id: 'OFFGRID',
    label: 'Độc lập',
    desc: 'Không hòa lưới, tự phát điện từ pin',
  },
  { id: 'OFF', label: 'Tắt', desc: 'Không phát, không sạc' },
];

/** Nhóm trong bảng chọn chế độ. */
export const MODE_GROUPS: { title: string; ids: HybridMode[] }[] = [
  { title: 'Hòa lưới', ids: ['LOAD', 'LOADACC', 'EXPORT'] },
  { title: 'Sạc pin', ids: ['CHG', 'ACCOUPLE'] },
  { title: 'Khác', ids: ['OFFGRID', 'OFF'] },
];

export const MODE_LABEL: Record<string, string> = Object.fromEntries(MODES.map((m) => [m.id, m.label]));

/** Lý do máy (firmware fw) không chạy được chế độ này; undefined = được. */
export function modeUnsupported(m: ModeDef, fw?: string | null): string | undefined {
  if (!m.minFw || !fw) return undefined;
  return versionAtLeast(fw, m.minFw) ? undefined : `Cần firmware máy từ ${m.minFw} (đang ${fw})`;
}

export const CMD_LABEL: Record<HybridCommand, string> = {
  FAULT_RST: 'Xóa lỗi',
  STOP: 'Dừng máy',
  RUN: 'Chạy máy',
  SAVE: 'Lưu vào máy',
  LFMEAS: 'Đo điện cảm rò',
  POWERON: 'Bật máy',
};

/**
 * STM32 >= 5.4.29: máy bị tắt bằng nút nguồn trên màn hình (giữ ENTER 5 s). Khoá
 * này không nằm trong MODE: $TLM báo ST=OFF trong khi MODE vẫn là chế độ đã đặt.
 * Bật lại từ xa bằng POWERON (gửi lại chế độ), không phải RUN.
 */
export const isPowerOff = (t: Record<string, string | undefined>) => {
  const mode = (t.MODE ?? '').trim();
  return t.ST === 'OFF' && mode !== '' && mode !== 'OFF';
};

export const IST_LABEL: Record<string, string> = {
  STANDBY: 'Chờ',
  POLTEST: 'Kiểm tra cực tính',
  OFFGRID: 'Đang phát độc lập',
  SYNC: 'Đang đồng bộ lưới',
  CLOSING: 'Đang đóng lưới',
  GRID: 'Đã hòa lưới',
  FAULT: 'Lỗi',
  LFMEAS: 'Đang đo điện cảm rò',
  HWTEST: 'Đang test phần cứng',
};

/**
 * STM32 >= 5.4.30: máy đang tự test phần cứng (bật từ phím trên máy, tự dừng
 * trong ~150 s). Chỉ xem: ẩn mọi ô nhập, không gửi $SET / $SETADV / $CMD và
 * không coi là lỗi.
 */
export const isHwTest = (ist?: string | null) => (ist ?? '').trim() === 'HWTEST';
export const HWTEST_TEXT = 'Đang test phần cứng tại máy';
export const HWTEST_HINT =
  'Máy tự dừng test trong khoảng 2–3 phút. Trong lúc này chỉ xem, không gửi lệnh hay cài đặt xuống máy.';

export const FLT_LABEL: Record<string, string> = {
  '1': 'F1 – Quá dòng phần cứng phía pin',
  '2': 'F2 – Quá dòng sơ cấp',
  '3': 'F3 – Pin quá áp',
  '4': 'F4 – Pin yếu (dưới ngưỡng ngắt xả)',
  '5': 'F5 – Bão hòa biến áp',
  '6': 'F6 – Kiểm tra cực tính thất bại',
  '7': 'F7 – Lỗi CT lưới (thiếu / hở / ngược; bám tải, sạc dư)',
  '8': 'Quá nhiệt (> 85 °C)',
  '9': 'Hở mạch cảm biến nhiệt',
  '10': 'Lỗi cảm biến / bộ đo (tắt bật lại máy)',
  '11': 'Máy bị khóa từ xa',
  '12': 'Firmware sai loại điện áp',
  '13': 'Firmware sai loại sản phẩm hoặc sai loại mạch',
};

/** Lần thử chạy lại nhanh sau quá dòng F1 (STM32 5.4.21+, RFAST 1–3; vắng mặt = 0). */
export const rfastOf = (t: Record<string, string | undefined>) => Number.parseInt(t.RFAST ?? '', 10) || 0;

/** F1 kèm RFAST ≥ 1: máy đang tự chạy lại sau 0,3 s, không phải lỗi cần báo động. */
export const isRetrying = (t: Record<string, string | undefined>) => (t.FLT ?? '').trim() === '1' && rfastOf(t) > 0;

export const NAK_LABEL: Record<string, string> = {
  CRC: 'Lỗi truyền tin, thiết bị sẽ gửi lại.',
  FORMAT: 'Sai cú pháp lệnh (lỗi firmware ESP32).',
  UNSUP: 'Máy không hỗ trợ lệnh này.',
  KEY: 'Tham số không hợp lệ hoặc chỉ đọc.',
  VALUE: 'Máy không đọc được giá trị.',
  RANGE: 'Giá trị ngoài dải hoặc sai thứ tự ngưỡng.',
  LOCAL: 'Máy đang chỉnh tại chỗ: vào menu máy chọn "Cai dat tu = APP".',
  BUSY: 'Có người đang thao tác menu trên máy, thiết bị sẽ thử lại.',
  FLASH: 'Ghi bộ nhớ máy thất bại, thiết bị sẽ thử lại.',
  PW: 'Sai mật khẩu.',
  PWLOCK: 'Sai mật khẩu quá nhiều lần. Thử lại sau 5 phút.',
  RUNNING: 'Phải tắt máy (chế độ Tắt) trước khi làm việc này.',
  MODE: 'Máy chưa ở chế độ Tắt.',
  NOSIGNAL: 'Tín hiệu đo quá nhỏ.',
  LOCKED: 'Máy đang bị khóa hoặc lỗi, không chỉnh được.',
  HWTEST: 'Máy đang test phần cứng, thử lại khi test xong.',
};
