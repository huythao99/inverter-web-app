import { useSlidingIndicator } from '../hooks/useSlidingIndicator';

/** Segmented control whose white pill slides to the selected option. */
export function SlidingSegmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const active = options.findIndex((o) => o.id === value);
  const s = useSlidingIndicator(active);
  return (
    <div
      ref={s.containerRef}
      role="tablist"
      className={`relative flex rounded-lg bg-gray-100 p-0.5 text-xs sm:text-sm font-medium ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-md bg-white shadow-sm"
        style={s.indicatorStyle}
      />
      {options.map((opt, i) => (
        <button
          key={opt.id}
          ref={s.itemRef(i)}
          role="tab"
          aria-selected={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={`relative z-10 px-2.5 sm:px-3 py-1.5 rounded-md whitespace-nowrap transition-colors duration-300 ${
            value === opt.id ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
