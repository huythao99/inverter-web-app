export interface Device {
  _id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  firmwareVersion?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceSettings {
  _id?: string;
  userId: string;
  deviceId: string;
  value: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceSchedule {
  _id?: string;
  userId: string;
  deviceId: string;
  schedule: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GridTieStatus {
  deviceId: string;
  status: number; // 1 = OFF, 0 = ON
  gridTieOff: boolean;
}

export interface InverterData {
  _id?: string;
  userId: string;
  deviceId: string;
  value: string;
  totalACapacity?: number;
  totalA2Capacity?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyTotal {
  _id: string;
  userId: string;
  deviceId: string;
  date: string;
  totalA: number;
  totalA2: number;
  timezone: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserProfile {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  photoURL?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page?: number;
  totalPages?: number;
  limit?: number;
  offset?: number;
}

export interface MonthlyTotals {
  year: number;
  month: number;
  totalA: number;
  totalA2: number;
  dailyRecords: Array<{
    date: string;
    totalA: number;
    totalA2: number;
    devices: number;
  }>;
  summary: {
    totalDays: number;
    averageDailyA: number;
    averageDailyA2: number;
    peakDayA: { date: string; value: number };
    peakDayA2: { date: string; value: number };
  };
}

export interface ChartDataPoint {
  date: string;
  totalA: number;
  totalA2: number;
}

export interface WebSocketDeviceData {
  currentUid: string;
  wifiSsid: string;
  data: string;
}

export interface WebSocketOtaStatus {
  deviceId: string;
  status: 'pending' | 'downloading' | 'installing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}
