import type { ReactNode } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  CloudOff,
  Home,
  HelpCircle,
  Hourglass,
  Plug,
  Power,
  RefreshCw,
  Upload,
} from 'lucide-react';
import type { HybridMode } from '../../../types';
import { MODES, MODE_GROUPS, MODE_LABEL, modeUnsupported } from '../../../services/hinvlf';
import type { ModeDef } from '../../../services/hinvlf';
import { fmtShortTime } from '../../../utils/fmt';
import { Chip, GlassCard, PendingBadge, Sheet, UndoButton } from '../ui';

const MODE_ICON: Record<HybridMode, typeof Home> = {
  LOAD: Home,
  LOADACC: Home,
  EXPORT: Upload,
  ACCOUPLE: BatteryCharging,
  CHG: BatteryCharging,
  OFFGRID: Plug,
  OFF: Power,
};

const modeDef = (id?: HybridMode) => MODES.find((m) => m.id === id);

/**
 * Chế độ đang chọn (đổi qua bảng chọn) + ô công suất của nó + dòng trạng
 * thái áp dụng + cảnh báo một dòng (máy chỉnh tại chỗ, máy từ chối).
 */
export function ModeCard({
  mode,
  current,
  pending,
  status,
  notices,
  onPick,
  onUndo,
  children,
}: {
  mode?: HybridMode;
  /** Chế độ máy đang chạy (khác mode = đang đổi, chưa lưu). */
  current?: HybridMode;
  pending: boolean;
  status?: ReactNode;
  notices: string[];
  onPick: () => void;
  onUndo: () => void;
  children?: ReactNode;
}) {
  const def = modeDef(mode);
  const Icon = mode ? MODE_ICON[mode] : HelpCircle;
  const changed = mode !== current;
  return (
    <GlassCard
      title="Chế độ hoạt động"
      trailing={
        <>
          {pending && <PendingBadge />}
          <button type="button" onClick={onPick} className="text-sm font-semibold text-blue-600 hover:text-blue-700 px-2 py-1">
            Đổi
          </button>
        </>
      }
    >
      <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPick}
        className="flex-1 min-w-0 flex items-center gap-3 rounded-xl p-1 -m-1 text-left hover:bg-blue-50/50"
      >
        <span className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
          <Icon className="w-5 h-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-bold text-blue-700">{def?.label ?? 'Chưa rõ'}</span>
            {changed && <span className="text-xs text-gray-400">(đang là {MODE_LABEL[current ?? ''] ?? '—'})</span>}
            {def?.needsCt && <Chip>Cần CT lưới</Chip>}
          </span>
          {def && <span className="block text-xs text-gray-500">{def.desc}</span>}
        </span>
      </button>
      {changed && <UndoButton label="chế độ" onClick={onUndo} />}
      </div>
      {status && <div className="mt-3">{status}</div>}
      {notices.map((n) => (
        <p key={n} className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {n}
        </p>
      ))}
      {children && <div className="mt-3 pt-3 border-t border-gray-100 space-y-4">{children}</div>}
    </GlassCard>
  );
}

/** Bảng chọn chế độ, chia nhóm; chế độ máy không chạy được bị làm mờ. */
export function ModePicker({
  mode,
  fw,
  onSelect,
  onClose,
}: {
  mode?: HybridMode;
  fw?: string | null;
  onSelect: (m: HybridMode) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Chọn chế độ hoạt động" onClose={onClose}>
      <div className="space-y-4">
        {MODE_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{g.title}</p>
            <div className="space-y-1.5">
              {g.ids.map((id) => {
                const m = modeDef(id);
                return m ? <ModeOption key={id} m={m} selected={mode === id} fw={fw} onSelect={onSelect} /> : null;
              })}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function ModeOption({
  m,
  selected,
  fw,
  onSelect,
}: {
  m: ModeDef;
  selected: boolean;
  fw?: string | null;
  onSelect: (m: HybridMode) => void;
}) {
  const blocked = modeUnsupported(m, fw);
  const Icon = MODE_ICON[m.id];
  return (
    <button
      type="button"
      disabled={!!blocked && !selected}
      onClick={() => onSelect(m.id)}
      className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-50 ${
        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${selected ? 'text-blue-600' : 'text-gray-400'}`} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-gray-900'}`}>{m.label}</span>
          {m.needsCt && <Chip>Cần CT lưới</Chip>}
        </span>
        <span className="block text-xs text-gray-500 mt-0.5">{m.desc}</span>
        {blocked && <span className="block text-xs font-semibold text-amber-700 mt-0.5">{blocked}</span>}
      </span>
      {selected && <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />}
    </button>
  );
}

/** Đã lưu rồi thì máy đang ở bước nào. */
export function ApplyStatus({
  pending,
  online,
  requestAt,
  cfgAt,
}: {
  pending: boolean;
  online: boolean;
  requestAt?: string | null;
  cfgAt?: string | null;
}) {
  let Icon = CheckCircle2;
  let cls = 'text-green-700';
  let text: string;
  if (pending) {
    const saved = requestAt ? ` Đã lưu lúc ${fmtShortTime(requestAt)}.` : '';
    const mins = requestAt ? Math.floor((Date.now() - new Date(requestAt).getTime()) / 60000) : 0;
    if (!online) {
      Icon = CloudOff;
      cls = 'text-amber-700';
      text = `Máy đang offline.${saved} Máy sẽ áp dụng khi kết nối lại.`;
    } else if (mins >= 2) {
      Icon = Hourglass;
      cls = 'text-amber-700';
      text = `Máy chưa áp dụng sau ${mins} phút. Có thể máy đang ở menu hoặc đang chỉnh tại chỗ.`;
    } else {
      Icon = RefreshCw;
      cls = 'text-blue-700';
      text = `Đang gửi xuống máy...${saved}`;
    }
  } else if (!online) {
    Icon = CloudOff;
    cls = 'text-gray-500';
    text = `Máy offline. Cài đặt máy báo lần cuối lúc ${fmtShortTime(cfgAt)}.`;
  } else if (cfgAt) {
    text = `Máy đang chạy đúng cài đặt này (cập nhật ${fmtShortTime(cfgAt)}).`;
  } else {
    return null;
  }
  return (
    <p className={`flex items-start gap-1.5 text-xs ${cls}`}>
      <Icon className="w-4 h-4 shrink-0" /> {text}
    </p>
  );
}
