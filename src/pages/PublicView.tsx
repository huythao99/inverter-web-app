import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link2Off } from 'lucide-react';
import { getPublicView } from '../services/api';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { DeviceDetail } from './DeviceDetail';
import { ChargerDetail } from './ChargerDetail';

/** /v/:token — read-only view of one device from a public share link. */
export function PublicView() {
  const { token } = useParams<{ token: string }>();
  const infoQuery = useQuery({
    queryKey: ['public-view', token],
    queryFn: () => getPublicView(token!),
    enabled: !!token,
    retry: false,
  });

  if (infoQuery.isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  const info = infoQuery.data;
  if (!token || infoQuery.error || !info) {
    return (
      <Layout>
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <Link2Off className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h1 className="text-lg font-semibold text-gray-900">Link không còn hiệu lực</h1>
          <p className="text-sm text-gray-500 mt-2">
            Link xem đã bị chủ thiết bị thu hồi hoặc đổi. Hãy xin lại link mới.
          </p>
        </div>
      </Layout>
    );
  }

  return info.kind === 'charger' ? (
    <ChargerDetail publicToken={token} publicDeviceId={info.deviceId} />
  ) : (
    <DeviceDetail publicToken={token} publicDeviceId={info.deviceId} />
  );
}
