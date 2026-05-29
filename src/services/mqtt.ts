import mqtt, { MqttClient } from 'mqtt';

// MQTT broker configuration
// For browser, we need WebSocket connection (ws:// or wss://)
const MQTT_BROKER_URL = import.meta.env.VITE_MQTT_BROKER_URL || 'ws://giabao-inverter.com:9001';
const MQTT_USERNAME = import.meta.env.VITE_MQTT_USERNAME || 'giabao';
const MQTT_PASSWORD = import.meta.env.VITE_MQTT_PASSWORD || '0918273645';

let client: MqttClient | null = null;
let connectionPromise: Promise<MqttClient> | null = null;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type StatusListener = (status: ConnectionStatus) => void;
const statusListeners = new Set<StatusListener>();

let currentStatus: ConnectionStatus = 'disconnected';

function notifyStatusChange(status: ConnectionStatus) {
  currentStatus = status;
  statusListeners.forEach(listener => listener(status));
}

export function onConnectionStatusChange(listener: StatusListener): () => void {
  statusListeners.add(listener);
  // Immediately notify with current status
  listener(currentStatus);
  return () => statusListeners.delete(listener);
}

export function getConnectionStatus(): ConnectionStatus {
  return currentStatus;
}

export async function getMqttClient(): Promise<MqttClient> {
  if (client?.connected) {
    return client;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = connectMqtt();
  return connectionPromise;
}

async function connectMqtt(): Promise<MqttClient> {
  notifyStatusChange('connecting');

  return new Promise((resolve, reject) => {
    const clientId = `web_${Math.random().toString(16).substring(2, 10)}`;

    client = mqtt.connect(MQTT_BROKER_URL, {
      clientId,
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clean: true,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    });

    const timeoutId = setTimeout(() => {
      connectionPromise = null;
      reject(new Error('MQTT connection timeout'));
    }, 15000);

    client.on('connect', () => {
      clearTimeout(timeoutId);
      notifyStatusChange('connected');
      connectionPromise = null;
      resolve(client!);
    });

    client.on('reconnect', () => {
      notifyStatusChange('reconnecting');
    });

    client.on('close', () => {
      notifyStatusChange('disconnected');
    });

    client.on('offline', () => {
      notifyStatusChange('disconnected');
    });

    client.on('error', (error) => {
      console.error('MQTT error:', error);
      clearTimeout(timeoutId);
      connectionPromise = null;
      reject(error);
    });
  });
}

export function disconnectMqtt(): void {
  if (client) {
    client.end();
    client = null;
  }
  connectionPromise = null;
  notifyStatusChange('disconnected');
}

export function isConnected(): boolean {
  return client?.connected ?? false;
}

// Topic builders matching ESP32 format
export function buildDataTopic(userId: string, deviceId: string): string {
  return `inverter/${userId}/${deviceId}/data`;
}

export function buildStatusTopic(userId: string, deviceId: string): string {
  return `inverter/${userId}/${deviceId}/status`;
}

export function buildOtaStatusTopic(userId: string, deviceId: string): string {
  return `inverter/${userId}/${deviceId}/ota/status`;
}
