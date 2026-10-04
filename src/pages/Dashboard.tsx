import { useState } from 'react';
import { useSlidingIndicator } from '../hooks/useSlidingIndicator';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Cpu, RefreshCw, Plus, BatteryCharging, Eye } from 'lucide-react';
import { Layout } from '../components/Layout';
import { DeviceCard } from '../components/DeviceCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  getDevices,
  getChargerDevices,
  getSharedWithMe,
  leaveSharedDevice,
  type SharedDevice,
} from '../services/api';
import { SharedDeviceCard } from '../components/SharedDeviceCard';
import { useAuth } from '../contexts/AuthContext';
import { useDevicesOnline } from '../hooks/useDevicesOnline';

type TabType = 'inverter' | 'charger';

export function Dashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('inverter');

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['devices'],
    queryFn: getDevices,
  });

  const chargerQuery = useQuery({
    queryKey: ['charger-devices', user?.uid],
    queryFn: () => getChargerDevices(),
    enabled: !!user?.uid,
  });

  // Devices other people shared read-only with this account.
  const queryClient = useQueryClient();
  const sharedQuery = useQuery({
    queryKey: ['shared-with-me', user?.uid],
    queryFn: getSharedWithMe,
    enabled: !!user?.uid,
  });
  const leaveMutation = useMutation({
    mutationFn: (d: SharedDevice) => leaveSharedDevice(d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shared-with-me'] }),
  });

  const chargers = chargerQuery.data ?? [];
  const inverters = data?.devices ?? [];
  const isLoadingAny = isLoading || chargerQuery.isLoading;

  const tabs = [
    { id: 'inverter' as TabType, label: 'Hoà lưới', icon: Cpu, count: inverters.length },
    { id: 'charger' as TabType, label: 'Bộ sạc', icon: BatteryCharging, count: chargers.length },
  ];

  const activeList = activeTab === 'inverter' ? inverters : chargers;
  const tabSlider = useSlidingIndicator<HTMLElement>(tabs.findIndex((t) => t.id === activeTab));
  const sharedForTab = (sharedQuery.data?.devices ?? []).filter((d) => d.kind === activeTab);

  // Live online/offline badges (one wildcard MQTT subscription per kind).
  const inverterOnline = useDevicesOnline('inverter', inverters.map((d) => d.deviceId));
  const chargerOnline = useDevicesOnline('charger', chargers.map((d) => d.deviceId));

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Thiết bị của tôi</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">
              Quản lý và giám sát các thiết bị inverter và bộ sạc
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                refetch();
                chargerQuery.refetch();
                sharedQuery.refetch();
              }}
              disabled={isRefetching || chargerQuery.isRefetching}
              aria-label="Làm mới"
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 whitespace-nowrap bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefetching || chargerQuery.isRefetching ? 'animate-spin' : ''}`}
              />
              <span>Làm mới</span>
            </button>
            <Link
              to="/add-device"
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 px-4 py-2 whitespace-nowrap bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm thiết bị</span>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav ref={tabSlider.containerRef} className="relative flex space-x-6 overflow-x-auto scrollbar-none">
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-blue-500"
              style={tabSlider.indicatorStyle}
            />
            {tabs.map((tab, i) => (
              <button
                key={tab.id}
                ref={tabSlider.itemRef(i)}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center space-x-2 py-3 px-1 font-medium text-sm transition-colors duration-300 whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                <span
                  className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        {isLoadingAny ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : error && activeTab === 'inverter' ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">Không thể tải danh sách thiết bị</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : chargerQuery.error && activeTab === 'charger' ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">Không thể tải danh sách bộ sạc</p>
            <button
              onClick={() => chargerQuery.refetch()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : activeList.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sm:p-12 text-center">
            {activeTab === 'inverter' ? (
              <Cpu className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            ) : (
              <BatteryCharging className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            )}
            <h3 className="text-lg font-medium text-gray-900">
              {activeTab === 'inverter'
                ? 'Chưa có thiết bị hoà lưới'
                : 'Chưa có bộ sạc'}
            </h3>
            <p className="text-gray-500 mt-2 mb-6">
              {activeTab === 'inverter'
                ? 'Thêm thiết bị inverter đầu tiên để bắt đầu'
                : 'Thêm bộ sạc (charger) đầu tiên để bắt đầu'}
            </p>
            <Link
              to="/add-device"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Thêm thiết bị</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {activeTab === 'inverter'
              ? inverters.map((device) => (
                  <DeviceCard
                    key={device._id}
                    device={device}
                    variant="inverter"
                    online={inverterOnline[device.deviceId] ?? 'checking'}
                  />
                ))
              : chargers.map((device) => (
                  <DeviceCard
                    key={device._id}
                    device={device}
                    variant="charger"
                    online={chargerOnline[device.deviceId] ?? 'checking'}
                  />
                ))}
          </div>
        )}

        {/* Shared with me (read-only) */}
        {!isLoadingAny && sharedForTab.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-gray-900">
              <Eye className="w-5 h-5 text-amber-600" />
              Được chia sẻ với tôi
              <span className="text-sm font-normal text-gray-500">({sharedForTab.length})</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {sharedForTab.map((d) => (
                <SharedDeviceCard
                  key={`${d.ownerUid}/${d.kind}/${d.deviceId}`}
                  device={d}
                  leaving={leaveMutation.isPending}
                  onLeave={(dev) => {
                    if (window.confirm(`Bỏ theo dõi "${dev.deviceName || dev.deviceId}"?`)) {
                      leaveMutation.mutate(dev);
                    }
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
