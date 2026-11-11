import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { HybridEnergy } from '../../types';
import { kwh } from '../../services/hinvlf';
import { CARD } from './styles';

/** Điện năng hôm nay / tháng này / tổng (ETOT). */
type EnergyPeriod = 'today' | 'month' | 'total';

export function HybridEnergyCard({
  energy,
  loading,
  onRefresh,
  refreshing,
}: {
  energy?: HybridEnergy;
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [period, setPeriod] = useState<EnergyPeriod>('today');
  // "Tổng" = lifetime counters in the STM32 flash ($ETOT): only machines on
  // protocol v1.1 send them.
  const hasTotal = !!energy?.total;
  const shown =
    period === 'month' ? energy?.month : period === 'total' ? energy?.total ?? undefined : energy?.today;
  const items = [
    { label: 'Pin xả', v: shown?.edis, cls: 'text-blue-600' },
    { label: 'Pin sạc', v: shown?.echg, cls: 'text-blue-400' },
    { label: 'Lấy lưới', v: shown?.eimp, cls: 'text-emerald-600' },
    { label: 'Đẩy lưới', v: shown?.eexp, cls: 'text-emerald-400' },
  ];
  const tabs: { k: EnergyPeriod; label: string }[] = [
    { k: 'today', label: 'Hôm nay' },
    { k: 'month', label: 'Tháng này' },
    ...(hasTotal ? [{ k: 'total' as const, label: 'Tổng' }] : []),
  ];
  return (
    <div className={`${CARD} p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h4 className="text-base font-semibold text-gray-900">Điện năng</h4>
        <div className="ml-auto inline-flex rounded-lg bg-gray-100 p-0.5 text-xs">
          {tabs.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setPeriod(t.k)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                period === t.k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          aria-label="Làm mới"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl bg-gray-50 p-3 text-center">
            <p className="text-xs text-gray-500">{it.label}</p>
            <p className={`text-lg font-bold tabular-nums ${it.cls}`}>
              {loading ? '…' : kwh(it.v ?? 0)}
              <span className="ml-1 text-xs font-medium text-gray-500">kWh</span>
            </p>
          </div>
        ))}
      </div>
      {period === 'total' && (
        <p className="mt-2 text-xs text-gray-400">
          Tổng từ lúc xuất xưởng, máy tự lưu (không mất khi mất điện).
          {energy?.totalAt ? ` Cập nhật ${new Date(energy.totalAt).toLocaleString('vi-VN')}.` : ''}
        </p>
      )}
    </div>
  );
}
