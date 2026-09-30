import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, Link2, Mail, RefreshCw, Trash2, X, Eye } from 'lucide-react';
import {
  addDeviceViewer,
  createViewLink,
  deleteViewLink,
  getDeviceSharing,
  removeDeviceViewer,
  viewLinkUrl,
  type DeviceSharing,
} from '../services/api';
import { LoadingSpinner } from './LoadingSpinner';

interface ShareDialogProps {
  kind: 'inverter' | 'charger';
  deviceId: string;
  deviceName?: string;
  onClose: () => void;
}

function errorText(e: unknown): string {
  const err = e as { response?: { data?: { message?: string | string[] } }; message?: string };
  const m = err?.response?.data?.message ?? err?.message;
  return Array.isArray(m) ? m.join(', ') : m || 'Có lỗi xảy ra';
}

/** Owner-only: invite viewers by email and manage the public view link. */
export function ShareDialog({ kind, deviceId, deviceName, onClose }: ShareDialogProps) {
  const queryClient = useQueryClient();
  const queryKey = ['device-sharing', kind, deviceId];
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const sharingQuery = useQuery({
    queryKey,
    queryFn: () => getDeviceSharing(kind, deviceId),
  });
  const onDone = (data: DeviceSharing) => queryClient.setQueryData(queryKey, data);

  const addMutation = useMutation({
    mutationFn: (e: string) => addDeviceViewer(kind, deviceId, e),
    onSuccess: (data) => {
      onDone(data);
      setEmail('');
    },
  });
  const removeMutation = useMutation({
    mutationFn: (e: string) => removeDeviceViewer(kind, deviceId, e),
    onSuccess: onDone,
  });
  const linkMutation = useMutation({
    mutationFn: () => createViewLink(kind, deviceId),
    onSuccess: (data) => {
      onDone(data);
      setConfirmRegen(false);
    },
  });
  const unlinkMutation = useMutation({
    mutationFn: () => deleteViewLink(kind, deviceId),
    onSuccess: onDone,
  });

  const sharing = sharingQuery.data;
  const link = sharing?.link ? viewLinkUrl(sharing.link.token) : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Sao chép link:', link);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Chia sẻ quyền xem"
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600 shrink-0" />
              Chia sẻ quyền xem
            </h3>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{deviceName || deviceId}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            Người được chia sẻ chỉ <b>xem</b> được số liệu, biểu đồ và cài đặt hiện tại — không thể
            sửa cài đặt, lập lịch, khởi động lại hay xoá thiết bị.
          </p>

          {sharingQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <LoadingSpinner />
            </div>
          ) : sharingQuery.error ? (
            <p className="text-sm text-red-600">{errorText(sharingQuery.error)}</p>
          ) : (
            <>
              {/* Invite by email */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-gray-500" /> Mời qua email
                </h4>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (email.trim()) addMutation.mutate(email.trim());
                  }}
                >
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@vidu.com"
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={addMutation.isPending || !email.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {addMutation.isPending ? '...' : 'Mời'}
                  </button>
                </form>
                {addMutation.error && (
                  <p className="text-xs text-red-600">{errorText(addMutation.error)}</p>
                )}
                <p className="text-xs text-gray-500">
                  Người đó đăng nhập web/app bằng đúng email này (đã xác thực) sẽ thấy thiết bị trong
                  mục “Được chia sẻ với tôi”.
                </p>
                {sharing && sharing.viewers.length > 0 && (
                  <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                    {sharing.viewers.map((v) => (
                      <li key={v.email} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 truncate">{v.email}</p>
                          <p className={`text-xs ${v.joined ? 'text-green-600' : 'text-gray-400'}`}>
                            {v.joined ? 'Đã xem' : 'Chưa đăng nhập'}
                          </p>
                        </div>
                        <button
                          onClick={() => removeMutation.mutate(v.email)}
                          disabled={removeMutation.isPending}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0 disabled:opacity-50"
                          title="Thu hồi quyền xem"
                          aria-label={`Thu hồi quyền xem của ${v.email}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Public link */}
              <section className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-gray-500" /> Link xem công khai
                </h4>
                {link ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={link}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 min-w-0 px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-xs text-gray-700"
                      />
                      <button
                        onClick={copy}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shrink-0"
                        aria-label="Sao chép link"
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      Ai có link đều xem được, không cần đăng nhập. Chỉ gửi cho người bạn tin tưởng.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {confirmRegen ? (
                        <button
                          onClick={() => linkMutation.mutate()}
                          disabled={linkMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Xác nhận: link cũ sẽ ngừng hoạt động
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmRegen(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> Đổi link
                        </button>
                      )}
                      <button
                        onClick={() => unlinkMutation.mutate()}
                        disabled={unlinkMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Tắt link
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    onClick={() => linkMutation.mutate()}
                    disabled={linkMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Link2 className="w-4 h-4" /> Tạo link xem
                  </button>
                )}
                {(linkMutation.error || unlinkMutation.error) && (
                  <p className="text-xs text-red-600">
                    {errorText(linkMutation.error || unlinkMutation.error)}
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
