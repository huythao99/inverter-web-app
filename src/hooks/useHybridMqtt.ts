import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMqttClient,
  onConnectionStatusChange,
  onMessage,
  buildChargerDataTopic,
  buildChargerStatusTopic,
} from '../services/mqtt';
import { auth } from '../services/firebase';
import type { HybridLatest } from '../types';
import { parseHinvlf } from '../services/hinvlf';
import { useOnlineTracker } from './useOnlineTracker';

/**
 * Realtime cho hybrid (HINVLF v1): khung RAW $TLM / $CFG / $INFO / $NAK trên
 * hybrid/{uid}/{id}/data được ghi thẳng vào cache ['hybrid-latest', id].
 * $CFG / $NAK làm mới tab Cài đặt (đã áp dụng / bị từ chối).
 */
export function useHybridMqtt(deviceId: string | undefined) {
  const queryClient = useQueryClient();
  const { isOnline: isDeviceOnline, markSeen, trackConnection } = useOnlineTracker(deviceId);
  const subscribedRef = useRef<string[]>([]);

  const handleMessage = useCallback(
    (topic: string, message: Buffer) => {
      const uid = auth.currentUser?.uid;
      if (!uid || !deviceId) return;
      if (topic === buildChargerStatusTopic(uid, deviceId, 'hybrid')) {
        markSeen();
        return;
      }
      if (topic !== buildChargerDataTopic(uid, deviceId, 'hybrid')) return;
      const raw = message.toString();
      const f = parseHinvlf(raw);
      if (!f) return;
      const now = new Date().toISOString();
      let patch: Partial<HybridLatest> = {};
      if (f.type === 'TLM') patch = { tlm: f.items, tlmAt: now };
      else if (f.type === 'CFG') patch = { cfg: f.items, cfgAt: now };
      else if (f.type === 'INFO') patch = { info: f.items };
      else if (f.type === 'NAK') {
        patch = {
          lastNak: { of: f.words.join(' ') || '?', err: f.items.ERR ?? '?', key: f.items.KEY, raw, at: now },
        };
      } else return;
      queryClient.setQueryData<HybridLatest>(['hybrid-latest', deviceId], (prev) => ({
        ...(prev ?? { deviceId }),
        ...patch,
        status: 'online',
        lastSeenAt: now,
      }));
      if (f.type === 'CFG' || f.type === 'NAK') {
        queryClient.invalidateQueries({ queryKey: ['hybrid-setting', deviceId] });
      }
      markSeen();
    },
    [deviceId, queryClient, markSeen]
  );

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!deviceId || !uid) return;
    let mounted = true;
    const unsubscribeMessage = onMessage(handleMessage);
    const topics = [
      buildChargerDataTopic(uid, deviceId, 'hybrid'),
      buildChargerStatusTopic(uid, deviceId, 'hybrid'),
    ];
    getMqttClient()
      .then((client) => {
        if (!mounted) return;
        client.subscribe(topics, (err) => {
          if (err) console.error('MQTT hybrid subscribe error:', err);
          else subscribedRef.current = topics;
        });
      })
      .catch((e) => console.error('Failed to connect to MQTT (hybrid):', e));

    const unsubscribeStatus = onConnectionStatusChange((status) => {
      if (!mounted) return;
      trackConnection(status);
      if (status === 'connected' && subscribedRef.current.length > 0) {
        getMqttClient()
          .then((client) => client.subscribe(subscribedRef.current))
          .catch(console.error);
      }
    });

    return () => {
      mounted = false;
      unsubscribeStatus();
      unsubscribeMessage();
      const subs = subscribedRef.current;
      subscribedRef.current = [];
      if (subs.length > 0) {
        getMqttClient()
          .then((client) => client.unsubscribe(subs))
          .catch(() => {});
      }
    };
  }, [deviceId, handleMessage, trackConnection]);

  return { isDeviceOnline };
}
