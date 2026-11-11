// Định dạng số đo / thời gian hiển thị, dùng chung cho các màn thiết bị.

const toNum = (v: unknown): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const x = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : undefined;
};

/** 53 -> "53", 56.5 -> "56.5" (bỏ ".0" thừa). */
export const fmtNumber = (v: number, maxDigits = 1) =>
  Number.isInteger(v) ? String(v) : v.toFixed(maxDigits);

/** "53.0 V"; không có số -> empty. */
export function fmtVolt(v: unknown, { digits = 1, empty = '--', space = true } = {}): string {
  const d = toNum(v);
  return d === undefined ? empty : `${d.toFixed(digits)}${space ? ' ' : ''}V`;
}

/** "1512 W"; từ 10 000 W: "12.5 kW". abs: bỏ dấu (chiều thể hiện riêng). */
export function fmtWatt(v: unknown, { empty = '--', abs = false, space = true } = {}): string {
  let d = toNum(v);
  if (d === undefined) return empty;
  if (abs) d = Math.abs(d);
  const sp = space ? ' ' : '';
  return Math.abs(d) >= 10000 ? `${(d / 1000).toFixed(1)}${sp}kW` : `${Math.round(d)}${sp}W`;
}

/** Hôm nay: "14:32"; ngày khác: "09/11 14:32". */
export function fmtShortTime(iso?: string | null): string {
  if (!iso) return '--';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '--';
  const hm = t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const now = new Date();
  if (t.toDateString() === now.toDateString()) return hm;
  return `${t.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${hm}`;
}

export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');
