import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, CircleDot, Info, Wrench } from 'lucide-react';
import { Layout } from '../components/Layout';
import { TOROID, toroid, type CoreQuality } from '../services/toroid';

/**
 * "Công cụ": small calculators for installers / DIY users. /tools lists them,
 * /tools/:tool opens one. First tool: toroidal transformer from the core size.
 */
const TOOLS = [
  {
    id: 'bien-ap-xuyen',
    title: 'Tính biến áp xuyến',
    desc: 'Nhập kích thước lõi tôn silic để ước lượng công suất, số vòng/volt và số vòng cuộn 220 V.',
    icon: CircleDot,
    color: 'bg-orange-50 text-orange-600',
  },
] as const;

export function Tools() {
  const { tool } = useParams<{ tool?: string }>();
  if (tool === 'bien-ap-xuyen') return <ToroidCalculator />;
  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center">
              <Wrench className="w-7 h-7 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900">Công cụ</h1>
              <p className="mt-1 text-sm text-gray-600">Các công cụ tính nhanh cho thợ lắp đặt và người tự làm.</p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOOLS.map((t) => (
            <Link
              key={t.id}
              to={`/tools/${t.id}`}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40"
            >
              <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${t.color}`}>
                <t.icon className="w-6 h-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-gray-900">{t.title}</span>
                <span className="block text-xs text-gray-500 mt-0.5">{t.desc}</span>
              </span>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------

const STORE_KEY = 'tool-toroid';
const nf = (x: number, d = 0) =>
  Number.isFinite(x) && x > 0
    ? x.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d })
    : '–';
const parse = (s: string) => {
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const QUALITY: Record<CoreQuality, string> = {
  ok: 'text-green-700 bg-green-50 border-green-200',
  warn: 'text-amber-700 bg-amber-50 border-amber-200',
  bad: 'text-red-700 bg-red-50 border-red-200',
};

function loadInputs() {
  const d = { od: '120', id: '60', h: '60', m: '' };
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s && typeof s === 'object') return { ...d, ...s };
  } catch {
    // private window / blocked storage: defaults
  }
  return d;
}

function ToroidCalculator() {
  const [v, setV] = useState<{ od: string; id: string; h: string; m: string }>(loadInputs);
  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(v));
    } catch {
      // ignore
    }
  }, [v]);

  const r = useMemo(
    () => toroid({ od: parse(v.od), id: parse(v.id), h: parse(v.h), mass: parse(v.m) || undefined }),
    [v],
  );
  const field = (key: keyof typeof v, label: string, placeholder?: string) => (
    <label className="block min-w-0">
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        min={0}
        value={v[key]}
        placeholder={placeholder}
        onChange={(e) => setV((s) => ({ ...s, [key]: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );

  return (
    <Layout>
      <div className="max-w-xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Link to="/tools" className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100" aria-label="Quay lại">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Tính biến áp xuyến</h1>
            <p className="text-sm text-gray-500">Nhập kích thước lõi tôn silic để ước lượng công suất.</p>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 sm:p-6 space-y-5">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-800">Kích thước lõi (mm)</h2>
            <div className="grid grid-cols-3 gap-3">
              {field('od', 'Phi ngoài')}
              {field('id', 'Phi trong')}
              {field('h', 'Cao')}
            </div>
            {field('m', 'Khối lượng lõi cân được (kg) — không bắt buộc', 'bỏ trống nếu chưa cân')}
            {r.stacking && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${QUALITY[r.stacking.quality]}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span>Hệ số ép lá</span>
                  <b className="tabular-nums">{nf(r.stacking.k, 2)}</b>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">{r.stacking.title}</span>
                </div>
                <p className="mt-1 text-xs opacity-90">
                  {r.stacking.detail} (lõi đặc 100% nặng {nf(r.massSolid, 2)} kg)
                </p>
              </div>
            )}
          </section>

          <section className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold tracking-wider text-gray-400 uppercase">Công suất ước lượng</p>
            <p className="mt-1 text-4xl sm:text-5xl font-bold tabular-nums text-blue-600">
              {r.ok ? nf(r.power) : '–'}
              <span className="ml-1 text-lg font-medium text-gray-500">W</span>
            </p>
            <p className={`mt-1 text-sm ${r.ok ? 'text-gray-500' : 'text-red-600'}`}>
              {r.ok ? `Khoảng ${nf(r.powerLow)} – ${nf(r.powerHigh)} W` : 'Phi ngoài phải lớn hơn phi trong, các số phải lớn hơn 0'}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat value={r.ok ? nf(r.turnsPerVolt, 2) : '–'} label="vòng / volt" />
              <Stat value={r.ok ? nf(r.turns220) : '–'} label="vòng cho cuộn 220 V" />
              <Stat value={r.ok ? `${nf(r.areaCm2, 1)} cm²` : '–'} label="tiết diện lõi" />
              <Stat
                value={r.ok ? `${nf(r.massKg, 2)} kg` : '–'}
                label={r.massWeighed ? 'khối lượng lõi (cân)' : 'khối lượng lõi (ước tính)'}
              />
            </div>
          </section>
        </div>

        <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <Info className="w-4 h-4 mt-px shrink-0 text-blue-500" />
          <p>
            Có khối lượng cân thì công suất tính theo lượng sắt thực tế trong lõi; bỏ trống thì giả định lõi quấn chặt
            (hệ số {String(TOROID.KFE).replace('.', ',')}). Cân lõi trần, chưa quấn dây và chưa bọc vỏ. Tính với B ={' '}
            {String(TOROID.B).replace('.', ',')} T, {TOROID.F} Hz, J = {TOROID.J} A/mm², hệ số lấp{' '}
            {String(TOROID.KU).replace('.', ',')}. Khoảng dao động ứng với J từ {String(TOROID.J_LOW).replace('.', ',')}{' '}
            (chạy liên tục, mát) đến {String(TOROID.J_HIGH).replace('.', ',')} A/mm² (tải ngắt quãng).
          </p>
        </div>
      </div>
    </Layout>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-lg font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
