import { useCallback, useEffect, useState } from 'react';
import { getMqttClient, onMessage, buildOtaStatusTopic } from '../services/mqtt';
import { auth } from '../services/firebase';

export interface OtaStatus {
  /** Raw status from the ESP32: starting | downloading | installing | success | failed */
  status: string;
  progress?: number;
  message?: string;
}

/**
 * Live OTA progress of one inverter from `inverter/{uid}/{deviceId}/ota/status`
 * (ESP32) or `.../stm/ota/status` (STM32 power board, flashed by the ESP32).
 * `reset()` clears the last status (call it when a new update is triggered).
 */
export function useOtaStatus(
  deviceId: string | undefined,
  kind: 'esp32' | 'stm32' = 'esp32'
) {
  const [ota, setOta] = useState<OtaStatus | null>(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !deviceId) return;
    const topic =
      kind === 'stm32'
        ? `inverter/${uid}/${deviceId}/stm/ota/status`
        : buildOtaStatusTopic(uid, deviceId);
    let mounted = true;

    const unsubscribeMessage = onMessage((t, payload) => {
      if (t !== topic) return;
      try {
        const data = JSON.parse(payload.toString()) as Partial<OtaStatus>;
        if (typeof data.status !== 'string') return;
        setOta({
          status: data.status,
          progress: typeof data.progress === 'number' ? data.progress : undefined,
          message: typeof data.message === 'string' ? data.message : undefined,
        });
      } catch {
        // ignore malformed payloads
      }
    });

    getMqttClient()
      .then((client) => {
        if (mounted) client.subscribe(topic);
      })
      .catch((err) => console.error('MQTT subscribe (ota) failed:', err));

    return () => {
      mounted = false;
      unsubscribeMessage();
      getMqttClient()
        .then((client) => client.unsubscribe(topic))
        .catch(() => {
          // ignore during cleanup
        });
    };
  }, [deviceId, kind]);

  const reset = useCallback(() => setOta(null), []);
  return { ota, reset };
}
