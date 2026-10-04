import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, Share2 } from 'lucide-react';
import { useSlidingIndicator } from '../hooks/useSlidingIndicator';

// Sub-tabs of the "Tổng quan" menu tab: account energy and power share groups.
// Each sub-tab is its own route (the page remounts), so the pill remembers its
// last spot ('overview-tabs') and slides over from there.
const ITEMS = [
  { to: '/overview', label: 'Sản lượng', icon: BarChart3 },
  { to: '/share', label: 'Chia sẻ công suất', icon: Share2 },
];

export function OverviewTabs() {
  const { pathname } = useLocation();
  const active = pathname.startsWith('/share') ? 1 : 0;
  const s = useSlidingIndicator(active, 'overview-tabs');
  return (
    <div
      ref={s.containerRef}
      className="relative flex w-full sm:w-auto sm:inline-flex rounded-lg bg-gray-100 p-0.5 text-sm font-medium"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-md bg-white shadow-sm"
        style={s.indicatorStyle}
      />
      {ITEMS.map(({ to, label, icon: Icon }, i) => (
        <NavLink
          key={to}
          to={to}
          ref={s.itemRef(i)}
          className={`relative z-10 flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-md whitespace-nowrap transition-colors duration-300 ${
            active === i ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Icon className="w-4 h-4" />
          {label}
        </NavLink>
      ))}
    </div>
  );
}
