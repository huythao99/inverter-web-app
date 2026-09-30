import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_URL } from '../services/api';
import { frameToLatest, parseFrame } from './useChargerMqtt';
import type { ChargerLatest, InverterData } from '../types';

/** Live data older than this = device offline. */
const ONLINE_MS = 90_000;

/**
 * Live data of a device opened from a public view link. The server relays the
 * device's MQTT messages as Server-Sent Events (no broker account needed) and
 * they land in the same React Query caches the MQTT hooks fill.
 */
export function usePublicLiveStream(
  token: string | undefined,
  kind: 'inverter' | 'charger',
  deviceId: string | undefined
): {
  isOnline: boolean;
  lastSeen: number;
  /** Set when the link stopped working while the page was open. */
  revoked: 'expired' | 'revoked' | null;
} {
  const queryClient = useQueryClient();
  const [lastSeen, setLastSeen] = useState(0);
  const [revoked, setRevoked] = useState<'expired' | 'revoked' | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!token || !deviceId || typeof EventSource === 'undefined') return;
    const es = new EventSource(
      `${API_URL}/api/public/view/${encodeURIComponent(token)}/stream`
    );

    const read = (e: MessageEvent): { payload: string; at: number } | null => {
      try {
        return JSON.parse(e.data);
      } catch {
        return null;
      }
    };

    es.addEventListener('data', (e) => {
      const msg = read(e as MessageEvent);
      if (!msg) return;
      const at = msg.at || Date.now();
      setLastSeen(at);
      if (kind === 'inverter') {
        try {
          const p = JSON.parse(msg.payload) as {
            value?: string;
            totalACapacity?: string;
            totalA2Capacity?: string;
          };
          if (!p.value) return;
          queryClient.setQueryData<InverterData>(['device-latest-data', deviceId], (prev) => ({
            ...(prev ?? { userId: '', deviceId }),
            deviceId,
            value: p.value!,
            totalACapacity: p.totalACapacity ? parseFloat(p.totalACapacity) : prev?.totalACapacity,
            totalA2Capacity: p.totalA2Capacity ? parseFloat(p.totalA2Capacity) : prev?.totalA2Capacity,
            updatedAt: new Date(at).toISOString(),
          }));
        } catch {
          /* not JSON: ignore */
        }
      } else {
        const kv = parseFrame(msg.payload);
        if (!kv) return;
        const patch = Object.fromEntries(
          Object.entries(frameToLatest(kv)).filter(([, v]) => v !== undefined)
        );
        queryClient.setQueryData<ChargerLatest>(['charger-latest', deviceId], (prev) => ({
          userId: '',
          deviceId,
          ...(prev ?? {}),
          ...patch,
          status: 'online',
          updatedAt: new Date(at).toISOString(),
        }));
      }
    });
    es.addEventListener('status', (e) => {
      const msg = read(e as MessageEvent);
      if (msg) setLastSeen(msg.at || Date.now());
    });
    es.addEventListener('revoked', (e) => {
      let reason: 'expired' | 'revoked' = 'revoked';
      try {
        if (JSON.parse((e as MessageEvent).data)?.reason === 'expired') reason = 'expired';
      } catch {
        /* keep 'revoked' */
      }
      setRevoked(reason);
      es.close();
    });

    return () => es.close();
  }, [token, kind, deviceId, queryClient]);

  // Re-evaluate "online" as time passes without messages.
  useEffect(() => {
    if (!token) return;
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, [token]);

  return {
    isOnline: lastSeen > 0 && Date.now() - lastSeen < ONLINE_MS,
    lastSeen,
    revoked,
  };
}
