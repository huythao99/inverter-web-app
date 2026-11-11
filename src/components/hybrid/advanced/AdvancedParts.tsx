import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  RotateCcw,
  Ruler,
  ShieldAlert,
  SlidersHorizontal,
  UtilityPole,
} from 'lucide-react';
import { LoadingSpinner } from '../../LoadingSpinner';
import { ADV_CAL, ADV_GROUPS, ADV_LABEL } from '../../../services/hinvlf';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT } from '../styles';

// Các phần nội dung của hộp Cài đặt nâng cao (AdvancedDialog giữ trạng thái).

type AdvValues = Record<string, string | undefined>;
type Draft = Record<string, string>;

const GROUP_ICON: Record<string, typeof Cpu> = {
  'Hệ thống': Cpu,
  'Biến áp': Cable,
  'Ngưỡng pin': BatteryCharging,
  'Cửa sổ lưới': UtilityPole,
};

export function SectionTitle({ icon: Icon, children }: { icon: typeof Cpu; children: ReactNode }) {
  return (
    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
      <Icon className="w-4 h-4 text-gray-500" /> {children}
    </h4>
  );
}

export function Note({ tone, children }: { tone: 'info' | 'ok' | 'error' | 'warn'; children: ReactNode }) {
  const cls = {
    info: 'text-gray-500 bg-blue-50 border-blue-100',
    ok: 'text-green-700 bg-green-50 border-green-100',
    error: 'text-red-700 bg-red-50 border-red-100',
    warn: 'text-amber-700 bg-amber-50 border-amber-100',
  }[tone];
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'info' ? ShieldAlert : AlertTriangle;
  return (
    <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${cls}`}>
      <Icon className="w-4 h-4 mt-px shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Màn nhập mật khẩu menu nâng cao. */
export function LockForm({
  value,
  onChange,
  showPw,
  onToggleShow,
  busy,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  showPw: boolean;
  onToggleShow: () => void;
  busy: string | null;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Note tone="info">
        Các mục này ảnh hưởng tới an toàn pin và phần cứng. Nhập mật khẩu menu nâng cao của máy (giống trên màn
        hình LCD). Sai 5 lần thì máy khóa 5 phút.
      </Note>
      <section className="space-y-3">
        <SectionTitle icon={Lock}>Mật khẩu</SectionTitle>
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type={showPw ? 'text' : 'password'}
              autoComplete="off"
              value={value}
              onChange={(e) => onChange(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 16))}
              placeholder="Mật khẩu menu nâng cao"
              className={`${INPUT} pr-10`}
              autoFocus
            />
            <button
              type="button"
              onClick={onToggleShow}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              aria-label={showPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button type="submit" disabled={!value || busy !== null} className={`${BTN_PRIMARY} whitespace-nowrap`}>
            {busy === 'unlock' ? <LoadingSpinner size="sm" className="text-white" /> : <KeyRound className="w-4 h-4" />}
            Mở menu
          </button>
        </div>
      </section>
    </form>
  );
}

/** Các nhóm tham số (hệ thống, biến áp, ngưỡng pin, cửa sổ lưới) + Áp dụng. */
export function AdvGroups({
  a,
  draft,
  setDraft,
  changes,
  busy,
  onApply,
}: {
  a: AdvValues;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  changes: Draft;
  busy: string | null;
  onApply: () => void;
}) {
  const count = Object.keys(changes).length;
  return (
    <>
      {ADV_GROUPS.map((g) => (
        <section key={g.title} className="space-y-3">
          <SectionTitle icon={GROUP_ICON[g.title] ?? SlidersHorizontal}>{g.title}</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {g.fields.map((f) => {
              const value = draft[f.key] ?? a[f.key] ?? '';
              const changed = changes[f.key] !== undefined;
              return (
                <label key={f.key} className="block">
                  <span className={`flex items-center gap-1 text-xs font-medium mb-1 ${changed ? 'text-blue-700' : 'text-gray-600'}`}>
                    {f.label}
                    {f.confirm && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                  </span>
                  <div className="flex items-center gap-2">
                    {f.options ? (
                      <select
                        value={value}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        className={`${INPUT} ${changed ? 'border-blue-400' : ''}`}
                      >
                        {!f.options.some((o) => o.value === value) && <option value={value}>{value || '—'}</option>}
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        inputMode="decimal"
                        step={f.step}
                        value={value}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        className={`${INPUT} tabular-nums ${changed ? 'border-blue-400' : ''}`}
                      />
                    )}
                    {f.unit && !f.options && <span className="text-sm text-gray-500 w-8 shrink-0">{f.unit}</span>}
                  </div>
                  {(f.hint || (f.key === 'LF' && a.LFID)) && (
                    <span className="mt-1 block text-[11px] text-gray-400">
                      {f.key === 'LF' && a.LFID ? `Máy đo được: ${a.LFID} mH · ` : ''}
                      {f.hint ?? ''}
                    </span>
                  )}
                  {f.key === 'HALL' && value === 'YES' && a.HALLF === '0' && (
                    <span className="mt-1 block text-[11px] text-red-600">Không thấy Hall, máy sẽ báo lỗi cảm biến.</span>
                  )}
                </label>
              );
            })}
          </div>
        </section>
      ))}

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onApply} disabled={count === 0 || busy !== null} className={BTN_PRIMARY}>
            {busy === 'apply' ? <LoadingSpinner size="sm" className="text-white" /> : <Check className="w-4 h-4" />}
            Áp dụng
          </button>
          {count > 0 && (
            <button type="button" onClick={() => setDraft({})} className={BTN_SECONDARY}>
              Hoàn tác
            </button>
          )}
        </div>
        {count > 0 && (
          <p className="text-xs text-gray-500">Sẽ đổi: {Object.keys(changes).map((k) => ADV_LABEL[k] ?? k).join(', ')}</p>
        )}
      </div>
    </>
  );
}

/** Hiệu chỉnh 5 kênh đo: nhập số đọc từ đồng hồ chuẩn, áp dụng từng kênh. */
export function Calibration({
  a,
  draft,
  setDraft,
  open,
  onToggle,
  busy,
  onApply,
}: {
  a: AdvValues;
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  open: boolean;
  onToggle: () => void;
  busy: string | null;
  onApply: (set: Draft, key: string) => Promise<void>;
}) {
  return (
    <section className="space-y-3">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-2 text-left">
        <SectionTitle icon={Ruler}>Hiệu chỉnh số đo</SectionTitle>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <p className="text-xs text-gray-500">Đo bằng đồng hồ chuẩn rồi nhập số đọc được. Áp dụng ngay, không cần tắt máy.</p>
      {open && (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {ADV_CAL.map((c) => {
            const measured = a[c.measured];
            const v = draft[c.key] ?? measured ?? '';
            return (
              <li key={c.key} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <div className="min-w-[8rem] flex-1">
                  <p className="text-sm text-gray-900">{c.label}</p>
                  <p className="text-xs text-gray-400 tabular-nums">
                    Máy đo {measured ?? '—'} {c.unit} · hệ số {a[c.factor] ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    step={c.decimals === 2 ? 0.01 : 0.1}
                    value={v}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.key]: e.target.value }))}
                    className={`${INPUT} w-24 tabular-nums`}
                  />
                  <span className="text-sm text-gray-500 w-3">{c.unit}</span>
                  <button
                    type="button"
                    disabled={!v || busy !== null}
                    aria-label={`Hiệu chỉnh ${c.label}`}
                    onClick={() =>
                      void onApply({ [c.key]: String(v).replace(',', '.') }, c.key).then(() =>
                        setDraft((d) => {
                          const n = { ...d };
                          delete n[c.key];
                          return n;
                        })
                      )
                    }
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shrink-0 disabled:opacity-50"
                  >
                    {busy === c.key ? <LoadingSpinner size="sm" className="text-white" /> : <Check className="w-4 h-4" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function FactoryReset({ busy, onApply }: { busy: string | null; onApply: () => void }) {
  return (
    <section className="space-y-3">
      <SectionTitle icon={RotateCcw}>Cài đặt gốc</SectionTitle>
      <p className="text-xs text-gray-500">
        Đưa cài đặt người dùng về mặc định, giữ hệ pin, tần số, biến áp và hiệu chỉnh. Máy để ở chế độ Tắt.
      </p>
      <button type="button" onClick={onApply} disabled={busy !== null} className={BTN_DANGER}>
        {busy === 'fact' ? <LoadingSpinner size="sm" /> : <RotateCcw className="w-4 h-4" />}
        Khôi phục cài đặt gốc
      </button>
    </section>
  );
}
