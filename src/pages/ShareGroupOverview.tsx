import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pencil, RefreshCw } from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { getShareGroupOverview } from '../services/api';
import { getMqttClient, onConnectionStatusChange, onMessage } from '../services/mqtt';
import { auth } from '../services/firebase';
import type { ShareMemberLive, ShareOverviewMember } from '../types';
import { colorAt } from '../components/shareColors';
import { SlidingSegmented } from '../components/SlidingSegmented';

// One share group on one page: each member's live power (MQTT), the watts the
// group assigns it (backend, every 10 s), energy today / week / month and the
// contribution of every member. Backend: GET /share-groups/:id/overview.

type Contrib = 'live' | 'today' | 'week' | 'month';
const MODES: { id: Contrib; label: string }[] = [
  { id: 'live', label: 'Đang xả' },
  { id: 'today', label: 'Hôm nay' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
];
const LIVE_FRESH_MS = 15_000;

const w = (v: number | null | undefined) =>
  v == null ? '–' : `${Math.round(v).toLocaleString('vi-VN')} W`;
const kwh = (v: number) => `${v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kWh`;
const one = (v: number) => v.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dm = (iso: string) => (iso.length >= 10 ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : iso);

function parseFrame(value: unknown): ShareMemberLive | null {
  if (typeof value !== 'string') return null;
  const p = value.replace(/\$/g, '').split('#');
  if (p.length < 8) return null;
  const n = (i: number) => {
    const v = parseFloat(p[i]);
    return Number.isFinite(v) ? v : null;
  };
  return {
    gridPower: n(2),
    batteryVoltage: n(3),
    gridTiePower: n(4),
    temperature: n(5),
    cutoffVoltage: n(6),
    powerLimit: n(7),
  };
}

/** Live frames of the user's inverters from the `inverter/{uid}/+/data` wildcard. */
function useLiveFrames(): Record<string, { live: ShareMemberLive; at: number }> {
  const [frames, setFrames] = useState<Record<string, { live: ShareMemberLive; at: number }>>({});
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    let mounted = true;
    const prefix = `inverter/${uid}/`;
    const topic = `${prefix}+/data`;
    const off = onMessage((t, message) => {
      if (!t.startsWith(prefix) || !t.endsWith('/data')) return;
      const deviceId = t.slice(prefix.length, -'/data'.length);
      if (!deviceId || deviceId.includes('/')) return;
      try {
        const live = parseFrame(JSON.parse(message.toString())?.value);
        if (live && mounted) setFrames((f) => ({ ...f, [deviceId]: { live, at: Date.now() } }));
      } catch {
        // not JSON: ignore
      }
    });
    const subscribe = () =>
      getMqttClient()
        .then((c) => mounted && c.subscribe(topic))
        .catch(() => {
          // the 10 s backend refresh still shows the members
        });
    subscribe();
    const offStatus = onConnectionStatusChange((s) => {
      if (s === 'connected') subscribe(); // clean session after a reconnect
    });
    return () => {
      mounted = false;
      off();
      offStatus();
      getMqttClient()
        .then((c) => c.unsubscribe(topic))
        .catch(() => {
          // ignore during cleanup
        });
    };
  }, []);
  return frames;
}

export function ShareGroupOverview() {
  const { groupId } = useParams<{ groupId: string }>();
  const [mode, setMode] = useState<Contrib>('live');
  const query = useQuery({
    queryKey: ['share-overview', groupId],
    queryFn: () => getShareGroupOverview(groupId!),
    enabled: !!groupId,
    refetchInterval: 10_000,
  });
  const frames = useLiveFrames();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const o = query.data;
  // Members with the freshest live frame (MQTT beats the backend copy).
  const members: Array<ShareOverviewMember & { online: boolean }> = (o?.members ?? []).map((m) => {
    const f = frames[m.deviceId];
    return f && now - f.at < LIVE_FRESH_MS ? { ...m, live: f.live, online: true } : m;
  });
  const sum = (f: (m: ShareOverviewMember) => number | null | undefined) =>
    members.reduce((s, m) => s + (f(m) ?? 0), 0);
  const online = members.filter((m) => m.online).length;

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <Link to="/share" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-4 h-4" />
            Chia sẻ công suất
          </Link>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{o?.name || 'Nhóm chia sẻ'}</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => query.refetch()}
                disabled={query.isFetching}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-50"
                aria-label="Tải lại"
              >
                <RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />
              </button>
              <Link
                to={`/share/${groupId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="w-4 h-4" />
                Sửa nhóm
              </Link>
            </div>
          </div>
        </div>

        {query.isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : query.error || !o ? (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-center text-sm text-red-700">
            Không tải được dữ liệu nhóm.{' '}
            <button onClick={() => query.refetch()} className="underline font-medium">
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {/* Group totals */}
            <section className="rounded-xl bg-white border border-gray-200 p-4 sm:p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${o.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className={o.enabled ? 'font-semibold text-green-700' : 'text-gray-500'}>
                    {o.enabled ? 'Đang chia sẻ' : 'Đã tắt'}
                  </span>
                </span>
                <span className="text-gray-500">
                  {online}/{members.length} máy online
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
                <Stat label="Đang xả" value={w(sum((m) => m.live?.gridTiePower))} color="#2a78d6" />
                <Stat label="Lấy lưới" value={w(sum((m) => m.live?.gridPower))} color="#eb6834" />
                <Stat label="Tổng tải chia" value={o.enabled ? w(o.poolWatts) : '–'} />
                <Stat label="Xả hôm nay" value={kwh(o.totals.todayGeneratedKwh)} />
                <Stat label="Xả tháng này" value={kwh(o.totals.monthGeneratedKwh)} />
              </div>
            </section>

            <Contribution members={members} mode={mode} setMode={setMode} weekStart={o.weekStart} monthStart={o.monthStart} />

            <div className="grid gap-3 md:grid-cols-2">
              {members.map((m, i) => (
                <MemberCard key={m.deviceId} m={m} color={colorAt(i)} enabled={o.enabled} />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        {color && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />}
        {label}
      </p>
      <p className="mt-0.5 truncate text-lg font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

function StackedBar({ values, height }: { values: number[]; height: number }) {
  const total = values.reduce((s, v) => s + v, 0);
  return (
    <div className="flex overflow-hidden rounded-full bg-gray-100" style={{ height }}>
      {total > 0 &&
        values.map((v, i) =>
          v > 0 ? (
            <span
              key={i}
              style={{ width: `${(v / total) * 100}%`, background: colorAt(i) }}
              className="h-full border-r-2 border-white last:border-r-0"
            />
          ) : null,
        )}
    </div>
  );
}

function Contribution({
  members,
  mode,
  setMode,
  weekStart,
  monthStart,
}: {
  members: ShareOverviewMember[];
  mode: Contrib;
  setMode: (m: Contrib) => void;
  weekStart: string;
  monthStart: string;
}) {
  const valueOf = (m: ShareOverviewMember) => {
    switch (mode) {
      case 'live':
        return Math.max(0, m.live?.gridTiePower ?? 0);
      case 'today':
        return m.today.generatedKwh;
      case 'week':
        return m.week.generatedKwh;
      case 'month':
        return m.month.generatedKwh;
    }
  };
  const values = members.map(valueOf);
  const total = values.reduce((s, v) => s + v, 0);
  const hint =
    mode === 'live'
      ? 'Theo công suất đang xả'
      : mode === 'today'
        ? 'Theo sản lượng xả hôm nay'
        : mode === 'week'
          ? `Sản lượng xả từ thứ Hai ${dm(weekStart)}`
          : `Sản lượng xả từ ${dm(monthStart)}`;

  return (
    <section className="rounded-xl bg-white border border-gray-200 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Đóng góp của từng máy</h2>
        <SlidingSegmented value={mode} options={MODES} onChange={setMode} />
      </div>
      <p className="mt-3 mb-1.5 text-xs text-gray-500">{hint}</p>
      <StackedBar values={values} height={14} />
      {total <= 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          {mode === 'live' ? 'Hiện chưa máy nào đang xả.' : 'Chưa có sản lượng trong khoảng này.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {members.map((m, i) => (
            <li key={m.deviceId} className="flex items-center gap-2 text-sm">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorAt(i) }} />
              <span className="min-w-0 flex-1 truncate text-gray-800">{m.name}</span>
              <span className="text-xs text-gray-500 tabular-nums">
                {mode === 'live' ? w(values[i]) : kwh(values[i])}
              </span>
              <span className="w-14 text-right font-semibold tabular-nums">{one((values[i] * 100) / total)}%</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center gap-3">
        <span className="shrink-0 text-xs text-gray-500">Tỉ lệ cài đặt</span>
        <div className="flex-1">
          <StackedBar values={members.map((m) => m.ratioPercent)} height={6} />
        </div>
      </div>
    </section>
  );
}

function MemberCard({ m, color, enabled }: { m: ShareOverviewMember; color: string; enabled: boolean }) {
  const l = m.live;
  const status = m.gridTieOff
    ? { label: 'Tắt hoà lưới', cls: 'bg-gray-100 text-gray-600' }
    : m.online
      ? { label: 'Online', cls: 'bg-green-50 text-green-700' }
      : { label: 'Offline', cls: 'bg-red-50 text-red-700' };
  const assigned = m.assignedWatts;
  const actual = l?.gridTiePower ?? null;
  const progress =
    enabled && assigned != null && assigned > 0 && actual != null ? Math.min(1, Math.max(0, actual / assigned)) : null;

  return (
    <Link
      to={`/devices/${encodeURIComponent(m.deviceId)}`}
      className="block rounded-xl bg-white border border-gray-200 p-4 hover:border-blue-300 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
        <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">{m.name}</span>
        <span className="text-xs text-gray-500">
          Tỉ lệ {m.ratio} · {one(m.ratioPercent)}%
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.label}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Cell label="Đang xả" value={w(actual)} />
        <Cell label="Được chia" value={enabled ? w(assigned) : '–'} />
        <Cell label="Lấy lưới" value={w(l?.gridPower)} />
      </div>
      {progress != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: '#2a78d6' }} />
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Cell label="Áp pin" value={l?.batteryVoltage == null ? '–' : `${one(l.batteryVoltage)} V`} />
        <Cell label="Ngưỡng áp" value={l?.cutoffVoltage == null ? '–' : `${one(l.cutoffVoltage)} V`} />
        <Cell label="Nhiệt độ" value={l?.temperature == null ? '–' : `${one(l.temperature)} °C`} />
      </div>
      <p className="mt-3 text-xs text-gray-600">
        Xả: hôm nay {kwh(m.today.generatedKwh)} · tuần {kwh(m.week.generatedKwh)} · tháng {kwh(m.month.generatedKwh)}
      </p>
    </Link>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="truncate text-sm font-semibold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}
