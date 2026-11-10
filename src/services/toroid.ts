// Toroidal (ring core) transformer estimate from the core size: power, turns
// per volt, core section and weight. Same formulas as the shop's calculator:
// B = 1.5 T, 50 Hz, window fill 0.35, efficiency 0.95, J = 3 A/mm² (range
// 2.5 continuous / cool – 3.5 intermittent load). Steel 7.65 g/cm³.

export const TOROID = { B: 1.5, F: 50, KU: 0.35, ETA: 0.95, J: 3, J_LOW: 2.5, J_HIGH: 3.5, KFE: 0.96, STEEL: 7.65e-6 };

export type CoreQuality = 'ok' | 'warn' | 'bad';

export interface ToroidInput {
  od: number; // outer diameter, mm
  id: number; // inner diameter, mm
  h: number; // height, mm
  mass?: number; // weighed bare core, kg (optional)
}

export interface ToroidResult {
  ok: boolean;
  /** W, rounded to 10; low/high = J 2.5 / 3.5. */
  power: number;
  powerLow: number;
  powerHigh: number;
  turnsPerVolt: number;
  turns220: number;
  /** Effective iron section, cm². */
  areaCm2: number;
  /** kg: the weighed mass, else estimated with the stacking factor. */
  massKg: number;
  massWeighed: boolean;
  /** Mass of a 100 % solid steel ring of that size, kg. */
  massSolid: number;
  /** Stacking factor from the weighed mass (undefined without a weight). */
  stacking?: { k: number; quality: CoreQuality; title: string; detail: string };
}

const round10 = (x: number) => Math.round(x / 10) * 10;

export function toroid({ od, id, h, mass }: ToroidInput): ToroidResult {
  const { B, F, KU, ETA, STEEL } = TOROID;
  const ok = od > id && id > 0 && h > 0;
  const massSolid = ((Math.PI / 4) * (od * od - id * id) * h) * STEEL;
  let kfe = TOROID.KFE;
  let stacking: ToroidResult['stacking'];
  const weighed = !!mass && mass > 0 && ok;
  if (weighed) {
    const k = mass! / massSolid;
    kfe = Math.min(k, 1);
    if (k > 1.03) {
      kfe = TOROID.KFE;
      stacking = {
        k,
        quality: 'bad',
        title: 'Kiểm tra lại',
        detail: 'Nặng hơn mức tối đa có thể. Đo lại kích thước, hoặc khối lượng đang tính cả vỏ, keo, dây.',
      };
    } else if (k >= 0.94) {
      stacking = { k, quality: 'ok', title: 'Lõi tốt', detail: 'Lá thép quấn chặt, đủ sắt. Công suất đúng như tính.' };
    } else if (k >= 0.88) {
      stacking = {
        k,
        quality: 'warn',
        title: 'Trung bình',
        detail: 'Quấn hơi lỏng hoặc lá dày lớp cách điện. Công suất giảm theo.',
      };
    } else {
      stacking = {
        k,
        quality: 'bad',
        title: 'Lõi kém',
        detail: 'Thiếu sắt nhiều: quấn lỏng, lá mỏng xen giấy, hoặc kích thước đo chưa đúng. Lõi dễ nóng, ồn.',
      };
    }
  }
  const ae = ((od - id) / 2) * h * kfe; // mm²
  const wa = (Math.PI * id * id) / 4; // mm²
  const p = (j: number) => (4.44 * F * B * ae * 1e-6 * wa * 1e-6 * KU * j * 1e6) / (1 + 1 / ETA);
  const tpv = 1 / (4.44 * F * B * ae * 1e-6);
  return {
    ok,
    power: ok ? round10(p(TOROID.J)) : 0,
    powerLow: ok ? round10(p(TOROID.J_LOW)) : 0,
    powerHigh: ok ? round10(p(TOROID.J_HIGH)) : 0,
    turnsPerVolt: ok ? tpv : 0,
    turns220: ok ? Math.ceil(220 * tpv) : 0,
    areaCm2: ok ? ae / 100 : 0,
    massKg: ok ? (weighed ? mass! : massSolid * kfe) : 0,
    massWeighed: weighed,
    massSolid,
    stacking,
  };
}
