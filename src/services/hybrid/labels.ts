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
  { id: 'LOAD', label: 'Bám tải', desc: 'Hòa lưới, phát đủ cho tải trong nhà', needsCt: true },
  {
    id: 'LOADACC',
    label: 'Bám tải + sạc dư',
    desc: 'Bám tải; khi inverter PV khác trong nhà phát dư ra lưới thì sạc pin phần dư',
    minFw: '5.4.10',
    needsCt: true,
  },
  { id: 'EXPORT', label: 'Đẩy lưới', desc: 'Hòa lưới, đẩy công suất cố định lên lưới' },
  {
    id: 'ACCOUPLE',
    label: 'Sạc điện dư',
    desc: 'Không xả pin; chỉ sạc phần điện dư đang đẩy ra lưới từ inverter PV khác',
    minFw: '5.4.5',
    needsCt: true,
  },
  { id: 'CHG', label: 'Sạc từ lưới', desc: 'Lấy điện lưới sạc pin' },
  { id: 'OFFGRID', label: 'Độc lập', desc: 'Không hòa lưới, tự phát điện từ pin' },
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
};

export const IST_LABEL: Record<string, string> = {
  STANDBY: 'Chờ',
  POLTEST: 'Kiểm tra cực tính',
  OFFGRID: 'Đang phát độc lập',
  SYNC: 'Đang đồng bộ lưới',
  CLOSING: 'Đang đóng lưới',
  GRID: 'Đã hòa lưới',
  FAULT: 'Lỗi',
};

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
  '13': 'Firmware sai loại sản phẩm',
};

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
};
