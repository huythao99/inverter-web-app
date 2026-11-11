import type { ReactNode } from 'react';
import { Wand2 } from 'lucide-react';
import type { HinvlfFrame, HybridConfig, HybridMode, HybridNumberKey } from '../../../types';
import { FIELD, LADDER_KEYS, modeUsesKey } from '../../../services/hinvlf';
import { fmtVolt } from '../../../utils/fmt';
import { Chip, PendingBadge, UndoButton } from '../ui';

/**
 * Thang điện áp pin, từ trên xuống phải giảm dần: Áp sạc (chỉ đọc) ≥ Áp dừng
 * xả ≥ Pin chạy lại > Pin ngắt xả. Ô người dùng không sửa tự dịch theo
 * (pullAlong); khung dưới cùng liệt kê các ô đã tự chỉnh.
 */
export function Ladder({
  cfg,
  parsed,
  effective,
  mode,
  edited,
  errors,
  pending,
  focusKey,
  hint,
  input,
  onUndo,
}: {
  cfg?: HinvlfFrame | null;
  parsed: HybridConfig;
  effective: HybridConfig;
  mode?: HybridMode;
  edited: Set<string>;
  errors: Partial<Record<HybridNumberKey, string>>;
  pending: Set<string>;
  /** Ô đang chỉnh: chỉ ô này (và ô lỗi) hiện dòng gợi ý dải. */
  focusKey?: string | null;
  hint: (k: HybridNumberKey) => string;
  input: (k: HybridNumberKey) => ReactNode;
  onUndo: (k: HybridNumberKey) => void;
}) {
  const pulled = LADDER_KEYS.filter((k) => !edited.has(k) && parsed[k] !== effective[k]);
  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Từ trên xuống phải giảm dần. Sửa một mức, các mức khác tự dịch theo để giữ đúng thứ tự.
      </p>
      <Step label="Áp sạc" desc="Chỉ đọc, đặt trên máy" first dot="bg-gray-300">
        <span className="text-sm font-semibold text-gray-500 tabular-nums">{fmtVolt(cfg?.VCV)}</span>
      </Step>
      {LADDER_KEYS.map((k, i) => {
        const f = FIELD[k];
        const used = modeUsesKey(mode, k);
        const err = errors[k];
        const canUndo = edited.has(k) && parsed[k] !== effective[k];
        return (
          <Step
            key={k}
            label={f.label}
            desc={f.hint}
            last={i === LADDER_KEYS.length - 1}
            dot={used ? 'bg-blue-500' : 'bg-gray-300'}
            highlight={used}
            badges={
              <>
                {used && <Chip>đang dùng</Chip>}
                {pending.has(k) && <PendingBadge />}
                {canUndo && <UndoButton label={f.label} onClick={() => onUndo(k)} />}
                {pulled.includes(k) && <span className="text-[11px] font-semibold text-blue-600">tự chỉnh</span>}
              </>
            }
            note={err ?? (focusKey === k ? hint(k) : undefined)}
            error={!!err}
          >
            {input(k)}
          </Step>
        );
      })}
      {pulled.length > 0 && (
        <p className="mt-1 flex items-start gap-2 rounded-lg bg-blue-50 p-2.5 text-xs text-blue-800">
          <Wand2 className="w-4 h-4 shrink-0" />
          <span>
            Tự chỉnh để giữ đúng thứ tự:{' '}
            {pulled.map((k) => `${FIELD[k].label} ${fmtVolt(effective[k])} → ${fmtVolt(parsed[k])}`).join(', ')}. Bấm Lưu
            để gửi cả bộ.
          </span>
        </p>
      )}
    </div>
  );
}

function Step({
  label,
  desc,
  dot,
  first,
  last,
  highlight,
  badges,
  note,
  error,
  children,
}: {
  label: string;
  desc: string;
  dot: string;
  first?: boolean;
  last?: boolean;
  highlight?: boolean;
  badges?: ReactNode;
  note?: string;
  error?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="relative pl-7 pb-3.5">
      {/* thanh dọc nối các mức + chấm */}
      <span
        className={`absolute left-[9px] w-0.5 bg-gray-200 ${first ? 'top-5' : 'top-0'} ${last ? 'h-5' : 'bottom-0'}`}
      />
      <span className={`absolute left-1 top-3.5 w-3 h-3 rounded-full ${dot}`} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 pt-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm ${highlight ? 'font-bold text-blue-700' : 'font-semibold text-gray-900'}`}>{label}</span>
            {badges}
          </div>
          <p className="text-xs text-gray-500">{desc}</p>
        </div>
        {children}
      </div>
      {note && <p className={`mt-1 text-[11px] ${error ? 'text-red-600' : 'text-gray-400'}`}>{note}</p>}
    </div>
  );
}
