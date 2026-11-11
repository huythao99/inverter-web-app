import type { Ref } from 'react';
import type { FieldDef } from '../../../services/hinvlf';
import { PendingBadge, UndoButton } from '../ui';

/** Ô số: gõ tự do, rời ô / Enter thì chốt (onCommit). */
export function NumInput({
  value,
  field,
  error,
  compact,
  inputRef,
  onChange,
  onCommit,
}: {
  value: string;
  field: FieldDef;
  error?: string;
  compact?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (v: string) => void;
  onCommit: () => void;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'shrink-0' : ''}`}>
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step={field.step}
        value={value}
        aria-label={field.label}
        aria-invalid={!!error}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={`${compact ? 'w-24 text-right' : 'w-full'} rounded-lg border px-3 py-2 text-base tabular-nums outline-none focus:ring-2 ${
          error ? 'border-red-400 focus:ring-red-200' : 'border-gray-300 focus:ring-blue-200'
        }`}
      />
      <span className="text-sm text-gray-500 w-4">{field.unit}</span>
    </div>
  );
}

/** Ô công suất (trong thẻ chế độ / giới hạn): nhãn, mô tả, ô nhập, dải. */
export function PowerField({
  field,
  value,
  error,
  hint,
  pending,
  pulled,
  canUndo,
  inputRef,
  onChange,
  onCommit,
  onUndo,
}: {
  field: FieldDef;
  value: string;
  error?: string;
  hint: string;
  pending: boolean;
  pulled: boolean;
  canUndo: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (v: string) => void;
  onCommit: () => void;
  onUndo: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm font-semibold text-gray-900">{field.label}</span>
        {canUndo && <UndoButton label={field.label} onClick={onUndo} />}
        {pending && <PendingBadge />}
      </div>
      {field.modes && <p className="text-xs text-gray-500">{field.hint}</p>}
      <div className="mt-1.5">
        <NumInput value={value} field={field} error={error} inputRef={inputRef} onChange={onChange} onCommit={onCommit} />
      </div>
      <p className={`mt-1 text-[11px] ${error ? 'text-red-600' : 'text-gray-400'}`}>
        {error || hint}
        {pulled && !error ? ' · tự chỉnh theo giới hạn mới' : ''}
      </p>
    </div>
  );
}
