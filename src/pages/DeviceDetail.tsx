import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Settings,
  Clock,
  BarChart3,
  Save,
  RefreshCw,
  Zap,
  Battery,
  Sun,
  Plug,
  Activity,
  TrendingUp,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  getDevice,
  getDeviceSettings,
  getDeviceSchedule,
  getLatestDeviceData,
  getDeviceMonthlyTotals,
  updateDeviceSettings,
  updateDeviceSchedule,
  updateDevice,
} from '../services/api';

type TabType = 'overview' | 'settings' | 'schedule';

export function DeviceDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [settingsValue, setSettingsValue] = useState('');
  const [scheduleValue, setScheduleValue] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

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

  const latestDataQuery = useQuery({
    queryKey: ['device-latest-data', deviceId],
    queryFn: () => getLatestDeviceData(deviceId!),
    enabled: !!deviceId && activeTab === 'overview',
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const monthlyTotalsQuery = useQuery({
    queryKey: ['device-monthly-totals', deviceId],
    queryFn: () => getDeviceMonthlyTotals(deviceId!),
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

  const updateDeviceMutation = useMutation({
    mutationFn: (name: string) => updateDevice(deviceId!, { deviceName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      setIsEditingName(false);
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Link
            to="/"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent"
                  autoFocus
                />
                <button
                  onClick={() => updateDeviceMutation.mutate(deviceName)}
                  disabled={updateDeviceMutation.isPending}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600"
                onClick={() => setIsEditingName(true)}
              >
                {device?.deviceName || device?.deviceId}
              </h1>
            )}
            <p className="text-gray-500">Mã thiết bị: {deviceId}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {activeTab === 'overview' && (
            <OverviewTab
              latestData={latestDataQuery.data}
              monthlyTotals={monthlyTotalsQuery.data}
              isLoading={latestDataQuery.isLoading || monthlyTotalsQuery.isLoading}
              onRefresh={() => {
                latestDataQuery.refetch();
                monthlyTotalsQuery.refetch();
              }}
              isRefreshing={latestDataQuery.isRefetching}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              value={settingsValue}
              onChange={setSettingsValue}
              onSave={() => updateSettingsMutation.mutate(settingsValue)}
              isLoading={settingsQuery.isLoading || settingsQuery.isFetching}
              isSaving={updateSettingsMutation.isPending}
              error={settingsQuery.error}
              onRetry={() => settingsQuery.refetch()}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleTab
              value={scheduleValue}
              onChange={setScheduleValue}
              onSave={() => updateScheduleMutation.mutate(scheduleValue)}
              isLoading={scheduleQuery.isLoading || scheduleQuery.isFetching}
              isSaving={updateScheduleMutation.isPending}
              error={scheduleQuery.error}
              onRetry={() => scheduleQuery.refetch()}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

// Parse inverter value string - format: field1#field2#...#totalA#totalA2
interface ParsedInverterData {
  // Grid parameters
  gridVoltage: number;
  gridCurrent: number;
  gridPower: number;
  gridFrequency: number;
  // Battery parameters
  batteryVoltage: number;
  batteryCurrent: number;
  batteryPower: number;
  batterySoc: number;
  // PV/Solar parameters
  pvVoltage: number;
  pvCurrent: number;
  pvPower: number;
  // Load parameters
  loadPower: number;
  loadPercent: number;
  // Temperature
  temperature: number;
  // Operating mode
  operatingMode: number;
  // Totals (raw values, need to divide by 1000000)
  totalA: number;
  totalA2: number;
  // Raw parts for debugging
  rawParts: string[];
}

function parseInverterValue(value: string): ParsedInverterData | null {
  if (!value) return null;

  const parts = value.split('#');
  if (parts.length < 10) return null;

  // Parse based on typical inverter data format
  // This mapping may need adjustment based on actual device protocol
  return {
    gridVoltage: parseFloat(parts[0]) || 0,
    gridCurrent: parseFloat(parts[1]) || 0,
    gridPower: parseFloat(parts[2]) || 0,
    gridFrequency: parseFloat(parts[3]) || 0,
    batteryVoltage: parseFloat(parts[4]) || 0,
    batteryCurrent: parseFloat(parts[5]) || 0,
    batteryPower: parseFloat(parts[6]) || 0,
    batterySoc: parseFloat(parts[7]) || 0,
    pvVoltage: parseFloat(parts[8]) || 0,
    pvCurrent: parseFloat(parts[9]) || 0,
    pvPower: parseFloat(parts[10]) || 0,
    loadPower: parseFloat(parts[11]) || 0,
    loadPercent: parseFloat(parts[12]) || 0,
    temperature: parseFloat(parts[13]) || 0,
    operatingMode: parseFloat(parts[14]) || 0,
    totalA: (parseFloat(parts[parts.length - 2]) || 0) / 1000000,
    totalA2: (parseFloat(parts[parts.length - 1]) || 0) / 1000000,
    rawParts: parts,
  };
}

// Overview Tab Component
function OverviewTab({
  latestData,
  monthlyTotals,
  isLoading,
  onRefresh,
  isRefreshing,
}: {
  latestData: any;
  monthlyTotals: any;
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
    <div className="space-y-8">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Dữ liệu thời gian thực</h3>
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
          {/* Main Stats - Primary metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={Sun}
              label="Pin mặt trời"
              value={`${parsedData.pvPower.toFixed(0)} W`}
              subValue={`${parsedData.pvVoltage.toFixed(1)}V / ${parsedData.pvCurrent.toFixed(1)}A`}
              color="yellow"
            />
            <StatCard
              icon={Battery}
              label="Ắc quy"
              value={`${parsedData.batterySoc.toFixed(0)}%`}
              subValue={`${parsedData.batteryVoltage.toFixed(1)}V / ${parsedData.batteryPower.toFixed(0)}W`}
              color="green"
            />
            <StatCard
              icon={Plug}
              label="Tải"
              value={`${parsedData.loadPower.toFixed(0)} W`}
              subValue={`${parsedData.loadPercent.toFixed(0)}% công suất`}
              color="blue"
            />
            <StatCard
              icon={Zap}
              label="Lưới điện"
              value={`${parsedData.gridPower.toFixed(0)} W`}
              subValue={`${parsedData.gridVoltage.toFixed(1)}V / ${parsedData.gridFrequency.toFixed(1)}Hz`}
              color="purple"
            />
          </div>

          {/* Detailed Parameters Section */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-gray-700">Thông số chi tiết</h4>

            {/* Grid Section */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-gray-600 mb-3 flex items-center">
                <Zap className="w-4 h-4 mr-2" /> Thông số lưới điện
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DataItem label="Điện áp" value={`${parsedData.gridVoltage.toFixed(1)} V`} />
                <DataItem label="Dòng điện" value={`${parsedData.gridCurrent.toFixed(2)} A`} />
                <DataItem label="Công suất" value={`${parsedData.gridPower.toFixed(0)} W`} />
                <DataItem label="Tần số" value={`${parsedData.gridFrequency.toFixed(2)} Hz`} />
              </div>
            </div>

            {/* Battery Section */}
            <div className="bg-green-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-green-700 mb-3 flex items-center">
                <Battery className="w-4 h-4 mr-2" /> Thông số ắc quy
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DataItem label="Điện áp" value={`${parsedData.batteryVoltage.toFixed(1)} V`} />
                <DataItem label="Dòng điện" value={`${parsedData.batteryCurrent.toFixed(2)} A`} />
                <DataItem label="Công suất" value={`${parsedData.batteryPower.toFixed(0)} W`} />
                <DataItem label="Dung lượng" value={`${parsedData.batterySoc.toFixed(0)} %`} />
              </div>
            </div>

            {/* PV/Solar Section */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-yellow-700 mb-3 flex items-center">
                <Sun className="w-4 h-4 mr-2" /> Thông số pin mặt trời
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <DataItem label="Điện áp" value={`${parsedData.pvVoltage.toFixed(1)} V`} />
                <DataItem label="Dòng điện" value={`${parsedData.pvCurrent.toFixed(2)} A`} />
                <DataItem label="Công suất" value={`${parsedData.pvPower.toFixed(0)} W`} />
              </div>
            </div>

            {/* Load & System Section */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-blue-700 mb-3 flex items-center">
                <Activity className="w-4 h-4 mr-2" /> Tải & Hệ thống
              </h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DataItem label="Công suất tải" value={`${parsedData.loadPower.toFixed(0)} W`} />
                <DataItem label="Phần trăm tải" value={`${parsedData.loadPercent.toFixed(0)} %`} />
                <DataItem label="Nhiệt độ" value={`${parsedData.temperature.toFixed(1)} °C`} />
                <DataItem label="Chế độ" value={`${parsedData.operatingMode}`} />
              </div>
            </div>

            {/* Energy Totals Section */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h5 className="text-sm font-medium text-purple-700 mb-3 flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" /> Tổng năng lượng
              </h5>
              <div className="grid grid-cols-2 gap-4">
                <DataItem label="Tổng A (Sản xuất)" value={`${parsedData.totalA.toFixed(4)} kWh`} />
                <DataItem label="Tổng A2 (Tiêu thụ)" value={`${parsedData.totalA2.toFixed(4)} kWh`} />
              </div>
            </div>
          </div>

          {/* Raw Data (collapsible for debugging) */}
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
              Hiển thị dữ liệu thô ({parsedData.rawParts.length} trường)
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded-lg font-mono text-xs overflow-x-auto">
              {parsedData.rawParts.map((part, index) => (
                <span key={index} className="inline-block mr-2 mb-1 px-2 py-1 bg-white rounded">
                  [{index}]: {part}
                </span>
              ))}
            </div>
          </details>
        </>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Không có dữ liệu
        </div>
      )}

      {/* Monthly Summary */}
      {monthlyTotals && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Tổng kết tháng ({monthlyTotals.month}/{monthlyTotals.year})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600">Tổng sản xuất</p>
              <p className="text-2xl font-bold text-blue-900">
                {monthlyTotals.totalA?.toFixed(2)} kWh
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-orange-600">Tổng tiêu thụ</p>
              <p className="text-2xl font-bold text-orange-900">
                {monthlyTotals.totalA2?.toFixed(2)} kWh
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-sm text-green-600">Trung bình ngày</p>
              <p className="text-2xl font-bold text-green-900">
                {monthlyTotals.summary?.averageDailyA?.toFixed(2)} kWh
              </p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <p className="text-sm text-yellow-600">Ngày cao điểm</p>
              <p className="text-2xl font-bold text-yellow-900">
                {monthlyTotals.summary?.peakDayA?.value?.toFixed(2)} kWh
              </p>
              <p className="text-xs text-yellow-600">
                {monthlyTotals.summary?.peakDayA?.date}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      {latestData?.updatedAt && (
        <p className="text-sm text-gray-500 text-right border-t pt-4">
          Cập nhật lần cuối: {new Date(latestData.updatedAt).toLocaleString('vi-VN')}
        </p>
      )}
    </div>
  );
}

// Stat Card Component with sub-value
function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  subValue?: string;
  color: 'yellow' | 'green' | 'blue' | 'red' | 'purple';
}) {
  const colors = {
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <div className={`rounded-lg p-4 border ${colors[color]}`}>
      <div className="flex items-center space-x-2 mb-2">
        <Icon className="w-5 h-5" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subValue && (
        <p className="text-xs mt-1 opacity-75">{subValue}</p>
      )}
    </div>
  );
}

// Data Item Component for detailed parameters
function DataItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
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
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
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
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Cài đặt thiết bị</h3>
      <p className="text-sm text-gray-500">
        Cấu hình cài đặt thiết bị. Các thay đổi sẽ được đồng bộ với thiết bị.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        className="w-full p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Nhập cài đặt thiết bị..."
      />
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <LoadingSpinner size="sm" className="text-white" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Lưu cài đặt</span>
        </button>
      </div>
    </div>
  );
}

// Schedule Tab Component
function ScheduleTab({
  value,
  onChange,
  onSave,
  isLoading,
  isSaving,
  error,
  onRetry,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
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
        <h3 className="text-lg font-semibold text-gray-900">Lịch trình thiết bị</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">Không thể tải lịch trình thiết bị</p>
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
      <h3 className="text-lg font-semibold text-gray-900">Lịch trình thiết bị</h3>
      <p className="text-sm text-gray-500">
        Thiết lập lịch trình hoạt động cho thiết bị của bạn.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        className="w-full p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Nhập lịch trình thiết bị..."
      />
      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isSaving ? (
            <LoadingSpinner size="sm" className="text-white" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Lưu lịch trình</span>
        </button>
      </div>
    </div>
  );
}
