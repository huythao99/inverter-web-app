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

interface MqttDeviceStatus {
  updatedAt: string;
  status: 'online' | 'offline';
}

interface UseDeviceMqttResult {
  data: InverterData | null;
  deviceStatus: 'online' | 'offline' | null;
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
}

export function useDeviceMqtt(deviceId: string | undefined): UseDeviceMqttResult {
  const queryClient = useQueryClient();
  const [data, setData] = useState<InverterData | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<'online' | 'offline' | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const subscribedTopicsRef = useRef<string[]>([]);

  const handleMessage = useCallback((topic: string, message: Buffer) => {
    const userId = auth.currentUser?.uid;
    if (!userId || !deviceId) return;

    const dataTopic = buildDataTopic(userId, deviceId);
    const statusTopic = buildStatusTopic(userId, deviceId);

    try {
      const payload = JSON.parse(message.toString());

      if (topic === dataTopic) {
        // Handle device data
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
      } else if (topic === statusTopic) {
        // Handle device status
        const statusData = payload as MqttDeviceStatus;
        setDeviceStatus(statusData.status);
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }, [deviceId, queryClient]);

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

        // Re-subscribe after reconnection
        if (status === 'connected' && subscribedTopicsRef.current.length > 0) {
          getMqttClient().then(client => {
            client.subscribe(subscribedTopicsRef.current);
          }).catch(console.error);
        }
      }
    });

    return () => {
      mounted = false;
      unsubscribeStatus();

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
  }, [deviceId, handleMessage]);

  return {
    data,
    deviceStatus,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
  };
}
