import axios from 'axios';
import { getIdToken } from './firebase';
import { getViewAccess, isViewedDeviceUrl } from './viewAccess';
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
  EnergyReport,
  EnergyOverview,
  ShareGroup,
  ShareGroupInput,
  ShareGroupOverview,
  ActivityPage,
} from '../types';

// In dev mode, use relative URL so Vite proxy can forward to VITE_API_URL
// In production, use VITE_API_URL directly
export const API_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api/user`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add Firebase token (or the read-only view headers
// for a device shared with this user / opened from a public link).
api.interceptors.request.use(async (config) => {
  const view = getViewAccess();
  if (view && isViewedDeviceUrl(config.url, view)) {
    if ((config.method || 'get').toLowerCase() !== 'get') {
      throw new Error('Bạn chỉ có quyền xem thiết bị này');
    }
    if (view.token) {
      config.headers['X-View-Token'] = view.token;
      return config; // anonymous: no Firebase token
    }
    if (view.owner) config.headers['X-View-Owner'] = view.owner;
  }
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
    if (error.response?.status === 401 && !getViewAccess()?.token) {
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

// Monthly report: kWh turned into money with the EVN tariff.
export const getEnergyReport = async (
  deviceId: string,
  year: number,
  month: number,
  tariff: 'tiered' | 'flat' = 'tiered'
): Promise<EnergyReport> => {
  const response = await api.get(`/devices/${deviceId}/energy-report`, {
    params: { year, month, tariff },
  });
  return response.data;
};

// All the inverters the user owns: today (live), month by day, year by month,
// lifetime, with each device's share and the savings.
export const getEnergyOverview = async (
  year: number,
  month: number,
  tariff: 'tiered' | 'flat' = 'tiered'
): Promise<EnergyOverview> => {
  const response = await api.get('/energy-overview', { params: { year, month, tariff } });
  return response.data;
};

// ---- Power share groups ----------------------------------------------------
export const getShareGroups = async (): Promise<ShareGroup[]> => {
  const response = await api.get('/share-groups');
  return Array.isArray(response.data) ? response.data : [];
};

export const getShareGroup = async (groupId: string): Promise<ShareGroup> => {
  const response = await api.get(`/share-groups/${groupId}`);
  return response.data;
};

export const createShareGroup = async (input: ShareGroupInput): Promise<ShareGroup> => {
  const response = await api.post('/share-groups', input);
  return response.data;
};

export const updateShareGroup = async (
  groupId: string,
  input: Partial<ShareGroupInput>
): Promise<ShareGroup> => {
  const response = await api.patch(`/share-groups/${groupId}`, input);
  return response.data;
};

export const deleteShareGroup = async (groupId: string): Promise<void> => {
  await api.delete(`/share-groups/${groupId}`);
};

// Live state of a group: members' power, the watts the group assigns them and
// their energy today / this week / this month.
export const getShareGroupOverview = async (groupId: string): Promise<ShareGroupOverview> => {
  const response = await api.get(`/share-groups/${groupId}/overview`);
  return response.data;
};

/** Backend error message (e.g. "device already in another group"). */
export const apiErrorMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { message?: unknown } } })?.response?.data;
  const msg = data?.message;
  if (typeof msg === 'string' && msg) return msg;
  if (Array.isArray(msg) && msg.length) return String(msg[0]);
  return fallback;
};

// Settings / schedule / grid-tie change history (newest first).
export const getDeviceActivity = async (
  deviceId: string,
  before?: string,
  kind: 'inverter' | 'charger' = 'inverter'
): Promise<ActivityPage> => {
  const path =
    kind === 'charger' ? `/chargers/${deviceId}/activity` : `/devices/${deviceId}/activity`;
  const response = await api.get(path, { params: { before, limit: 30 } });
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
): Promise<{ version: string; releaseNotes?: string }> => {
  const response = await api.get('/firmware/newest', {
    params: deviceId ? { deviceId } : undefined,
  });
  return response.data;
};

export interface FirmwareRelease {
  version: string;
  /** Plain text, one change per line. */
  notes: string;
  date: string | null;
  installed: boolean;
  isNew: boolean;
}

// Release notes of the versions up to the one this device is offered.
export const getFirmwareReleases = async (
  deviceId: string
): Promise<{ currentVersion: string; targetVersion: string; releases: FirmwareRelease[] }> => {
  const response = await api.get(`/devices/${deviceId}/firmware/releases`);
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

// ---- Read-only sharing -------------------------------------------------

export interface ShareViewer {
  email: string;
  joined: boolean;
  lastSeenAt: string | null;
  createdAt: string | null;
}
export interface DeviceSharing {
  viewers: ShareViewer[];
  link: { token: string; createdAt: string | null; expiresAt: string | null } | null;
}
export interface SharedDevice {
  kind: 'inverter' | 'charger';
  deviceId: string;
  ownerUid: string;
  deviceName: string;
  description: string;
}
type Kind = 'inverter' | 'charger';
const enc = encodeURIComponent;

export const getSharedWithMe = async (): Promise<{
  devices: SharedDevice[];
  emailNotVerified: boolean;
}> => (await api.get('/shared-with-me')).data;

export const leaveSharedDevice = async (d: SharedDevice): Promise<void> => {
  await api.delete(`/shared-with-me/${enc(d.ownerUid)}/${d.kind}/${enc(d.deviceId)}`);
};

export const getDeviceSharing = async (kind: Kind, deviceId: string): Promise<DeviceSharing> =>
  (await api.get(`/viewers/${kind}/${enc(deviceId)}`)).data;

export const addDeviceViewer = async (
  kind: Kind,
  deviceId: string,
  email: string
): Promise<DeviceSharing> => (await api.post(`/viewers/${kind}/${enc(deviceId)}`, { email })).data;

export const removeDeviceViewer = async (
  kind: Kind,
  deviceId: string,
  email: string
): Promise<DeviceSharing> =>
  (await api.delete(`/viewers/${kind}/${enc(deviceId)}/${enc(email)}`)).data;

/** Link lifetimes offered to the owner (days; 0 = never expires). */
export const LINK_DAYS = [1, 7, 30, 0] as const;
export type LinkDays = (typeof LINK_DAYS)[number];

export const createViewLink = async (
  kind: Kind,
  deviceId: string,
  days: LinkDays = 7
): Promise<DeviceSharing> =>
  (await api.post(`/viewers/${kind}/${enc(deviceId)}/link`, { days })).data;

/** New lifetime for the current link, counted from now (same URL). */
export const extendViewLink = async (
  kind: Kind,
  deviceId: string,
  days: LinkDays
): Promise<DeviceSharing> =>
  (await api.post(`/viewers/${kind}/${enc(deviceId)}/link/extend`, { days })).data;

export const deleteViewLink = async (kind: Kind, deviceId: string): Promise<DeviceSharing> =>
  (await api.delete(`/viewers/${kind}/${enc(deviceId)}/link`)).data;

/** Public link landing: which device it opens (no account needed). */
export const getPublicView = async (
  token: string
): Promise<{
  kind: Kind;
  deviceId: string;
  deviceName: string;
  description: string;
  expiresAt: string | null;
}> =>
  (await axios.get(`${API_URL}/api/public/view/${enc(token)}`)).data;

/** Full URL of a public view link (web route /app/v/:token). */
export const viewLinkUrl = (token: string): string =>
  `${window.location.origin}/app/v/${token}`;

export default api;

// ---- Home Assistant (read-only data over MQTT) ----
export interface HassDeviceInfo {
  kind: 'inverter' | 'charger';
  deviceId: string;
  deviceName: string;
  stateTopic: string;
  availabilityTopic: string;
}

export interface HassConfig {
  /** False when Home Assistant is switched off server-wide. */
  available: boolean;
  enabled: boolean;
  connected: boolean;
  lastSeenAt: string | null;
  broker: string;
  port: number;
  ssl: boolean;
  username?: string;
  password?: string;
  discoveryPrefix?: string;
  stateTopicPrefix?: string;
  bridgeConfig?: string;
  devices: HassDeviceInfo[];
}

export const getHassConfig = async (): Promise<HassConfig> =>
  (await api.get('/hass')).data;
export const enableHass = async (): Promise<HassConfig> =>
  (await api.post('/hass/enable')).data;
export const disableHass = async (): Promise<HassConfig> =>
  (await api.post('/hass/disable')).data;
export const regenerateHass = async (): Promise<HassConfig> =>
  (await api.post('/hass/regenerate')).data;
