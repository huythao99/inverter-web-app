import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BatteryCharging,
  Check,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  HousePlug,
  Loader2,
  Power,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import {
  disableHass,
  enableHass,
  getHassConfig,
  regenerateHass,
  type HassConfig,
} from '../services/api';

type Method = 'direct' | 'bridge';

const INVERTER_SENSORS = [
  'Công suất hoà lưới',
  'Công suất lưới',
  'Công suất tải',
  'Công suất pin',
  'Điện áp / tần số lưới',
  'Điện áp / dòng pin',
  'Nhiệt độ MOSFET',
  'Điện năng hôm nay (Energy dashboard)',
];
const CHARGER_SENSORS = [
  'Công suất / điện áp / dòng PV',
  'Điện áp / dòng pin',
  'Nhiệt độ',
  'Mã lỗi',
];

function timeAgo(iso: string | null): string {
  if (!iso) return 'chưa bao giờ';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return 'vừa xong';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} giờ trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function CopyButton({ value, label = 'Sao chép' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
      className="inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-md text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
      aria-label={label}
    >
      {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {done ? 'Đã chép' : label}
    </button>
  );
}

function Field({
  label,
  value,
  secret,
  hint,
}: {
  label: string;
  value: string;
  secret?: boolean;
  hint?: string;
}) {
  const [show, setShow] = useState(!secret);
  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">{label}</div>
          <div className="font-mono text-sm text-gray-900 break-all">
            {show ? value : '•'.repeat(Math.min(value.length, 16))}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {secret && (
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="p-1 text-gray-500 hover:text-gray-800"
              aria-label={show ? 'Ẩn' : 'Hiện'}
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          <CopyButton value={value} />
        </div>
      </div>
      {hint && <div className="mt-1 text-xs text-amber-700">{hint}</div>}
    </div>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-blue-600 text-white text-xs font-bold">
        {n}
      </span>
      <div className="text-sm text-gray-700 pt-0.5">{children}</div>
    </li>
  );
}

function StatusPill({ cfg }: { cfg: HassConfig }) {
  if (!cfg.enabled)
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <span className="w-2 h-2 rounded-full bg-gray-400" /> Đang tắt
      </span>
    );
  return cfg.connected ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
      <span className="w-2 h-2 rounded-full bg-green-500" /> Đã kết nối · {timeAgo(cfg.lastSeenAt)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
      <span className="w-2 h-2 rounded-full bg-amber-500" /> Chưa thấy Home Assistant kết nối
    </span>
  );
}

export function HomeAssistant() {
  const qc = useQueryClient();
  const [method, setMethod] = useState<Method>('direct');
  const { data: cfg, isLoading, error } = useQuery({
    queryKey: ['hass'],
    queryFn: getHassConfig,
    refetchInterval: 30_000,
  });
  const set = (c: HassConfig) => qc.setQueryData(['hass'], c);
  const enable = useMutation({ mutationFn: enableHass, onSuccess: set });
  const disable = useMutation({ mutationFn: disableHass, onSuccess: set });
  const regen = useMutation({ mutationFn: regenerateHass, onSuccess: set });
  const busy = enable.isPending || disable.isPending || regen.isPending;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 shrink-0 rounded-xl bg-sky-50 flex items-center justify-center">
              <HousePlug className="w-7 h-7 text-sky-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900">Home Assistant</h1>
              <p className="mt-1 text-sm text-gray-600">
                Đưa số liệu biến tần và bộ sạc vào Home Assistant qua MQTT. Thiết bị tự hiện ra, cập nhật mỗi 30 giây. Chỉ
                đọc: không điều khiển được thiết bị từ Home Assistant.
              </p>
              {cfg && (
                <div className="mt-3">
                  <StatusPill cfg={cfg} />
                </div>
              )}
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-xl p-4">Không tải được cấu hình. Thử lại sau.</div>
        )}

        {cfg && cfg.available === false && (
          <div className="bg-amber-50 text-amber-800 text-sm rounded-xl p-4">
            Tính năng Home Assistant đang tạm ngưng để bảo trì. Vui lòng quay lại sau.
          </div>
        )}

        {cfg && !cfg.enabled && cfg.available !== false && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                  <Cpu className="w-4 h-4 text-blue-600" /> Biến tần
                </div>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc pl-5">
                  {INVERTER_SENSORS.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 font-medium text-gray-900 text-sm">
                  <BatteryCharging className="w-4 h-4 text-green-600" /> Bộ sạc
                </div>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc pl-5">
                  {CHARGER_SENSORS.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => enable.mutate()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {enable.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              Bật Home Assistant
            </button>
          </div>
        )}

        {cfg?.enabled && (
          <>
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex border-b border-gray-200">
                {(
                  [
                    ['direct', 'Cách A · Trực tiếp'],
                    ['bridge', 'Cách B · Qua Mosquitto'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMethod(k)}
                    className={`flex-1 px-3 py-3 text-sm font-medium border-b-2 -mb-px ${
                      method === k
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {method === 'direct' ? (
                <div className="p-5 sm:p-6 space-y-5">
                  <p className="text-sm text-gray-600">
                    Dùng khi Home Assistant <b>chưa</b> kết nối MQTT broker nào (Home Assistant chỉ nhận một broker).
                  </p>
                  <ol className="space-y-3">
                    <Step n={1}>
                      Bật <b>Chế độ nâng cao</b> (Advanced mode) trong trang Hồ sơ người dùng của Home Assistant, rồi vào{' '}
                      <b>Cài đặt → Thiết bị & dịch vụ → Thêm tích hợp</b>, chọn <b>MQTT</b>.
                    </Step>
                    <Step n={2}>Nhập Broker, Cổng, Tên đăng nhập, Mật khẩu bên dưới.</Step>
                    <Step n={3}>
                      Bấm <b>Hiển thị tuỳ chọn nâng cao</b>: bật <b>Xác thực chứng chỉ broker</b> (Tự động) và chọn giao
                      thức <b>TCP</b>.
                    </Step>
                    <Step n={4}>
                      Sau khi thêm xong, mở tích hợp <b>MQTT → Cấu hình (Configure)</b>, đổi <b>Tiền tố khám phá</b> (discovery prefix)
                      thành giá trị bên dưới.
                    </Step>
                  </ol>
                  <div className="rounded-lg border border-gray-200 px-4">
                    <Field label="Broker" value={cfg.broker} />
                    <Field label="Cổng" value={String(cfg.port)} hint={cfg.ssl ? 'Có mã hoá TLS' : undefined} />
                    <Field label="Tên đăng nhập" value={cfg.username ?? ''} />
                    <Field label="Mật khẩu" value={cfg.password ?? ''} secret />
                    <Field
                      label="Tiền tố khám phá (discovery prefix)"
                      value={cfg.discoveryPrefix ?? ''}
                      hint="Bắt buộc đổi, nếu để “homeassistant” thiết bị sẽ không hiện ra."
                    />
                  </div>
                </div>
              ) : (
                <div className="p-5 sm:p-6 space-y-5">
                  <p className="text-sm text-gray-600">
                    Dùng khi Home Assistant đã chạy add-on Mosquitto cho thiết bị khác. Broker của bạn sẽ kéo dữ liệu về,
                    thiết bị hiện ra với tiền tố mặc định <code>homeassistant</code>.
                  </p>
                  <ol className="space-y-3">
                    <Step n={1}>
                      Mở add-on <b>Mosquitto broker → Cấu hình</b>, phần <b>customize</b> đặt <code>active: true</code>,{' '}
                      <code>folder: mosquitto</code>.
                    </Step>
                    <Step n={2}>
                      Tạo file <code>/share/mosquitto/giabao.conf</code> (dùng add-on File editor hoặc Samba) với nội dung
                      bên dưới.
                    </Step>
                    <Step n={3}>Khởi động lại add-on Mosquitto. Không cần đổi gì trong tích hợp MQTT.</Step>
                  </ol>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 text-xs rounded-lg p-4 pt-10 overflow-x-auto whitespace-pre">
                      {cfg.bridgeConfig}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton value={cfg.bridgeConfig ?? ''} />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">File có chứa mật khẩu, đừng chia sẻ cho người khác.</p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
              <h2 className="font-semibold text-gray-900">Thiết bị sẽ hiện trong Home Assistant</h2>
              {cfg.devices.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">Bạn chưa có thiết bị nào.</p>
              ) : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {cfg.devices.map((d) => (
                    <li key={`${d.kind}:${d.deviceId}`} className="flex items-center gap-3 py-2.5">
                      {d.kind === 'inverter' ? (
                        <Cpu className="w-5 h-5 text-blue-600 shrink-0" />
                      ) : (
                        <BatteryCharging className="w-5 h-5 text-green-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{d.deviceName}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {d.kind === 'inverter' ? 'Biến tần' : 'Bộ sạc'} · {d.deviceId}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-gray-500">
                Thiết bị mới thêm sẽ tự hiện trong vòng 30 phút. Điện năng hôm nay dùng được trong Energy dashboard.
              </p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Tạo mật khẩu mới? Home Assistant đang dùng mật khẩu cũ sẽ bị ngắt kết nối.'))
                    regen.mutate();
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {regen.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Tạo lại mật khẩu
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Tắt Home Assistant? Dữ liệu sẽ ngừng gửi sang Home Assistant.')) disable.mutate();
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {disable.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                Tắt Home Assistant
              </button>
              <div className="sm:ml-auto flex items-center gap-1.5 text-xs text-gray-500">
                <ShieldCheck className="w-4 h-4 text-green-600" /> Tài khoản chỉ đọc, riêng của bạn
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
