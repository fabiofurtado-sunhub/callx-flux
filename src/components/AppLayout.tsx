import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Kanban,
  Brain,
  DollarSign,
  Settings,
  Zap,
  Menu,
  X,
  LogOut,
  MessageCircle,
  Phone,
  Shield,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, type AppRole } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  gestor: 'Gestor',
  closer: 'Closer',
  sdr: 'SDR',
  suporte: 'Suporte',
  financeiro: 'Financeiro',
  vendedor: 'Vendedor',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-destructive text-destructive-foreground',
  gestor: 'bg-primary text-primary-foreground',
  closer: 'bg-blue-600 text-white',
  sdr: 'bg-green-600 text-white',
  suporte: 'bg-yellow-600 text-white',
  financeiro: 'bg-orange-600 text-white',
  vendedor: 'bg-muted text-muted-foreground',
};

interface NavItem {
  to: string;
  icon: any;
  label: string;
  requiredRoles?: AppRole[];
  requirePermission?: { section: string; action: string };
}

const allNavItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Clientes' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/inteligencia', icon: Brain, label: 'Inteligência', requiredRoles: ['admin', 'gestor'] },
  { to: '/investimentos', icon: DollarSign, label: 'Investimentos', requiredRoles: ['admin', 'gestor', 'financeiro'] },
  { to: '/chamadas', icon: Phone, label: 'Chamadas IA', requiredRoles: ['admin', 'gestor', 'closer'] },
  { to: '/setup-mensagens', icon: MessageCircle, label: 'Mensagens', requiredRoles: ['admin', 'gestor'] },
  { to: '/configuracoes', icon: Settings, label: 'Configurações', requiredRoles: ['admin'] },
];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { role, loading: permLoading } = usePermissions();
  const initials = user?.email?.substring(0, 2).toUpperCase() || 'MX';

  // Filter nav items based on role
  const navItems = allNavItems.filter(item => {
    if (!item.requiredRoles) return true;
    if (!role) return false;
    return item.requiredRoles.includes(role);
  });

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-sidebar-border bg-sidebar transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--gradient-sidebar)' }}
      >
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-display font-bold text-foreground">MX3 Lead Ops</h1>
            <p className="text-[10px] text-muted-foreground tracking-wider uppercase">CallX Automation</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setMobileOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sidebar-accent text-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
              {role && (
                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 mt-0.5 ${ROLE_COLORS[role] || ''}`}>
                  {ROLE_LABELS[role] || role}
                </Badge>
              )}
            </div>
            <button onClick={signOut} className="text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-30 flex items-center gap-4 px-6 py-3 border-b border-border bg-background/80 backdrop-blur-md lg:hidden">
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <span className="font-display font-bold text-foreground">MX3 Lead Ops</span>
        </header>
        <div className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
