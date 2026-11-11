// So sánh phiên bản "M.m.p" (ESP32, STM32). Phần không phải số bị bỏ:
// "5.4.15b" = 5.4.15. Chuỗi không có số (rỗng, "--") coi như bằng nhau để
// không báo "có bản mới" khi chưa biết phiên bản.

function parts(v?: string | null): number[] | null {
  if (!v || !/\d/.test(v)) return null;
  return v.trim().split('.').map((x) => parseInt(x.replace(/[^0-9]/g, ''), 10) || 0);
}

/** < 0: a cũ hơn b (có bản mới), 0: bằng / không so được, > 0: a mới hơn. */
export function compareVersions(a?: string | null, b?: string | null): number {
  const x = parts(a);
  const y = parts(b);
  if (!x || !y) return 0;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/** v >= min. Chưa biết v: true (không chặn). */
export const versionAtLeast = (v: string | null | undefined, min: string) => compareVersions(v, min) >= 0;
