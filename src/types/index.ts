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

// ---- Charger (Web người dùng cuối dùng bộ /api/user/chargers/*, Firebase JWT) ----
export interface ChargerDevice {
  _id: string;
  userId: string;
  deviceId: string;      // dạng ChargerControl<N>
  deviceName: string;
  description?: string;
  firmwareVersion?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Snapshot realtime đã được backend giải mã từ khung raw ($TLM/$CFG/$INFO)
export interface ChargerLatest {
  userId: string;
  deviceId: string;
  status?: string;          // online/offline suy ra từ heartbeat
  st?: string;              // trạng thái chạy (RUN/...)
  flt?: string;             // mã lỗi (0 = ok)
  lock?: string;
  rtry?: string;
  out?: string;             // BAT/...
  mode?: string;            // MPPT/...
  ms?: string;              // TRACK/...
  temp?: string;            // nhiệt độ (°C)
  // PV (đầu vào solar)
  vpv?: string;
  ipv?: string;
  ppv?: string;
  // Ắc quy / sạc
  vbat?: string;
  ibat?: string;
  il?: string;
  duty?: string;
  vref?: string;
  // Cấu hình đang áp dụng thật trên máy ($CFG)
  cfgVbat?: string;
  cfgIbat?: string;
  cfgPbat?: string;
  src?: string;             // ESP/LOCAL
  cfgOut?: string;
  // Thông tin thiết bị
  fw?: string;
  hw?: string;
  raw?: string;
  updatedAt?: string;
}

export interface ChargerSetting {
  _id?: string;
  userId: string;
  deviceId: string;
  value: string;            // chuỗi 8 số HHHHLLLL
  vbat?: number;            // đã decode: HHHH / 10
  ibat?: number;            // đã decode: LLLL / 10
  createdAt?: string;
  updatedAt?: string;
}

// ---- Hybrid (/api/user/hybrids/*): STM32 HINVLF v1 inverter ----
export type HybridDevice = ChargerDevice; // deviceId dạng HybridControl<N>

/** Khung STM32 dạng KEY -> VALUE (chuỗi, đúng như máy gửi). */
export type HinvlfFrame = Record<string, string>;

export interface HybridNak {
  of: string; // "SET" | "CMD FAULT_RST" ...
  err: string; // CRC FORMAT UNSUP KEY VALUE RANGE LOCAL BUSY FLASH
  key?: string;
  raw?: string;
  at: string;
}

export interface HybridLatest {
  userId?: string;
  deviceId: string;
  tlm?: HinvlfFrame;
  tlmAt?: string;
  cfg?: HinvlfFrame;
  cfgAt?: string;
  info?: HinvlfFrame;
  lastNak?: HybridNak | null;
  status?: string;
  lastSeenAt?: string;
  updatedAt?: string;
}

export type HybridMode = 'OFF' | 'OFFGRID' | 'LOAD' | 'CHG' | 'EXPORT';
export type HybridNumberKey =
  | 'PCHG'
  | 'PEXP'
  | 'PIMP'
  | 'VEXP'
  | 'VCUT'
  | 'VRES'
  | 'PMAX'
  | 'PCMAX';
export type HybridConfigKey = 'MODE' | HybridNumberKey;
export type HybridConfig = { MODE?: HybridMode } & Partial<Record<HybridNumberKey, number>>;

export interface HybridSetting {
  userId: string;
  deviceId: string;
  config: HybridConfig; // các giá trị người dùng đã đặt (server giữ)
  set: string;
  updatedAt: string | null;
  cfg: HinvlfFrame | null; // $CFG máy đang chạy
  cfgAt: string | null;
  src: string | null; // LOCAL | ESP
  pending: HybridConfigKey[]; // chưa áp dụng xuống máy
  lastNak: HybridNak | null;
  status: string;
}

export interface HybridEnergyDay {
  day: string;
  edis: number; // Wh xả pin
  echg: number; // Wh sạc pin
  eimp: number; // Wh lấy lưới
  eexp: number; // Wh đẩy lưới
}

export interface HybridEnergy {
  from: string;
  to: string;
  today: HybridEnergyDay;
  days: HybridEnergyDay[];
}

export type HybridCommand = 'FAULT_RST' | 'STOP' | 'RUN';

/** One firmware version with its release notes ("Cập nhật" tab). */
export interface FirmwareRelease {
  version: string;
  notes: string;
  date: string | null;
  installed: boolean; // the device runs it
  isNew: boolean; // newer than what the device runs
}

/** GET /api/user/hybrids/:id/firmware */
export interface HybridFirmwareOverview {
  esp: {
    currentVersion: string | null;
    targetVersion: string | null;
    updateAvailable: boolean;
    releases: FirmwareRelease[];
  };
  stm: {
    version: string | null;
    chip: string | null;
    voltage: string | null;
    reportedAt: string | null;
    supported: boolean;
    minEspVersion: string;
    target: { version: string; crc32: string } | null;
    updateAvailable: boolean;
    reason: null | 'esp_firmware_too_old' | 'version_unknown' | 'no_firmware';
    lastOta: { status: string; progress?: number | null; message?: string | null; at: string } | null;
    releases: FirmwareRelease[];
  };
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

// ---- Energy report (kWh -> tiền theo giá EVN) ----
export interface MonthEnergy {
  year: number;
  month: number;
  days: number;
  generatedKwh: number;
  gridKwh: number;
  consumptionKwh: number;
  selfSufficiency: number;
  billWithoutSolar: number;
  billWithSolar: number;
  savings: number;
}

export interface EnergyReport extends MonthEnergy {
  tariff: {
    mode: 'tiered' | 'flat';
    tiers: { size: number; price: number }[];
    flatPrice: number | null;
    vatPercent: number;
    source: string;
  };
  bestDay: { date: string; kwh: number } | null;
  partial: boolean;
  previousMonth: MonthEnergy;
  sameMonthLastYear: MonthEnergy;
  yearToDate: { generatedKwh: number; savings: number; months: number };
}

// ---- Activity (settings / schedule / grid-tie change history) ----
export interface ActivityEntry {
  _id: string;
  deviceId: string;
  kind: 'inverter' | 'charger' | 'hybrid';
  action: 'settings' | 'schedule' | 'grid-tie' | 'command';
  source: 'app' | 'web' | 'cms' | 'api' | 'system';
  actor: string | null;
  actorLabel: string | null;
  summary: string;
  before: string | null;
  after: string | null;
  createdAt: string;
}

export interface ActivityPage {
  data: ActivityEntry[];
  nextBefore: string | null;
}

// ---- Account energy overview (GET /api/user/energy-overview) ----
export interface OverviewDevice {
  deviceId: string;
  name: string;
  generatedKwh: number;
  gridKwh: number;
  savings: number;
  sharePercent: number;
}

export interface OverviewPeriod {
  generatedKwh: number;
  gridKwh: number;
  consumptionKwh: number;
  selfSufficiency: number;
  savings: number;
  devices: OverviewDevice[];
}

export interface EnergyOverview {
  generatedAt: string;
  devices: { deviceId: string; name: string }[];
  tariff: EnergyReport['tariff'];
  today: OverviewPeriod & { date: string };
  month: OverviewPeriod & {
    year: number;
    month: number;
    partial: boolean;
    days: { date: string; generatedKwh: number; gridKwh: number }[];
  };
  year: OverviewPeriod & {
    year: number;
    months: { month: number; generatedKwh: number; gridKwh: number; savings: number }[];
  };
  lifetime: OverviewPeriod & { since: string | null };
}

// ---- Power share groups (GET/POST/PATCH/DELETE /api/user/share-groups) ----
export interface ShareMember {
  deviceId: string;
  ratio: number;
}

export interface ShareGroup {
  _id: string;
  name?: string;
  enabled: boolean;
  members: ShareMember[];
  updatedAt?: string;
}

export interface ShareGroupInput {
  name?: string;
  enabled?: boolean;
  members: ShareMember[];
}

export interface ShareMemberLive {
  gridPower: number | null;
  batteryVoltage: number | null;
  gridTiePower: number | null;
  temperature: number | null;
  cutoffVoltage: number | null;
  powerLimit: number | null;
}

export interface ShareKwh {
  generatedKwh: number;
  gridKwh: number;
}

export interface ShareOverviewMember {
  deviceId: string;
  name: string;
  ratio: number;
  ratioPercent: number;
  online: boolean;
  gridTieOff: boolean;
  assignedWatts: number | null;
  live: ShareMemberLive | null;
  today: ShareKwh;
  week: ShareKwh;
  month: ShareKwh;
}

export interface ShareGroupOverview {
  groupId: string;
  name: string;
  enabled: boolean;
  generatedAt: string;
  poolWatts: number;
  weekStart: string;
  monthStart: string;
  totals: {
    gridTiePower: number;
    gridPower: number;
    assignedWatts: number;
    online: number;
    todayGeneratedKwh: number;
    todayGridKwh: number;
    weekGeneratedKwh: number;
    weekGridKwh: number;
    monthGeneratedKwh: number;
    monthGridKwh: number;
  };
  members: ShareOverviewMember[];
}
