import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Check, Link2, Mail, RefreshCw, Trash2, X, Eye, Clock } from 'lucide-react';
import {
  addDeviceViewer,
  createViewLink,
  deleteViewLink,
  extendViewLink,
  LINK_DAYS,
  type LinkDays,
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

const DAYS_LABEL: Record<LinkDays, string> = {
  1: '1 ngày',
  7: '7 ngày',
  30: '30 ngày',
  0: 'Không giới hạn',
};

/** "Hết hạn lúc 16:30 7/10/2026 (còn 3 ngày)" + severity. */
function expiryInfo(expiresAt: string | null | undefined): {
  text: string;
  tone: 'ok' | 'soon' | 'expired';
} {
  if (!expiresAt) return { text: 'Không giới hạn thời gian', tone: 'ok' };
  const t = new Date(expiresAt).getTime();
  const left = t - Date.now();
  if (left <= 0) return { text: 'Đã hết hạn — người xem không mở được nữa', tone: 'expired' };
  const when = new Date(t).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const hours = Math.floor(left / 3_600_000);
  const rest = hours >= 24 ? `còn ${Math.ceil(left / 86_400_000)} ngày` : hours >= 1 ? `còn ${hours} giờ` : 'còn dưới 1 giờ';
  return { text: `Hết hạn lúc ${when} (${rest})`, tone: left < 86_400_000 ? 'soon' : 'ok' };
}

function DaysPicker({ value, onChange }: { value: LinkDays; onChange: (d: LinkDays) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Thời hạn link">
      {LINK_DAYS.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={value === d}
          onClick={() => onChange(d)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            value === d
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {DAYS_LABEL[d]}
        </button>
      ))}
    </div>
  );
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
  const [days, setDays] = useState<LinkDays>(7);
  const [showExtend, setShowExtend] = useState(false);

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
    mutationFn: () => createViewLink(kind, deviceId, days),
    onSuccess: (data) => {
      onDone(data);
      setConfirmRegen(false);
    },
  });
  const extendMutation = useMutation({
    mutationFn: () => extendViewLink(kind, deviceId, days),
    onSuccess: (data) => {
      onDone(data);
      setShowExtend(false);
    },
  });
  const unlinkMutation = useMutation({
    mutationFn: () => deleteViewLink(kind, deviceId),
    onSuccess: onDone,
  });

  const sharing = sharingQuery.data;
  const link = sharing?.link ? viewLinkUrl(sharing.link.token) : null;
  const expiry = expiryInfo(sharing?.link?.expiresAt);

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
                    <div
                      className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${
                        expiry.tone === 'expired'
                          ? 'bg-red-50 border-red-200 text-red-700'
                          : expiry.tone === 'soon'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-gray-50 border-gray-200 text-gray-700'
                      }`}
                    >
                      <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                      <span className="flex-1">{expiry.text}</span>
                      <button
                        onClick={() => setShowExtend((v) => !v)}
                        className="text-xs font-semibold text-blue-600 hover:underline shrink-0"
                      >
                        Gia hạn
                      </button>
                    </div>
                    {showExtend && (
                      <div className="space-y-2 border border-blue-100 bg-blue-50/50 rounded-lg p-3">
                        <p className="text-xs text-gray-600">Thời hạn mới, tính từ bây giờ (link giữ nguyên):</p>
                        <DaysPicker value={days} onChange={setDays} />
                        <button
                          onClick={() => extendMutation.mutate()}
                          disabled={extendMutation.isPending}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {extendMutation.isPending ? '...' : 'Lưu thời hạn'}
                        </button>
                      </div>
                    )}
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
                          <RefreshCw className="w-3.5 h-3.5" /> Xác nhận: link mới ({DAYS_LABEL[days]}), link cũ ngừng hoạt động
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
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-600">Thời hạn của link:</p>
                      <DaysPicker value={days} onChange={setDays} />
                    </div>
                    <button
                      onClick={() => linkMutation.mutate()}
                      disabled={linkMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 text-sm border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                    >
                      <Link2 className="w-4 h-4" /> Tạo link xem
                    </button>
                  </div>
                )}
                {(linkMutation.error || unlinkMutation.error || extendMutation.error) && (
                  <p className="text-xs text-red-600">
                    {errorText(linkMutation.error || unlinkMutation.error || extendMutation.error)}
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
