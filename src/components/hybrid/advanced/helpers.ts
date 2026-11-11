import { isAxiosError } from 'axios';
import { getHybridAdvanced } from '../../../services/api';
import type { HybridAdvanced as Adv } from '../../../types';

export type Result = { ok: boolean; err?: string; key?: string };

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Chờ kết quả của lệnh vừa gửi (ACK / NAK), tối đa ~8 s. */
export async function waitResult(deviceId: string, requestAt: string): Promise<{ r: Result; a: Adv | null }> {
  const since = new Date(requestAt).getTime();
  let last: Adv | null = null;
  for (let i = 0; i < 12; i++) {
    await sleep(700);
    try {
      last = await getHybridAdvanced(deviceId);
      if (last.result && new Date(last.result.at).getTime() >= since) return { r: last.result, a: last };
    } catch {
      // thử lại
    }
  }
  return { r: { ok: false, err: 'TIMEOUT' }, a: last };
}

export function errText(e: unknown): string {
  if (isAxiosError(e)) {
    const m = e.response?.data?.message;
    if (typeof m === 'string') return m;
  }
  return 'Không gửi được lệnh, hãy thử lại.';
}
