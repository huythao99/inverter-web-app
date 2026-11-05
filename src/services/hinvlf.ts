// HINVLF v1 (inverter hybrid biến áp sắt) — nhãn hiển thị + kiểm tra cài đặt
// phía web. Cùng quy tắc với BE (nestjs-app src/constants/hybrid.constants.ts)
// và esp32-hybrid PROTOCOL_HINVLF_V1.md.
import type { HinvlfFrame, HybridConfig, HybridMode, HybridNumberKey } from '../types';

export const num = (v?: string | number | null): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const x = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(x) ? x : undefined;
};

export const ST_LABEL: Record<string, string> = {
  RUN: 'Đang chạy',
  IDLE: 'Đang chờ',
  OFF: 'Chế độ tắt',
  STOP: 'Đã dừng từ app',
  FLT: 'Đang lỗi',
};

export const MODES: { id: HybridMode; label: string; desc: string }[] = [
  { id: 'LOAD', label: 'Bám tải', desc: 'Hòa lưới, phát đủ cho tải trong nhà (cần CT lưới)' },
  {
    id: 'LOADACC',
    label: 'Bám tải + sạc dư',
    desc: 'Bám tải; khi inverter PV khác trong nhà phát dư ra lưới thì sạc pin phần dư (cần CT lưới, máy từ 5.4.10)',
  },
  { id: 'EXPORT', label: 'Đẩy lưới', desc: 'Hòa lưới, đẩy công suất cố định lên lưới' },
  {
    id: 'ACCOUPLE',
    label: 'Sạc điện dư',
    desc: 'Không xả pin; chỉ sạc phần điện dư đang đẩy ra lưới từ inverter PV khác (cần CT lưới)',
  },
  { id: 'CHG', label: 'Sạc từ lưới', desc: 'Lấy điện lưới sạc pin' },
  { id: 'OFFGRID', label: 'Độc lập', desc: 'Không hòa lưới, tự phát điện từ pin' },
  { id: 'OFF', label: 'Tắt', desc: 'Không phát, không sạc' },
];
export const MODE_LABEL: Record<string, string> = Object.fromEntries(
  MODES.map((m) => [m.id, m.label])
);

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

export interface FieldDef {
  key: HybridNumberKey;
  label: string;
  unit: 'W' | 'V';
  step: number;
  hint: string;
  /** Chế độ dùng tham số này (để làm nổi bật). */
  modes?: HybridMode[];
}

export const FIELDS: FieldDef[] = [
  { key: 'PEXP', label: 'Công suất đẩy lưới', unit: 'W', step: 10, hint: 'Chế độ Đẩy lưới', modes: ['EXPORT'] },
  {
    key: 'VEXP',
    label: 'Áp dừng xả (hòa lưới)',
    unit: 'V',
    step: 0.1,
    hint: 'Khi hòa lưới: pin về gần mức này thì giảm dần công suất xả, giữ pin ở mức này',
    modes: ['LOAD', 'EXPORT', 'LOADACC'],
  },
  {
    key: 'PIMP',
    label: 'Công suất nhận lưới',
    unit: 'W',
    step: 10,
    hint: 'Bám tải: giữ mức lấy lưới này (âm = đẩy ra)',
    modes: ['LOAD', 'LOADACC'],
  },
  {
    key: 'PCHG',
    label: 'Công suất sạc pin',
    unit: 'W',
    step: 10,
    hint: 'Sạc từ lưới; mức sạc tối đa từ điện dư (Sạc điện dư, Bám tải + sạc dư)',
    modes: ['CHG', 'ACCOUPLE', 'LOADACC'],
  },
  { key: 'VCUT', label: 'Pin ngắt xả (độc lập)', unit: 'V', step: 0.1, hint: 'Khi chạy độc lập: pin xuống mức này thì ngừng xả', modes: ['OFFGRID'] },
  { key: 'VRES', label: 'Pin chạy lại (độc lập)', unit: 'V', step: 0.1, hint: 'Khi chạy độc lập: pin lên lại mức này thì chạy tiếp', modes: ['OFFGRID'] },
  { key: 'PMAX', label: 'Công suất tối đa', unit: 'W', step: 100, hint: '500 – 6000 W' },
  { key: 'PCMAX', label: 'Công suất sạc tối đa', unit: 'W', step: 100, hint: '100 – 6000 W' },
];

export const READONLY: { key: string; label: string; unit?: string }[] = [
  { key: 'VCV', label: 'Áp sạc', unit: 'V' },
  { key: 'VOVP', label: 'Quá áp pin', unit: 'V' },
  { key: 'SYS', label: 'Hệ pin', unit: 'V' },
  { key: 'FHZ', label: 'Tần số', unit: 'Hz' },
  { key: 'VGMAX', label: 'Áp lưới tối đa', unit: 'V' },
  { key: 'VGMIN', label: 'Áp lưới tối thiểu', unit: 'V' },
  { key: 'VBMAX', label: 'Áp pin tối đa', unit: 'V' },
];

/** $CFG -> config (9 tham số ghi được). */
export function configFromCfg(cfg?: HinvlfFrame | null): HybridConfig {
  const c: HybridConfig = {};
  if (!cfg) return c;
  if (cfg.MODE) c.MODE = cfg.MODE as HybridMode;
  for (const f of FIELDS) {
    const v = num(cfg[f.key]);
    if (v !== undefined) c[f.key] = v;
  }
  return c;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Dải hợp lệ của từng ô theo giá trị đang nhập (ràng buộc chéo). */
export function fieldRange(
  key: HybridNumberKey,
  c: HybridConfig,
  cfg?: HinvlfFrame | null
): [number, number | undefined] {
  const vcv = num(cfg?.VCV);
  const vbmax = num(cfg?.VBMAX);
  switch (key) {
    case 'PMAX':
      return [500, 6000];
    case 'PCMAX':
      return [100, 6000];
    case 'PIMP':
      return [-500, 500];
    case 'PCHG':
      return [0, c.PCMAX ?? 6000];
    case 'PEXP':
      return [0, c.PMAX ?? 6000];
    case 'VCUT': {
      const hi = [vbmax, c.VRES !== undefined ? r1(c.VRES - 0.5) : undefined].filter(
        (x): x is number => x !== undefined
      );
      return [5, hi.length ? Math.min(...hi) : undefined];
    }
    case 'VRES': {
      const hi = [vbmax, vcv !== undefined ? r1(vcv - 0.5) : undefined].filter(
        (x): x is number => x !== undefined
      );
      return [c.VCUT !== undefined ? r1(c.VCUT + 0.1) : 5, hi.length ? Math.min(...hi) : undefined];
    }
    case 'VEXP':
      return [c.VRES ?? 5, vcv];
  }
}

export function validate(c: HybridConfig, cfg?: HinvlfFrame | null): Partial<Record<HybridNumberKey, string>> {
  const errors: Partial<Record<HybridNumberKey, string>> = {};
  for (const f of FIELDS) {
    const v = c[f.key];
    if (v === undefined) continue;
    if (!Number.isFinite(v)) {
      errors[f.key] = 'Nhập một số';
      continue;
    }
    const [lo, hi] = fieldRange(f.key, c, cfg);
    if (v < lo || (hi !== undefined && v > hi)) {
      errors[f.key] = `Trong khoảng ${lo} – ${hi ?? '…'} ${f.unit}`;
    }
  }
  return errors;
}

/** Quy tắc kéo theo của máy cho các ô người dùng không sửa. */
export function pullAlong(c: HybridConfig, edited: Set<string>): HybridConfig {
  const n = { ...c };
  if (!edited.has('PEXP') && n.PMAX !== undefined && n.PEXP !== undefined && n.PEXP > n.PMAX) n.PEXP = n.PMAX;
  if (!edited.has('PCHG') && n.PCMAX !== undefined && n.PCHG !== undefined && n.PCHG > n.PCMAX) n.PCHG = n.PCMAX;
  if (!edited.has('VEXP') && n.VRES !== undefined && n.VEXP !== undefined && n.VEXP < n.VRES) n.VEXP = n.VRES;
  return n;
}

/** Parse "$NAK,SET,ERR=RANGE*xx" -> { type, words, items }. */
export function parseHinvlf(raw: string): { type: string; words: string[]; items: HinvlfFrame } | null {
  const t = (raw ?? '').trim();
  if (t[0] !== '$') return null;
  const star = t.lastIndexOf('*');
  const [type, ...rest] = t.slice(1, star === -1 ? undefined : star).split(',');
  if (!type) return null;
  const words: string[] = [];
  const items: HinvlfFrame = {};
  for (const it of rest) {
    const eq = it.indexOf('=');
    if (eq > 0) items[it.slice(0, eq)] = it.slice(eq + 1);
    else if (it) words.push(it);
  }
  return { type, words, items };
}

export const kwh = (wh?: number) =>
  wh === undefined ? '--' : (wh / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// ---------------------------------------------------------------------------
// Cài đặt nâng cao (STM32 >= 5.4.12, $GET,ADV / $SETADV)
// ---------------------------------------------------------------------------

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
