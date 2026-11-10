import { Home, Thermometer, UtilityPole, Fan } from 'lucide-react';
import type { HybridLatest } from '../types';
import { IST_LABEL, num } from '../services/hinvlf';
import batteryIcon from '../assets/energy/icon_storage_battery.svg';

// "Luồng năng lượng" của hybrid: Pin ⇄ Inverter ⇄ Lưới, Inverter → Nhà.
// PINV: + xả pin, − sạc pin. PGRID (qua CT): + lấy lưới, − đẩy lưới.
// Tải trong nhà ≈ PINV + PGRID (không có CT thì PGRID ≈ 0).

const ACTIVE_W = 10;

function Link({ watts, reverse, color }: { watts: number; reverse: boolean; color: string }) {
  const active = Math.abs(watts) >= ACTIVE_W;
  return (
    <div className="relative flex-1 h-6 min-w-[20px]" aria-hidden>
      <div
        className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
        style={{ background: active ? `${color}55` : '#e5e7eb' }}
      />
      {active ? (
        <span
          className="energy-flow-dot absolute top-1/2 w-2.5 h-2.5 rounded-full"
          style={{
            background: color,
            boxShadow: `0 0 0 4px ${color}33`,
            animationDirection: reverse ? 'reverse' : 'normal',
          }}
        />
      ) : (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-300" />
      )}
    </div>
  );
}

/** Vertical link inverter -> home, same look as Link (dot moving down). */
function VLink({ watts, color }: { watts: number; color: string }) {
  const active = Math.abs(watts) >= ACTIVE_W;
  return (
    <div className="relative w-6 h-10 sm:h-12" aria-hidden>
      <div
        className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] rounded-full"
        style={{ background: active ? `${color}55` : '#e5e7eb' }}
      />
      {active ? (
        <span
          className="energy-flow-dot-v absolute left-1/2 w-2.5 h-2.5 rounded-full"
          style={{ background: color, boxShadow: `0 0 0 4px ${color}33` }}
        />
      ) : (
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-300" />
      )}
    </div>
  );
}

function Node({ ring, big, children }: { ring: string; big?: boolean; children: React.ReactNode }) {
  // The inverter (middle) is larger: it shows a power value up to 5 digits.
  const size = big ? 'w-[76px] h-[76px] sm:w-[96px] sm:h-[96px]' : 'w-[64px] h-[64px] sm:w-[80px] sm:h-[80px]';
  return (
    <div className={`shrink-0 grid place-items-center rounded-full bg-white border-[3px] ${ring} ${size}`}>
      <div className="flex flex-col items-center">{children}</div>
    </div>
  );
}

function Value({ title, watts, sub, cls }: { title: string; watts: number | undefined; sub: string; cls: string }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-0 rounded-xl bg-white border border-gray-100 shadow-sm px-2 py-2">
      <p className="text-[11px] sm:text-xs font-semibold tracking-wider text-gray-400 uppercase">{title}</p>
      <p className={`text-xl sm:text-2xl font-bold tabular-nums ${cls}`}>
        {watts === undefined ? '--' : Math.round(Math.abs(watts))}
        <span className="ml-1 text-xs font-medium text-gray-500">W</span>
      </p>
      <p className="text-[11px] sm:text-xs text-gray-500 text-center leading-tight">{sub}</p>
    </div>
  );
}

/**
 * Inverter power inside its circle: up to 4 digits "802W" / "4520W"; from
 * 10 kW "12.3kW"; a smaller font for 5-character values so nothing overflows.
 */
function InverterPower({ watts }: { watts: number | undefined }) {
  if (watts === undefined) {
    return <span className="text-sm sm:text-base font-bold text-gray-800 leading-tight">--</span>;
  }
  const w = Math.round(Math.abs(watts));
  const text = w >= 10000 ? `${(w / 1000).toFixed(w >= 100000 ? 0 : 1)}kW` : `${w}W`;
  const size = text.length > 5 ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';
  return (
    <span className={`${size} font-bold text-gray-800 tabular-nums leading-tight whitespace-nowrap`}>{text}</span>
  );
}

export function HybridEnergyFlow({ latest, online }: { latest?: HybridLatest; online: boolean }) {
  const t = latest?.tlm ?? {};
  const pinv = num(t.PINV);
  const pgrid = num(t.PGRID);
  const load = pinv !== undefined ? Math.max(0, pinv + (pgrid ?? 0)) : undefined;
  const gridOk = t.GRID === '1';
  const vbat = num(t.VBAT);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 px-3 py-5 sm:p-6">
      <p className="text-center text-base sm:text-lg font-semibold tracking-[0.2em] text-gray-400 uppercase">
        Luồng năng lượng
      </p>
      <p className="mt-1 text-center text-sm text-gray-500">{IST_LABEL[t.IST ?? ''] ?? t.IST ?? '—'}</p>

      <div className={online ? '' : 'opacity-50 grayscale'}>
        <div className="mt-4 flex items-center">
          <Node ring="border-blue-500">
            <img src={batteryIcon} alt="" className="w-7 h-7 sm:w-9 sm:h-9" />
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 tabular-nums">
              {vbat !== undefined ? `${vbat.toFixed(1)}V` : '--'}
            </span>
          </Node>
          {/* + xả: pin → inverter; − sạc: inverter → pin */}
          <Link watts={pinv ?? 0} reverse={(pinv ?? 0) < 0} color="#3b82f6" />
          <Node ring="border-gray-200" big>
            <span className="text-[10px] sm:text-xs font-semibold text-gray-400 leading-tight">INVERTER</span>
            <InverterPower watts={pinv} />
          </Node>
          {/* + lấy lưới: lưới → inverter (ngược chiều); − đẩy lưới: inverter → lưới */}
          <Link watts={pgrid ?? 0} reverse={(pgrid ?? 0) > 0} color="#10b981" />
          <Node ring={gridOk ? 'border-emerald-500' : 'border-gray-300'}>
            <UtilityPole className={`w-7 h-7 sm:w-9 sm:h-9 ${gridOk ? 'text-emerald-600' : 'text-gray-400'}`} />
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 tabular-nums">
              {t.VGRID ? `${Math.round(num(t.VGRID) ?? 0)}V` : '--'}
            </span>
          </Node>
        </div>
        <div className="flex justify-center">
          <VLink watts={load ?? 0} color="#f59e0b" />
        </div>
        <div className="flex justify-center">
          <Node ring="border-amber-400">
            <Home className="w-7 h-7 sm:w-9 sm:h-9 text-amber-500" />
            <span className="text-[10px] sm:text-xs font-semibold text-gray-500 tabular-nums">
              {t.VOUT ? `${Math.round(num(t.VOUT) ?? 0)}V` : '--'}
            </span>
          </Node>
        </div>

        <div className="mt-2 flex justify-center gap-3 text-xs sm:text-sm font-semibold text-gray-500 tabular-nums">
          <span className="inline-flex items-center gap-0.5" title="Nhiệt MOSFET / biến áp">
            <Thermometer className="w-3.5 h-3.5" />
            {t.T ? `${Math.round(num(t.T) ?? 0)}°` : '--'} / {t.T2 ? `${Math.round(num(t.T2) ?? 0)}°` : '--'}
          </span>
          <span className="inline-flex items-center gap-0.5" title="Quạt">
            <Fan className="w-3.5 h-3.5" />
            {t.FAN ? `${t.FAN}%` : '--'}
          </span>
          {t.F && <span title="Tần số">{num(t.F)?.toFixed(2)} Hz</span>}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Value
            title="Pin"
            watts={pinv}
            sub={pinv === undefined ? '' : pinv >= ACTIVE_W ? 'Đang xả' : pinv <= -ACTIVE_W ? 'Đang sạc' : 'Nghỉ'}
            cls="text-blue-600"
          />
          <Value
            title="Lưới"
            watts={pgrid}
            sub={pgrid === undefined ? '' : pgrid >= ACTIVE_W ? 'Đang lấy lưới' : pgrid <= -ACTIVE_W ? 'Đang đẩy lưới' : gridOk ? 'Có lưới' : 'Không có lưới'}
            cls="text-emerald-600"
          />
          <Value title="Nhà" watts={load} sub="Ước tính" cls="text-amber-500" />
        </div>
      </div>
    </div>
  );
}
