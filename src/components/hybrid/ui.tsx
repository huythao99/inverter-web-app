import { useEffect } from 'react';
import { CARD } from './styles';
import type { ReactNode } from 'react';
import { ChevronDown, Clock, Undo2, X } from 'lucide-react';

// Khối giao diện dùng chung cho các tab của hybrid (cùng kiểu thẻ kính mờ
// trên nền background_2 như app).

export function GlassCard({
  title,
  icon,
  trailing,
  className = '',
  children,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${CARD} p-4 sm:p-5 ${className}`}>
      {title && (
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <h4 className="flex-1 min-w-0 text-base font-semibold text-gray-900">{title}</h4>
          {trailing}
        </div>
      )}
      {children}
    </section>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{children}</span>
    </div>
  );
}

export function PendingBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
      <Clock className="w-3 h-3" /> chờ áp dụng
    </span>
  );
}

export function Chip({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'gray' }) {
  const cls = tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600';
  return <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
}

/** Trả một ô về giá trị máy đang chạy. */
export function UndoButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`Hoàn tác ${label}`}
      aria-label={`Hoàn tác ${label}`}
      className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
    >
      <Undo2 className="w-4 h-4" />
    </button>
  );
}

/** Một mục trong khối: tiêu đề + tóm tắt một dòng, bấm để mở. */
export function Collapsible({
  title,
  summary,
  open,
  onToggle,
  badge,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-2 py-3 text-left">
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-gray-900">{title}</span>
          {!open && <span className="block truncate text-xs text-gray-500 mt-0.5">{summary}</span>}
        </span>
        {badge}
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}

/** Lớp phủ: trượt từ dưới lên trên điện thoại, hộp giữa màn hình trên máy tính. */
export function Sheet({
  title,
  onClose,
  children,
  z = 'z-50',
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  z?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center ${z}`} onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="min-w-0 text-lg font-semibold text-gray-900">{title}</div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Đóng">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export interface ConfirmAsk {
  title: string;
  text: string;
  list?: string[];
  ok: string;
  danger?: boolean;
}

/** Hộp hỏi lại (Huỷ / OK). */
export function ConfirmDialog({ ask, onResult }: { ask: ConfirmAsk; onResult: (ok: boolean) => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
      onClick={(e) => {
        e.stopPropagation();
        onResult(false);
      }}
    >
      <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{ask.title}</h3>
        <p className="text-gray-600 whitespace-pre-line">{ask.text}</p>
        {ask.list && (
          <ul className="mt-2 text-sm text-gray-800 list-disc pl-5">
            {ask.list.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <div className="flex space-x-3 mt-5">
          <button
            type="button"
            onClick={() => onResult(false)}
            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={() => onResult(true)}
            className={`flex-1 py-2 text-white rounded-lg font-medium ${
              ask.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {ask.ok}
          </button>
        </div>
      </div>
    </div>
  );
}

