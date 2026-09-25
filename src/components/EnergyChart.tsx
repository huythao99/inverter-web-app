import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getDeviceChartData } from '../services/api';
import { LoadingSpinner } from './LoadingSpinner';

// Monthly energy chart of an inverter (same data as the mobile "Biểu đồ"
// page: GET /api/user/devices/:id/chart-data). One stacked column per day:
// discharged (totalA) + taken from the grid (totalA2) = consumed.

// Validated categorical slots 1 + 2 (dataviz reference palette, light).
const COLOR_DISCHARGE = '#2a78d6';
const COLOR_GRID = '#eb6834';

// Server days are GMT+7 regardless of the browser's timezone.
function nowGmt7() {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const fmt = (v: number) => v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });

// "Nice" axis maximum + step (1/2/2.5/5 x 10^n) for ~4 grid lines.
function niceScale(max: number) {
  if (max <= 0) return { top: 1, step: 0.25 };
  const raw = max / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  return { top: Math.ceil(max / step) * step, step };
}

// Width of the chart container (the SVG is drawn in real pixels so text
// never stretches).
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

interface DayRow {
  day: number;
  date: string; // YYYY-MM-DD
  discharge: number;
  grid: number;
  hasData: boolean;
}

export function EnergyChart({ deviceId }: { deviceId: string }) {
  const today = nowGmt7();
  const [ym, setYm] = useState({ year: today.year, month: today.month });
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const isCurrentMonth = ym.year === today.year && ym.month === today.month;

  const query = useQuery({
    queryKey: ['device-chart', deviceId, ym.year, ym.month],
    queryFn: () => getDeviceChartData(deviceId, ym.year, ym.month),
  });

  const rows: DayRow[] = useMemo(() => {
    const byDate = new Map((query.data ?? []).map((p) => [p.date.slice(0, 10), p]));
    const n = daysInMonth(ym.year, ym.month);
    return Array.from({ length: n }, (_, i) => {
      const day = i + 1;
      const date = `${ym.year}-${String(ym.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const p = byDate.get(date);
      return {
        day,
        date,
        discharge: Math.max(0, p?.totalA ?? 0),
        grid: Math.max(0, p?.totalA2 ?? 0),
        hasData: !!p,
      };
    });
  }, [query.data, ym.year, ym.month]);

  const sumDischarge = rows.reduce((s, r) => s + r.discharge, 0);
  const sumGrid = rows.reduce((s, r) => s + r.grid, 0);
  const daysWithData = rows.filter((r) => r.hasData).length;

  const shiftMonth = (delta: number) => {
    setYm(({ year, month }) => {
      const m = month + delta;
      if (m < 1) return { year: year - 1, month: 12 };
      if (m > 12) return { year: year + 1, month: 1 };
      return { year, month: m };
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls: month + view, one row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Tháng trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[88px] text-center text-sm font-semibold text-gray-900 whitespace-nowrap">
            Tháng {String(ym.month).padStart(2, '0')}/{ym.year}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            disabled={isCurrentMonth}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Tháng sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
            {(['chart', 'table'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v === 'chart' ? 'Biểu đồ' : 'Bảng'}
              </button>
            ))}
          </div>
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

      {/* Month totals */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Xả" value={sumDischarge} color={COLOR_DISCHARGE} />
        <Stat label="Lấy lưới" value={sumGrid} color={COLOR_GRID} />
        <Stat label="Tiêu thụ" value={sumDischarge + sumGrid} />
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : query.error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center text-sm text-red-700">
          Không tải được dữ liệu biểu đồ.{' '}
          <button onClick={() => query.refetch()} className="underline font-medium">
            Thử lại
          </button>
        </div>
      ) : daysWithData === 0 ? (
        <div className="rounded-lg bg-gray-50 border border-gray-200 py-12 text-center text-sm text-gray-500">
          Chưa có dữ liệu trong tháng {String(ym.month).padStart(2, '0')}/{ym.year}.
        </div>
      ) : view === 'chart' ? (
        <StackedDays rows={rows} />
      ) : (
        <DaysTable rows={rows} />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl bg-white/70 border border-gray-100 px-2.5 sm:px-3 py-2.5 min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        {color && <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-sm sm:text-base font-bold text-gray-900 tabular-nums">
        <span>{fmt(value)}</span>
        <span className="text-xs font-medium text-gray-500">kWh</span>
      </p>
    </div>
  );
}

const PAD = { top: 12, right: 8, bottom: 24, left: 40 };
const HEIGHT = 240;

function StackedDays({ rows }: { rows: DayRow[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...rows.map((r) => r.discharge + r.grid));
  const { top, step } = niceScale(max);
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = rows.length ? plotW / rows.length : 0;
  const barW = Math.max(2, Math.min(18, slot - 2)); // >= 2px gap between bars
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  // Label every day when there is room, otherwise 1, 5, 10, ... and the last.
  const labelDay = (d: number) =>
    slot >= 22 || d === 1 || d === rows.length || (d % 5 === 0 && rows.length - d >= 2);

  const h = hover != null ? rows[hover] : null;
  // Tooltip beside the hovered column (never over it): right of it in the
  // left half, left of it in the right half.
  const colX = hover != null ? PAD.left + slot * hover : 0;
  const tipOnRight = hover != null && hover < rows.length / 2;

  return (
    <div>
      {/* Legend (2 series) */}
      <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
        <LegendItem color={COLOR_DISCHARGE} label="Năng lượng xả" />
        <LegendItem color={COLOR_GRID} label="Lấy lưới" />
        <span className="ml-auto text-gray-400">kWh / ngày</span>
      </div>

      <div ref={ref} className="relative w-full select-none" style={{ height: HEIGHT }}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label="Năng lượng theo ngày trong tháng">
            {/* Grid + y labels (recessive) */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? '#d4d4d0' : '#ecebe8'}
                  strokeWidth={1}
                />
                <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#6b6a66">
                  {fmt(t)}
                </text>
              </g>
            ))}

            {rows.map((r, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const x = cx - barW / 2;
              const total = r.discharge + r.grid;
              const yTop = y(total);
              const yMid = y(r.discharge);
              const base = y(0);
              // 2px surface gap between the two segments when both are visible.
              const gap = base - yMid >= 3 && yMid - yTop >= 3 ? 2 : 0;
              const dim = hover != null && hover !== i;
              return (
                <g key={r.day} opacity={dim ? 0.45 : 1}>
                  {r.discharge > 0 && (
                    <Bar
                      x={x}
                      y={yMid}
                      w={barW}
                      h={base - yMid}
                      color={COLOR_DISCHARGE}
                      roundTop={r.grid <= 0}
                    />
                  )}
                  {r.grid > 0 && (
                    <Bar x={x} y={yTop} w={barW} h={yMid - yTop - gap} color={COLOR_GRID} roundTop />
                  )}
                  {labelDay(r.day) && (
                    <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill="#6b6a66">
                      {r.day}
                    </text>
                  )}
                  {/* Hit target: whole column, wider than the bar */}
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

        {/* Tooltip */}
        {h && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-white shadow-lg border border-gray-200 px-3 py-2 text-xs"
            style={
              tipOnRight
                ? { top: 0, left: colX + slot + 6 }
                : { top: 0, right: width - colX + 6 }
            }
          >
            <p className="font-semibold text-gray-900 mb-1">
              {h.date.slice(8, 10)}/{h.date.slice(5, 7)}/{h.date.slice(0, 4)}
            </p>
            {h.hasData ? (
              <>
                <TipRow color={COLOR_DISCHARGE} label="Xả" value={h.discharge} />
                <TipRow color={COLOR_GRID} label="Lấy lưới" value={h.grid} />
                <div className="mt-1 pt-1 border-t border-gray-100">
                  <TipRow label="Tiêu thụ" value={h.discharge + h.grid} bold />
                </div>
              </>
            ) : (
              <p className="text-gray-500">Không có dữ liệu</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Rect with 4px rounded top corners (the data end); flat on the baseline.
function Bar({
  x,
  y,
  w,
  h,
  color,
  roundTop,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  roundTop: boolean;
}) {
  if (h <= 0) return null;
  const r = roundTop ? Math.min(4, w / 2, h) : 0;
  const d = `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
  return <path d={d} fill={color} />;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

function TipRow({
  color,
  label,
  value,
  bold,
}: {
  color?: string;
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      {color ? (
        <span className="inline-block w-2 h-2 rounded-sm" style={{ background: color }} />
      ) : (
        <span className="inline-block w-2" />
      )}
      <span className="text-gray-600">{label}</span>
      <span className={`ml-auto tabular-nums text-gray-900 ${bold ? 'font-semibold' : ''}`}>
        {fmt(value)} kWh
      </span>
    </div>
  );
}

function DaysTable({ rows }: { rows: DayRow[] }) {
  const withData = rows.filter((r) => r.hasData);
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Ngày</th>
            <th className="px-3 py-2 text-right font-medium">Xả (kWh)</th>
            <th className="px-3 py-2 text-right font-medium">Lấy lưới (kWh)</th>
            <th className="px-3 py-2 text-right font-medium">Tiêu thụ (kWh)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white/60">
          {withData.map((r) => (
            <tr key={r.date}>
              <td className="px-3 py-2 text-gray-900">
                {r.date.slice(8, 10)}/{r.date.slice(5, 7)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(r.discharge)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmt(r.grid)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{fmt(r.discharge + r.grid)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
