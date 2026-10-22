import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  History,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Square,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ActivityLog } from '../components/ActivityLog';
import { HybridEnergyFlow } from '../components/HybridEnergyFlow';
import { useHybridMqtt } from '../hooks/useHybridMqtt';
import {
  getHybridDevice,
  getHybridEnergy,
  getHybridLatest,
  getHybridSetting,
  sendHybridCommand,
  updateHybridDevice,
  updateHybridSetting,
} from '../services/api';
import type {
  HybridCommand,
  HybridConfig,
  HybridLatest,
  HybridMode,
  HybridNak,
  HybridNumberKey,
  HybridSetting,
} from '../types';
import {
  FIELDS,
  FLT_LABEL,
  MODES,
  MODE_LABEL,
  NAK_LABEL,
  READONLY,
  ST_LABEL,
  configFromCfg,
  fieldRange,
  kwh,
  num,
  pullAlong,
  validate,
} from '../services/hinvlf';
import { ChargerStatusIndicator } from './ChargerDetail';

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;

type TabType = 'overview' | 'settings' | 'history';

/**
 * Hybrid (inverter biến áp sắt, STM32 HINVLF v1): luồng năng lượng, trạng
 * thái / lỗi + lệnh (Xóa lỗi, Dừng, Chạy), điện năng hôm nay, và 9 tham số
 * cài đặt (server giữ, ESP32 tự áp lại xuống máy).
 */
export function HybridDetail() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [deviceName, setDeviceName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);

  const { isDeviceOnline } = useHybridMqtt(deviceId);

  const deviceQuery = useQuery({
    queryKey: ['hybrid-device', deviceId],
    queryFn: () => getHybridDevice(deviceId!),
    enabled: !!deviceId,
  });

  // Giá trị đầu từ REST; useHybridMqtt ghi khung live vào cache này.
  const latestQuery = useQuery({
    queryKey: ['hybrid-latest', deviceId],
    queryFn: () => getHybridLatest(deviceId!),
    enabled: !!deviceId,
  });

  const energyQuery = useQuery({
    queryKey: ['hybrid-energy', deviceId],
    queryFn: () => getHybridEnergy(deviceId!),
    enabled: !!deviceId && activeTab === 'overview',
    refetchInterval: 60_000,
  });

  const settingQuery = useQuery({
    queryKey: ['hybrid-setting', deviceId],
    queryFn: () => getHybridSetting(deviceId!),
    enabled: !!deviceId,
  });

  const commandMutation = useMutation({
    mutationFn: (cmd: HybridCommand) => sendHybridCommand(deviceId!, cmd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['device-activity', 'hybrid', deviceId] });
    },
  });

  const updateNameMutation = useMutation({
    mutationFn: (name: string) => updateHybridDevice(deviceId!, { deviceName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hybrid-device', deviceId] });
      queryClient.invalidateQueries({ queryKey: ['hybrid-devices'] });
      setIsEditingName(false);
    },
  });

  useEffect(() => {
    if (deviceQuery.data) setDeviceName(deviceQuery.data.deviceName || '');
  }, [deviceQuery.data]);

  if (deviceQuery.isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (deviceQuery.error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600">Không thể tải thông tin thiết bị hybrid</p>
          <Link
            to="/"
            className="mt-4 inline-block px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Quay lại Bảng điều khiển
          </Link>
        </div>
      </Layout>
    );
  }

  const device = deviceQuery.data;
  const latest = latestQuery.data;
  const src = latest?.tlm?.SRC ?? latest?.cfg?.SRC ?? settingQuery.data?.src ?? null;
  const tabs = [
    { id: 'overview' as TabType, label: 'Tổng quan', icon: BarChart3 },
    { id: 'settings' as TabType, label: 'Cài đặt', icon: Settings },
    { id: 'history' as TabType, label: 'Lịch sử', icon: History },
  ];

  return (
    <Layout>
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <img
          src={asset('assets/images/background_2.png')}
          className="w-full h-full object-cover"
          alt=""
          aria-hidden="true"
        />
      </div>
      <div className="relative z-10 max-w-2xl mx-auto space-y-3 pb-8">
        <div className="flex items-center space-x-3">
          <Link to="/" className="p-2 hover:bg-white/50 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </Link>
          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="text-lg font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent w-full"
                  autoFocus
                />
                <button
                  onClick={() => updateNameMutation.mutate(deviceName)}
                  disabled={updateNameMutation.isPending}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1
                className="text-lg font-bold text-gray-900 truncate cursor-pointer hover:text-blue-600"
                onClick={() => setIsEditingName(true)}
              >
                {device?.deviceName || device?.deviceId}
              </h1>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <ChargerStatusIndicator isOnline={isDeviceOnline} />
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                Hybrid
              </span>
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex space-x-4 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-3">
            {latestQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <>
                <HybridEnergyFlow latest={latest} online={isDeviceOnline} />
                <HybridStatusCard
                  latest={latest}
                  online={isDeviceOnline}
                  src={src}
                  sending={commandMutation.isPending ? commandMutation.variables : undefined}
                  sent={commandMutation.isSuccess ? commandMutation.data.cmd : undefined}
                  error={commandMutation.isError}
                  onCommand={(cmd) => commandMutation.mutate(cmd)}
                />
                <HybridTodayEnergy
                  today={energyQuery.data?.today}
                  loading={energyQuery.isLoading}
                  onRefresh={() => {
                    energyQuery.refetch();
                    latestQuery.refetch();
                  }}
                  refreshing={energyQuery.isRefetching || latestQuery.isRefetching}
                />
              </>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 sm:p-6">
            {settingQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : settingQuery.error || !settingQuery.data ? (
              <div className="text-center py-6">
                <p className="text-red-600 text-sm">Không tải được cài đặt</p>
                <button
                  onClick={() => settingQuery.refetch()}
                  className="mt-3 px-4 py-2 bg-gray-600 text-white rounded-lg text-sm"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <HybridSettingsForm
                deviceId={deviceId!}
                setting={settingQuery.data}
                latest={latest}
                online={isDeviceOnline}
              />
            )}
          </div>
        )}

        {activeTab === 'history' && deviceId && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 sm:p-6">
            <ActivityLog deviceId={deviceId} kind="hybrid" />
          </div>
        )}
      </div>
    </Layout>
  );
}

// ---------------------------------------------------------------------------

const CMD_LABEL: Record<HybridCommand, string> = {
  FAULT_RST: 'Xóa lỗi',
  STOP: 'Dừng máy',
  RUN: 'Chạy máy',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{children}</span>
    </div>
  );
}

function HybridStatusCard({
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
  const hasFault = flt !== '' && flt !== '0';
  const locked = t.LOCK === '1';
  const stopped = t.ST === 'STOP';
  const srcEsp = src === 'ESP';
  const cmdNak = latest?.lastNak?.of?.startsWith('CMD') ? latest.lastNak : null;

  const stCls =
    t.ST === 'FLT'
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
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 sm:p-5">
      <h4 className="text-base font-semibold text-gray-900 mb-2">Trạng thái máy</h4>
      <div className="divide-y divide-gray-100">
        <Row label="Hoạt động">
          <span className={stCls}>{ST_LABEL[t.ST ?? ''] ?? t.ST ?? '—'}</span>
        </Row>
        <Row label="Chế độ">{MODE_LABEL[t.MODE ?? ''] ?? t.MODE ?? '—'}</Row>
        <Row label="Pin">{t.VBAT ? `${num(t.VBAT)?.toFixed(2)} V` : '—'}</Row>
        <Row label="Áp ra / áp lưới">
          {t.VOUT ?? '—'} V / {t.VGRID ?? '—'} V
        </Row>
        <Row label="Cài đặt từ">
          {src === 'ESP' ? 'Ứng dụng (APP)' : src === 'LOCAL' ? 'Trên máy (LOCAL)' : '—'}
        </Row>
        {(hasFault || Number(t.RTRY ?? 0) > 0) && (
          <Row label="Tự chạy lại">{t.RTRY ?? 0}/5</Row>
        )}
      </div>

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
        {stopped
          ? btn('RUN', <Play className="w-4 h-4" />, 'col-span-2 bg-green-600 text-white hover:bg-green-700', !srcEsp)
          : btn('STOP', <Square className="w-4 h-4" />, 'col-span-2 bg-gray-100 text-gray-700 hover:bg-gray-200', !srcEsp)}
      </div>
      {!srcEsp && src && (
        <p className="mt-2 text-xs text-amber-600">
          Dừng / chạy từ xa cần chọn "Cai dat tu = APP" trong menu máy.
        </p>
      )}
      {sent && !sending && !error && (
        <p className="mt-2 text-xs text-green-600">Đã gửi lệnh "{CMD_LABEL[sent]}".</p>
      )}
      {error && <p className="mt-2 text-xs text-red-600">Không gửi được lệnh, hãy thử lại.</p>}
      {cmdNak && <NakNotice nak={cmdNak} />}
    </div>
  );
}

function HybridTodayEnergy({
  today,
  loading,
  onRefresh,
  refreshing,
}: {
  today?: { edis: number; echg: number; eimp: number; eexp: number };
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const items = [
    { label: 'Pin xả', v: today?.edis, cls: 'text-blue-600' },
    { label: 'Pin sạc', v: today?.echg, cls: 'text-blue-400' },
    { label: 'Lấy lưới', v: today?.eimp, cls: 'text-emerald-600' },
    { label: 'Đẩy lưới', v: today?.eexp, cls: 'text-emerald-400' },
  ];
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-base font-semibold text-gray-900">Điện năng hôm nay</h4>
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
    </div>
  );
}

function NakNotice({ nak }: { nak: HybridNak }) {
  const field = FIELDS.find((f) => f.key === nak.key);
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <div>
        <p>
          Máy từ chối {nak.of.startsWith('CMD') ? 'lệnh' : 'cài đặt'}
          {field ? ` (${field.label})` : nak.key ? ` (${nak.key})` : ''}:{' '}
          {NAK_LABEL[nak.err] ?? nak.err}
        </p>
        <p className="mt-0.5 text-amber-600">
          {new Date(nak.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

type Draft = { MODE?: HybridMode } & Partial<Record<HybridNumberKey, string>>;

function toDraft(c: HybridConfig): Draft {
  const d: Draft = { MODE: c.MODE };
  for (const f of FIELDS) {
    const v = c[f.key];
    if (v !== undefined) d[f.key] = f.unit === 'V' ? v.toFixed(1) : String(Math.round(v));
  }
  return d;
}

function HybridSettingsForm({
  deviceId,
  setting,
  latest,
  online,
}: {
  deviceId: string;
  setting: HybridSetting;
  latest?: HybridLatest;
  online: boolean;
}) {
  const queryClient = useQueryClient();
  // $CFG mới nhất: live MQTT trước, rồi API.
  const cfg = latest?.cfg ?? setting.cfg ?? null;
  // Giá trị đang hiệu lực = $CFG của máy, đè bởi cấu hình server đã lưu.
  const effective = useMemo<HybridConfig>(
    () => ({ ...configFromCfg(cfg), ...setting.config }),
    [cfg, setting.config]
  );
  const [draft, setDraft] = useState<Draft>(() => toDraft(effective));
  const [edited, setEdited] = useState<Set<string>>(new Set());
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});

  // Khi chưa sửa gì: theo giá trị mới (máy vừa áp dụng / người khác sửa).
  useEffect(() => {
    if (edited.size === 0) setDraft(toDraft(effective));
  }, [effective, edited.size]);

  const parsed = useMemo<HybridConfig>(() => {
    const c: HybridConfig = { ...effective };
    if (draft.MODE) c.MODE = draft.MODE;
    for (const f of FIELDS) {
      const raw = draft[f.key];
      if (raw === undefined || raw === '') continue;
      const v = Number(raw.replace(',', '.'));
      c[f.key] = f.unit === 'V' ? Math.round(v * 10) / 10 : Math.round(v);
    }
    return pullAlong(c, edited);
  }, [draft, effective, edited]);

  const errors = validate(parsed, cfg);
  const changes = useMemo(() => {
    const out: HybridConfig = {};
    if (parsed.MODE && parsed.MODE !== effective.MODE) out.MODE = parsed.MODE;
    for (const f of FIELDS) {
      const v = parsed[f.key];
      if (v !== undefined && v !== effective[f.key]) out[f.key] = v;
    }
    return out;
  }, [parsed, effective]);
  const dirty = Object.keys(changes).length > 0;

  const save = useMutation({
    mutationFn: () => updateHybridSetting(deviceId, changes),
    onSuccess: (data) => {
      queryClient.setQueryData(['hybrid-setting', deviceId], data);
      queryClient.invalidateQueries({ queryKey: ['device-activity', 'hybrid', deviceId] });
      setEdited(new Set());
      setServerErrors({});
    },
    onError: (e) => {
      const list = isAxiosError(e)
        ? (e.response?.data?.errors as { key: string; message: string }[] | undefined)
        : undefined;
      setServerErrors(Object.fromEntries((list ?? []).map((x) => [x.key, x.message])));
    },
  });

  const setField = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setEdited((s) => new Set(s).add(key));
    setServerErrors((s) => ({ ...s, [key]: '' }));
  };

  const pending = new Set(setting.pending);
  const local = setting.src === 'LOCAL' || cfg?.SRC === 'LOCAL';
  const settingNak = setting.lastNak && !setting.lastNak.of.startsWith('CMD') ? setting.lastNak : null;
  const mode = parsed.MODE;

  return (
    <div className="space-y-5">
      {local && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <Lock className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            Máy đang ở chế độ chỉnh tại chỗ. Vào menu máy chọn <b>"Cai dat tu = APP"</b> để cài đặt
            từ ứng dụng được áp dụng.
          </p>
        </div>
      )}
      {!online && (
        <p className="text-xs text-gray-500">
          Thiết bị đang mất kết nối — cài đặt sẽ được áp dụng khi thiết bị online trở lại.
        </p>
      )}

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          Chế độ hoạt động
          {pending.has('MODE') && <PendingBadge />}
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setField('MODE', m.id)}
                className={`text-left rounded-xl border-2 p-3 transition-colors ${
                  active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-900'}`}>
                  {m.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Thông số</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map((f) => {
            const [lo, hi] = fieldRange(f.key, parsed, cfg);
            const err = serverErrors[f.key] || errors[f.key];
            const pulled =
              !edited.has(f.key) && parsed[f.key] !== undefined && parsed[f.key] !== effective[f.key];
            const value =
              pulled && parsed[f.key] !== undefined
                ? f.unit === 'V'
                  ? parsed[f.key]!.toFixed(1)
                  : String(parsed[f.key])
                : (draft[f.key] ?? '');
            const highlight = f.modes && mode && f.modes.includes(mode);
            return (
              <label
                key={f.key}
                className={`block rounded-xl border p-3 ${highlight ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-white'}`}
              >
                <span className="flex items-center justify-between gap-2 text-xs font-medium text-gray-600">
                  {f.label}
                  {pending.has(f.key) && <PendingBadge />}
                </span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={f.step}
                    value={value}
                    onChange={(e) => setField(f.key, e.target.value)}
                    className={`w-full rounded-lg border px-3 py-2 text-base tabular-nums outline-none focus:ring-2 ${
                      err ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
                    }`}
                  />
                  <span className="text-sm text-gray-500 w-4">{f.unit}</span>
                </div>
                <span className={`mt-1 block text-[11px] ${err ? 'text-red-600' : 'text-gray-400'}`}>
                  {err || `${f.hint} · ${lo} – ${hi ?? '…'} ${f.unit}`}
                  {pulled && !err ? ' · tự chỉnh theo giới hạn mới' : ''}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {settingNak && <NakNotice nak={settingNak} />}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={!dirty || Object.keys(errors).length > 0 || save.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {save.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Lưu cài đặt
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => {
              setEdited(new Set());
              setDraft(toDraft(effective));
              setServerErrors({});
            }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Hoàn tác
          </button>
        )}
        {!dirty && setting.pending.length === 0 && setting.updatedAt && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="w-4 h-4" /> Máy đang chạy đúng cài đặt
          </span>
        )}
      </div>
      {save.isError && Object.keys(serverErrors).length === 0 && (
        <p className="text-xs text-red-600">Không lưu được cài đặt, hãy thử lại.</p>
      )}

      <section>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Thông số máy (chỉ đọc)</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {READONLY.map((r) => (
            <div key={r.key} className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-[11px] text-gray-500">{r.label}</p>
              <p className="text-sm font-semibold text-gray-900 tabular-nums">
                {cfg?.[r.key] ? `${cfg[r.key]} ${r.unit ?? ''}` : '—'}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Cài đặt được lưu trên máy chủ; thiết bị tự áp lại xuống máy mỗi khi máy khởi động lại.
        </p>
      </section>
    </div>
  );
}

function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
      <Clock className="w-3 h-3" /> chờ áp dụng
    </span>
  );
}
