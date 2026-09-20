import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Cpu, RefreshCw, Plus, BatteryCharging } from 'lucide-react';
import { Layout } from '../components/Layout';
import { DeviceCard } from '../components/DeviceCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { getDevices, getChargerDevices } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
    queryFn: () => getChargerDevices(user!.uid),
    enabled: !!user?.uid,
  });

  const chargers = chargerQuery.data ?? [];
  const inverters = data?.devices ?? [];
  const isLoadingAny = isLoading || chargerQuery.isLoading;

  const tabs = [
    { id: 'inverter' as TabType, label: 'Hoà lưới', icon: Cpu, count: inverters.length },
    { id: 'charger' as TabType, label: 'Bộ sạc', icon: BatteryCharging, count: chargers.length },
  ];

  const activeList = activeTab === 'inverter' ? inverters : chargers;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Thiết bị của tôi</h1>
            <p className="text-gray-500 mt-1">
              Quản lý và giám sát các thiết bị inverter và bộ sạc
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                refetch();
                chargerQuery.refetch();
              }}
              disabled={isRefetching || chargerQuery.isRefetching}
              className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefetching || chargerQuery.isRefetching ? 'animate-spin' : ''}`}
              />
              <span>Làm mới</span>
            </button>
            <Link
              to="/add-device"
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm thiết bị</span>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-6 overflow-x-auto scrollbar-none">
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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeTab === 'inverter'
              ? inverters.map((device) => (
                  <DeviceCard key={device._id} device={device} variant="inverter" />
                ))
              : chargers.map((device) => (
                  <DeviceCard key={device._id} device={device} variant="charger" />
                ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
