import { Outlet, Link, useLocation } from 'react-router-dom';
import { useHubAuth } from '@/contexts/HubAuthContext';
import { LogOut, LayoutDashboard, BookOpen, Shield } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/plataforma/dashboard', label: 'Painel', icon: LayoutDashboard },
  { path: '/plataforma/cursos', label: 'Cursos', icon: BookOpen },
];

const ADMIN_NAV = { path: '/plataforma/admin', label: 'Admin', icon: Shield };

export default function HubLayout() {
  const { user, hubProfile, isHubAdmin, signOut } = useHubAuth();
  const location = useLocation();
  const navItems = isHubAdmin ? [...NAV_ITEMS, ADMIN_NAV] : NAV_ITEMS;

  return (
    <div className="min-h-screen" style={{ background: '#111111', color: '#FFFFFF' }}>
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: '#1a1a1a' }}
      >
        <div className="flex items-center gap-6">
          <Link to="/plataforma/dashboard" className="flex items-center gap-3">
            <span
              className="text-[10px] tracking-[3px] uppercase font-medium"
              style={{ color: '#FF1657' }}
            >
              MX3 EXECUTION HUB
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs tracking-wide transition-colors"
                  style={{
                    color: active ? '#FF1657' : '#666',
                    borderBottom: active ? '1px solid #FF1657' : '1px solid transparent',
                  }}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs hidden sm:block" style={{ color: '#666' }}>
            {hubProfile?.nome || user?.email}
          </span>
          <button
            onClick={signOut}
            className="hover:opacity-80 transition-opacity"
            style={{ color: '#666' }}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
