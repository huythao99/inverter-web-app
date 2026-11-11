// HINVLF: khung tin ($TLM / $CFG ...), số, điện năng, luồng năng lượng.
import type { HinvlfFrame } from '../../types';

export const num = (v?: string | number | null): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const x = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(x) ? x : undefined;
};

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

/** Dưới mức này (W) coi như không có dòng: "Nghỉ", mũi tên đứng yên. */
export const ACTIVE_W = 10;

export interface HybridFlow {
  pinv?: number; // + xả pin / − sạc pin
  pgrid?: number; // + lấy lưới / − đẩy lưới
  load?: number; // tải trong nhà, ≥ 0
  gridOk: boolean;
  batteryState: string;
  gridState: string;
}

/**
 * Luồng năng lượng từ $TLM. Nhà = PINV + PGRID (giao thức mục 6, chỉ đúng
 * khi CT lắp ngay sau công tơ). Cùng luật với app (HybridFlow.fromTlm).
 */
export function hybridFlow(t: HinvlfFrame = {}): HybridFlow {
  const pinv = num(t.PINV);
  const pgrid = num(t.PGRID);
  const gridOk = t.GRID === '1';
  return {
    pinv,
    pgrid,
    gridOk,
    load: pinv !== undefined ? Math.max(0, pinv + (pgrid ?? 0)) : undefined,
    batteryState:
      pinv === undefined ? '' : pinv >= ACTIVE_W ? 'Đang xả' : pinv <= -ACTIVE_W ? 'Đang sạc' : 'Nghỉ',
    gridState:
      pgrid === undefined
        ? ''
        : pgrid >= ACTIVE_W
          ? 'Đang lấy lưới'
          : pgrid <= -ACTIVE_W
            ? 'Đang đẩy lưới'
            : gridOk
              ? 'Có lưới'
              : 'Không có lưới',
  };
}
