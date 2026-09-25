import axios from 'axios';
import { getIdToken } from './firebase';
import type {
  Device,
  DeviceSettings,
  DeviceSchedule,
  InverterData,
  DailyTotal,
  UserProfile,
  PaginatedResponse,
  MonthlyTotals,
  ChartDataPoint,
  GridTieStatus,
  ChargerDevice,
  ChargerLatest,
  ChargerSetting,
} from '../types';

// In dev mode, use relative URL so Vite proxy can forward to VITE_API_URL
// In production, use VITE_API_URL directly
const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api/user`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add Firebase token
api.interceptors.request.use(async (config) => {
  const token = await getIdToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// User Profile
export const getProfile = async (): Promise<UserProfile> => {
  const response = await api.get('/profile');
  return response.data;
};

// Devices
export const getDevices = async (): Promise<{ devices: Device[] }> => {
  const response = await api.get('/devices');
  return response.data;
};

export const getDevice = async (deviceId: string): Promise<Device> => {
  const response = await api.get(`/devices/${deviceId}`);
  return response.data;
};

export const updateDevice = async (
  deviceId: string,
  data: { deviceName?: string }
): Promise<Device> => {
  const response = await api.patch(`/devices/${deviceId}`, data);
  return response.data;
};

// userId is kept for the callers' signature; the backend takes it from the token.
export const deleteDevice = async (_userId: string, deviceId: string): Promise<void> => {
  await api.delete(`/devices/${deviceId}`);
};

// Broker account of the signed-in user (read-only, own devices).
export const getMqttCredentials = async (): Promise<{ username: string; password: string }> => {
  const response = await api.get('/mqtt-credentials');
  return response.data;
};

// Device Settings
export const getDeviceSettings = async (
  deviceId: string
): Promise<DeviceSettings> => {
  const response = await api.get(`/devices/${deviceId}/settings`);
  return response.data;
};

export const updateDeviceSettings = async (
  deviceId: string,
  value: string
): Promise<DeviceSettings> => {
  const response = await api.patch(`/devices/${deviceId}/settings`, { value });
  return response.data;
};

// Grid-tie (Hoà lưới) on/off
export const getGridTieStatus = async (
  deviceId: string
): Promise<GridTieStatus> => {
  const response = await api.get(`/devices/${deviceId}/grid-tie`);
  return response.data;
};

export const setGridTieStatus = async (
  deviceId: string,
  status: number // 1 = tắt (OFF), 0 = bật (ON)
): Promise<{ status: number; gridTieOff: boolean; setting: DeviceSettings }> => {
  const response = await api.patch(`/devices/${deviceId}/grid-tie`, { status });
  return response.data;
};

// Device Schedule
export const getDeviceSchedule = async (
  deviceId: string
): Promise<DeviceSchedule> => {
  const response = await api.get(`/devices/${deviceId}/schedule`);
  return response.data;
};

export const updateDeviceSchedule = async (
  deviceId: string,
  schedule: string
): Promise<DeviceSchedule> => {
  const response = await api.patch(`/devices/${deviceId}/schedule`, {
    schedule,
  });
  return response.data;
};

// Device Data
export const getDeviceData = async (
  deviceId: string,
  page = 1,
  limit = 10
): Promise<PaginatedResponse<InverterData>> => {
  const response = await api.get(`/devices/${deviceId}/data`, {
    params: { page, limit },
  });
  return response.data;
};

export const getLatestDeviceData = async (
  deviceId: string
): Promise<InverterData> => {
  const response = await api.get(`/devices/${deviceId}/data/latest`);
  return response.data;
};

// Daily Totals
export const getDeviceDailyTotals = async (
  deviceId: string,
  params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
): Promise<PaginatedResponse<DailyTotal>> => {
  const response = await api.get(`/devices/${deviceId}/daily-totals`, {
    params,
  });
  return response.data;
};

// Monthly Totals
export const getDeviceMonthlyTotals = async (
  deviceId: string,
  year?: number,
  month?: number
): Promise<MonthlyTotals> => {
  const response = await api.get(`/devices/${deviceId}/monthly-totals`, {
    params: { year, month },
  });
  return response.data;
};

// Chart Data
export const getDeviceChartData = async (
  deviceId: string,
  year?: number,
  month?: number
): Promise<ChartDataPoint[]> => {
  const response = await api.get(`/devices/${deviceId}/chart-data`, {
    params: { year, month },
  });
  return response.data;
};

// Today's daily totals (single GMT+7 day). Only today's rows are requested,
// so yesterday's value can never be shown as "today" when today has no data yet.
export const getDailyTotalsToday = async (
  deviceId: string
): Promise<{ totalA: number; totalA2: number }> => {
  // Server days are GMT+7 regardless of the browser's timezone.
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const response = await api.get(`/devices/${deviceId}/daily-totals`, {
    params: { startDate: today, endDate: today },
  });
  const records: DailyTotal[] = response.data.data || [];
  return records.reduce(
    (acc, r) => ({
      totalA: acc.totalA + (r.totalA || 0),
      totalA2: acc.totalA2 + (r.totalA2 || 0),
    }),
    { totalA: 0, totalA2: 0 }
  );
};

// Calculate Daily Totals (like mobile app)
export const calculateDailyTotals = async (
  deviceId: string
): Promise<{ totalA: number; totalA2: number }> => {
  const response = await api.get(`/devices/${deviceId}/calculate-daily-totals`);
  return response.data;
};

// ---- STM32 power board firmware (FOTA through the ESP32) ----
// STM32 version "major.voltage.patch": major = chip (3 = F303, 2 = G431),
// 2nd number = voltage class (1 = 12V, 2 = 24V, 3 = 36V, 4 = 48V).
export interface DeviceStmInfo {
  version: string | null;
  chip: string | null;
  voltageCode: number | null;
  voltage: string | null;
  crc32: string | null;
  reportedAt: string | null;
  supported: boolean;
  minEspVersion: string;
  target: { version: string; voltage: string | null; crc32: string } | null;
  updateAvailable: boolean;
  reason: null | 'esp_firmware_too_old' | 'version_unknown' | 'no_firmware';
  lastOta: { status: string; progress?: number | null; message?: string | null; at: string } | null;
}

export const getDeviceStm = async (deviceId: string): Promise<DeviceStmInfo> => {
  const response = await api.get(`/devices/${deviceId}/stm`);
  return response.data;
};

export const triggerStmUpdate = async (
  deviceId: string
): Promise<{ success: boolean; targetVersion: string; crc32: string }> => {
  const response = await api.post(`/devices/${deviceId}/stm/update`);
  return response.data;
};

// Remote restart (ESP32 reboot via MQTT). Backend allows 1 request/device/minute.
export const restartDevice = async (
  deviceId: string
): Promise<{ message: string; requestId: string; cooldownSeconds: number }> => {
  const response = await api.post(`/devices/${deviceId}/restart`);
  return response.data;
};

// Firmware
export const getDeviceFirmwareVersion = async (
  deviceId: string
): Promise<{ firmwareVersion: string }> => {
  const response = await api.get(`/devices/${deviceId}/firmware/version`);
  return response.data;
};

// deviceId: devices on the beta list get the beta version.
export const getLatestFirmwareVersion = async (
  deviceId?: string
): Promise<{ version: string }> => {
  const response = await api.get('/firmware/newest', {
    params: deviceId ? { deviceId } : undefined,
  });
  return response.data;
};

export const triggerFirmwareUpdate = async (
  deviceId: string
): Promise<{ success: boolean; currentVersion: string; targetVersion: string }> => {
  const response = await api.post(`/devices/${deviceId}/firmware/update`);
  return response.data;
};

// ============================================================
// Charger — Web người dùng cuối dùng bộ /api/user/chargers/*
// (Firebase JWT, uid lấy từ token — KHÔNG truyền trên URL, giống inverter).
// ============================================================

// Danh sách charger của user
export const getChargerDevices = async (): Promise<ChargerDevice[]> => {
  const response = await api.get('/chargers');
  // Backend có thể trả mảng trực tiếp hoặc bọc { chargers } / { devices }
  return response.data?.chargers ?? response.data?.devices ?? response.data ?? [];
};

// Chi tiết 1 charger
export const getChargerDevice = async (
  deviceId: string
): Promise<ChargerDevice> => {
  const response = await api.get(`/chargers/${deviceId}`);
  return response.data;
};

// Snapshot realtime mới nhất (đã backend giải mã)
export const getChargerLatest = async (
  deviceId: string
): Promise<ChargerLatest> => {
  const response = await api.get(`/chargers/${deviceId}/data/latest`);
  return response.data;
};

// Đọc setting (kèm vbat/ibat đã decode)
export const getChargerSetting = async (
  deviceId: string
): Promise<ChargerSetting> => {
  const response = await api.get(`/chargers/${deviceId}/settings`);
  return response.data;
};

// Ghi setting thân thiện { vbat, ibat }. Backend tự publish cmd/settings.
export const updateChargerSetting = async (
  deviceId: string,
  data: { vbat: number; ibat: number }
): Promise<ChargerSetting> => {
  const response = await api.patch(`/chargers/${deviceId}/settings`, data);
  return response.data;
};

// Đổi tên / ghi chú
export const updateChargerDevice = async (
  deviceId: string,
  data: { deviceName?: string; description?: string }
): Promise<ChargerDevice> => {
  const response = await api.patch(`/chargers/${deviceId}`, data);
  return response.data;
};

export default api;
