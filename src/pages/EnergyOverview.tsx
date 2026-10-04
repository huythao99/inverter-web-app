import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Info, PiggyBank, RefreshCw } from 'lucide-react';
import { Layout } from '../components/Layout';
import { OverviewTabs } from '../components/OverviewTabs';
import { SlidingSegmented } from '../components/SlidingSegmented';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { getEnergyOverview } from '../services/api';
import type { OverviewPeriod } from '../types';

// "Tổng quan" tab: energy of every inverter the user owns (shared devices are
// not counted). Backend: GET /api/user/energy-overview.

const COLOR_DISCHARGE = '#2a78d6';
const COLOR_GRID = '#eb6834';

type Period = 'today' | 'month' | 'year' | 'lifetime';
type Tariff = 'tiered' | 'flat';
const TARIFF_KEY = 'energy-report-tariff'; // same choice as the device report
const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'month', label: 'Tháng' },
  { id: 'year', label: 'Năm' },
  { id: 'lifetime', label: 'Tổng' },
];

function loadTariff(): Tariff {
  try {
    return localStorage.getItem(TARIFF_KEY) === 'flat' ? 'flat' : 'tiered';
  } catch {
    return 'tiered';
  }
}

function saveTariff(t: Tariff) {
  try {
    localStorage.setItem(TARIFF_KEY, t);
  } catch {
    // private mode: the choice just isn't remembered
  }
}

function nowGmt7() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

const kwh = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
const vnd = (v: number) => `${Math.round(v).toLocaleString('vi-VN')} đ`;
const pct = (v: number) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export function EnergyOverview() {
  const now = nowGmt7();
  const [period, setPeriod] = useState<Period>('today');
  const [ym, setYm] = useState(now);
  const [tariff, setTariff] = useState<Tariff>(loadTariff);

  const query = useQuery({
    queryKey: ['energy-overview', ym.year, ym.month, tariff],
    queryFn: () => getEnergyOverview(ym.year, ym.month, tariff),
    // Today is live: refresh while it is on screen.
    refetchInterval: period === 'today' ? 30_000 : false,
  });
  const o = query.data;

  const isNow =
    period === 'year' ? ym.year >= now.year : ym.year > now.year || (ym.year === now.year && ym.month >= now.month);
  const shift = (delta: number) =>
    setYm(({ year, month }) => {
      if (period === 'year') return { year: year + delta, month };
      const idx = year * 12 + month - 1 + delta;
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
    });

  const data: OverviewPeriod | undefined = o ? o[period] : undefined;
  const title = !o
    ? ''
    : period === 'today'
      ? `Hôm nay, ${dmy(o.today.date)}`
      : period === 'month'
        ? `Tháng ${String(ym.month).padStart(2, '0')}/${ym.year}`
        : period === 'year'
          ? `Năm ${ym.year}`
          : o.lifetime.since
            ? `Từ ${dmy(o.lifetime.since)} đến nay`
            : 'Từ trước tới nay';

  return (
    <Layout>
      <div className="space-y-5">
        <OverviewTabs />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tổng quan sản lượng</h1>
            <p className="text-sm text-gray-500">
              {o ? `${o.devices.length} thiết bị của bạn` : 'Tất cả thiết bị của bạn'} · không tính thiết bị được chia sẻ
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SlidingSegmented
              value={tariff}
              options={[
                { id: 'tiered', label: 'Bậc thang' },
                { id: 'flat', label: 'Trả trước' },
              ]}
              onChange={(t) => {
                setTariff(t);
                saveTariff(t);
              }}
            />
            <button
              onClick={() => query.refetch()}
              disabled={query.isFetching}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-50"
              aria-label="Tải lại"
            >
              <RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <SlidingSegmented value={period} options={PERIODS} onChange={setPeriod} />
          {(period === 'month' || period === 'year') && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => shift(-1)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label={period === 'year' ? 'Năm trước' : 'Tháng trước'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="min-w-[96px] text-center text-sm font-semibold text-gray-900 whitespace-nowrap">
                {period === 'year' ? `Năm ${ym.year}` : `Tháng ${String(ym.month).padStart(2, '0')}/${ym.year}`}
              </span>
              <button
                onClick={() => shift(1)}
                disabled={isNow}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label={period === 'year' ? 'Năm sau' : 'Tháng sau'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {query.isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : query.error || !o || !data ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center text-sm text-red-700">
            Không tải được dữ liệu tổng quan.{' '}
            <button onClick={() => query.refetch()} className="underline font-medium">
              Thử lại
            </button>
          </div>
        ) : o.devices.length === 0 ? (
          <div className="rounded-xl bg-white border border-gray-200 py-14 text-center text-sm text-gray-500">
            Bạn chưa có thiết bị hoà lưới nào.{' '}
            <Link to="/add-device" className="text-blue-600 font-medium hover:underline">
              Thêm thiết bị
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <Kpis data={data} />

            {period === 'month' && (
              <Card title="Theo ngày" unit="kWh / ngày">
                <StackedBars
                  bars={o.month.days.map((d) => ({
                    label: String(Number(d.date.slice(8, 10))),
                    title: dmy(d.date),
                    a: d.generatedKwh,
                    b: d.gridKwh,
                  }))}
                  sparseLabels
                />
              </Card>
            )}
            {period === 'year' && (
              <Card title="Theo tháng" unit="kWh / tháng">
                <StackedBars
                  bars={o.year.months.map((m) => ({
                    label: `T${m.month}`,
                    title: `Tháng ${String(m.month).padStart(2, '0')}/${o.year.year}`,
                    a: m.generatedKwh,
                    b: m.gridKwh,
                    extra: m.savings > 0 ? `Tiết kiệm ${vnd(m.savings)}` : undefined,
                  }))}
                />
              </Card>
            )}

            <Card title="Tỉ trọng từng thiết bị" unit="theo sản lượng xả">
              <DeviceShares data={data} />
            </Card>

            <p className="flex items-start gap-1.5 text-xs text-gray-500">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Tiết kiệm ước tính theo{' '}
                {o.tariff.mode === 'flat' ? `giá ${vnd(o.tariff.flatPrice ?? 0)}/kWh` : 'giá bậc thang'} (
                {o.tariff.source}), đã gồm VAT {o.tariff.vatPercent}%, mỗi thiết bị tính như một công tơ riêng.
                {period === 'today' && ' Số liệu hôm nay tự cập nhật mỗi 30 giây.'}
              </span>
            </p>
          </>
        )}
      </div>
    </Layout>
  );
}

function Card({ title, unit, children }: { title: string; unit?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white border border-gray-200 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
      {children}
    </section>
  );
}

function Kpis({ data }: { data: OverviewPeriod }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi label="Sản lượng xả" value={kwh(data.generatedKwh)} unit="kWh" color={COLOR_DISCHARGE} />
      <Kpi label="Lấy lưới" value={kwh(data.gridKwh)} unit="kWh" color={COLOR_GRID} />
      <Kpi
        label="Tiêu thụ"
        value={kwh(data.consumptionKwh)}
        unit="kWh"
        note={data.consumptionKwh > 0 ? `Tự cung cấp ${pct(data.selfSufficiency)}` : undefined}
      />
      <Kpi label="Tiết kiệm" value={Math.round(data.savings).toLocaleString('vi-VN')} unit="đ" icon />
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  color,
  note,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  color?: string;
  note?: string;
  icon?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white border border-gray-200 px-4 py-3 min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {color && <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />}
        {icon && <PiggyBank className="w-3.5 h-3.5 text-green-600" />}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">
        <span>{value}</span>
        <span className="text-xs sm:text-sm font-medium text-gray-500">{unit}</span>
      </p>
      {note && <p className="mt-0.5 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

function DeviceShares({ data }: { data: OverviewPeriod }) {
  const max = Math.max(0, ...data.devices.map((d) => d.generatedKwh));
  return (
    <ul className="space-y-3">
      {data.devices.map((d) => (
        <li key={d.deviceId}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <Link to={`/devices/${encodeURIComponent(d.deviceId)}`} className="font-medium text-gray-900 hover:text-blue-700 truncate">
              {d.name}
            </Link>
            <span className="shrink-0 tabular-nums text-gray-900">
              <span className="font-semibold">{kwh(d.generatedKwh)}</span>
              <span className="text-gray-500"> kWh · {pct(d.sharePercent)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: max > 0 ? `${(d.generatedKwh / max) * 100}%` : 0, background: COLOR_DISCHARGE }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 tabular-nums">
            Lấy lưới {kwh(d.gridKwh)} kWh · Tiết kiệm {vnd(d.savings)}
          </p>
        </li>
      ))}
    </ul>
  );
}

// ---- Stacked column chart (xả + lấy lưới) --------------------------------

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceScale(max: number) {
  if (max <= 0) return { top: 1, step: 0.25 };
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return { top: Math.ceil(max / step) * step, step };
}

interface BarDatum {
  label: string;
  title: string;
  a: number;
  b: number;
  extra?: string;
}

const PAD = { top: 12, right: 8, bottom: 24, left: 44 };
const HEIGHT = 240;

function StackedBars({ bars, sparseLabels }: { bars: BarDatum[]; sparseLabels?: boolean }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...bars.map((r) => r.a + r.b));
  const { top, step } = niceScale(max);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = bars.length ? plotW / bars.length : 0;
  const barW = Math.max(2, Math.min(28, slot - 3));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const showLabel = (i: number) =>
    !sparseLabels || slot >= 22 || i === 0 || i === bars.length - 1 || ((i + 1) % 5 === 0 && bars.length - i > 2);
  const h = hover != null ? bars[hover] : null;
  const colX = hover != null ? PAD.left + slot * hover : 0;
  const tipOnRight = hover != null && hover < bars.length / 2;

  if (max <= 0) {
    return <p className="py-10 text-center text-sm text-gray-500">Chưa có dữ liệu trong khoảng này.</p>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
        <Legend color={COLOR_DISCHARGE} label="Xả" />
        <Legend color={COLOR_GRID} label="Lấy lưới" />
      </div>
      <div ref={ref} className="relative w-full select-none" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Biểu đồ sản lượng">
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? '#d4d4d0' : '#ecebe8'}
                />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#6b6a66">
                  {kwh(t)}
                </text>
              </g>
            ))}
            {bars.map((r, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const x = cx - barW / 2;
              const base = y(0);
              const yMid = y(r.a);
              const yTop = y(r.a + r.b);
              const gap = base - yMid >= 3 && yMid - yTop >= 3 ? 2 : 0;
              return (
                <g key={i} opacity={hover != null && hover !== i ? 0.45 : 1}>
                  {r.a > 0 && <Bar x={x} y={yMid} w={barW} h={base - yMid} color={COLOR_DISCHARGE} roundTop={r.b <= 0} />}
                  {r.b > 0 && <Bar x={x} y={yTop} w={barW} h={yMid - yTop - gap} color={COLOR_GRID} roundTop />}
                  {showLabel(i) && (
                    <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="#6b6a66">
                      {r.label}
                    </text>
                  )}
                  <rect
                    x={PAD.left + slot * i}
                    y={PAD.top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setHover(hover === i ? null : i)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {h && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-white shadow-lg border border-gray-200 px-3 py-2 text-xs"
            style={tipOnRight ? { top: 0, left: colX + slot + 6 } : { top: 0, right: width - colX + 6 }}
          >
            <p className="font-semibold text-gray-900 mb-1">{h.title}</p>
            <TipRow color={COLOR_DISCHARGE} label="Xả" value={`${kwh(h.a)} kWh`} />
            <TipRow color={COLOR_GRID} label="Lấy lưới" value={`${kwh(h.b)} kWh`} />
            <div className="mt-1 pt-1 border-t border-gray-100">
              <TipRow label="Tiêu thụ" value={`${kwh(h.a + h.b)} kWh`} />
              {h.extra && <p className="mt-0.5 text-green-700">{h.extra}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Bar({ x, y, w, h, color, roundTop }: { x: number; y: number; w: number; h: number; color: string; roundTop: boolean }) {
  if (h <= 0) return null;
  const r = roundTop ? Math.min(4, w / 2, h) : 0;
  const d = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
  return <path d={d} fill={color} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 min-w-[150px]">
      {color ? <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} /> : <span className="inline-block w-2" />}
      <span className="text-gray-600">{label}</span>
      <span className="ml-auto tabular-nums text-gray-900">{value}</span>
    </div>
  );
}

