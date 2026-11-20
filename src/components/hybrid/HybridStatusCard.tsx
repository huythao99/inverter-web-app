import { AlertTriangle, Lock, Play, Power, RefreshCw, RotateCcw, Square } from 'lucide-react';
import type { HybridCommand, HybridLatest } from '../../types';
import {
  CMD_LABEL,
  FLT_LABEL,
  MODE_LABEL,
  ST_LABEL,
  isPowerOff,
  isRetrying,
  num,
  rfastOf,
} from '../../services/hinvlf';
import { CARD } from './styles';
import { Row } from './ui';
import { NakNotice } from './NakNotice';

/** Trạng thái máy + lỗi + lệnh Xóa lỗi / Dừng / Chạy. */
export function HybridStatusCard({
  latest,
  online,
  src,
  sending,
  sent,
  error,
  onCommand,
}: {
  latest?: HybridLatest;
  online: boolean;
  src: string | null;
  sending?: HybridCommand;
  sent?: HybridCommand;
  error: boolean;
  onCommand: (cmd: HybridCommand) => void;
}) {
  const t = latest?.tlm ?? {};
  const flt = (t.FLT ?? '0').trim();
  // F1 + RFAST: máy tự chạy lại sau 0,3 s (STM32 5.4.21+), không báo lỗi.
  const retrying = isRetrying(t);
  const hasFault = flt !== '' && flt !== '0' && !retrying;
  const locked = t.LOCK === '1';
  const stopped = t.ST === 'STOP';
  // Tắt bằng nút nguồn trên máy (5.4.29+): ST=OFF, MODE vẫn là chế độ đặt.
  const powerOff = isPowerOff(t);
  const srcEsp = src === 'ESP';
  const cmdNak = latest?.lastNak?.of?.startsWith('CMD') ? latest.lastNak : null;

  const stCls =
    retrying || powerOff
      ? 'text-amber-600'
      : t.ST === 'FLT'
        ? 'text-red-600'
        : t.ST === 'RUN'
          ? 'text-green-600'
          : 'text-gray-700';

  const btn = (cmd: HybridCommand, icon: React.ReactNode, cls: string, disabled = false) => (
    <button
      type="button"
      onClick={() => onCommand(cmd)}
      disabled={!online || !!sending || disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${cls}`}
    >
      {sending === cmd ? <RefreshCw className="w-4 h-4 animate-spin" /> : icon}
      {CMD_LABEL[cmd]}
    </button>
  );

  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <h4 className="text-base font-semibold text-gray-900 mb-2">Trạng thái máy</h4>
      <div className="divide-y divide-gray-100">
        <Row label="Hoạt động">
          <span className={stCls}>
            {retrying
              ? `Đang thử lại (${rfastOf(t)}/3)`
              : powerOff
                ? 'Đã tắt bằng nút trên máy'
                : (ST_LABEL[t.ST ?? ''] ?? t.ST ?? '—')}
          </span>
        </Row>
        <Row label="Chế độ">{MODE_LABEL[t.MODE ?? ''] ?? t.MODE ?? '—'}</Row>
        <Row label="Pin">{t.VBAT ? `${num(t.VBAT)?.toFixed(2)} V` : '—'}</Row>
        <Row label="Áp ra / áp lưới">
          {t.VOUT ?? '—'} V / {t.VGRID ?? '—'} V
        </Row>
        <Row label="Cài đặt từ">{src === 'ESP' ? 'Ứng dụng (APP)' : src === 'LOCAL' ? 'Trên máy (LOCAL)' : '—'}</Row>
        {(hasFault || Number(t.RTRY ?? 0) > 0) && <Row label="Tự chạy lại">{t.RTRY ?? 0}/5</Row>}
      </div>

      {retrying && (
        <p className="mt-3 text-xs text-amber-700">
          Quá dòng lúc đang chạy (thường do tải chỉnh lưu như máy sấy) — máy tự chạy lại sau 0,3 s, lần {rfastOf(t)}/3.
        </p>
      )}
      {hasFault && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{FLT_LABEL[flt] ?? `Lỗi ${flt}`}</p>
            {locked ? (
              <p className="mt-0.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Máy đã khóa sau 5 lần tự chạy lại — bấm "Xóa lỗi" để chạy lại.
              </p>
            ) : (
              <p className="mt-0.5">Máy sẽ tự chạy lại khi hết lỗi.</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {(hasFault || locked) &&
          btn('FAULT_RST', <RotateCcw className="w-4 h-4" />, 'col-span-2 bg-red-600 text-white hover:bg-red-700')}
        {/* Dừng từ app (STOP) mở bằng RUN; tắt bằng nút nguồn trên máy chỉ mở bằng
            POWERON (RUN cố ý không bật được máy lúc đó). */}
        {stopped
          ? btn('RUN', <Play className="w-4 h-4" />, 'col-span-2 bg-green-600 text-white hover:bg-green-700', !srcEsp)
          : powerOff
            ? btn(
                'POWERON',
                <Power className="w-4 h-4" />,
                'col-span-2 bg-green-600 text-white hover:bg-green-700',
                !srcEsp
              )
            : btn(
                'STOP',
                <Square className="w-4 h-4" />,
                'col-span-2 bg-gray-100 text-gray-700 hover:bg-gray-200',
                !srcEsp
              )}
      </div>
      {powerOff && srcEsp && (
        <p className="mt-2 text-xs text-gray-500">
          Máy được tắt bằng nút nguồn trên màn hình. "Bật máy" sẽ chạy lại đúng chế độ đang đặt. Cần bộ điều khiển
          (ESP32) từ bản 1.3.9.
        </p>
      )}
      {!srcEsp && src && (
        <p className="mt-2 text-xs text-amber-600">
          {powerOff
            ? 'Máy đang tắt bằng nút trên máy và để "Cai dat tu = MAY": chỉ bật lại được bằng nút trên máy.'
            : 'Dừng / chạy từ xa cần chọn "Cai dat tu = APP" trong menu máy.'}
        </p>
      )}
      {sent && !sending && !error && <p className="mt-2 text-xs text-green-600">Đã gửi lệnh "{CMD_LABEL[sent]}".</p>}
      {error && <p className="mt-2 text-xs text-red-600">Không gửi được lệnh, hãy thử lại.</p>}
      {cmdNak && <NakNotice nak={cmdNak} />}
    </div>
  );
}
