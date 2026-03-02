import { Outlet, Link, useLocation } from 'react-router-dom';
import { useHubAuth } from '@/contexts/HubAuthContext';
import {
  LogOut, Users, BookOpen, BarChart3, Shield, Bell, ArrowLeft,
} from 'lucide-react';

const ADMIN_NAV = [
  { path: '/plataforma/admin', label: 'Métricas', icon: BarChart3, exact: true },
  { path: '/plataforma/admin/membros', label: 'Membros', icon: Users },
  { path: '/plataforma/admin/conteudo', label: 'Conteúdo', icon: BookOpen },
  { path: '/plataforma/admin/roles', label: 'Roles', icon: Shield },
  { path: '/plataforma/admin/alertas', label: 'Alertas', icon: Bell },
];

export default function HubAdminLayout() {
  const { user, hubProfile, signOut } = useHubAuth();
  const location = useLocation();

  const isActive = (item: typeof ADMIN_NAV[0]) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#111111', color: '#FFFFFF' }}>
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col border-r"
        style={{ borderColor: '#1a1a1a', background: '#0d0d0d' }}
      >
        {/* Brand */}
        <div className="px-5 py-5 border-b" style={{ borderColor: '#1a1a1a' }}>
          <p className="text-[10px] tracking-[3px] uppercase font-medium" style={{ color: '#FF1657' }}>
            MX3 ADMIN
          </p>
          <p className="text-[10px] mt-1" style={{ color: '#444' }}>Painel Administrativo</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {ADMIN_NAV.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex items-center gap-2.5 px-3 py-2.5 text-xs tracking-wide transition-all"
                style={{
                  color: active ? '#FFFFFF' : '#666',
                  background: active ? '#1a1a1a' : 'transparent',
                  borderLeft: active ? '2px solid #FF1657' : '2px solid transparent',
                }}
              >
                <item.icon className="w-4 h-4" style={{ color: active ? '#FF1657' : '#555' }} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to student view */}
        <div className="px-3 py-4 border-t" style={{ borderColor: '#1a1a1a' }}>
          <Link
            to="/plataforma/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:opacity-80"
            style={{ color: '#666' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Visão do Aluno
          </Link>
        </div>

        {/* User */}
        <div className="px-5 py-4 border-t flex items-center justify-between" style={{ borderColor: '#1a1a1a' }}>
          <span className="text-[10px] truncate" style={{ color: '#666' }}>
            {hubProfile?.nome || user?.email}
          </span>
          <button onClick={signOut} className="hover:opacity-80 transition-opacity" style={{ color: '#666' }}>
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
