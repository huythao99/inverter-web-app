import { useEffect, useState } from 'react';
import { auth } from '../services/firebase';
import {
  LEGACY_OFFLINE_AFTER_MS,
  LEGACY_ONLINE_AT_LOAD_MS,
  isLegacyInverter,
  watchLegacyUpdatedAt,
} from '../services/legacyInverter';
import type { OnlineState } from './useDevicesOnline';

/**
 * Online state of the old inverters (< 400) of a list, from Firebase
 * `updatedAt` (same rules as the app's device list). Other ids are ignored.
 */
export function useLegacyDevicesOnline(deviceIds: string[]): Record<string, OnlineState> {
  const [states, setStates] = useState<Record<string, OnlineState>>({});
  const legacy = deviceIds.filter(isLegacyInverter);
  const key = legacy.join(',');

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !key) return;
    const ids = key.split(',');
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const put = (id: string, s: OnlineState) => setStates((p) => (p[id] === s ? p : { ...p, [id]: s }));
    const offLater = (id: string) => {
      const t = timers.get(id);
      if (t) clearTimeout(t);
      timers.set(id, setTimeout(() => put(id, 'offline'), LEGACY_OFFLINE_AFTER_MS));
    };

    const stops = ids.map((id) => {
      let first = true;
      return watchLegacyUpdatedAt(
        uid,
        id,
        (at) => {
          if (first) {
            first = false;
            const t = at ? Date.parse(at) : NaN;
            const fresh = Number.isFinite(t) && Date.now() - t < LEGACY_ONLINE_AT_LOAD_MS;
            put(id, fresh ? 'online' : 'offline');
            if (fresh) offLater(id);
            return;
          }
          if (at == null) return;
          put(id, 'online');
          offLater(id);
        },
        () => put(id, 'offline'),
      );
    });

    return () => {
      stops.forEach((s) => s());
      timers.forEach((t) => clearTimeout(t));
    };
  }, [key]);

  return states;
}
