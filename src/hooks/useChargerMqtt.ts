import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMqttClient,
  onConnectionStatusChange,
  onMessage,
  ConnectionStatus,
  buildChargerDataTopic,
  buildChargerStatusTopic,
} from '../services/mqtt';
import { auth } from '../services/firebase';
import type { ChargerLatest } from '../types';

// Timeout để đánh dấu charger offline (giống inverter hook)
const DEVICE_OFFLINE_TIMEOUT = 15000; // 15s
const RECONNECT_GRACE_PERIOD = 15000;

interface UseChargerMqttResult {
  data: ChargerLatest | null;
  isDeviceOnline: boolean;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
}

// Parse khung STM32 RAW "$TLM,DEV=MPPT,ST=RUN,...*4E" → { type, KEY: VALUE, ... }
function parseFrame(raw: string): Record<string, string> | null {
  if (!raw || raw[0] !== '$') return null;
  const star = raw.lastIndexOf('*');
  const body = raw.slice(1, star === -1 ? undefined : star);
  const [type, ...items] = body.split(',');
  const kv: Record<string, string> = { type };
  for (const item of items) {
    const eq = item.indexOf('=');
    if (eq > 0) kv[item.slice(0, eq)] = item.slice(eq + 1);
  }
  return kv;
}

// Map khung đã parse → các trường của ChargerLatest (theo từng loại TYPE).
// VBAT/IBAT/OUT xuất hiện ở cả TLM lẫn CFG nhưng map sang trường khác nhau,
// nên phải map theo TYPE rồi merge vào snapshot đang có.
function frameToLatest(kv: Record<string, string>): Partial<ChargerLatest> {
  switch (kv.type) {
    case 'TLM':
      return {
        st: kv.ST,
        flt: kv.FLT,
        lock: kv.LOCK,
        rtry: kv.RTRY,
        out: kv.OUT,
        temp: kv.T,
        mode: kv.MODE,
        ms: kv.MS,
        vpv: kv.VPV,
        ipv: kv.IPV,
        ppv: kv.PPV,
        vbat: kv.VBAT,
        ibat: kv.IBAT,
        il: kv.IL,
        duty: kv.DUTY,
        vref: kv.VREF,
      };
    case 'CFG':
      return {
        cfgVbat: kv.VBAT,
        cfgIbat: kv.IBAT,
        cfgPbat: kv.PBAT,
        src: kv.SRC,
        cfgOut: kv.OUT,
      };
    case 'INFO':
      return {
        fw: kv.FW,
        hw: kv.HW,
      };
    default:
      return {};
  }
}

/**
 * Realtime cho charger — cùng cơ chế với inverter (useDeviceMqtt):
 * parse payload MQTT rồi ghi thẳng vào cache React Query
 * (`['charger-latest', deviceId]`), không refetch. Query REST /latest chỉ cung
 * cấp giá trị khởi tạo, sau đó MQTT đẩy dữ liệu mới vào cache.
 *
 * Khác biệt: charger gửi khung RAW nhiều loại ($TLM/$CFG/$INFO) nên map theo
 * từng loại rồi merge (undefined được lược bỏ để không ghi đè trường cũ).
 */
export function useChargerMqtt(
  deviceId: string | undefined
): UseChargerMqttResult {
  const queryClient = useQueryClient();
  const [data, setData] = useState<ChargerLatest | null>(null);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const subscribedTopicsRef = useRef<string[]>([]);
  const offlineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetOfflineTimeout = useCallback(
    (timeout: number = DEVICE_OFFLINE_TIMEOUT) => {
      setIsDeviceOnline(true);
      if (offlineTimeoutRef.current) {
        clearTimeout(offlineTimeoutRef.current);
      }
      offlineTimeoutRef.current = setTimeout(() => {
        setIsDeviceOnline(false);
      }, timeout);
    },
    []
  );

  const handleMessage = useCallback(
    (topic: string, message: Buffer) => {
      const userId = auth.currentUser?.uid;
      if (!userId || !deviceId) return;

      const dataTopic = buildChargerDataTopic(userId, deviceId);
      const statusTopic = buildChargerStatusTopic(userId, deviceId);

      if (topic === dataTopic) {
        // Payload là chuỗi RAW ($...*CRC), không phải JSON
        const kv = parseFrame(message.toString());
        if (!kv) return;

        const patch = frameToLatest(kv);
        // Bỏ các trường undefined để merge không ghi đè giá trị đã có
        const cleaned = Object.fromEntries(
          Object.entries(patch).filter(([, v]) => v !== undefined)
        );

        const updater = (prev?: ChargerLatest): ChargerLatest => ({
          userId,
          deviceId,
          ...(prev ?? {}),
          ...cleaned,
          status: 'online',
          raw: message.toString(),
          updatedAt: new Date().toISOString(),
        });

        setData((prev) => updater(prev ?? undefined));
        queryClient.setQueryData<ChargerLatest>(
          ['charger-latest', deviceId],
          (prev) => updater(prev)
        );

        resetOfflineTimeout();
      } else if (topic === statusTopic) {
        // Heartbeat JSON { "status": "online" }
        resetOfflineTimeout();
      }
    },
    [deviceId, queryClient, resetOfflineTimeout]
  );

  useEffect(() => {
    if (!deviceId) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    let mounted = true;
    const currentUserId = userId;
    const currentDeviceId = deviceId;

    const unsubscribeMessage = onMessage(handleMessage);

    async function setupMqtt() {
      try {
        const client = await getMqttClient();
        if (!mounted) return;

        const dataTopic = buildChargerDataTopic(currentUserId, currentDeviceId);
        const statusTopic = buildChargerStatusTopic(
          currentUserId,
          currentDeviceId
        );

        client.subscribe([dataTopic, statusTopic], (err) => {
          if (err) {
            console.error('MQTT charger subscribe error:', err);
          } else {
            subscribedTopicsRef.current = [dataTopic, statusTopic];
          }
        });
      } catch (error) {
        console.error('Failed to connect to MQTT (charger):', error);
      }
    }

    setupMqtt();

    const unsubscribeStatus = onConnectionStatusChange((status) => {
      if (!mounted) return;
      setConnectionStatus(status);

      if (status === 'connected') {
        if (subscribedTopicsRef.current.length > 0) {
          getMqttClient()
            .then((client) => client.subscribe(subscribedTopicsRef.current))
            .catch(console.error);
        }
        resetOfflineTimeout(RECONNECT_GRACE_PERIOD);
      } else if (status === 'disconnected') {
        if (offlineTimeoutRef.current) {
          clearTimeout(offlineTimeoutRef.current);
          offlineTimeoutRef.current = null;
        }
        setIsDeviceOnline(false);
      }
    });

    return () => {
      mounted = false;
      unsubscribeStatus();
      unsubscribeMessage();

      if (offlineTimeoutRef.current) {
        clearTimeout(offlineTimeoutRef.current);
        offlineTimeoutRef.current = null;
      }

      const topics = subscribedTopicsRef.current;
      subscribedTopicsRef.current = [];
      if (topics.length > 0) {
        getMqttClient()
          .then((client) => client.unsubscribe(topics))
          .catch(() => {});
      }
    };
  }, [deviceId, handleMessage, resetOfflineTimeout]);

  return {
    data,
    isDeviceOnline,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
  };
}
