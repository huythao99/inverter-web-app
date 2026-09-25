import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CircuitBoard, Cpu, RefreshCw } from 'lucide-react';
import {
  getDeviceFirmwareVersion,
  getDeviceStm,
  getLatestFirmwareVersion,
  triggerFirmwareUpdate,
  triggerStmUpdate,
} from '../services/api';
import type { DeviceStmInfo } from '../services/api';
import { useOtaStatus } from '../hooks/useOtaStatus';
import type { OtaStatus } from '../hooks/useOtaStatus';
import { LoadingSpinner } from './LoadingSpinner';

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

const TERMINAL = new Set(['success', 'failed', 'rescue_needed']);
const isRunning = (ota: OtaStatus | null) => !!ota && !TERMINAL.has(ota.status);

const errorText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

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

const STM_LABEL: Record<string, string> = {
  starting: 'Đang bắt đầu',
  downloading: 'Đang tải firmware',
  verifying: 'Đang kiểm tra firmware',
  flashing: 'Đang nạp mạch công suất',
  installing: 'Đang nạp mạch công suất',
  success: 'Cập nhật mạch công suất thành công',
  failed: 'Cập nhật mạch công suất thất bại',
  rescue_needed: 'Mạch công suất chưa có firmware — cần nạp lại',
};

const STM_REASON: Record<string, string> = {
  esp_firmware_too_old: 'Cần cập nhật firmware bộ điều khiển (ESP32) trước',
  version_unknown: 'Thiết bị chưa báo phiên bản mạch công suất',
  no_firmware: 'Chưa có bản firmware cho loại mạch này',
};

/** ESP32 status messages (English) -> Vietnamese for the user. */
const STM_MESSAGES: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^Checking STM32 firmware/, () => 'Đang kiểm tra bản firmware'],
  [/^Downloading (\S+)/, (m) => `Đang tải bản ${m[1]}`],
  [/^Image OK/, () => 'File firmware hợp lệ'],
  [/^Stopping inverter/, () => 'Đang dừng phát điện và nạp mạch (~40 giây)'],
  [/^Flashing STM32/, () => 'Đang nạp mạch công suất'],
  [/^Update failed, restoring (\S+)/, (m) => `Nạp lỗi, đang khôi phục bản ${m[1]}`],
  [/^STM32 updated to (\S+)/, (m) => `Mạch công suất đã lên bản ${m[1]}`],
  [/^Flashed (\S+), waiting/, (m) => `Đã nạp bản ${m[1]}, đang chờ mạch báo phiên bản`],
  [/^Already up to date/, () => 'Mạch công suất đã ở bản mới nhất'],
  [/restored (\S+)$/, (m) => `Nạp không thành công, đã khôi phục bản ${m[1]} — máy chạy bình thường`],
  [/: busy/, () => 'Mạch đang ghi dữ liệu, hãy thử lại sau ít phút'],
  [/: no_ack/, () => 'Mạch công suất không phản hồi lệnh nạp'],
  [/: (variant|product)/, () => 'File firmware không đúng loại mạch / điện áp — đã huỷ, máy chạy bản cũ'],
  [/waits in bootloader/, () => 'Nạp lỗi giữa chừng, mạch đang chờ nạp lại. Bấm "Thử nạp lại"'],
  [/^STM32 flash failed/, () => 'Nạp mạch công suất lỗi'],
  [/No STM32 firmware/, () => 'Chưa có bản firmware cho loại mạch này'],
  [/version unknown/, () => 'Chưa biết phiên bản mạch công suất'],
  [/does not match board|Image says/, () => 'Bản firmware không khớp loại mạch'],
  [/CRC32|Download|Size mismatch|Bad firmware URL|Cannot get STM32/, () => 'Tải firmware lỗi, hãy thử lại'],
  [/busy/i, () => 'Thiết bị đang bận, hãy thử lại sau'],
  [/No WiFi/, () => 'Thiết bị mất kết nối WiFi'],
  [/Storage/, () => 'Lỗi bộ nhớ của thiết bị'],
];

function stmMessage(msg?: string): string | undefined {
  if (!msg) return undefined;
  for (const [re, fn] of STM_MESSAGES) {
    const m = re.exec(msg);
    if (m) return fn(m);
  }
  return msg;
}

/**
 * One bar for the whole STM32 update: download 0-20 %, verify 20-25 %,
 * flash 25-100 % (the ESP32 reports each phase from 0 again).
 */
function stmPercent(ota: OtaStatus): number {
  const p = Math.max(0, Math.min(100, ota.progress ?? 0));
  switch (ota.status) {
    case 'downloading':
      return Math.round(p * 0.2);
    case 'verifying':
      return 22;
    case 'flashing':
    case 'installing':
      return Math.round(25 + p * 0.75);
    case 'success':
      return 100;
    default:
      return 0;
  }
}

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
    if (!TERMINAL.has(stmLiveOta.status)) return;
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
        <UpdateButton
          label={espButtonLabel}
          enabled={espEnabled}
          pending={espMutation.isPending}
          onClick={onEspUpdate}
          color="bg-blue-600 hover:bg-blue-700"
        />
        {espNotice && <p className={`text-sm ${TONE_CLASS[espNotice.tone]}`}>{espNotice.text}</p>}
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
          <Row label="Phiên bản mới" value={stm.target?.version ?? '---'} />
          {stm.reason && (
            <p className="text-sm text-amber-700">{STM_REASON[stm.reason] ?? stm.reason}</p>
          )}
          {stm.target && (
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
              label={STM_LABEL[stmOta.status] ?? stmOta.status}
              pct={stmFailed ? null : stmPercent(stmOta)}
              tone={stmRescue ? 'warn' : stmFailed ? 'error' : stmDone ? 'ok' : 'info'}
              detail={stmMessage(stmOta.message)}
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
