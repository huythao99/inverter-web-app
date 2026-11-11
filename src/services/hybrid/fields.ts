// HINVLF: tham số cài đặt, dải hợp lệ, quy tắc kéo theo. Cùng quy tắc với
// BE (nestjs-app src/constants/hybrid.constants.ts) và app
// (lib/models/hybrid/hybrid_fields.dart).
import type { HinvlfFrame, HybridConfig, HybridMode, HybridNumberKey } from '../../types';
import { fmtNumber, fmtVolt, fmtWatt } from '../../utils/fmt';
import { num } from './frame';

export interface FieldDef {
  key: HybridNumberKey;
  label: string;
  unit: 'W' | 'V';
  step: number;
  hint: string;
  /** Chế độ dùng tham số này. */
  modes?: HybridMode[];
}

export const FIELDS: FieldDef[] = [
  { key: 'PEXP', label: 'Công suất đẩy lưới', unit: 'W', step: 10, hint: 'Công suất cố định đẩy lên lưới', modes: ['EXPORT'] },
  {
    key: 'VEXP',
    label: 'Áp dừng xả',
    unit: 'V',
    step: 0.1,
    hint: 'Khi hòa lưới: pin về gần mức này thì giảm dần xả, giữ pin ở mức này',
    modes: ['LOAD', 'EXPORT', 'LOADACC'],
  },
  { key: 'PIMP', label: 'Công suất nhận lưới', unit: 'W', step: 10, hint: 'Mức lấy từ lưới khi bám tải', modes: ['LOAD', 'LOADACC'] },
  {
    key: 'PCHG',
    label: 'Công suất sạc pin',
    unit: 'W',
    step: 10,
    hint: 'Sạc từ lưới; mức sạc tối đa từ điện dư',
    modes: ['CHG', 'ACCOUPLE', 'LOADACC'],
  },
  { key: 'VCUT', label: 'Pin ngắt xả', unit: 'V', step: 0.1, hint: 'Khi chạy độc lập: pin xuống mức này thì ngừng xả', modes: ['OFFGRID'] },
  { key: 'VRES', label: 'Pin chạy lại', unit: 'V', step: 0.1, hint: 'Khi chạy độc lập: pin lên lại mức này thì chạy tiếp', modes: ['OFFGRID'] },
  { key: 'PMAX', label: 'Công suất tối đa', unit: 'W', step: 100, hint: '500 – 6000 W' },
  { key: 'PCMAX', label: 'Công suất sạc tối đa', unit: 'W', step: 100, hint: '100 – 6000 W' },
];

export const FIELD: Record<HybridNumberKey, FieldDef> = Object.fromEntries(
  FIELDS.map((f) => [f.key, f])
) as Record<HybridNumberKey, FieldDef>;

/** Thang điện áp pin, hiển thị từ trên xuống. */
export const LADDER_KEYS: HybridNumberKey[] = ['VEXP', 'VRES', 'VCUT'];
/** Giới hạn công suất chung cho mọi chế độ. */
export const LIMIT_KEYS: HybridNumberKey[] = ['PMAX', 'PCMAX'];

/** Ô công suất riêng của chế độ (thang điện áp và giới hạn để riêng). */
export const modeFields = (mode?: HybridMode) =>
  FIELDS.filter((f) => f.unit === 'W' && !!mode && f.modes?.includes(mode));

/** Chế độ có dùng mức điện áp này không. */
export const modeUsesKey = (mode: HybridMode | undefined, key: HybridNumberKey) =>
  !!mode && !!FIELD[key].modes?.includes(mode);

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
const minOf = (xs: (number | undefined)[]) => {
  const l = xs.filter((x): x is number => x !== undefined);
  return l.length ? Math.min(...l) : undefined;
};

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
    case 'VCUT':
      return [5, minOf([vbmax, c.VRES !== undefined ? r1(c.VRES - 0.5) : undefined])];
    case 'VRES':
      return [
        c.VCUT !== undefined ? r1(c.VCUT + 0.5) : 5,
        minOf([vbmax, vcv !== undefined ? r1(vcv - 0.5) : undefined]),
      ];
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
      errors[f.key] = `Trong khoảng ${fmtNumber(lo)} – ${hi === undefined ? '…' : fmtNumber(hi)} ${f.unit}`;
    }
  }
  return errors;
}

// Thang từ thấp lên: Pin ngắt xả < Pin chạy lại ≤ Áp dừng xả (≤ Áp sạc).
const LADDER_UP: HybridNumberKey[] = ['VCUT', 'VRES', 'VEXP'];
const LADDER_GAP = [0.5, 0]; // VCUT→VRES ≥ 0,5 V; VRES→VEXP ≥ 0

/**
 * Quy tắc kéo theo cho các ô người dùng KHÔNG sửa: công suất theo giới hạn,
 * thang điện áp giữ đúng thứ tự (ô vừa sửa đứng yên, ô khác dịch theo).
 * Máy nhận cả bộ trong một $SET (nguyên tử, giao thức §3).
 */
export function pullAlong(c: HybridConfig, edited: Set<string>): HybridConfig {
  const n = { ...c };
  if (!edited.has('PEXP') && n.PMAX !== undefined && n.PEXP !== undefined && n.PEXP > n.PMAX) n.PEXP = n.PMAX;
  if (!edited.has('PCHG') && n.PCMAX !== undefined && n.PCHG !== undefined && n.PCHG > n.PCMAX) n.PCHG = n.PCMAX;
  const v = LADDER_UP.map((k) => n[k]);
  if (v.every((x): x is number => x !== undefined && Number.isFinite(x))) {
    const l = v as number[];
    for (let i = 1; i < l.length; i++) {
      const min = r1(l[i - 1] + LADDER_GAP[i - 1]);
      if (l[i] < min && !edited.has(LADDER_UP[i])) l[i] = min;
    }
    for (let i = l.length - 2; i >= 0; i--) {
      const max = r1(l[i + 1] - LADDER_GAP[i]);
      if (l[i] > max && !edited.has(LADDER_UP[i])) l[i] = max;
    }
    LADDER_UP.forEach((k, i) => (n[k] = l[i]));
  }
  return n;
}

/** Dòng gợi ý dưới ô: dải hợp lệ và VÌ SAO (giới hạn bởi ô nào). */
export function rangeHint(key: HybridNumberKey, c: HybridConfig, cfg: HinvlfFrame | null | undefined, edited: Set<string>): string {
  const n = (x?: number | string | null) => {
    const d = num(x ?? undefined);
    return d === undefined ? '…' : fmtNumber(d);
  };
  switch (key) {
    case 'PEXP':
      return `0 – ${n(c.PMAX)} W (tối đa = Công suất tối đa)`;
    case 'PCHG':
      return `0 – ${n(c.PCMAX)} W (tối đa = Công suất sạc tối đa)`;
    case 'PIMP':
      return '-500 – 500 W · âm = đẩy ra lưới';
    case 'PMAX':
      return '500 – 6000 W';
    case 'PCMAX':
      return '100 – 6000 W';
    case 'VEXP':
      return edited.has('VRES')
        ? `Từ Pin chạy lại (${n(c.VRES)} V) đến Áp sạc (${n(cfg?.VCV)} V)`
        : `Tối đa bằng Áp sạc (${n(cfg?.VCV)} V). Đặt thấp hơn Pin chạy lại thì Pin chạy lại tự hạ theo`;
    case 'VRES':
      return `Tối đa ${n(fieldRange('VRES', c, cfg)[1])} V (dưới Áp sạc 0,5 V). Áp dừng xả và Pin ngắt xả tự chỉnh theo`;
    case 'VCUT':
      return 'Thấp hơn Pin chạy lại ít nhất 0,5 V. Đặt cao hơn thì Pin chạy lại tự nâng theo';
  }
}

/**
 * Câu "máy sẽ làm gì" khi chuyển sang mode (hộp xác nhận). Theo
 * PROTOCOL_HINVLF_V1.md; chưa được bên STM32 xác nhận: OFF (tải có mất điện
 * không), Áp dừng xả ở chế độ bám tải.
 */
export function modeEffect(mode: HybridMode, c: HybridConfig): string {
  switch (mode) {
    case 'OFF':
      return 'Máy ngừng phát và ngừng sạc. Thiết bị đang lấy điện từ máy sẽ mất điện.';
    case 'OFFGRID':
      return `Máy tách khỏi lưới và phát từ pin. Pin xuống ${fmtVolt(c.VCUT)} (Pin ngắt xả) thì máy ngừng phát.`;
    case 'CHG':
      return `Máy lấy điện lưới để sạc pin, tối đa ${fmtWatt(c.PCHG)}.`;
    case 'EXPORT':
      return `Máy đẩy cố định ${fmtWatt(c.PEXP)} lên lưới, tới khi pin về ${fmtVolt(c.VEXP)}.`;
    case 'LOAD':
    case 'LOADACC':
      return `Máy hòa lưới và phát theo tải trong nhà (cần CT lưới lắp đúng), giữ pin trên ${fmtVolt(c.VEXP)}.`;
    case 'ACCOUPLE':
      return 'Máy không xả pin, chỉ sạc phần điện dư từ inverter PV khác (cần CT lưới).';
  }
}

/** Giá trị hiển thị trong ô nhập. */
export const fieldText = (f: FieldDef, v?: number) =>
  v === undefined ? '' : f.unit === 'V' ? v.toFixed(1) : String(Math.round(v));
