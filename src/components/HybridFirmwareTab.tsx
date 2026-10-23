import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircuitBoard, Cpu, RefreshCw, Sparkles } from 'lucide-react';
import { getHybridFirmware, updateHybridEsp, updateHybridStm } from '../services/api';
import type { FirmwareRelease } from '../types';
import { useOtaStatus } from '../hooks/useOtaStatus';
import type { OtaStatus } from '../hooks/useOtaStatus';
import { LoadingSpinner } from './LoadingSpinner';

// ---------------------------------------------------------------------------
// "Cập nhật" tab of a hybrid: the ESP32 controller and the STM32 power board,
// each with its version, the version offered, an update button, live
// progress (MQTT hybrid/{uid}/{id}/ota/status and .../stm/ota/status) and the
// release notes of every version up to the offered one.
// Only one update at a time (the ESP32 does both).
// ---------------------------------------------------------------------------

/** No status from the device this long after the command -> it didn't answer. */
const RESPONSE_TIMEOUT_MS = 45000;
const TERMINAL = new Set(['success', 'failed', 'rescue_needed']);
const running = (o: OtaStatus | null) => !!o && !TERMINAL.has(o.status);

const errorText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const ESP_LABEL: Record<string, string> = {
  starting: 'Đang bắt đầu',
  downloading: 'Đang tải firmware',
  installing: 'Đang cài đặt',
  success: 'Cập nhật thành công, thiết bị đang khởi động lại',
  failed: 'Cập nhật thất bại',
};

const STM_LABEL: Record<string, string> = {
  starting: 'Đang kiểm tra bản firmware',
  downloading: 'Đang tải firmware',
  verifying: 'Đang kiểm tra file firmware',
  flashing: 'Đang nạp mạch công suất (máy ngừng phát ~40 giây)',
  success: 'Cập nhật mạch công suất thành công',
  failed: 'Cập nhật mạch công suất thất bại',
  rescue_needed: 'Nạp lỗi giữa chừng — mạch đang chờ nạp lại, bấm "Thử nạp lại"',
};

const STM_REASON: Record<string, string> = {
  esp_firmware_too_old: 'Cần cập nhật bộ điều khiển (ESP32) trước',
  version_unknown: 'Chưa biết phiên bản mạch công suất (máy chưa báo)',
  no_firmware: 'Chưa có bản firmware cho loại mạch này',
};

/** STM32: download 0-20 %, verify ~22 %, flash 25-100 %. */
function stmPercent(o: OtaStatus): number {
  const p = Math.max(0, Math.min(100, o.progress ?? 0));
  if (o.status === 'downloading') return Math.round(p * 0.2);
  if (o.status === 'verifying') return 22;
  if (o.status === 'flashing' || o.status === 'installing') return Math.round(25 + p * 0.75);
  if (o.status === 'success') return 100;
  return 0;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '');

function NotesList({ text }: { text: string }) {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length === 0) return <p className="text-sm text-gray-400">Không có ghi chú.</p>;
  return (
    <ul className="list-disc pl-5 space-y-0.5 text-sm text-gray-700">
      {lines.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

function Releases({ releases }: { releases: FirmwareRelease[] }) {
  if (releases.length === 0) {
    return <p className="text-sm text-gray-500">Chưa có ghi chú phiên bản.</p>;
  }
  return (
    <ol className="relative border-l border-gray-200 ml-1.5 space-y-4">
      {releases.map((r) => (
        <li key={r.version} className="ml-4">
          <span
            className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white ${
              r.installed ? 'bg-green-500' : r.isNew ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          />
          <p className="mb-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-gray-900">{r.version}</span>
            {r.installed && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">Đang dùng</span>
            )}
            {r.isNew && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Mới</span>
            )}
            <span className="text-xs text-gray-400">{fmtDate(r.date)}</span>
          </p>
          <NotesList text={r.notes} />
        </li>
      ))}
    </ol>
  );
}

function Progress({ label, pct, tone, detail }: { label: string; pct: number | null; tone: 'info' | 'ok' | 'error'; detail?: string }) {
  const color = tone === 'ok' ? 'bg-green-500' : tone === 'error' ? 'bg-red-500' : 'bg-blue-500';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className={tone === 'error' ? 'text-red-600' : tone === 'ok' ? 'text-green-600' : 'text-gray-700'}>{label}</span>
        {pct !== null && <span className="text-gray-500 tabular-nums">{pct}%</span>}
      </div>
      {pct !== null && (
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {detail && <p className="text-xs text-gray-500 break-words">{detail}</p>}
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 sm:p-5 space-y-3">
      <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2">
        {icon}
        {title}
      </h4>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

/** Command sent, no status yet: give up after RESPONSE_TIMEOUT_MS. */
function useNoAnswer(since: number | null, ota: OtaStatus | null, onTimeout: () => void) {
  useEffect(() => {
    if (!since || (ota && ota.at >= since)) return;
    const t = setTimeout(onTimeout, Math.max(0, since + RESPONSE_TIMEOUT_MS - Date.now()));
    return () => clearTimeout(t);
  }, [since, ota, onTimeout]);
}

export function HybridFirmwareTab({ deviceId, isOnline }: { deviceId: string; isOnline: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['hybrid-firmware', deviceId],
    queryFn: () => getHybridFirmware(deviceId),
  });
  const data = query.data;
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['hybrid-firmware', deviceId] }),
    [queryClient, deviceId],
  );

  const { ota: espOta, reset: resetEsp } = useOtaStatus(deviceId, 'esp32', 'hybrid');
  const { ota: stmLive, reset: resetStm } = useOtaStatus(deviceId, 'stm32', 'hybrid');
  const [espSince, setEspSince] = useState<number | null>(null);
  const [stmSince, setStmSince] = useState<number | null>(null);
  const [espNote, setEspNote] = useState<{ error: boolean; text: string } | null>(null);
  const [stmNote, setStmNote] = useState<{ error: boolean; text: string } | null>(null);

  // After a reload in the middle of an STM32 update: last status the server saw.
  const last = data?.stm.lastOta;
  const lastAt = last?.at ? new Date(last.at).getTime() : 0;
  const stmOta: OtaStatus | null =
    stmLive ??
    (last && last.status !== 'sent' && Date.now() - lastAt < 3 * 60 * 1000
      ? { status: last.status, progress: last.progress ?? undefined, message: last.message ?? undefined, at: lastAt }
      : null);

  const espBusy = running(espOta) || !!espSince;
  const stmBusy = running(stmOta) || !!stmSince;

  const espMutation = useMutation({
    mutationFn: () => updateHybridEsp(deviceId),
    onMutate: () => {
      resetEsp();
      setEspNote(null);
    },
    onSuccess: (r) => {
      setEspSince(Date.now());
      setEspNote({ error: false, text: `Đã gửi lệnh cập nhật lên ${r.targetVersion}, đang chờ thiết bị...` });
    },
    onError: (e) => setEspNote({ error: true, text: errorText(e, 'Không gửi được lệnh cập nhật') }),
  });
  const stmMutation = useMutation({
    mutationFn: () => updateHybridStm(deviceId),
    onMutate: () => {
      resetStm();
      setStmNote(null);
    },
    onSuccess: (r) => {
      setStmSince(Date.now());
      setStmNote({ error: false, text: `Đã gửi lệnh cập nhật mạch công suất lên ${r.targetVersion}, đang chờ thiết bị...` });
    },
    onError: (e) => setStmNote({ error: true, text: errorText(e, 'Không gửi được lệnh cập nhật') }),
  });

  useNoAnswer(espSince, espOta, useCallback(() => {
    setEspSince(null);
    setEspNote({ error: true, text: 'Thiết bị không phản hồi. Kiểm tra thiết bị đang online rồi thử lại.' });
  }, []));
  useNoAnswer(stmSince, stmLive, useCallback(() => {
    setStmSince(null);
    setStmNote({ error: true, text: 'Thiết bị không phản hồi. Kiểm tra thiết bị đang online rồi thử lại.' });
  }, []));

  // Status arrived: stop waiting; refresh the versions once finished.
  useEffect(() => {
    if (!espOta) return;
    setEspSince(null);
    setEspNote(null);
    if (espOta.status !== 'success') return;
    const t = setTimeout(refresh, 30000); // reboot + version report
    return () => clearTimeout(t);
  }, [espOta, refresh]);
  useEffect(() => {
    if (!stmLive) return;
    setStmSince(null);
    setStmNote(null);
    if (!TERMINAL.has(stmLive.status)) return;
    const t1 = setTimeout(refresh, 5000);
    const t2 = setTimeout(refresh, 30000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [stmLive, refresh]);

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <LoadingSpinner />
      </div>
    );
  }
  if (query.error || !data) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 text-sm">Không tải được thông tin phiên bản</p>
        <button onClick={() => query.refetch()} className="mt-3 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm">
          Thử lại
        </button>
      </div>
    );
  }

  const esp = data.esp;
  const stm = data.stm;
  const espNew = esp.releases.find((r) => r.version === esp.targetVersion);

  const espLabel = !isOnline
    ? 'Thiết bị đang offline'
    : espBusy
      ? 'Đang cập nhật...'
      : stmBusy
        ? 'Đang cập nhật mạch công suất...'
        : esp.updateAvailable
          ? `Cập nhật lên ${esp.targetVersion}`
          : 'Đã là bản mới nhất';
  const espEnabled = isOnline && esp.updateAvailable && !espBusy && !stmBusy;

  const stmRescue = stmOta?.status === 'rescue_needed';
  const stmCan = !!stm.target && (stm.updateAvailable || stmRescue);
  const stmEnabled = isOnline && stmCan && !stmBusy && !espBusy;
  const stmLabel = !isOnline
    ? 'Thiết bị đang offline'
    : stmBusy
      ? 'Đang cập nhật...'
      : espBusy
        ? 'Đang cập nhật bộ điều khiển...'
        : stmRescue
          ? 'Thử nạp lại'
          : stm.updateAvailable
            ? `Cập nhật lên ${stm.target?.version}`
            : 'Đã là bản mới nhất';

  const button = (label: string, enabled: boolean, pending: boolean, onClick: () => void, color: string) => (
    <button
      onClick={onClick}
      disabled={!enabled || pending}
      className={`w-full py-3 rounded-xl font-semibold transition-colors flex items-center justify-center ${
        enabled ? `${color} text-white` : 'bg-gray-200 text-gray-500 cursor-not-allowed'
      }`}
    >
      {pending ? <LoadingSpinner size="sm" className="text-white" /> : label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => query.refetch()}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Làm mới
        </button>
      </div>

      <Card icon={<Cpu className="w-5 h-5 text-blue-600" />} title="Bộ điều khiển (ESP32)">
        <Row label="Phiên bản hiện tại" value={esp.currentVersion ?? '---'} />
        <Row label="Phiên bản mới nhất" value={esp.targetVersion ?? '---'} />
        {esp.updateAvailable && espNew?.notes && (
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-blue-800">
              <Sparkles className="h-4 w-4" /> Có gì mới ở bản {esp.targetVersion}
            </p>
            <NotesList text={espNew.notes} />
          </div>
        )}
        {button(espLabel, espEnabled, espMutation.isPending, () => {
          const ok = window.confirm(
            `Cập nhật bộ điều khiển lên ${esp.targetVersion}?\n\n` +
              (espNew?.notes ? `Có gì mới:\n${espNew.notes}\n\n` : '') +
              'Thiết bị sẽ tự khởi động lại, mất kết nối khoảng 1 phút.',
          );
          if (ok) espMutation.mutate();
        }, 'bg-blue-600 hover:bg-blue-700')}
        {espNote && <p className={`text-sm ${espNote.error ? 'text-red-600' : 'text-blue-600'}`}>{espNote.text}</p>}
        {espOta && (
          <Progress
            label={ESP_LABEL[espOta.status] ?? espOta.status}
            pct={espOta.status === 'failed' ? null : espOta.status === 'success' ? 100 : Math.max(0, Math.min(100, espOta.progress ?? 0))}
            tone={espOta.status === 'failed' ? 'error' : espOta.status === 'success' ? 'ok' : 'info'}
            detail={espOta.status === 'failed' ? espOta.message : undefined}
          />
        )}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-800 mb-2">Các phiên bản</p>
          <Releases releases={esp.releases} />
        </div>
      </Card>

      <Card icon={<CircuitBoard className="w-5 h-5 text-orange-600" />} title="Mạch công suất (STM32)">
        <Row label="Loại mạch" value={[stm.chip, stm.voltage].filter(Boolean).join(' · ') || '---'} />
        <Row label="Phiên bản hiện tại" value={stm.version ?? '---'} />
        <Row label="Phiên bản mới nhất" value={stm.target?.version ?? '---'} />
        {stm.reason && (
          <p className="text-sm text-amber-700">
            {STM_REASON[stm.reason] ?? stm.reason}
            {stm.reason === 'esp_firmware_too_old' ? ` (cần ESP32 ≥ ${stm.minEspVersion})` : ''}
          </p>
        )}
        {stm.target &&
          button(stmLabel, stmEnabled, stmMutation.isPending, () => {
            const ok = window.confirm(
              `Cập nhật mạch công suất lên ${stm.target?.version}?\n\n` +
                'Máy sẽ NGỪNG PHÁT ĐIỆN khoảng 40 giây trong lúc nạp. Nên làm lúc tải thấp. ' +
                'Không tắt nguồn trong lúc cập nhật.',
            );
            if (ok) stmMutation.mutate();
          }, 'bg-orange-600 hover:bg-orange-700')}
        {stmNote && <p className={`text-sm ${stmNote.error ? 'text-red-600' : 'text-orange-600'}`}>{stmNote.text}</p>}
        {stmOta && (
          <Progress
            label={STM_LABEL[stmOta.status] ?? stmOta.status}
            pct={stmOta.status === 'failed' || stmRescue ? null : stmPercent(stmOta)}
            tone={stmOta.status === 'failed' || stmRescue ? 'error' : stmOta.status === 'success' ? 'ok' : 'info'}
            detail={stmOta.message}
          />
        )}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-sm font-semibold text-gray-800 mb-2">Các phiên bản</p>
          <Releases releases={stm.releases} />
        </div>
      </Card>
    </div>
  );
}
