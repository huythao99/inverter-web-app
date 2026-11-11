// HINVLF: cài đặt nâng cao (STM32 >= 5.4.12, $GET,ADV / $SETADV, giao thức mục 13).

export interface AdvField {
  key: string;
  label: string;
  unit: string;
  /** Lựa chọn cố định (select); không có = ô số. */
  options?: { value: string; label: string }[];
  step?: number;
  hint?: string;
  /** Hỏi lại trước khi gửi (đặt sai có thể hỏng pin). */
  confirm?: boolean;
}

export const ADV_GROUPS: { title: string; fields: AdvField[] }[] = [
  {
    title: 'Hệ thống',
    fields: [
      {
        key: 'SYS', label: 'Hệ pin', unit: 'V', confirm: true,
        options: ['12', '24', '36', '48', '60', '72'].map((v) => ({ value: v, label: `${v} V` })),
        hint: 'Đổi hệ pin sẽ nạp lại toàn bộ ngưỡng pin và giới hạn công suất',
      },
      { key: 'FHZ', label: 'Tần số', unit: 'Hz', options: [{ value: '50', label: '50 Hz' }, { value: '60', label: '60 Hz' }] },
    ],
  },
  {
    title: 'Biến áp',
    fields: [
      { key: 'N', label: 'Tỉ số biến áp', unit: '', step: 0.01, hint: '1,01 – 39,99. Đổi tỉ số thì điện cảm rò về 0 (máy đo lại)' },
      { key: 'CF', label: 'Tụ lọc Cf', unit: 'µF', step: 0.1, hint: '0,6 – 99,9 µF' },
      { key: 'LF', label: 'Điện cảm rò Lf', unit: 'mH', step: 0.1, hint: '0 = máy tự đo khi khởi động' },
      {
        key: 'HALL', label: 'Hall sơ cấp', unit: '',
        options: [{ value: 'AUTO', label: 'Tự động' }, { value: 'YES', label: 'Có' }, { value: 'NO', label: 'Không' }],
      },
    ],
  },
  {
    title: 'Ngưỡng pin',
    fields: [
      { key: 'VCV', label: 'Áp sạc', unit: 'V', step: 0.1, confirm: true, hint: 'Cao hơn áp chạy lại ít nhất 0,5 V' },
      { key: 'VOVP', label: 'Pin quá áp', unit: 'V', step: 0.1, confirm: true, hint: 'Cao hơn áp sạc ít nhất 0,5 V' },
    ],
  },
  {
    title: 'Cửa sổ lưới',
    fields: [
      { key: 'VGMAX', label: 'Áp lưới cao nhất', unit: 'V', step: 1, hint: '230 – 280 V' },
      { key: 'VGMIN', label: 'Áp lưới thấp nhất', unit: 'V', step: 1, hint: '150 – 205 V' },
    ],
  },
];

/** Hiệu chỉnh: key gửi, số đo, hệ số, điều kiện (NOSIGNAL). */
export const ADV_CAL: { key: string; label: string; unit: string; measured: string; factor: string; need: string; decimals: number }[] = [
  { key: 'CVO', label: 'Áp ra', unit: 'V', measured: 'MVO', factor: 'KVO', need: 'Cần áp ra ≥ 50 V: cho máy chạy chế độ độc lập', decimals: 1 },
  { key: 'CVG', label: 'Áp lưới', unit: 'V', measured: 'MVG', factor: 'KVG', need: 'Cần áp lưới ≥ 50 V: cắm lưới', decimals: 1 },
  { key: 'CVB', label: 'Áp pin', unit: 'V', measured: 'MVB', factor: 'KVB', need: 'Cần áp pin ≥ 10 V: nối pin', decimals: 2 },
  { key: 'CII', label: 'Dòng CT inverter', unit: 'A', measured: 'MII', factor: 'KII', need: 'Cần dòng ≥ 0,5 A: cần có tải', decimals: 2 },
  { key: 'CIG', label: 'Dòng CT lưới', unit: 'A', measured: 'MIG', factor: 'KIG', need: 'Cần dòng ≥ 0,5 A: cần có tải', decimals: 2 },
];

export const ADV_LABEL: Record<string, string> = Object.fromEntries([
  ...ADV_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.label])),
  ...ADV_CAL.map((c) => [c.key, `Hiệu chỉnh ${c.label.toLowerCase()}`]),
  ['FACT', 'Cài đặt gốc'],
]);

/** Câu báo khi $SETADV bị từ chối (mục 11). */
export function advErrorText(err?: string, key?: string): string {
  const cal = ADV_CAL.find((c) => c.key === key);
  switch (err) {
    case 'PW': return 'Sai mật khẩu.';
    case 'PWLOCK': return 'Sai mật khẩu quá nhiều lần. Thử lại sau 5 phút.';
    case 'RUNNING': return 'Phải tắt máy trước khi đổi mục này.';
    case 'NOSIGNAL': return cal ? cal.need : 'Tín hiệu đo quá nhỏ để hiệu chỉnh.';
    case 'LOCKED': return 'Máy đang bị khóa hoặc lỗi, không chỉnh được.';
    case 'LOCAL': return 'Máy đang ở chế độ chỉnh tay. Trên máy chọn Cai dat tu = APP.';
    case 'BUSY': return 'Có người đang thao tác trên máy. Thử lại sau.';
    case 'RANGE':
      if (cal) return 'Số nhập lệch quá 20 % so với số máy đo.';
      return `Giá trị ngoài dải cho phép${key ? ` (${ADV_LABEL[key] ?? key})` : ''}.`;
    case 'VALUE': return `Giá trị không hợp lệ${key ? ` (${ADV_LABEL[key] ?? key})` : ''}.`;
    case 'KEY': return 'Tham số này không chỉnh được ở đây.';
    case 'FLASH': return 'Lưu thất bại, thử lại.';
    case 'UNSUP': return 'Máy chưa hỗ trợ cài đặt nâng cao.';
    case 'TIMEOUT': return 'Máy không phản hồi. Xem lại giá trị đang chạy trước khi gửi lại.';
    default: return `Máy từ chối (${err ?? '?'}).`;
  }
}
