import { useHubAuth } from '@/contexts/HubAuthContext';
import { LogOut, BarChart3, BookOpen, Flame } from 'lucide-react';

export default function HubDashboard() {
  const { user, hubProfile, signOut } = useHubAuth();

  return (
    <div className="min-h-screen" style={{ background: '#111111', color: '#FFFFFF' }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#1a1a1a' }}>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tracking-[3px] uppercase font-medium" style={{ color: '#FF1657' }}>
            MX3 EXECUTION HUB
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: '#666' }}>{user?.email}</span>
          <button onClick={signOut} className="hover:opacity-80 transition-opacity" style={{ color: '#666' }}>
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Olá, {hubProfile?.nome || user?.email?.split('@')[0]}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#666' }}>
            Bem-vindo ao seu painel de execução comercial.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
            <div className="flex items-center gap-3 mb-3">
              <Flame className="w-4 h-4" style={{ color: '#FF1657' }} />
              <span className="text-[10px] tracking-[2px] uppercase" style={{ color: '#666' }}>
                Engajamento
              </span>
            </div>
            <p className="text-3xl font-bold">{hubProfile?.engagement_score ?? 0}</p>
            <p className="text-xs mt-1" style={{ color: '#444' }}>de 100 pontos</p>
          </div>

          <div className="p-5 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
            <div className="flex items-center gap-3 mb-3">
              <BarChart3 className="w-4 h-4" style={{ color: '#FF1657' }} />
              <span className="text-[10px] tracking-[2px] uppercase" style={{ color: '#666' }}>
                Frequência
              </span>
            </div>
            <p className="text-3xl font-bold">{hubProfile?.dias_consecutivos ?? 0}</p>
            <p className="text-xs mt-1" style={{ color: '#444' }}>dias consecutivos</p>
          </div>

          <div className="p-5 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="w-4 h-4" style={{ color: '#FF1657' }} />
              <span className="text-[10px] tracking-[2px] uppercase" style={{ color: '#666' }}>
                Acessos totais
              </span>
            </div>
            <p className="text-3xl font-bold">{hubProfile?.total_login_count ?? 0}</p>
            <p className="text-xs mt-1" style={{ color: '#444' }}>logins registrados</p>
          </div>
        </div>

        {/* Placeholder for courses */}
        <div className="p-8 border text-center" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: '#333' }} />
          <p className="text-sm" style={{ color: '#666' }}>
            Nenhum curso disponível ainda.
          </p>
          <p className="text-xs mt-1" style={{ color: '#444' }}>
            Os cursos serão exibidos aqui quando liberados.
          </p>
        </div>
      </div>
    </div>
  );
}
