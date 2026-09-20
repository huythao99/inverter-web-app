import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Cpu, RefreshCw, Plus } from 'lucide-react';
import { Layout } from '../components/Layout';
import { DeviceCard } from '../components/DeviceCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { getDevices, getChargerDevices } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function Dashboard() {
  const { user } = useAuth();

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
  const isEmpty =
    !isLoading &&
    !chargerQuery.isLoading &&
    inverters.length === 0 &&
    chargers.length === 0;

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

        {/* Content */}
        {isLoading || chargerQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">Không thể tải danh sách thiết bị</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : isEmpty ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Cpu className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              Không tìm thấy thiết bị
            </h3>
            <p className="text-gray-500 mt-2 mb-6">
              Thêm thiết bị inverter hoặc bộ sạc (charger) đầu tiên để bắt đầu
            </p>
            <Link
              to="/add-device"
              className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Thêm thiết bị đầu tiên</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {inverters.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Inverter
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inverters.map((device) => (
                    <DeviceCard key={device._id} device={device} variant="inverter" />
                  ))}
                </div>
              </div>
            )}

            {chargers.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Bộ sạc (Charger)
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {chargers.map((device) => (
                    <DeviceCard key={device._id} device={device} variant="charger" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
