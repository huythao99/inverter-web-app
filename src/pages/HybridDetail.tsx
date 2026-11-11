import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BarChart3, Download, History, Save, Settings } from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ActivityLog } from '../components/ActivityLog';
import { HybridEnergyFlow } from '../components/hybrid/HybridEnergyFlow';
import { HybridFirmwareTab } from '../components/hybrid/HybridFirmwareTab';
import { HybridStatusCard } from '../components/hybrid/HybridStatusCard';
import { HybridEnergyCard } from '../components/hybrid/HybridEnergyCard';
import { HybridSettings } from '../components/hybrid/settings/HybridSettings';
import { DeleteDeviceButton } from '../components/DeleteDeviceButton';
import { useHybridMqtt } from '../hooks/useHybridMqtt';
import {
  deleteHybrid,
  getHybridDevice,
  getHybridEnergy,
  getHybridLatest,
  getHybridSetting,
  sendHybridCommand,
  updateHybridDevice,
} from '../services/api';
import type { HybridCommand } from '../types';
import { ChargerStatusIndicator } from './ChargerDetail';

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

type TabType = 'overview' | 'settings' | 'update' | 'history';

/**
 * Hybrid (inverter biến áp sắt, STM32 HINVLF v1): luồng năng lượng, trạng
 * thái / lỗi + lệnh (Xóa lỗi, Dừng, Chạy), điện năng hôm nay, và 9 tham số
 * cài đặt (lưu thì gửi xuống máy một lần, máy tự lưu; giá trị hiển thị = $CFG của máy).
 */
export function HybridDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [deviceName, setDeviceName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  const { isDeviceOnline } = useHybridMqtt(deviceId);

  const deviceQuery = useQuery({
    queryKey: ['hybrid-device', deviceId],
    queryFn: () => getHybridDevice(deviceId!),
    enabled: !!deviceId,
  });

  // Giá trị đầu từ REST; useHybridMqtt ghi khung live vào cache này.
  const latestQuery = useQuery({
    queryKey: ['hybrid-latest', deviceId],
    queryFn: () => getHybridLatest(deviceId!),
    enabled: !!deviceId,
  });

  const energyQuery = useQuery({
    queryKey: ['hybrid-energy', deviceId],
    queryFn: () => getHybridEnergy(deviceId!),
    enabled: !!deviceId && activeTab === 'overview',
    refetchInterval: 60_000,
  });

  const settingQuery = useQuery({
    queryKey: ['hybrid-setting', deviceId],
    queryFn: () => getHybridSetting(deviceId!),
    enabled: !!deviceId,
  });

  const commandMutation = useMutation({
    mutationFn: (cmd: HybridCommand) => sendHybridCommand(deviceId!, cmd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-activity', 'hybrid', deviceId] });
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: (name: string) => updateHybridDevice(deviceId!, { deviceName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hybrid-device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['hybrid-devices'] });
      setIsEditingName(false);
    },
  });

  useEffect(() => {
    if (deviceQuery.data) setDeviceName(deviceQuery.data.deviceName || '');
  }, [deviceQuery.data]);

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
          <p className="text-red-600">Không thể tải thông tin thiết bị hybrid</p>
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
  const latest = latestQuery.data;
  const src = latest?.tlm?.SRC ?? latest?.cfg?.SRC ?? settingQuery.data?.src ?? null;
  const tabs = [
    { id: 'overview' as TabType, label: 'Tổng quan', icon: BarChart3 },
    { id: 'settings' as TabType, label: 'Cài đặt', icon: Settings },
    { id: 'update' as TabType, label: 'Cập nhật', icon: Download },
    { id: 'history' as TabType, label: 'Lịch sử', icon: History },
  ];

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
        <div className="flex items-center space-x-3">
          <Link to="/" className="p-2 hover:bg-white/50 rounded-lg transition-colors flex-shrink-0">
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
                className="text-lg font-bold text-gray-900 truncate cursor-pointer hover:text-blue-600"
                onClick={() => setIsEditingName(true)}
              >
                {device?.deviceName || device?.deviceId}
              </h1>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <ChargerStatusIndicator isOnline={isDeviceOnline} />
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                Hybrid
              </span>
            </div>
          </div>
          {deviceId && (
            <DeleteDeviceButton
              deviceName={device?.deviceName || deviceId}
              listQueryKey="hybrid-devices"
              onDelete={() => deleteHybrid(deviceId)}
            />
          )}
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

        {activeTab === 'overview' && (
          <div className="space-y-3">
            {latestQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <>
                <HybridEnergyFlow latest={latest} online={isDeviceOnline} />
                <HybridStatusCard
                  latest={latest}
                  online={isDeviceOnline}
                  src={src}
                  sending={commandMutation.isPending ? commandMutation.variables : undefined}
                  sent={commandMutation.isSuccess ? commandMutation.data.cmd : undefined}
                  error={commandMutation.isError}
                  onCommand={(cmd) => commandMutation.mutate(cmd)}
                />
                <HybridEnergyCard
                  energy={energyQuery.data}
                  loading={energyQuery.isLoading}
                  onRefresh={() => {
                    energyQuery.refetch();
                    latestQuery.refetch();
                  }}
                  refreshing={energyQuery.isRefetching || latestQuery.isRefetching}
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            {settingQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : settingQuery.error || !settingQuery.data ? (
              <div className="text-center py-6">
                <p className="text-red-600 text-sm">Không tải được cài đặt</p>
                <button
                  onClick={() => settingQuery.refetch()}
                  className="mt-3 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <HybridSettings
                deviceId={deviceId!}
                setting={settingQuery.data}
                latest={latest}
                online={isDeviceOnline}
              />
            )}
          </div>
        )}

        {activeTab === 'update' && deviceId && (
          <HybridFirmwareTab deviceId={deviceId} isOnline={isDeviceOnline} />
        )}

        {activeTab === 'history' && deviceId && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 sm:p-6">
            <ActivityLog deviceId={deviceId} kind="hybrid" />
          </div>
        )}
      </div>
    </Layout>
  );
}
