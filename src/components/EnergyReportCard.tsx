import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PiggyBank, TrendingDown, TrendingUp, Info } from 'lucide-react';
import { getEnergyReport } from '../services/api';
import type { MonthEnergy } from '../types';

// "Tiết kiệm" card of the chart tab: the month's kWh turned into money with
// the EVN household tariff (backend: GET /devices/:id/energy-report).

type Tariff = 'tiered' | 'flat';
const TARIFF_KEY = 'energy-report-tariff';

function loadTariff(): Tariff {
  try {
    return localStorage.getItem(TARIFF_KEY) === 'flat' ? 'flat' : 'tiered';
  } catch {
    return 'tiered';
  }
}

const vnd = (v: number) => `${Math.round(v).toLocaleString('vi-VN')} đ`;
const kwh = (v: number) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} kWh`;
const mm = (m: MonthEnergy) => `${String(m.month).padStart(2, '0')}/${m.year}`;

function Delta({ now, before, label }: { now: number; before: MonthEnergy; label: string }) {
  if (before.days === 0 || before.savings <= 0) {
    return (
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className="text-sm text-gray-400">Chưa có dữ liệu</p>
      </div>
    );
  }
  const pct = ((now - before.savings) / before.savings) * 100;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500 truncate">
        {label} ({mm(before)})
      </p>
      <p className="text-sm font-semibold text-gray-900 tabular-nums">{vnd(before.savings)}</p>
      <p className={`mt-0.5 inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-green-700' : 'text-orange-700'}`}>
        <Icon className="w-3.5 h-3.5" />
        {up ? '+' : ''}
        {pct.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%
      </p>
    </div>
  );
}

export function EnergyReportCard({
  deviceId,
  year,
  month,
}: {
  deviceId: string;
  year: number;
  month: number;
}) {
  const [tariff, setTariff] = useState<Tariff>(loadTariff);
  const [showInfo, setShowInfo] = useState(false);

  const query = useQuery({
    queryKey: ['energy-report', deviceId, year, month, tariff],
    queryFn: () => getEnergyReport(deviceId, year, month, tariff),
  });

  const pickTariff = (t: Tariff) => {
    setTariff(t);
    try {
      localStorage.setItem(TARIFF_KEY, t);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  const r = query.data;

  return (
    <div className="rounded-xl border border-green-100 bg-gradient-to-br from-green-50 to-sky-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 p-2 rounded-lg bg-white/80 text-green-600">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">Tiền điện tiết kiệm</p>
            <p className="text-xs text-gray-500">
              {r?.partial ? 'Tạm tính đến hôm nay' : 'Ước tính theo giá điện EVN'}
            </p>
          </div>
        </div>
        <div className="flex rounded-lg bg-white/70 p-0.5 text-xs font-medium">
          {(['tiered', 'flat'] as const).map((t) => (
            <button
              key={t}
              onClick={() => pickTariff(t)}
              className={`px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                tariff === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'tiered' ? 'Bậc thang' : 'Trả trước'}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div className="mt-3 h-24 rounded-lg bg-white/50 animate-pulse" />
      ) : query.error || !r ? (
        <p className="mt-3 text-sm text-red-600">
          Không tải được báo cáo.{' '}
          <button className="underline font-medium" onClick={() => query.refetch()}>
            Thử lại
          </button>
        </p>
      ) : r.days === 0 ? (
        <p className="mt-3 text-sm text-gray-500">Chưa có dữ liệu trong tháng này.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <p className="text-2xl sm:text-3xl font-bold text-green-700 tabular-nums">{vnd(r.savings)}</p>
              <p className="mt-0.5 text-xs sm:text-sm text-gray-600">
                Hoá đơn ước tính {vnd(r.billWithSolar)} thay vì {vnd(r.billWithoutSolar)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Tự cung cấp</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums">
                {r.selfSufficiency.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}%
              </p>
            </div>
          </div>

          {/* Self-sufficiency bar */}
          <div className="mt-2 h-2 rounded-full bg-white/80 overflow-hidden" aria-hidden>
            <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, r.selfSufficiency)}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {kwh(r.generatedKwh)} từ biến tần / {kwh(r.consumptionKwh)} tiêu thụ
          </p>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg bg-white/70 p-3">
            <Delta now={r.savings} before={r.previousMonth} label="Tháng trước" />
            <Delta now={r.savings} before={r.sameMonthLastYear} label="Cùng kỳ năm trước" />
            <div className="min-w-0 col-span-2 sm:col-span-1">
              <p className="text-xs text-gray-500 truncate">Từ đầu năm {r.year}</p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">{vnd(r.yearToDate.savings)}</p>
              <p className="text-xs text-gray-500">{kwh(r.yearToDate.generatedKwh)}</p>
            </div>
          </div>

          {r.bestDay && r.bestDay.kwh > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              Ngày xả nhiều nhất: <span className="font-medium">{r.bestDay.date.split('-').reverse().join('/')}</span> ·{' '}
              {kwh(r.bestDay.kwh)}
            </p>
          )}

          <button
            onClick={() => setShowInfo((v) => !v)}
            className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            aria-expanded={showInfo}
          >
            <Info className="w-3.5 h-3.5" />
            Cách tính
          </button>
          {showInfo && (
            <div className="mt-1.5 text-xs text-gray-600 space-y-1">
              <p>
                Tiết kiệm = tiền điện của toàn bộ điện tiêu thụ (xả + lấy lưới) trừ tiền điện phần lấy lưới, tính
                theo {r.tariff.mode === 'flat' ? `giá ${vnd(r.tariff.flatPrice ?? 0)}/kWh` : 'giá bậc thang'}{' '}
                ({r.tariff.source}), đã gồm VAT {r.tariff.vatPercent}%.
              </p>
              <p>Chỉ tính điện năng thiết bị này đo được, nên có thể khác hoá đơn thực tế.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
