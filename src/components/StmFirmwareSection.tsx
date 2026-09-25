import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu } from 'lucide-react';
import { getDeviceStm, triggerStmUpdate } from '../services/api';
import { useOtaStatus } from '../hooks/useOtaStatus';
import { LoadingSpinner } from './LoadingSpinner';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Đã gửi lệnh, đang chờ thiết bị',
  starting: 'Đang bắt đầu',
  downloading: 'Đang tải firmware',
  verifying: 'Đang kiểm tra firmware',
  flashing: 'Đang nạp STM32',
  installing: 'Đang nạp STM32',
  success: 'Cập nhật STM32 thành công',
  failed: 'Cập nhật STM32 thất bại',
  rescue_needed: 'STM32 đang chờ nạp lại — hãy tắt/bật nguồn bộ hoà lưới',
};

const REASON_TEXT: Record<string, string> = {
  esp_firmware_too_old: 'Cần cập nhật firmware ESP32 trước khi cập nhật STM32',
  version_unknown: 'Thiết bị chưa báo phiên bản mạch STM32',
  no_firmware: 'Chưa có bản firmware STM32 cho loại mạch này',
};

/** STM32 power-board firmware of one inverter (web, settings tab). */
export function StmFirmwareSection({ deviceId }: { deviceId: string }) {
  const queryClient = useQueryClient();
  const { ota, reset } = useOtaStatus(deviceId, 'stm32');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const stmQuery = useQuery({
    queryKey: ['device-stm', deviceId],
    queryFn: () => getDeviceStm(deviceId),
  });

  const updateMutation = useMutation({
    mutationFn: () => triggerStmUpdate(deviceId),
    onMutate: () => {
      reset();
      setNotice(null);
    },
    onSuccess: (res) =>
      setNotice({
        ok: true,
        text: `Đã gửi lệnh cập nhật STM32 lên ${res.targetVersion}, đang chờ thiết bị...`,
      }),
    onError: (err) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message;
      setNotice({ ok: false, text: message || 'Không gửi được lệnh cập nhật STM32' });
    },
  });

  // The ESP32 re-reports the STM32 version after flashing.
  useEffect(() => {
    if (!ota) return;
    setNotice(null);
    if (ota.status !== 'success') return;
    const t = setTimeout(
      () => queryClient.invalidateQueries({ queryKey: ['device-stm', deviceId] }),
      30000
    );
    return () => clearTimeout(t);
  }, [ota, deviceId, queryClient]);

  const info = stmQuery.data;
  // Nothing to show for boards that never reported and can't be updated yet.
  if (!info || (!info.version && !info.target && info.reason !== 'version_unknown')) return null;

  const onUpdate = () => {
    const ok = window.confirm(
      'Cập nhật firmware mạch công suất (STM32)?\n\n' +
        'Bộ hoà lưới sẽ NGỪNG PHÁT ĐIỆN khoảng 40 giây trong lúc nạp. ' +
        'Nên thực hiện lúc công suất thấp (buổi tối). Không tắt nguồn trong lúc cập nhật.'
    );
    if (ok) updateMutation.mutate();
  };

  const failed = ota?.status === 'failed' || ota?.status === 'rescue_needed';
  const pct = ota?.status === 'success' ? 100 : Math.max(0, Math.min(100, ota?.progress ?? 0));

  return (
    <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
      <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Cpu className="w-5 h-5 text-orange-600" />
        Mạch công suất (STM32)
      </h4>
      <div className="border-t border-gray-200 pt-4 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Loại mạch</span>
          <span className="font-medium text-gray-900">
            {info.chip && info.voltage ? `${info.chip} · ${info.voltage}` : info.voltage ?? '---'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Phiên bản hiện tại</span>
          <span className="font-medium text-gray-900">{info.version ?? '---'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Phiên bản mới</span>
          <span className="font-medium text-gray-900">{info.target?.version ?? '---'}</span>
        </div>

        {info.reason && <p className="text-amber-700">{REASON_TEXT[info.reason] ?? info.reason}</p>}

        {info.target && (
          <button
            onClick={onUpdate}
            disabled={!info.updateAvailable || updateMutation.isPending}
            className={`w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center ${
              info.updateAvailable
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {updateMutation.isPending ? (
              <LoadingSpinner size="sm" className="text-white" />
            ) : info.updateAvailable ? (
              <span>Cập nhật STM32</span>
            ) : (
              <span>Đã là bản mới nhất</span>
            )}
          </button>
        )}

        {notice && (
          <p className={notice.ok ? 'text-blue-600' : 'text-red-600'}>{notice.text}</p>
        )}

        {ota && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span
                className={failed ? 'text-red-600' : ota.status === 'success' ? 'text-green-600' : 'text-gray-700'}
              >
                {STATUS_LABEL[ota.status] ?? ota.status}
              </span>
              {!failed && <span className="text-gray-500">{pct}%</span>}
            </div>
            {!failed && (
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${ota.status === 'success' ? 'bg-green-500' : 'bg-orange-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {ota.message && <p className="text-xs text-gray-500">{ota.message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
