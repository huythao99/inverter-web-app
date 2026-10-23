import { getDatabase, ref, get, set, update, onValue, type Database } from 'firebase/database';
import { app } from './firebase';

// ---------------------------------------------------------------------------
// Old inverters (GTIControl numbered < 400) still talk to Firebase Realtime
// Database, not MQTT. Same paths and formats as the mobile app
// (flutter/inverter: DeviceTypeHelper.usesMqtt, status/setting/schedules
// widgets):
//   /data/inverter/battery/{uid}/{id}/last            {value: "<frame>", ...}
//   /data/inverter/battery/{uid}/{id}/updatedAt       ISO time of the last frame
//   /data/inverter/battery/{uid}/{id}/setup/value     "VVVVPPPP" setting
//   /data/inverter/battery/{uid}/{id}/schedule/value  "start=..&end=..&value=..#..."
// The signed-in Firebase user reads/writes its own branch directly.
// ---------------------------------------------------------------------------

const INVERTER_PREFIX = 'GTIControl';

/** Inverters numbered >= 400 use MQTT; older ones Firebase. Accepts "GTIControl401" or "401". */
export function usesMqtt(deviceId: string): boolean {
  if (deviceId.startsWith('ChargerControl') || deviceId.startsWith('HybridControl')) return true;
  const num = deviceId.startsWith(INVERTER_PREFIX) ? deviceId.slice(INVERTER_PREFIX.length) : deviceId;
  if (!/^\d+$/.test(num)) return false;
  return Number(num) >= 400;
}

export const isLegacyInverter = (deviceId: string | undefined): boolean =>
  !!deviceId && !usesMqtt(deviceId);

let db: Database | null = null;
function rtdb(): Database {
  if (!db) {
    const url = import.meta.env.VITE_FIREBASE_DATABASE_URL;
    db = url ? getDatabase(app, url) : getDatabase(app);
  }
  return db;
}

const base = (uid: string, deviceId: string) => `/data/inverter/battery/${uid}/${deviceId}`;

/** Live `last` frame. Returns the unsubscribe function. */
export function watchLegacyLast(
  uid: string,
  deviceId: string,
  cb: (last: { value?: string; totalACapacity?: unknown; totalA2Capacity?: unknown } | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onValue(
    ref(rtdb(), `${base(uid, deviceId)}/last`),
    (snap) => cb((snap.val() as Record<string, unknown> | null) as never),
    (e) => onError?.(e),
  );
}

/** Live `updatedAt` (ISO string or null). */
export function watchLegacyUpdatedAt(
  uid: string,
  deviceId: string,
  cb: (updatedAt: string | null) => void,
  onError?: (e: Error) => void,
): () => void {
  return onValue(
    ref(rtdb(), `${base(uid, deviceId)}/updatedAt`),
    (snap) => {
      const v = snap.val() as unknown;
      cb(v == null ? null : String(v));
    },
    (e) => onError?.(e),
  );
}

export async function getLegacyLast(uid: string, deviceId: string) {
  const snap = await get(ref(rtdb(), `${base(uid, deviceId)}/last`));
  return (snap.val() as { value?: string; totalACapacity?: unknown; totalA2Capacity?: unknown } | null) ?? null;
}

export async function getLegacySetting(uid: string, deviceId: string): Promise<string> {
  const snap = await get(ref(rtdb(), `${base(uid, deviceId)}/setup/value`));
  return snap.exists() ? String(snap.val()) : '';
}

/** Same write as the app: update {value} under setup. */
export async function setLegacySetting(uid: string, deviceId: string, value: string): Promise<void> {
  await update(ref(rtdb(), `${base(uid, deviceId)}/setup`), { value });
}

export async function getLegacySchedule(uid: string, deviceId: string): Promise<string> {
  const snap = await get(ref(rtdb(), `${base(uid, deviceId)}/schedule/value`));
  return snap.exists() ? String(snap.val()) : '';
}

export async function setLegacySchedule(uid: string, deviceId: string, schedule: string): Promise<void> {
  await set(ref(rtdb(), `${base(uid, deviceId)}/schedule/value`), schedule);
}

/** Online rule of the app: last frame younger than 5 s at load; afterwards
 * every new updatedAt = online, offline 35 s after the last one. */
export const LEGACY_ONLINE_AT_LOAD_MS = 5_000;
export const LEGACY_OFFLINE_AFTER_MS = 35_000;
