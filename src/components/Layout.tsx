import { ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, HousePlug, LayoutGrid, LogOut, Sun, User } from 'lucide-react';
import { SupportBanner } from './SupportBanner';
import { useSlidingIndicator } from '../hooks/useSlidingIndicator';
import { useAuth } from '../contexts/AuthContext';

// "Thiết bị" stays selected on device pages too (/devices/..., /chargers/...).
const TABS = [
  {
    to: '/',
    label: 'Thiết bị',
    icon: LayoutGrid,
    match: (p: string) =>
      !p.startsWith('/home-assistant') && !p.startsWith('/overview') && !p.startsWith('/share'),
  },
  // "Tổng quan" holds two sub-tabs: Sản lượng (/overview) and Chia sẻ công suất (/share).
  {
    to: '/overview',
    label: 'Tổng quan',
    icon: BarChart3,
    match: (p: string) => p.startsWith('/overview') || p.startsWith('/share'),
  },
  { to: '/home-assistant', label: 'Home Assistant', icon: HousePlug, match: (p: string) => p.startsWith('/home-assistant') },
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const nav = useSlidingIndicator(
    TABS.findIndex((t) => t.match(pathname)),
    'main-nav',
  );

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SupportBanner className="relative z-30" />

      {/* Header */}
      <header className="relative z-20 bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <Sun className="w-8 h-8 text-yellow-500 shrink-0" />
              <span className="text-lg sm:text-xl font-bold text-gray-900 whitespace-nowrap">
                Giabao Inverter
              </span>
            </Link>

            {/* User Menu */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {user && (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'Người dùng'}
                        className="w-8 h-8 rounded-full shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-8 h-8 text-gray-400 shrink-0" />
                    )}
                    <span className="text-sm text-gray-700 hidden sm:block truncate max-w-[16rem]" title={user.displayName || user.email || undefined}>
                      {user.displayName || user.email}
                    </span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    aria-label="Đăng xuất"
                    className="flex items-center gap-1 shrink-0 p-1 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                    <span className="hidden sm:block text-sm">Đăng xuất</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Section tabs (same sections as the mobile app's bottom bar) */}
      {user && (
        <nav className="relative z-10 bg-white border-b border-gray-200">
          <div
            ref={nav.containerRef}
            className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto"
          >
            {/* Sliding underline under the active tab */}
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-blue-600"
              style={nav.indicatorStyle}
            />
            {TABS.map(({ to, label, icon: Icon, match }, i) => (
              <NavLink
                key={to}
                to={to}
                ref={nav.itemRef(i)}
                className={() =>
                  `relative flex items-center gap-2 shrink-0 px-3 sm:px-4 py-3 text-sm font-medium transition-colors duration-300 ${
                    match(pathname) ? 'text-blue-700' : 'text-gray-500 hover:text-gray-800'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
