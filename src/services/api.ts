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
} from '../types';

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

// Firmware
export const getDeviceFirmwareVersion = async (
  deviceId: string
): Promise<{ firmwareVersion: string }> => {
  const response = await api.get(`/devices/${deviceId}/firmware/version`);
  return response.data;
};

export const getLatestFirmwareVersion = async (): Promise<{ version: string }> => {
  const response = await api.get('/firmware/newest');
  return response.data;
};

export const triggerFirmwareUpdate = async (
  deviceId: string
): Promise<{ success: boolean }> => {
  const response = await api.post(`/devices/${deviceId}/firmware/update`);
  return response.data;
};

export default api;
