import React, { useState, useEffect } from 'react';

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Settings,
  Clock,
  BarChart3,
  Save,
  RefreshCw,
  Zap,
  Plug,
  Activity,
  TrendingUp,
  Plus,
  X,
  WifiOff,
  Trash2,
  HeadphonesIcon,
  Phone,
  MessageCircle,
  MapPin,
  MonitorSmartphone,
  Cpu,
} from 'lucide-react';
import { useQuery as useRCQuery } from '@tanstack/react-query';
import { fetchSupportConfig } from '../services/remoteConfig';
import { useDeviceMqtt } from '../hooks/useDeviceMqtt';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  getDevice,
  getDeviceSettings,
  getGridTieStatus,
  setGridTieStatus,
  getDeviceSchedule,
  getLatestDeviceData,
  getDeviceMonthlyTotals,
  getDailyTotalsToday,
  calculateDailyTotals,
  updateDeviceSettings,
  updateDeviceSchedule,
  updateDevice,
  deleteDevice,
  getLatestFirmwareVersion,
  triggerFirmwareUpdate,
} from '../services/api';

type TabType = 'overview' | 'settings' | 'schedule' | 'support';

export function DeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [settingsValue, setSettingsValue] = useState('');
  const [scheduleValue, setScheduleValue] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // MQTT for real-time data
  const { isDeviceOnline } = useDeviceMqtt(deviceId);

  // Queries
  const deviceQuery = useQuery({
    queryKey: ['device', deviceId],
    queryFn: () => getDevice(deviceId!),
    enabled: !!deviceId,
  });

  const settingsQuery = useQuery({
    queryKey: ['device-settings', deviceId],
    queryFn: () => getDeviceSettings(deviceId!),
    enabled: !!deviceId && activeTab === 'settings',
  });

  const scheduleQuery = useQuery({
    queryKey: ['device-schedule', deviceId],
    queryFn: () => getDeviceSchedule(deviceId!),
    enabled: !!deviceId && activeTab === 'schedule',
  });

  const gridTieQuery = useQuery({
    queryKey: ['device-grid-tie', deviceId],
    queryFn: () => getGridTieStatus(deviceId!),
    enabled: !!deviceId,
  });

  const gridTieOff = gridTieQuery.data?.gridTieOff ?? false;

  const latestDataQuery = useQuery({
    queryKey: ['device-latest-data', deviceId],
    queryFn: () => getLatestDeviceData(deviceId!),
    enabled: !!deviceId && (activeTab === 'overview' || activeTab === 'settings'),
  });

  const latestFirmwareQuery = useQuery({
    queryKey: ['latest-firmware'],
    queryFn: () => getLatestFirmwareVersion(),
    enabled: activeTab === 'settings',
  });

  const firmwareUpdateMutation = useMutation({
    mutationFn: () => triggerFirmwareUpdate(deviceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
    },
  });

  const monthlyTotalsQuery = useQuery({
    queryKey: ['device-monthly-totals', deviceId],
    queryFn: () => getDeviceMonthlyTotals(deviceId!),
    enabled: !!deviceId && activeTab === 'overview',
  });

  const dailyTotalsQuery = useQuery({
    queryKey: ['device-daily-totals', deviceId],
    queryFn: () => calculateDailyTotals(deviceId!),
    enabled: !!deviceId && activeTab === 'overview',
  });

  const dailyTodayQuery = useQuery({
    queryKey: ['device-daily-today', deviceId],
    queryFn: () => getDailyTotalsToday(deviceId!),
    enabled: !!deviceId && activeTab === 'overview',
  });

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (value: string) => updateDeviceSettings(deviceId!, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-settings', deviceId] });
    },
  });

  const updateScheduleMutation = useMutation({
    mutationFn: (schedule: string) => updateDeviceSchedule(deviceId!, schedule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-schedule', deviceId] });
    },
  });

  const gridTieMutation = useMutation({
    mutationFn: (status: number) => setGridTieStatus(deviceId!, status),
    onSuccess: () => {
      // After toggling, re-fetch grid-tie status and the stored setting
      queryClient.invalidateQueries({ queryKey: ['device-grid-tie', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device-settings', deviceId] });
    },
  });

  const updateDeviceMutation = useMutation({
    mutationFn: (name: string) => updateDevice(deviceId!, { deviceName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      setIsEditingName(false);
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: () => deleteDevice(user!.uid, deviceId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      navigate('/');
    },
  });

  // Initialize form values when data loads
  useEffect(() => {
    if (settingsQuery.data) {
      setSettingsValue(settingsQuery.data.value || '');
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (scheduleQuery.data) {
      setScheduleValue(scheduleQuery.data.schedule || '');
    }
  }, [scheduleQuery.data]);

  useEffect(() => {
    if (deviceQuery.data) {
      setDeviceName(deviceQuery.data.deviceName || '');
    }
  }, [deviceQuery.data]);

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
    { id: 'schedule', label: 'Lịch trình', icon: Clock },
    { id: 'support', label: 'Hỗ trợ', icon: HeadphonesIcon },
  ];

  if (deviceQuery.isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (deviceQuery.error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600">Không thể tải thông tin thiết bị</p>
          <Link
            to="/"
            className="mt-4 inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Quay lại Bảng điều khiển
          </Link>
        </div>
      </Layout>
    );
  }

  const device = deviceQuery.data;

  return (
    <Layout>
      {/* Mobile-style background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <img src={asset('assets/images/background_2.png')} className="w-full h-full object-cover" alt="" aria-hidden="true" />
      </div>
      <div className="relative z-10 max-w-2xl mx-auto space-y-3 pb-8">
        {/* Header */}
        <div className="flex items-center space-x-3">
          <Link
            to="/"
            className="p-2 hover:bg-white/50 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="text-lg font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent w-full"
                  autoFocus
                />
                <button
                  onClick={() => updateDeviceMutation.mutate(deviceName)}
                  disabled={updateDeviceMutation.isPending}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1
                className="text-lg font-bold text-gray-900 cursor-pointer hover:text-blue-600 truncate"
                onClick={() => setIsEditingName(true)}
              >
                {device?.deviceName || device?.deviceId}
              </h1>
            )}
            <DeviceStatusIndicator isOnline={isDeviceOnline} />
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 flex-shrink-0"
            title="Xóa thiết bị"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Xóa thiết bị?
              </h3>
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa thiết bị "{device?.deviceName || deviceId}"?
                Hành động này không thể hoàn tác.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={() => deleteDeviceMutation.mutate()}
                  disabled={deleteDeviceMutation.isPending}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {deleteDeviceMutation.isPending ? (
                    <LoadingSpinner size="sm" className="text-white" />
                  ) : (
                    'Xóa'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 sm:p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              latestData={latestDataQuery.data}
              monthlyTotals={monthlyTotalsQuery.data}
              dailyTotals={dailyTotalsQuery.data}
              dailyToday={dailyTodayQuery.data}
              isLoading={latestDataQuery.isLoading || monthlyTotalsQuery.isLoading || dailyTotalsQuery.isLoading || dailyTodayQuery.isLoading}
              onRefresh={() => {
                latestDataQuery.refetch();
                monthlyTotalsQuery.refetch();
                dailyTotalsQuery.refetch();
                dailyTodayQuery.refetch();
              }}
              isRefreshing={latestDataQuery.isRefetching}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              value={settingsValue}
              onChange={setSettingsValue}
              onSave={(val) => updateSettingsMutation.mutate(val)}
              isLoading={settingsQuery.isLoading || settingsQuery.isFetching}
              isSaving={updateSettingsMutation.isPending}
              error={settingsQuery.error}
              onRetry={() => settingsQuery.refetch()}
              latestData={latestDataQuery.data}
              currentFirmware={device?.firmwareVersion}
              latestFirmware={latestFirmwareQuery.data?.version}
              onFirmwareUpdate={() => firmwareUpdateMutation.mutate()}
              isUpdatingFirmware={firmwareUpdateMutation.isPending}
              gridTieOff={gridTieOff}
              onToggleGridTie={(status) => gridTieMutation.mutate(status)}
              isTogglingGridTie={gridTieMutation.isPending || gridTieQuery.isLoading}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleTab
              value={scheduleValue}
              onChange={setScheduleValue}
              onSave={(val) => updateScheduleMutation.mutate(val)}
              isLoading={scheduleQuery.isLoading || scheduleQuery.isFetching}
              isSaving={updateScheduleMutation.isPending}
              error={scheduleQuery.error}
              onRetry={() => scheduleQuery.refetch()}
              gridTieOff={gridTieOff}
            />
          )}

          {activeTab === 'support' && <SupportTab />}
        </div>
      </div>
    </Layout>
  );
}

// Parse inverter value string - format based on mobile app (8 fields)
// data[0]=vAC, data[1]=fHZ, data[2]=p, data[3]=vBat, data[4]=energy,
// data[5]=mostphesTemp, data[6]=vBattUvpSetReal, data[7]=pMaxDischargeSetReal
interface ParsedInverterData {
  // Grid parameters
  gridVoltage: number;      // data[0] - vAC
  gridFrequency: number;    // data[1] - fHZ
  gridPower: number;        // data[2] - p (lấy lưới)
  // Battery parameters
  batteryVoltage: number;   // data[3] - vBat
  energy: number;           // data[4] - công suất hoà lưới
  // Temperature
  temperature: number;      // data[5] - mostphesTemp
  // Settings (real values from device)
  vBattUvpSetReal: number;  // data[6]
  pMaxDischargeSetReal: number; // data[7]
  // Calculated values (matching mobile app)
  batteryPower: number;     // energy / 0.94 (Công suất ắc quy)
  consumption: number;      // gridPower + energy (Tiêu thụ)
  dischargeCurrent: number; // batteryPower / batteryVoltage
  // Raw parts for debugging
  rawParts: string[];
}

function parseInverterValue(value: string): ParsedInverterData | null {
  if (!value) return null;

  const parts = value.replace(/\$/g, '').split('#');
  if (parts.length < 8) return null;

  const gridVoltage = parseFloat(parts[0]) || 0;
  const gridFrequency = parseFloat(parts[1]) || 0;
  const gridPower = parseFloat(parts[2]) || 0;
  const batteryVoltage = parseFloat(parts[3]) || 0;
  const energy = parseFloat(parts[4]) || 0;
  const temperature = parseFloat(parts[5]) || 0;
  const vBattUvpSetReal = parseFloat(parts[6]) || 0;
  const pMaxDischargeSetReal = parseFloat(parts[7]) || 0;

  // Calculated values (matching mobile app logic)
  const batteryPower = energy / 0.94; // Công suất ắc quy
  const consumption = gridPower + energy; // Tiêu thụ
  const dischargeCurrent = batteryVoltage > 0 ? batteryPower / batteryVoltage : 0;

  return {
    gridVoltage,
    gridFrequency,
    gridPower,
    batteryVoltage,
    energy,
    temperature,
    vBattUvpSetReal,
    pMaxDischargeSetReal,
    batteryPower,
    consumption,
    dischargeCurrent,
    rawParts: parts,
  };
}

// Overview Tab Component
function OverviewTab({
  latestData,
  monthlyTotals,
  dailyTotals,
  dailyToday,
  isLoading,
  onRefresh,
  isRefreshing,
}: {
  latestData: any;
  monthlyTotals: any;
  dailyTotals: { totalA: number; totalA2: number } | undefined;
  dailyToday: { totalA: number; totalA2: number } | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  const parsedData = parseInverterValue(latestData?.value);

  return (
    <div className="space-y-4">
      {/* Refresh */}
      <div className="flex justify-end">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {parsedData ? (
        <>
          {/* Thông tin hệ thống - matching mobile layout */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Thông tin hệ thống</p>

            {/* Battery top center + voltage/current top-right */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start py-1">
              <div />
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-full border-2 border-blue-300 bg-white flex items-center justify-center shadow-sm">
                  <img src={asset('assets/icons/icon_battery.svg')} className="w-7 h-7" alt="" />
                </div>
                <img src={asset('assets/images/ic_arrow_down.gif')} className="h-6 mt-0.5" alt="" />
                <p className="text-xl font-bold text-gray-900">{parsedData.batteryPower.toFixed(2)} W</p>
                <p className="text-xs text-gray-400">Công suất xả</p>
              </div>
              <div className="flex flex-col items-end justify-start space-y-1.5 pt-1">
                <p className="text-xs text-gray-500 text-right">Điện áp: <span className="text-blue-600 font-semibold">{parsedData.batteryVoltage.toFixed(2)} V</span></p>
                <p className="text-xs text-gray-500 text-right">Dòng điện xả: <span className="text-blue-600 font-semibold">{parsedData.dischargeCurrent.toFixed(2)} A</span></p>
              </div>
            </div>

            {/* Grid voltage + arrow (left 32/62 like mobile) */}
            <div className="flex items-center">
              <div className="flex-[32] flex items-center justify-between">
                <p className="text-xs font-medium text-blue-500">
                  {parsedData.gridVoltage.toFixed(2)}V - {parsedData.gridFrequency.toFixed(2)}Hz
                </p>
                <img src={asset('assets/images/ic_arrow_down.gif')} className="h-5" alt="" />
              </div>
              <div className="flex-[30]" />
            </div>

            {/* Main energy flow row: Grid → Lấy lưới → Inverter → Tiêu thụ → House */}
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full border-2 border-blue-300 bg-white flex items-center justify-center flex-shrink-0">
                <img src={asset('assets/icons/icon_electricity.svg')} className="w-5 h-5" alt="" />
              </div>
              <div className="flex-1 flex items-center">
                <img src={asset('assets/images/ic_arrow.gif')} className="w-5 flex-shrink-0" alt="" />
                <div className="flex-1 text-center">
                  <p className="text-xs font-bold leading-tight text-gray-900">{parsedData.gridPower.toFixed(2)} W</p>
                  <p className="text-xs text-gray-400">Lấy lưới</p>
                </div>
                <img src={asset('assets/images/ic_arrow.gif')} className="w-5 flex-shrink-0" alt="" />
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-orange-300 bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                <img src={asset('assets/icons/icon_inverter_3.svg')} className="w-7 h-7" alt="" />
              </div>
              <div className="flex-1 flex items-center">
                <img src={asset('assets/images/ic_arrow.gif')} className="w-5 flex-shrink-0" alt="" />
                <div className="flex-1 text-center">
                  <p className="text-xs font-bold leading-tight text-gray-900">{parsedData.consumption.toFixed(2)} W</p>
                  <p className="text-xs text-gray-400">Tiêu thụ</p>
                </div>
                <img src={asset('assets/images/ic_arrow.gif')} className="w-5 flex-shrink-0" alt="" />
              </div>
              <div className="w-10 h-10 rounded-full border-2 border-blue-300 bg-white flex items-center justify-center flex-shrink-0">
                <img src={asset('assets/icons/icon_house.svg')} className="w-5 h-5" alt="" />
              </div>
            </div>

            {/* Summary stats: Lấy lưới tổng | Điện áp ngắt | Tiêu thụ tổng */}
            <div className="flex justify-between pt-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-900">{(dailyTotals?.totalA2 ?? 0).toFixed(2)} kWh</p>
                <p className="text-xs text-gray-500">Lấy lưới tổng</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-900">{parsedData.vBattUvpSetReal.toFixed(2)} V</p>
                <p className="text-xs text-gray-500">Điện áp ngắt</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{((dailyTotals?.totalA ?? 0) + (dailyTotals?.totalA2 ?? 0)).toFixed(2)} kWh</p>
                <p className="text-xs text-gray-500">Tiêu thụ tổng</p>
              </div>
            </div>

            {/* Bottom center: Công suất giới hạn + hoà lưới + nhiệt độ */}
            <div className="text-center space-y-1.5 pt-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-bold text-gray-900">{parsedData.pMaxDischargeSetReal.toFixed(0)} W</p>
                <p className="text-xs text-gray-400">Công suất giới hạn</p>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{parsedData.energy.toFixed(2)} W</p>
                <p className="text-xs text-gray-400">Công suất hoà lưới</p>
              </div>
              <div className="flex items-center justify-center space-x-1">
                <img src={asset('assets/icons/icon_temp.svg')} className="w-5 h-5" alt="" />
                <p className="text-xs font-medium text-orange-600">Nhiệt độ Mosfet: {parsedData.temperature.toFixed(1)} °C</p>
              </div>
            </div>
          </div>

          {/* Raw data collapsible */}
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
              Dữ liệu thô ({parsedData.rawParts.length} trường)
            </summary>
            <div className="mt-2 p-3 bg-gray-50 rounded-xl font-mono text-xs overflow-x-auto">
              {parsedData.rawParts.map((part, index) => (
                <span key={index} className="inline-block mr-2 mb-1 px-2 py-1 bg-white rounded">
                  [{index}]: {part}
                </span>
              ))}
            </div>
          </details>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">Không có dữ liệu</div>
      )}

      {/* Hôm nay */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Hôm nay</p>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4">
          <div className="flex justify-between">
            <EnergyCol
              iconSrc={asset('assets/icons/icon_battery_2.svg')}
              value={(dailyToday?.totalA ?? 0).toFixed(2)}
              label={"Năng lượng xả\n(kWh)"}
            />
            <EnergyCol
              iconSrc={asset('assets/icons/icon_electric_poles.svg')}
              value={(dailyToday?.totalA2 ?? 0).toFixed(2)}
              label={"Năng lượng lấy\nlưới (kWh)"}
            />
            <EnergyCol
              iconSrc={asset('assets/icons/icon_home_2.svg')}
              value={((dailyToday?.totalA ?? 0) + (dailyToday?.totalA2 ?? 0)).toFixed(2)}
              label={"Năng lượng tiêu\nthụ (kWh)"}
            />
          </div>
        </div>
      </div>

      {/* Tháng này */}
      <div>
        <p className="text-sm font-semibold text-gray-900 mb-2">Tháng này</p>
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4">
          <div className="flex justify-between">
            <EnergyCol
              iconSrc={asset('assets/icons/icon_battery_2.svg')}
              value={(monthlyTotals?.totalA ?? 0).toFixed(2)}
              label={"Năng lượng xả\n(kWh)"}
            />
            <EnergyCol
              iconSrc={asset('assets/icons/icon_electric_poles.svg')}
              value={(monthlyTotals?.totalA2 ?? 0).toFixed(2)}
              label={"Năng lượng lấy\nlưới (kWh)"}
            />
            <EnergyCol
              iconSrc={asset('assets/icons/icon_home_2.svg')}
              value={((monthlyTotals?.totalA ?? 0) + (monthlyTotals?.totalA2 ?? 0)).toFixed(2)}
              label={"Năng lượng tiêu\nthụ (kWh)"}
            />
          </div>
        </div>
      </div>

      {/* Last updated */}
      {latestData?.updatedAt && (
        <p className="text-xs text-gray-400 text-right">
          Cập nhật lần cuối: {new Date(latestData.updatedAt).toLocaleString('vi-VN')}
        </p>
      )}
    </div>
  );
}

function EnergyCol({
  iconSrc,
  value,
  label,
}: {
  iconSrc: string;
  value: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center space-y-2">
      <img src={iconSrc} className="w-8 h-8" alt="" />
      <p className="text-base font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 text-center whitespace-pre-line">{label}</p>
    </div>
  );
}

// Device Status Indicator Component (online/offline based on MQTT message timeout)
function DeviceStatusIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="inline-flex items-center space-x-1">
      <img
        src={isOnline ? asset('assets/icons/icon_wifi_on.svg') : asset('assets/icons/icon_wifi_off.svg')}
        className="w-[18px] h-[18px]"
        alt=""
      />
      <span className={`text-sm font-semibold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

// Parse settings value: "XXXXYYYYM" -> { vBattUvp: XX.XX, pMaxDischarge: YYYY-1000 }
function parseSettingsValue(value: string): { vBattUvp: number; pMaxDischarge: number } {
  if (!value || value.length < 8) {
    return { vBattUvp: 48, pMaxDischarge: 500 };
  }
  try {
    const vBattUvp = parseFloat(value.substring(0, 4)) / 100;
    const pMaxDischarge = parseInt(value.substring(4, 8)) - 1000;
    return { vBattUvp, pMaxDischarge };
  } catch {
    return { vBattUvp: 48, pMaxDischarge: 500 };
  }
}

// Format settings to string: { vBattUvp, pMaxDischarge } -> "XXXXYYYYM"
function formatSettingsValue(vBattUvp: number, pMaxDischarge: number): string {
  const vBattStr = Math.round(vBattUvp * 100).toString().padStart(4, '0');
  const pMaxStr = (pMaxDischarge + 1000).toString().padStart(4, '0');
  return `${vBattStr}${pMaxStr}`;
}

// Parse real-time inverter data for settings display
function parseRealTimeSettings(value: string): { vBattReal: number; pMaxReal: number } {
  if (!value) return { vBattReal: 0, pMaxReal: 0 };
  try {
    const parts = value.replace(/\$/g, '').split('#');
    // Based on mobile app: data[6] = vBattUvpSetReal, data[7] = pMaxDischargeSetReal
    return {
      vBattReal: parseFloat(parts[6]) || 0,
      pMaxReal: parseFloat(parts[7]) || 0,
    };
  } catch {
    return { vBattReal: 0, pMaxReal: 0 };
  }
}

// Compare firmware versions
function compareVersions(current: string, latest: string): number {
  if (!current || !latest) return 0;
  try {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    const maxLength = Math.max(currentParts.length, latestParts.length);

    for (let i = 0; i < maxLength; i++) {
      const c = currentParts[i] || 0;
      const l = latestParts[i] || 0;
      if (c < l) return -1;
      if (c > l) return 1;
    }
    return 0;
  } catch {
    return 0;
  }
}

// Settings Tab Component
function SettingsTab({
  value,
  onChange,
  onSave,
  isLoading,
  isSaving,
  error,
  onRetry,
  latestData,
  currentFirmware,
  latestFirmware,
  onFirmwareUpdate,
  isUpdatingFirmware,
  gridTieOff,
  onToggleGridTie,
  isTogglingGridTie,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  onRetry: () => void;
  latestData?: { value: string } | null;
  currentFirmware?: string;
  latestFirmware?: string;
  onFirmwareUpdate: () => void;
  isUpdatingFirmware: boolean;
  gridTieOff: boolean;
  onToggleGridTie: (status: number) => void;
  isTogglingGridTie: boolean;
}) {
  const [vBattUvp, setVBattUvp] = useState('48.00');
  const [pMaxDischarge, setPMaxDischarge] = useState('500');
  const [vBattError, setVBattError] = useState('');
  const [pMaxError, setPMaxError] = useState('');

  // Parse value when it changes
  useEffect(() => {
    if (value) {
      const parsed = parseSettingsValue(value);
      setVBattUvp(parsed.vBattUvp.toFixed(2));
      setPMaxDischarge(parsed.pMaxDischarge.toString());
    }
  }, [value]);

  // Get real-time values from latest data
  const realTimeValues = parseRealTimeSettings(latestData?.value || '');
  const isUpdateAvailable = compareVersions(currentFirmware || '', latestFirmware || '') < 0;

  const validateVBatt = (val: string): boolean => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 10 || num > 99.99) {
      setVBattError('Điện áp ngắt kích phải từ 10 đến 99.99');
      return false;
    }
    setVBattError('');
    return true;
  };

  const validatePMax = (val: string): boolean => {
    const num = parseInt(val);
    if (isNaN(num) || num <= 0 || num > 8999) {
      setPMaxError('Công suất phải từ 1 đến 8999');
      return false;
    }
    setPMaxError('');
    return true;
  };

  const handleSave = () => {
    const isVBattValid = validateVBatt(vBattUvp);
    const isPMaxValid = validatePMax(pMaxDischarge);

    if (isVBattValid && isPMaxValid) {
      const newValue = formatSettingsValue(parseFloat(vBattUvp), parseInt(pMaxDischarge));
      onChange(newValue);
      onSave(newValue);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Cài đặt thiết bị</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">Không thể tải cài đặt thiết bị</p>
          <button
            onClick={onRetry}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grid-tie (Hoà lưới) Section */}
      <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 mb-4">Hoà lưới</h4>
        <div className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${gridTieOff ? 'bg-gray-200' : 'bg-green-100'}`}>
                <Plug className={`w-5 h-5 ${gridTieOff ? 'text-gray-500' : 'text-green-600'}`} />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">
                  {gridTieOff ? 'Đã tắt hoà lưới' : 'Đang hoà lưới'}
                </span>
                <p className="text-xs text-gray-500">
                  {gridTieOff ? 'Bật để cho phép hoà lưới' : 'Tắt để ngừng hoà lưới'}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!gridTieOff}
              disabled={isTogglingGridTie}
              onClick={() => onToggleGridTie(gridTieOff ? 0 : 1)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                gridTieOff ? 'bg-gray-300' : 'bg-blue-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  gridTieOff ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </button>
          </div>
          {gridTieOff && (
            <p className="text-xs text-amber-600 mt-3">
              Lịch không hoạt động do bạn đã tắt hoà lưới.
            </p>
          )}
        </div>
      </div>

      {/* Voltage Section */}
      <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 mb-4">Điện áp</h4>
        <div className="border-t border-gray-200 pt-4 space-y-4">
          {/* Editable voltage */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Zap className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Điện áp ngắt kích</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                step="0.01"
                min="10"
                max="99.99"
                value={vBattUvp}
                onChange={(e) => {
                  setVBattUvp(e.target.value);
                  validateVBatt(e.target.value);
                }}
                className={`w-24 px-3 py-2 text-right border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  vBattError ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <span className="text-sm text-gray-500 w-8">(V)</span>
            </div>
          </div>
          {vBattError && (
            <p className="text-red-500 text-xs text-right">{vBattError}</p>
          )}

          {/* Real-time voltage (read-only) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-200 rounded-lg">
                <Zap className="w-5 h-5 text-gray-500" />
              </div>
              <span className="text-sm font-medium text-gray-500">Điện áp ngắt kích thực tế</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-24 px-3 py-2 text-right bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
                {realTimeValues.vBattReal.toFixed(2)}
              </span>
              <span className="text-sm text-gray-500 w-8">(V)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Power Section */}
      <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 mb-4">Công suất</h4>
        <div className="border-t border-gray-200 pt-4 space-y-4">
          {/* Editable power */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Công suất hoà tối đa</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                step="1"
                min="1"
                max="8999"
                value={pMaxDischarge}
                onChange={(e) => {
                  setPMaxDischarge(e.target.value);
                  validatePMax(e.target.value);
                }}
                className={`w-24 px-3 py-2 text-right border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  pMaxError ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <span className="text-sm text-gray-500 w-8">(W)</span>
            </div>
          </div>
          {pMaxError && (
            <p className="text-red-500 text-xs text-right">{pMaxError}</p>
          )}

          {/* Real-time power (read-only) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-200 rounded-lg">
                <Activity className="w-5 h-5 text-gray-500" />
              </div>
              <span className="text-sm font-medium text-gray-500">Công suất hoà tối đa thực tế</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-24 px-3 py-2 text-right bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
                {realTimeValues.pMaxReal.toFixed(0)}
              </span>
              <span className="text-sm text-gray-500 w-8">(W)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Firmware Section */}
      <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 mb-4">Phiên bản</h4>
        <div className="border-t border-gray-200 pt-4 space-y-4">
          {/* Current version */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Settings className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Phiên bản hiện tại</span>
            </div>
            <span className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
              {currentFirmware || '---'}
            </span>
          </div>

          {/* Latest version */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">Phiên bản mới</span>
            </div>
            <span className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
              {latestFirmware || '---'}
            </span>
          </div>

          {/* Update button */}
          <button
            onClick={onFirmwareUpdate}
            disabled={!isUpdateAvailable || isUpdatingFirmware}
            className={`w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center space-x-2 ${
              isUpdateAvailable
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isUpdatingFirmware ? (
              <LoadingSpinner size="sm" className="text-white" />
            ) : (
              <span>Cập nhật</span>
            )}
          </button>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving || gridTieOff}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
      >
        {isSaving ? (
          <LoadingSpinner size="sm" className="text-white" />
        ) : (
          <>
            <Save className="w-5 h-5" />
            <span>Lưu</span>
          </>
        )}
      </button>
    </div>
  );
}

// Schedule item interface
interface ScheduleItem {
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  vBattUvp: string;
  pMaxDischarge: string;
}

// Parse schedule string: "start=HH:MM&end=HH:MM&value=XXXXXXXX#..."
function parseScheduleValue(value: string): ScheduleItem[] {
  if (!value) {
    return [
      { startTime: '08:00', endTime: '17:00', vBattUvp: '48.00', pMaxDischarge: '500' },
      { startTime: '08:00', endTime: '17:00', vBattUvp: '48.00', pMaxDischarge: '500' },
      { startTime: '08:00', endTime: '17:00', vBattUvp: '48.00', pMaxDischarge: '500' },
    ];
  }

  try {
    const schedules = value.split('#');
    return schedules.map((schedule) => {
      const params: Record<string, string> = {};
      schedule.split('&').forEach((param) => {
        const [key, val] = param.split('=');
        if (key && val) params[key] = val;
      });

      // Parse start time (convert from UTC to local +7)
      let startTime = '08:00';
      if (params.start) {
        const [h, m] = params.start.split(':').map(Number);
        const localH = (h + 7) % 24;
        startTime = `${localH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }

      // Parse end time (convert from UTC to local +7)
      let endTime = '17:00';
      if (params.end) {
        const [h, m] = params.end.split(':').map(Number);
        const localH = (h + 7) % 24;
        endTime = `${localH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      }

      // Parse value (first 4 digits = vBatt * 100, last 4 digits = pMax + 1000)
      let vBattUvp = '48.00';
      let pMaxDischarge = '500';
      if (params.value && params.value.length >= 8) {
        vBattUvp = (parseFloat(params.value.substring(0, 4)) / 100).toFixed(2);
        pMaxDischarge = (parseInt(params.value.substring(4, 8)) - 1000).toString();
      }

      return { startTime, endTime, vBattUvp, pMaxDischarge };
    });
  } catch {
    return [
      { startTime: '08:00', endTime: '17:00', vBattUvp: '48.00', pMaxDischarge: '500' },
      { startTime: '08:00', endTime: '17:00', vBattUvp: '48.00', pMaxDischarge: '500' },
      { startTime: '08:00', endTime: '17:00', vBattUvp: '48.00', pMaxDischarge: '500' },
    ];
  }
}

// Format schedules to string
function formatScheduleValue(schedules: ScheduleItem[]): string {
  return schedules.map((schedule) => {
    // Convert local time to UTC (-7)
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);

    const utcStartH = (startH - 7 + 24) % 24;
    const utcEndH = (endH - 7 + 24) % 24;

    const startStr = `${utcStartH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
    const endStr = `${utcEndH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    // Format value
    const vBatt = Math.round(parseFloat(schedule.vBattUvp) * 100).toString().padStart(4, '0');
    const pMax = (parseInt(schedule.pMaxDischarge) + 1000).toString().padStart(4, '0');

    return `start=${startStr}&end=${endStr}&value=${vBatt}${pMax}`;
  }).join('#');
}

const MIN_SCHEDULES = 3;
const MAX_SCHEDULES = 10;

// Schedule Tab Component
function ScheduleTab({
  value,
  onChange,
  onSave,
  isLoading,
  isSaving,
  error,
  onRetry,
  gridTieOff,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  onRetry: () => void;
  gridTieOff: boolean;
}) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);

  // Parse value when it changes
  useEffect(() => {
    const parsed = parseScheduleValue(value);
    // Ensure minimum 3 schedules
    while (parsed.length < MIN_SCHEDULES) {
      parsed.push({ startTime: '08:00', endTime: '17:00', vBattUvp: '48.00', pMaxDischarge: '500' });
    }
    setSchedules(parsed);
  }, [value]);

  const updateSchedule = (index: number, field: keyof ScheduleItem, newValue: string) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: newValue };
    setSchedules(newSchedules);
  };

  const addSchedule = () => {
    if (schedules.length < MAX_SCHEDULES) {
      setSchedules([...schedules, { startTime: '08:00', endTime: '17:00', vBattUvp: '48.00', pMaxDischarge: '500' }]);
    }
  };

  const removeSchedule = (index: number) => {
    if (schedules.length > MIN_SCHEDULES) {
      const newSchedules = schedules.filter((_, i) => i !== index);
      setSchedules(newSchedules);
    }
  };

  const handleSave = () => {
    const newValue = formatScheduleValue(schedules);
    onChange(newValue);
    onSave(newValue);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Lịch xả</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">Không thể tải lịch xả</p>
          <button
            onClick={onRetry}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grid-tie off notice */}
      {gridTieOff && (
        <div className="flex items-start space-x-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <WifiOff className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-amber-700">
            Lịch không hoạt động do bạn đã tắt hoà lưới.
          </p>
        </div>
      )}

      {/* Schedule Cards */}
      {schedules.map((schedule, index) => (
        <div key={index} className="bg-gray-50 rounded-xl p-4 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-gray-900">Lịch xả {index + 1}</h4>
            {schedules.length > MIN_SCHEDULES && (
              <button
                onClick={() => removeSchedule(index)}
                className="p-1.5 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
              >
                <X className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-4">
            {/* Voltage */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                <Zap className="w-4 h-4 text-yellow-600" />
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1 min-w-0">Điện áp ngắt</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="number"
                  step="0.01"
                  min="10"
                  max="99.99"
                  value={schedule.vBattUvp}
                  onChange={(e) => updateSchedule(index, 'vBattUvp', e.target.value)}
                  className="w-20 px-2 py-1.5 text-right border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-sm text-gray-500 w-6">(V)</span>
              </div>
            </div>

            {/* Power */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1 min-w-0">Công suất tối đa</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="8999"
                  value={schedule.pMaxDischarge}
                  onChange={(e) => updateSchedule(index, 'pMaxDischarge', e.target.value)}
                  className="w-20 px-2 py-1.5 text-right border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-sm text-gray-500 w-6">(W)</span>
              </div>
            </div>

            {/* Time Range */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
                  <Clock className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-medium text-gray-700">Thời gian</span>
              </div>
              <div className="flex items-center gap-2 pl-11">
                <input
                  type="time"
                  value={schedule.startTime}
                  onChange={(e) => updateSchedule(index, 'startTime', e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-400 flex-shrink-0">-</span>
                <input
                  type="time"
                  value={schedule.endTime}
                  onChange={(e) => updateSchedule(index, 'endTime', e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Add Schedule Button */}
      {schedules.length < MAX_SCHEDULES && (
        <button
          onClick={addSchedule}
          className="w-full py-3 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 font-medium hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Thêm lịch xả</span>
        </button>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving || gridTieOff}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
      >
        {isSaving ? (
          <LoadingSpinner size="sm" className="text-white" />
        ) : (
          <>
            <Save className="w-5 h-5" />
            <span>Lưu</span>
          </>
        )}
      </button>
    </div>
  );
}

// Support Tab Component
function SupportTab() {
  const { data: config, isLoading } = useRCQuery({
    queryKey: ['support-config'],
    queryFn: fetchSupportConfig,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Thông tin hỗ trợ</h3>

      {/* Hardware Support */}
      <SupportItem
        icon={Cpu}
        iconBg="bg-blue-100"
        iconColor="text-blue-600"
        title="Hỗ trợ phần cứng"
        name={config?.hardwareSupportName}
        phone={config?.hardwareSupportPhone}
      />

      {/* Software Support */}
      <SupportItem
        icon={MonitorSmartphone}
        iconBg="bg-purple-100"
        iconColor="text-purple-600"
        title="Hỗ trợ phần mềm"
        name={config?.softwareSupportName}
        phone={config?.softwareSupportPhone}
      />

      {/* Warranty Address */}
      {config?.warrantyAddress && (
        <a
          href={config.warrantyAddressLink || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="flex items-center space-x-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-blue-300 transition-colors">
            <div className="p-3 bg-orange-100 rounded-lg flex-shrink-0">
              <MapPin className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">Địa chỉ bảo hành</p>
              <p className="text-sm text-gray-600 mt-0.5">{config.warrantyAddress}</p>
            </div>
            {config.warrantyAddressLink && (
              <div className="p-2 bg-orange-50 rounded-lg flex-shrink-0">
                <MapPin className="w-5 h-5 text-orange-600" />
              </div>
            )}
          </div>
        </a>
      )}

      {/* Messenger Group */}
      {config?.messengerGroupLink && (
        <a
          href={config.messengerGroupLink}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className="flex items-center space-x-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors">
            <div className="p-3 bg-indigo-100 rounded-lg flex-shrink-0">
              <MessageCircle className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Nhóm hỗ trợ Messenger</p>
              <p className="text-sm text-gray-600 mt-0.5">Tham gia nhóm chat để được hỗ trợ</p>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg flex-shrink-0">
              <ArrowLeft className="w-5 h-5 text-indigo-600 rotate-180" />
            </div>
          </div>
        </a>
      )}
    </div>
  );
}

function SupportItem({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  name,
  phone,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  name?: string;
  phone?: string;
}) {
  return (
    <div className="flex items-center space-x-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className={`p-3 ${iconBg} rounded-lg flex-shrink-0`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{title}</p>
        {name && <p className="text-sm text-gray-600 mt-0.5">{name}</p>}
        {phone && <p className="text-sm text-gray-500">{phone}</p>}
        {!name && !phone && (
          <p className="text-sm text-gray-400 italic">Chưa có thông tin</p>
        )}
      </div>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="p-2.5 bg-green-50 rounded-lg flex-shrink-0 hover:bg-green-100 transition-colors"
        >
          <Phone className="w-5 h-5 text-green-600" />
        </a>
      )}
    </div>
  );
}
