import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, CircuitBoard, Cpu, RefreshCw, Sparkles } from 'lucide-react';
import {
  getDeviceFirmwareVersion,
  getDeviceStm,
  getFirmwareReleases,
  getLatestFirmwareVersion,
  triggerFirmwareUpdate,
  triggerStmUpdate,
} from '../services/api';
import type { DeviceStmInfo } from '../services/api';
import { useOtaStatus } from '../hooks/useOtaStatus';
import type { OtaStatus } from '../hooks/useOtaStatus';
import { LoadingSpinner } from './LoadingSpinner';
import { OTA_TERMINAL, STM_OTA_LABEL, STM_OTA_REASON, stmOtaMessage, stmOtaPercent } from '../services/stmOta';
import { compareVersions } from '../utils/version';

// ---------------------------------------------------------------------------
// One "Firmware" card for an inverter: the ESP32 controller and the STM32
// power board (flashed through the ESP32), each with its version, update
// button and live progress. Only one of the two can run at a time.
// ---------------------------------------------------------------------------

/** No status from the device this long after the command -> it didn't answer. */
const RESPONSE_TIMEOUT_MS = 45000;

type Tone = 'info' | 'ok' | 'warn' | 'error';
interface Notice {
  tone: Tone;
  text: string;
}

const isRunning = (ota: OtaStatus | null) => !!ota && !OTA_TERMINAL.has(ota.status);

const errorText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// ---- ESP32 -----------------------------------------------------------------

const ESP_LABEL: Record<string, string> = {
  starting: 'Đang bắt đầu',
  started: 'Đang bắt đầu',
  downloading: 'Đang tải firmware',
  installing: 'Đang cài đặt',
  progress: 'Đang cập nhật',
  success: 'Cập nhật thành công, thiết bị đang khởi động lại',
  failed: 'Cập nhật thất bại',
};

// ---- STM32 -----------------------------------------------------------------

// ---- UI pieces -------------------------------------------------------------

const TONE_CLASS: Record<Tone, string> = {
  info: 'text-blue-600',
  ok: 'text-green-600',
  warn: 'text-amber-700',
  error: 'text-red-600',
};

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function Progress({
  label,
  pct,
  tone,
  detail,
  color,
}: {
  label: string;
  pct: number | null;
  tone: Tone;
  detail?: string;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={tone === 'info' ? 'text-gray-700' : TONE_CLASS[tone]}>{label}</span>
        {pct !== null && <span className="text-gray-500">{pct}%</span>}
      </div>
      {pct !== null && (
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${tone === 'ok' ? 'bg-green-500' : color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {detail && <p className="text-xs text-gray-500">{detail}</p>}
    </div>
  );
}

function UpdateButton({
  label,
  enabled,
  pending,
  onClick,
  color,
}: {
  label: string;
  enabled: boolean;
  pending: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled || pending}
      className={`w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center ${
        enabled ? `${color} text-white` : 'bg-gray-300 text-gray-500 cursor-not-allowed'
      }`}
    >
      {pending ? <LoadingSpinner size="sm" className="text-white" /> : <span>{label}</span>}
    </button>
  );
}

/** Command sent but the device hasn't answered yet -> give up after a while. */
function useResponseTimeout(
  waitingSince: number | null,
  ota: OtaStatus | null,
  onTimeout: () => void,
) {
  useEffect(() => {
    if (!waitingSince) return;
    if (ota && ota.at >= waitingSince) return;
    const t = setTimeout(onTimeout, Math.max(0, waitingSince + RESPONSE_TIMEOUT_MS - Date.now()));
    return () => clearTimeout(t);
  }, [waitingSince, ota, onTimeout]);
}

/** Release notes: one change per line -> bullet list. */
function NotesList({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
  return (
    <ul className="list-disc pl-5 space-y-0.5 text-sm text-gray-700">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('vi-VN') : '';

// ---------------------------------------------------------------------------

export function FirmwareSection({
  deviceId,
  isOnline,
  reportedEspVersion,
}: {
  deviceId: string;
  isOnline: boolean;
  /** firmwareVersion from the device document, until the query answers. */
  reportedEspVersion?: string;
}) {
  const queryClient = useQueryClient();

  // ---- ESP32 state ----
  const { ota: espOta, reset: resetEspOta } = useOtaStatus(deviceId, 'esp32');
  const [espNotice, setEspNotice] = useState<Notice | null>(null);
  const [espWaitingSince, setEspWaitingSince] = useState<number | null>(null);

  const espCurrentQuery = useQuery({
    queryKey: ['device-firmware', deviceId],
    queryFn: () => getDeviceFirmwareVersion(deviceId),
  });
  const espLatestQuery = useQuery({
    queryKey: ['latest-firmware', deviceId],
    queryFn: () => getLatestFirmwareVersion(deviceId),
  });
  const espCurrent = espCurrentQuery.data?.firmwareVersion ?? reportedEspVersion ?? '';
  const espLatest = espLatestQuery.data?.version ?? '';
  const espLatestNotes = espLatestQuery.data?.releaseNotes?.trim() ?? '';
  const [showHistory, setShowHistory] = useState(false);
  const releasesQuery = useQuery({
    queryKey: ['firmware-releases', deviceId],
    queryFn: () => getFirmwareReleases(deviceId),
    enabled: showHistory,
  });
  const espUpdateAvailable = !!espCurrent && !!espLatest && compareVersions(espCurrent, espLatest) < 0;

  // ---- STM32 state ----
  const { ota: stmLiveOta, reset: resetStmOta } = useOtaStatus(deviceId, 'stm32');
  const [stmNotice, setStmNotice] = useState<Notice | null>(null);
  const [stmWaitingSince, setStmWaitingSince] = useState<number | null>(null);

  const stmQuery = useQuery({
    queryKey: ['device-stm', deviceId],
    queryFn: () => getDeviceStm(deviceId),
  });
  const stm: DeviceStmInfo | undefined = stmQuery.data;

  // After a page reload in the middle of an update: continue from the last
  // status the backend saw (if recent), until the live topic says more.
  const lastOta = stm?.lastOta;
  const lastOtaAt = lastOta?.at ? new Date(lastOta.at).getTime() : 0;
  const stmOta: OtaStatus | null =
    stmLiveOta ??
    (lastOta && lastOta.status !== 'sent' && Date.now() - lastOtaAt < 3 * 60 * 1000
      ? {
          status: lastOta.status,
          progress: lastOta.progress ?? undefined,
          message: lastOta.message ?? undefined,
          at: lastOtaAt,
        }
      : null);

  // ---- mutual exclusion: the ESP32 does one update at a time ----
  const espBusy = isRunning(espOta) || !!espWaitingSince;
  const stmBusy = isRunning(stmOta) || !!stmWaitingSince;

  // ---- ESP32 update ----
  const espMutation = useMutation({
    mutationFn: () => triggerFirmwareUpdate(deviceId),
    onMutate: () => {
      resetEspOta();
      setEspNotice(null);
    },
    onSuccess: (res) => {
      setEspWaitingSince(Date.now());
      setEspNotice({
        tone: 'info',
        text: `Đã gửi lệnh cập nhật lên ${res.targetVersion}, đang chờ thiết bị phản hồi...`,
      });
    },
    onError: (err) =>
      setEspNotice({ tone: 'error', text: errorText(err, 'Không gửi được lệnh cập nhật') }),
  });

  useResponseTimeout(espWaitingSince, espOta, () => {
    setEspWaitingSince(null);
    setEspNotice({
      tone: 'error',
      text: 'Thiết bị không phản hồi. Kiểm tra thiết bị đang online rồi thử lại.',
    });
  });

  useEffect(() => {
    if (!espOta) return;
    setEspWaitingSince(null);
    setEspNotice(null);
    if (espOta.status !== 'success') return;
    // The ESP32 reboots and re-reports its version.
    const t = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['device-firmware', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['device-stm', deviceId] });
    }, 30000);
    return () => clearTimeout(t);
  }, [espOta, deviceId, queryClient]);

  // ---- STM32 update ----
  const stmMutation = useMutation({
    mutationFn: () => triggerStmUpdate(deviceId),
    onMutate: () => {
      resetStmOta();
      setStmNotice(null);
    },
    onSuccess: (res) => {
      setStmWaitingSince(Date.now());
      setStmNotice({
        tone: 'info',
        text: `Đã gửi lệnh cập nhật mạch công suất lên ${res.targetVersion}, đang chờ thiết bị...`,
      });
    },
    onError: (err) =>
      setStmNotice({ tone: 'error', text: errorText(err, 'Không gửi được lệnh cập nhật') }),
  });

  useResponseTimeout(stmWaitingSince, stmLiveOta, () => {
    setStmWaitingSince(null);
    setStmNotice({
      tone: 'error',
      text: 'Thiết bị không phản hồi. Kiểm tra thiết bị đang online rồi thử lại.',
    });
  });

  useEffect(() => {
    if (!stmLiveOta) return;
    setStmWaitingSince(null);
    setStmNotice(null);
    if (!OTA_TERMINAL.has(stmLiveOta.status)) return;
    // The new version arrives with the next telemetry frames.
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['device-stm', deviceId] });
    const t1 = setTimeout(refresh, 5000);
    const t2 = setTimeout(refresh, 30000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [stmLiveOta, deviceId, queryClient]);

  const onEspUpdate = () => {
    const ok = window.confirm(
      `Cập nhật firmware bộ điều khiển lên ${espLatest}?\n\n` +
        (espLatestNotes ? `Có gì mới:\n${espLatestNotes}\n\n` : '') +
        'Thiết bị sẽ tự khởi động lại, mất kết nối khoảng 1 phút.',
    );
    if (ok) espMutation.mutate();
  };

  const onStmUpdate = () => {
    const ok = window.confirm(
      `Cập nhật firmware mạch công suất lên ${stm?.target?.version ?? ''}?\n\n` +
        'Bộ hoà lưới sẽ NGỪNG PHÁT ĐIỆN khoảng 40 giây trong lúc nạp. ' +
        'Nên thực hiện lúc công suất thấp (buổi tối). Không tắt nguồn trong lúc cập nhật.',
    );
    if (ok) stmMutation.mutate();
  };

  // ---- ESP32 view ----
  const espFailed = espOta?.status === 'failed';
  const espDone = espOta?.status === 'success';
  const espButtonLabel = !isOnline
    ? 'Thiết bị đang offline'
    : espBusy
      ? 'Đang cập nhật...'
      : stmBusy
        ? 'Đang cập nhật mạch công suất...'
        : espUpdateAvailable
          ? `Cập nhật lên ${espLatest}`
          : 'Đã là bản mới nhất';
  const espEnabled = isOnline && espUpdateAvailable && !espBusy && !stmBusy;

  // ---- STM32 view ----
  // Hidden for boards that never reported and can't be updated yet.
  const showStm =
    !!stm && (!!stm.version || !!stm.target || stm.reason === 'version_unknown');
  const stmRescue = stmOta?.status === 'rescue_needed';
  const stmFailed = stmOta?.status === 'failed' || stmRescue;
  const stmDone = stmOta?.status === 'success';
  const stmCanUpdate = !!stm?.target && (!!stm.updateAvailable || stmRescue);
  // No image for this chip/voltage = nothing newer: shown like the ESP32.
  const stmNoImage = stm?.reason === 'no_firmware' && !!stm.version;
  const stmEnabled = isOnline && stmCanUpdate && !stmBusy && !espBusy;
  const stmButtonLabel = !isOnline
    ? 'Thiết bị đang offline'
    : stmBusy
      ? 'Đang cập nhật...'
      : espBusy
        ? 'Đang cập nhật bộ điều khiển...'
        : stmRescue
          ? 'Thử nạp lại'
          : stm?.updateAvailable
            ? `Cập nhật lên ${stm.target?.version}`
            : 'Đã là bản mới nhất';

  return (
    <div className="bg-gray-50 rounded-xl p-4 shadow-sm">
      <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center justify-between">
        <span>Firmware</span>
        <button
          onClick={() => {
            espCurrentQuery.refetch();
            espLatestQuery.refetch();
            stmQuery.refetch();
          }}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Làm mới"
        >
          <RefreshCw
            className={`w-4 h-4 ${
              espCurrentQuery.isFetching || stmQuery.isFetching ? 'animate-spin' : ''
            }`}
          />
        </button>
      </h4>

      {/* ---- ESP32 controller ---- */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <h5 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-blue-600" />
          Bộ điều khiển (ESP32)
        </h5>
        <Row label="Phiên bản hiện tại" value={espCurrent || '---'} />
        <Row label="Phiên bản mới" value={espLatest || '---'} />
        {espUpdateAvailable && espLatestNotes && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-blue-800">
              <Sparkles className="h-4 w-4" />
              Có gì mới ở bản {espLatest}
            </p>
            <NotesList text={espLatestNotes} />
          </div>
        )}
        <UpdateButton
          label={espButtonLabel}
          enabled={espEnabled}
          pending={espMutation.isPending}
          onClick={onEspUpdate}
          color="bg-blue-600 hover:bg-blue-700"
        />
        {espNotice && <p className={`text-sm ${TONE_CLASS[espNotice.tone]}`}>{espNotice.text}</p>}
        <button
          onClick={() => setShowHistory((v) => !v)}
          className="flex w-full items-center justify-between text-sm text-gray-600 hover:text-gray-900"
        >
          <span>Lịch sử phiên bản</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showHistory ? 'rotate-180' : ''}`}
          />
        </button>
        {showHistory && (
          <div className="space-y-3">
            {releasesQuery.isLoading ? (
              <LoadingSpinner size="sm" />
            ) : !releasesQuery.data?.releases.length ? (
              <p className="text-sm text-gray-500">Chưa có ghi chú phiên bản.</p>
            ) : (
              releasesQuery.data.releases.map((r) => (
                <div key={r.version} className="rounded-lg bg-white p-3 border border-gray-100">
                  <p className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-gray-900">{r.version}</span>
                    {r.installed && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                        Đang dùng
                      </span>
                    )}
                    {r.isNew && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        Mới
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{fmtDate(r.date)}</span>
                  </p>
                  <NotesList text={r.notes} />
                </div>
              ))
            )}
          </div>
        )}
        {espOta && (
          <Progress
            label={ESP_LABEL[espOta.status] ?? espOta.status}
            pct={espFailed ? null : espDone ? 100 : Math.max(0, Math.min(100, espOta.progress ?? 0))}
            tone={espFailed ? 'error' : espDone ? 'ok' : 'info'}
            detail={espFailed ? espOta.message : undefined}
            color="bg-blue-500"
          />
        )}
      </div>

      {/* ---- STM32 power board ---- */}
      {showStm && stm && (
        <div className="border-t border-gray-200 mt-4 pt-4 space-y-3">
          <h5 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <CircuitBoard className="w-4 h-4 text-orange-600" />
            Mạch công suất (STM32)
          </h5>
          <Row
            label="Loại mạch"
            value={stm.chip && stm.voltage ? `${stm.chip} · ${stm.voltage}` : (stm.voltage ?? '---')}
          />
          <Row label="Phiên bản hiện tại" value={stm.version ?? '---'} />
          <Row
            label="Phiên bản mới"
            value={stm.target?.version ?? (stmNoImage ? stm.version! : '---')}
          />
          {stm.reason && !stmNoImage && (
            <p className="text-sm text-amber-700">{STM_OTA_REASON[stm.reason] ?? stm.reason}</p>
          )}
          {(stm.target || stmNoImage) && (
            <UpdateButton
              label={stmButtonLabel}
              enabled={stmEnabled}
              pending={stmMutation.isPending}
              onClick={onStmUpdate}
              color="bg-orange-600 hover:bg-orange-700"
            />
          )}
          {stmCanUpdate && !stmBusy && !stmRescue && (
            <p className="text-xs text-gray-500">
              Bộ hoà lưới ngừng phát điện khoảng 40 giây trong lúc nạp.
            </p>
          )}
          {stmNotice && (
            <p className={`text-sm ${TONE_CLASS[stmNotice.tone]}`}>{stmNotice.text}</p>
          )}
          {stmOta && (
            <Progress
              label={STM_OTA_LABEL[stmOta.status] ?? stmOta.status}
              pct={stmFailed ? null : stmOtaPercent(stmOta.status, stmOta.progress)}
              tone={stmRescue ? 'warn' : stmFailed ? 'error' : stmDone ? 'ok' : 'info'}
              detail={stmOtaMessage(stmOta.message)}
              color="bg-orange-500"
            />
          )}
          {stmRescue && (
            <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Mạch công suất đang chờ nạp lại và chưa phát điện. Bấm "Thử nạp lại". Nếu vẫn
                lỗi, hãy tắt rồi bật lại nguồn bộ hoà lưới và liên hệ hỗ trợ.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
