import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '../services/firebase';
import {
  LEGACY_OFFLINE_AFTER_MS,
  LEGACY_ONLINE_AT_LOAD_MS,
  watchLegacyLast,
  watchLegacyUpdatedAt,
} from '../services/legacyInverter';
import type { InverterData } from '../types';

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Live data + online state of an old inverter (< 400) from Firebase Realtime
 * Database — the Firebase twin of useDeviceMqtt (same rules as the app).
 * Pass deviceId undefined to stay idle.
 */
export function useDeviceFirebase(deviceId: string | undefined, ownerUid?: string) {
  const queryClient = useQueryClient();
  const [data, setData] = useState<InverterData | null>(null);
  const [isDeviceOnline, setOnline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const uid = ownerUid || auth.currentUser?.uid;
    if (!deviceId || !uid) return;
    let first = true;

    const offLater = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setOnline(false), LEGACY_OFFLINE_AFTER_MS);
    };

    const stopUpdated = watchLegacyUpdatedAt(uid, deviceId, (at) => {
      if (first) {
        // Initial value: online only if the last frame is a few seconds old.
        first = false;
        const t = at ? Date.parse(at) : NaN;
        const fresh = Number.isFinite(t) && Date.now() - t < LEGACY_ONLINE_AT_LOAD_MS;
        setOnline(fresh);
        if (fresh) offLater();
        return;
      }
      if (at == null) return;
      setOnline(true);
      offLater();
    });

    const stopLast = watchLegacyLast(
      uid,
      deviceId,
      (last) => {
        if (!last?.value) return;
        const d: InverterData = {
          userId: uid,
          deviceId,
          value: String(last.value),
          totalACapacity: num(last.totalACapacity),
          totalA2Capacity: num(last.totalA2Capacity),
          updatedAt: new Date().toISOString(),
        };
        setData(d);
        queryClient.setQueryData(['device-latest-data', deviceId], d);
      },
      (e) => console.error('Firebase (legacy inverter) error:', e),
    );

    return () => {
      stopUpdated();
      stopLast();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [deviceId, ownerUid, queryClient]);

  return { data, isDeviceOnline };
}
