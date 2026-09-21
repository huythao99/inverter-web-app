import { useState, useEffect } from 'react';

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Settings,
  BarChart3,
  Save,
  RefreshCw,
  Zap,
  Activity,
  Sun,
  BatteryCharging,
  Thermometer,
  AlertTriangle,
} from 'lucide-react';
import { useChargerMqtt } from '../hooks/useChargerMqtt';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  getChargerDevice,
  getChargerLatest,
  getChargerSetting,
  updateChargerSetting,
  updateChargerDevice,
} from '../services/api';
import type { ChargerLatest } from '../types';

type TabType = 'overview' | 'settings';

// ---- Helpers cho giá trị chuỗi từ snapshot (có thể là "NAN") ----
function num(v?: string): number | null {
  if (v === undefined || v === null) return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

// Dòng điện có thể hơi âm khi không tải → kẹp về ≥ 0 khi hiển thị.
function clampCurrent(v?: string): number | null {
  const n = num(v);
  return n === null ? null : Math.max(0, n);
}

function fmt(n: number | null, digits = 2, unit = ''): string {
  if (n === null) return '---';
  return `${n.toFixed(digits)}${unit ? ' ' + unit : ''}`;
}

export function ChargerDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [deviceName, setDeviceName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  const { isDeviceOnline } = useChargerMqtt(deviceId);

  const deviceQuery = useQuery({
    queryKey: ['charger-device', deviceId],
    queryFn: () => getChargerDevice(deviceId!),
    enabled: !!deviceId,
  });

  // Giá trị khởi tạo từ REST; sau đó useChargerMqtt đẩy dữ liệu mới vào cache
  // (cùng cơ chế với inverter — không refetch định kỳ).
  const latestQuery = useQuery({
    queryKey: ['charger-latest', deviceId],
    queryFn: () => getChargerLatest(deviceId!),
    enabled: !!deviceId,
  });

  const settingQuery = useQuery({
    queryKey: ['charger-setting', deviceId],
    queryFn: () => getChargerSetting(deviceId!),
    enabled: !!deviceId && activeTab === 'settings',
  });

  const updateSettingMutation = useMutation({
    mutationFn: (data: { vbat: number; ibat: number }) =>
      updateChargerSetting(deviceId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['charger-setting', deviceId],
      });
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: (name: string) =>
      updateChargerDevice(deviceId!, { deviceName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['charger-device', deviceId],
      });
      setIsEditingName(false);
    },
  });

  useEffect(() => {
    if (deviceQuery.data) {
      setDeviceName(deviceQuery.data.deviceName || '');
    }
  }, [deviceQuery.data]);

  const tabs = [
    { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
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
          <p className="text-red-600">Không thể tải thông tin bộ sạc</p>
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
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <img
          src={asset('assets/images/background_2.png')}
          className="w-full h-full object-cover"
          alt=""
          aria-hidden="true"
        />
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
                  onClick={() => updateNameMutation.mutate(deviceName)}
                  disabled={updateNameMutation.isPending}
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
            <ChargerStatusIndicator isOnline={isDeviceOnline} />
          </div>
        </div>

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
            <ChargerOverviewTab
              latest={latestQuery.data}
              isLoading={latestQuery.isLoading}
              onRefresh={() => latestQuery.refetch()}
              isRefreshing={latestQuery.isRefetching}
            />
          )}

          {activeTab === 'settings' && (
            <ChargerSettingsTab
              vbat={settingQuery.data?.vbat}
              ibat={settingQuery.data?.ibat}
              latest={latestQuery.data}
              isLoading={settingQuery.isLoading || settingQuery.isFetching}
              isSaving={updateSettingMutation.isPending}
              error={settingQuery.error}
              onRetry={() => settingQuery.refetch()}
              onSave={(data) => updateSettingMutation.mutate(data)}
              currentFirmware={device?.firmwareVersion}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

function ChargerStatusIndicator({ isOnline }: { isOnline: boolean }) {
  return (
    <div className="inline-flex items-center space-x-1">
      <img
        src={
          isOnline
            ? asset('assets/icons/icon_wifi_on.svg')
            : asset('assets/icons/icon_wifi_off.svg')
        }
        className="w-[18px] h-[18px]"
        alt=""
      />
      <span
        className={`text-sm font-semibold ${
          isOnline ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}

// Cảnh báo khi máy đang ở chế độ điều khiển tại chỗ (không nhận lệnh từ xa).
function LocalSourceNotice({ src }: { src?: string }) {
  if (src !== 'LOCAL') return null;
  return (
    <div className="flex items-start space-x-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium text-amber-700">
        Hãy chọn nguồn ESP32 trên máy để điều khiển từ xa.
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

// ---- Overview Tab ----
function ChargerOverviewTab({
  latest,
  isLoading,
  onRefresh,
  isRefreshing,
}: {
  latest?: ChargerLatest;
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

  if (!latest) {
    return <div className="text-center py-8 text-gray-500">Không có dữ liệu</div>;
  }

  const flt = num(latest.flt);
  const hasFault = flt !== null && flt !== 0;

  return (
    <div className="space-y-4">
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

      <LocalSourceNotice src={latest.src} />

      {/* Trạng thái */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Trạng thái</p>
        <div className="space-y-2">
          <InfoRow label="Trạng thái chạy" value={latest.st || '---'} />
          <InfoRow label="Chế độ" value={latest.mode || '---'} />
          <InfoRow label="Bám công suất" value={latest.ms || '---'} />
          <InfoRow label="Ngõ ra" value={latest.out || '---'} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Lỗi (FLT)</span>
            <span
              className={`font-medium ${
                hasFault ? 'text-red-600' : 'text-green-600'
              }`}
            >
              {latest.flt ?? '---'}
            </span>
          </div>
        </div>
      </div>

      {/* PV (đầu vào solar) */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Sun className="w-5 h-5 text-yellow-500" />
          <p className="text-sm font-semibold text-gray-700">Đầu vào PV</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Điện áp" value={fmt(num(latest.vpv), 2)} unit="V" />
          <Metric label="Dòng điện" value={fmt(clampCurrent(latest.ipv), 2)} unit="A" />
          <Metric label="Công suất" value={fmt(num(latest.ppv), 0)} unit="W" />
        </div>
      </div>

      {/* Ắc quy / sạc */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 space-y-3">
        <div className="flex items-center space-x-2">
          <BatteryCharging className="w-5 h-5 text-green-600" />
          <p className="text-sm font-semibold text-gray-700">Ắc quy / Sạc</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Điện áp" value={fmt(num(latest.vbat), 2)} unit="V" />
          <Metric label="Dòng sạc" value={fmt(clampCurrent(latest.ibat), 2)} unit="A" />
          <Metric label="Dòng cuộn" value={fmt(clampCurrent(latest.il), 2)} unit="A" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-center pt-2 border-t border-gray-100">
          <Metric label="Duty" value={fmt(num(latest.duty), 3)} unit="" />
          <Metric label="Vref" value={fmt(num(latest.vref), 2)} unit="V" />
        </div>
      </div>

      {/* Cấu hình đang áp dụng ($CFG) */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">
          Cấu hình đang áp dụng
        </p>
        <div className="space-y-2">
          <InfoRow label="Điện áp sạc (VBAT)" value={fmt(num(latest.cfgVbat), 1, 'V')} />
          <InfoRow label="Dòng sạc (IBAT)" value={fmt(num(latest.cfgIbat), 1, 'A')} />
          <InfoRow label="Công suất (PBAT)" value={fmt(num(latest.cfgPbat), 0, 'W')} />
          <InfoRow label="Nguồn điều khiển" value={latest.src || '---'} />
          <InfoRow label="Ngõ ra" value={latest.cfgOut || '---'} />
        </div>
      </div>

      {/* Nhiệt độ + thông tin thiết bị */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 space-y-3">
        <div className="flex items-center justify-center space-x-2">
          <Thermometer className="w-5 h-5 text-orange-500" />
          <p className="text-sm font-medium text-orange-600">
            Nhiệt độ: {fmt(num(latest.temp), 1, '°C')}
          </p>
        </div>
        <div className="space-y-2 pt-2 border-t border-gray-100">
          <InfoRow label="Firmware" value={latest.fw || '---'} />
          <InfoRow label="Phần cứng" value={latest.hw || '---'} />
        </div>
      </div>

      {/* Raw */}
      {latest.raw && (
        <details className="text-sm">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
            Dữ liệu thô
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded-xl font-mono text-xs break-all">
            {latest.raw}
          </div>
        </details>
      )}

      {latest.updatedAt && (
        <p className="text-xs text-gray-400 text-right">
          Cập nhật lần cuối: {new Date(latest.updatedAt).toLocaleString('vi-VN')}
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div>
      <p className="text-base font-bold text-gray-900">
        {value}
        {unit && value !== '---' && (
          <span className="text-xs font-normal text-gray-400"> {unit}</span>
        )}
      </p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

// ---- Settings Tab ----
const VBAT_MIN = 3.0;
const VBAT_MAX = 100.0;
const IBAT_MIN = 0.0;
const IBAT_MAX = 100.0;

function ChargerSettingsTab({
  vbat,
  ibat,
  latest,
  isLoading,
  isSaving,
  error,
  onRetry,
  onSave,
  currentFirmware,
}: {
  vbat?: number;
  ibat?: number;
  latest?: ChargerLatest;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  onRetry: () => void;
  onSave: (data: { vbat: number; ibat: number }) => void;
  currentFirmware?: string;
}) {
  const [vbatInput, setVbatInput] = useState('54.0');
  const [ibatInput, setIbatInput] = useState('20.0');
  const [vbatError, setVbatError] = useState('');
  const [ibatError, setIbatError] = useState('');

  useEffect(() => {
    if (vbat !== undefined) setVbatInput(vbat.toFixed(1));
  }, [vbat]);
  useEffect(() => {
    if (ibat !== undefined) setIbatInput(ibat.toFixed(1));
  }, [ibat]);

  const validateVbat = (val: string): boolean => {
    const n = parseFloat(val);
    if (Number.isNaN(n) || n < VBAT_MIN || n > VBAT_MAX) {
      setVbatError(`Điện áp phải từ ${VBAT_MIN} đến ${VBAT_MAX} V`);
      return false;
    }
    setVbatError('');
    return true;
  };

  const validateIbat = (val: string): boolean => {
    const n = parseFloat(val);
    if (Number.isNaN(n) || n < IBAT_MIN || n > IBAT_MAX) {
      setIbatError(`Dòng điện phải từ ${IBAT_MIN} đến ${IBAT_MAX} A`);
      return false;
    }
    setIbatError('');
    return true;
  };

  const handleSave = () => {
    const okV = validateVbat(vbatInput);
    const okI = validateIbat(ibatInput);
    if (okV && okI) {
      onSave({
        vbat: parseFloat(vbatInput),
        ibat: parseFloat(ibatInput),
      });
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
        <h3 className="text-lg font-semibold text-gray-900">Cài đặt bộ sạc</h3>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-red-600">Không thể tải cài đặt</p>
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

  const appliedVbat = num(latest?.cfgVbat);
  const appliedIbat = num(latest?.cfgIbat);

  return (
    <div className="space-y-6">
      <LocalSourceNotice src={latest?.src} />

      {/* Điện áp sạc */}
      <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 mb-4">
          Điện áp sạc
        </h4>
        <div className="border-t border-gray-200 pt-4 space-y-4">
          {/* Cài đặt */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Zap className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Điện áp sạc (VBAT)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                step="0.1"
                min={VBAT_MIN}
                max={VBAT_MAX}
                value={vbatInput}
                onChange={(e) => {
                  setVbatInput(e.target.value);
                  validateVbat(e.target.value);
                }}
                className={`w-24 px-3 py-2 text-right border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  vbatError ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <span className="text-sm text-gray-500 w-8">(V)</span>
            </div>
          </div>
          {vbatError && (
            <p className="text-red-500 text-xs text-right">{vbatError}</p>
          )}

          {/* Thực tế đang áp dụng */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-200 rounded-lg">
                <Zap className="w-5 h-5 text-gray-500" />
              </div>
              <span className="text-sm font-medium text-gray-500">
                Điện áp đang áp dụng
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-24 px-3 py-2 text-right bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
                {appliedVbat === null ? '---' : appliedVbat.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500 w-8">(V)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Dòng sạc */}
      <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 mb-4">Dòng sạc</h4>
        <div className="border-t border-gray-200 pt-4 space-y-4">
          {/* Cài đặt */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Dòng sạc (IBAT)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                step="0.1"
                min={IBAT_MIN}
                max={IBAT_MAX}
                value={ibatInput}
                onChange={(e) => {
                  setIbatInput(e.target.value);
                  validateIbat(e.target.value);
                }}
                className={`w-24 px-3 py-2 text-right border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  ibatError ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              <span className="text-sm text-gray-500 w-8">(A)</span>
            </div>
          </div>
          {ibatError && (
            <p className="text-red-500 text-xs text-right">{ibatError}</p>
          )}

          {/* Thực tế đang áp dụng */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-200 rounded-lg">
                <Activity className="w-5 h-5 text-gray-500" />
              </div>
              <span className="text-sm font-medium text-gray-500">
                Dòng sạc đang áp dụng
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-24 px-3 py-2 text-right bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
                {appliedIbat === null ? '---' : appliedIbat.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500 w-8">(A)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Phiên bản firmware */}
      <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
        <h4 className="text-base font-semibold text-gray-900 mb-4">Phiên bản</h4>
        <div className="border-t border-gray-200 pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Settings className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-700">
                Phiên bản hiện tại
              </span>
            </div>
            <span className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-medium text-gray-600">
              {currentFirmware || '---'}
            </span>
          </div>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={isSaving}
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
