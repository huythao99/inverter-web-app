import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Sun, User } from 'lucide-react';
import { SupportBanner } from './SupportBanner';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
