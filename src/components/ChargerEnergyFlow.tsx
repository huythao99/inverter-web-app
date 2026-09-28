import { Thermometer, Zap } from 'lucide-react';
import type { ChargerLatest } from '../types';
import solarIcon from '../assets/energy/icon_solar_panel.svg';
import mpptIcon from '../assets/energy/icon_mppt.svg';
import batteryIcon from '../assets/energy/icon_storage_battery.svg';

// "Luồng năng lượng" card of the charger: solar -> MPPT -> battery, with an
// animated dot on each link while power flows (same look as the app, which
// uses orange_loading.gif / blue_loading.gif).

const n = (v?: string) => {
  const x = parseFloat(v ?? '');
  return Number.isFinite(x) ? x : 0;
};
const pos = (v?: string) => Math.max(0, n(v));
const ACTIVE_W = 5;

type Status = { label: string; dot: string; pill: string };

function chargerFlowStatus(latest: ChargerLatest | undefined, online: boolean): Status {
  const ppv = pos(latest?.ppv);
  const pbat = pos(latest?.vbat) * pos(latest?.ibat);
  const flt = (latest?.flt ?? '0').trim();
  if (!online) return { label: 'Mất kết nối', dot: 'bg-gray-400', pill: 'bg-gray-100 text-gray-500 border-gray-200' };
  if (flt && flt !== '0') return { label: 'Có lỗi', dot: 'bg-red-500', pill: 'bg-red-50 text-red-600 border-red-200' };
  if (pbat >= ACTIVE_W) return { label: 'Đang sạc', dot: 'bg-green-500', pill: 'bg-green-50 text-green-700 border-green-200' };
  if (ppv < ACTIVE_W) return { label: 'Chờ nắng', dot: 'bg-amber-400', pill: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Không sạc', dot: 'bg-gray-400', pill: 'bg-gray-50 text-gray-600 border-gray-200' };
}

function FlowLink({ active, color }: { active: boolean; color: 'orange' | 'blue' }) {
  const c = color === 'orange' ? '#f59e0b' : '#3b82f6';
  return (
    <div className="relative flex-1 h-6 min-w-[24px]" aria-hidden>
      <div
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
        style={{ background: active ? `${c}55` : '#e5e7eb' }}
      />
      {active ? (
        <span
          className="energy-flow-dot absolute top-1/2 w-2.5 h-2.5 rounded-full"
          style={{ background: c, boxShadow: `0 0 0 4px ${c}33` }}
        />
      ) : (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-300" />
      )}
    </div>
  );
}

function Node({
  icon,
  ring,
  children,
}: {
  icon: string;
  ring: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`shrink-0 grid place-items-center rounded-full bg-white border-[3px] ${ring} w-[72px] h-[72px] sm:w-[88px] sm:h-[88px]`}
    >
      <div className="flex flex-col items-center">
        <img src={icon} alt="" className={children ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} />
        {children}
      </div>
    </div>
  );
}

function Side({
  title,
  watts,
  v,
  a,
  color,
}: {
  title: string;
  watts: number;
  v: number;
  a: number;
  color: 'orange' | 'blue';
}) {
  const text = color === 'orange' ? 'text-amber-500' : 'text-blue-600';
  const bar = color === 'orange' ? 'bg-amber-400' : 'bg-blue-500';
  return (
    <div className="flex flex-col items-center gap-2 min-w-0">
      <p className="text-xs sm:text-sm font-semibold tracking-widest text-gray-400 uppercase">{title}</p>
      <div className="relative w-full max-w-[140px] rounded-xl bg-white border border-gray-100 shadow-sm pt-1.5 pb-1 text-center">
        <span className={`absolute left-3 right-3 top-0 h-1 rounded-b ${bar}`} />
        <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${text}`}>{Math.round(watts)}</span>
        <span className="ml-1 text-sm text-gray-500">W</span>
      </div>
      <div className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap">
        <span className="text-gray-700">{v.toFixed(1)}V</span>
        <span className="mx-1.5 text-gray-300">|</span>
        <span className="text-gray-400">{a.toFixed(1)}A</span>
      </div>
    </div>
  );
}

export function ChargerEnergyFlow({
  latest,
  online,
}: {
  latest?: ChargerLatest;
  online: boolean;
}) {
  const vpv = pos(latest?.vpv);
  const ipv = pos(latest?.ipv);
  const ppv = pos(latest?.ppv) || vpv * ipv;
  const vbat = pos(latest?.vbat);
  const ibat = pos(latest?.ibat);
  const pbat = vbat * ibat;
  const temp = n(latest?.temp);
  const eff = ppv >= 20 ? Math.min(100, (pbat / ppv) * 100) : null;
  const status = chargerFlowStatus(latest, online);
  const solarOn = online && ppv >= ACTIVE_W;
  const batOn = online && pbat >= ACTIVE_W;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 px-3 py-5 sm:p-6">
      <p className="text-center text-base sm:text-lg font-semibold tracking-[0.2em] text-gray-400 uppercase">
        Luồng năng lượng
      </p>
      <div className="mt-3 flex justify-center">
        <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold ${status.pill}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${status.dot} ${batOn ? 'animate-pulse' : ''}`} />
          {status.label}
        </span>
      </div>

      {/* Last known values stay visible but dimmed while offline. */}
      <div className={online ? '' : 'opacity-50 grayscale'}>
      <div className="mt-5 flex items-center">
        <Node icon={solarIcon} ring="border-amber-400" />
        <FlowLink active={solarOn} color="orange" />
        <div className="flex flex-col items-center">
          <Node icon={mpptIcon} ring="border-gray-200">
            <span className="text-[10px] sm:text-xs font-semibold text-gray-400 leading-tight">MPPT</span>
            <span className="text-sm sm:text-base font-bold text-blue-600 leading-tight tabular-nums">
              {Math.round(pbat)} W
            </span>
          </Node>
        </div>
        <FlowLink active={batOn} color="blue" />
        <Node icon={batteryIcon} ring="border-blue-500" />
      </div>
      <div className="mt-2 flex justify-center gap-3 text-xs sm:text-sm font-semibold text-gray-500 tabular-nums">
        <span className="inline-flex items-center gap-0.5">
          <Thermometer className="w-3.5 h-3.5" />
          {latest?.temp ? `${Math.round(temp)}°` : '--'}
        </span>
        {eff !== null && (
          <span className="inline-flex items-center gap-0.5" title="Hiệu suất chuyển đổi">
            <Zap className="w-3.5 h-3.5" />
            {Math.round(eff)}%
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Side title="Solar" watts={ppv} v={vpv} a={ipv} color="orange" />
        <Side title="Lưu trữ" watts={pbat} v={vbat} a={ibat} color="blue" />
      </div>
      </div>
    </div>
  );
}
