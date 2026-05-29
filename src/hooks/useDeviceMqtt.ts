import { useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMqttClient,
  onConnectionStatusChange,
  ConnectionStatus,
  buildDataTopic,
  buildStatusTopic,
} from '../services/mqtt';
import { auth } from '../services/firebase';
import type { InverterData } from '../types';

interface MqttDeviceData {
  value: string;
  totalACapacity?: string;
  totalA2Capacity?: string;
}

// Timeout duration to mark device as offline (matching Flutter app)
const DEVICE_OFFLINE_TIMEOUT = 10000; // 10 seconds
const RECONNECT_GRACE_PERIOD = 15000; // 15 seconds after reconnection

interface UseDeviceMqttResult {
  data: InverterData | null;
  isDeviceOnline: boolean;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
}

export function useDeviceMqtt(deviceId: string | undefined): UseDeviceMqttResult {
  const queryClient = useQueryClient();
  const [data, setData] = useState<InverterData | null>(null);
  const [isDeviceOnline, setIsDeviceOnline] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const subscribedTopicsRef = useRef<string[]>([]);
  const offlineTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageTimeRef = useRef<number>(0);

  // Reset offline timeout - called when receiving any message from the device
  const resetOfflineTimeout = useCallback((timeout: number = DEVICE_OFFLINE_TIMEOUT) => {
    lastMessageTimeRef.current = Date.now();
    setIsDeviceOnline(true);

    if (offlineTimeoutRef.current) {
      clearTimeout(offlineTimeoutRef.current);
    }

    offlineTimeoutRef.current = setTimeout(() => {
      setIsDeviceOnline(false);
    }, timeout);
  }, []);

  const handleMessage = useCallback((topic: string, message: Buffer) => {
    const userId = auth.currentUser?.uid;
    if (!userId || !deviceId) return;

    const dataTopic = buildDataTopic(userId, deviceId);
    const statusTopic = buildStatusTopic(userId, deviceId);

    try {
      const payload = JSON.parse(message.toString());

      if (topic === dataTopic) {
        // Handle device data - device is online when sending data
        const mqttData = payload as MqttDeviceData;
        const newData: InverterData = {
          userId,
          deviceId,
          value: mqttData.value,
          totalACapacity: mqttData.totalACapacity ? parseFloat(mqttData.totalACapacity) : undefined,
          totalA2Capacity: mqttData.totalA2Capacity ? parseFloat(mqttData.totalA2Capacity) : undefined,
          updatedAt: new Date().toISOString(),
        };

        setData(newData);
        // Update React Query cache for consistency
        queryClient.setQueryData(['device-latest-data', deviceId], newData);

        // Reset offline timeout - device is active
        resetOfflineTimeout();
      } else if (topic === statusTopic) {
        // Handle device status message - also indicates device is online
        resetOfflineTimeout();
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }, [deviceId, queryClient, resetOfflineTimeout]);

  useEffect(() => {
    if (!deviceId) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    let mounted = true;
    const currentUserId = userId;
    const currentDeviceId = deviceId;

    async function setupMqtt() {
      try {
        const client = await getMqttClient();
        if (!mounted) return;

        const dataTopic = buildDataTopic(currentUserId, currentDeviceId);
        const statusTopic = buildStatusTopic(currentUserId, currentDeviceId);

        // Subscribe to topics
        client.subscribe([dataTopic, statusTopic], (err) => {
          if (err) {
            console.error('MQTT subscribe error:', err);
          } else {
            subscribedTopicsRef.current = [dataTopic, statusTopic];
          }
        });

        // Listen for messages
        client.on('message', handleMessage);
      } catch (error) {
        console.error('Failed to connect to MQTT:', error);
      }
    }

    setupMqtt();

    // Listen for connection status changes
    const unsubscribeStatus = onConnectionStatusChange((status) => {
      if (mounted) {
        setConnectionStatus(status);

        if (status === 'connected') {
          // Re-subscribe after reconnection
          if (subscribedTopicsRef.current.length > 0) {
            getMqttClient().then(client => {
              client.subscribe(subscribedTopicsRef.current);
            }).catch(console.error);
          }

          // After reconnection, give device a grace period to send status
          // Mark offline if no message received within grace period
          resetOfflineTimeout(RECONNECT_GRACE_PERIOD);
        } else if (status === 'disconnected') {
          // Clear timeout when disconnected - we don't know device status
          if (offlineTimeoutRef.current) {
            clearTimeout(offlineTimeoutRef.current);
            offlineTimeoutRef.current = null;
          }
          setIsDeviceOnline(false);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribeStatus();

      // Clear timeout
      if (offlineTimeoutRef.current) {
        clearTimeout(offlineTimeoutRef.current);
        offlineTimeoutRef.current = null;
      }

      // Unsubscribe from topics
      if (subscribedTopicsRef.current.length > 0) {
        getMqttClient().then(client => {
          client.unsubscribe(subscribedTopicsRef.current);
          client.removeListener('message', handleMessage);
        }).catch(() => {
          // Ignore errors during cleanup
        });
        subscribedTopicsRef.current = [];
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
