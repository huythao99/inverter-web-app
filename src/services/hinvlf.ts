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
  { id: 'EXPORT', label: 'Đẩy lưới', desc: 'Hòa lưới, đẩy công suất cố định lên lưới' },
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
  '7': 'F7 – Lỗi CT lưới (thiếu / hở / ngược)',
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
  { key: 'VEXP', label: 'Áp ngừng đẩy lưới', unit: 'V', step: 0.1, hint: 'Pin dưới mức này thì ngừng đẩy (Đẩy lưới)', modes: ['EXPORT'] },
  { key: 'PIMP', label: 'Công suất nhận lưới', unit: 'W', step: 10, hint: 'Bám tải: giữ mức lấy lưới này (âm = đẩy ra)', modes: ['LOAD'] },
  { key: 'PCHG', label: 'Công suất sạc pin', unit: 'W', step: 10, hint: 'Chế độ Sạc từ lưới', modes: ['CHG'] },
  { key: 'VCUT', label: 'Pin ngắt xả', unit: 'V', step: 0.1, hint: 'Pin xuống mức này thì ngừng xả' },
  { key: 'VRES', label: 'Pin chạy lại', unit: 'V', step: 0.1, hint: 'Pin lên lại mức này thì chạy tiếp' },
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
