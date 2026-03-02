import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Flame, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { toast } from 'sonner';

interface MemberRow {
  user_id: string;
  nome: string;
  telefone: string | null;
  engagement_score: number;
  total_login_count: number;
  dias_consecutivos: number;
  ultimo_login: string | null;
  status: string;
  completedLessons: number;
  totalLessons: number;
  email: string | null;
}

export default function HubAdminMembers() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchMembers = async () => {
    const { data: profiles } = await supabase
      .from('hub_profiles')
      .select('*')
      .order('engagement_score', { ascending: false });

    if (!profiles) { setLoading(false); return; }

    const { data: progress } = await supabase.from('hub_user_progress').select('user_id, concluida');
    const { data: allLessons } = await supabase.from('hub_lessons').select('id');
    const totalLessons = allLessons?.length || 0;

    // Get emails from profiles table
    const userIds = profiles.map(p => p.user_id);
    const { data: appProfiles } = await supabase
      .from('profiles')
      .select('user_id, email')
      .in('user_id', userIds);

    const emailMap = new Map<string, string>();
    (appProfiles || []).forEach(p => emailMap.set(p.user_id, p.email));

    const completedMap = new Map<string, number>();
    (progress || []).forEach((p) => {
      if (p.concluida) {
        completedMap.set(p.user_id, (completedMap.get(p.user_id) || 0) + 1);
      }
    });

    setMembers(
      profiles.map((p) => ({
        user_id: p.user_id,
        nome: p.nome,
        telefone: p.telefone,
        engagement_score: p.engagement_score,
        total_login_count: p.total_login_count,
        dias_consecutivos: p.dias_consecutivos,
        ultimo_login: p.ultimo_login,
        status: p.status,
        completedLessons: completedMap.get(p.user_id) || 0,
        totalLessons,
        email: emailMap.get(p.user_id) || null,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  const toggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';
    const { error } = await supabase
      .from('hub_profiles')
      .update({ status: newStatus })
      .eq('user_id', userId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Aluno ${newStatus === 'ativo' ? 'ativado' : 'desativado'}`);
    fetchMembers();
  };

  const filtered = members.filter(m =>
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    (m.email?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="p-10 text-sm animate-pulse" style={{ color: '#666' }}>Carregando membros...</div>;

  return (
    <div className="max-w-6xl mx-auto px-8 py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Membros</h1>
          <p className="text-xs mt-1" style={{ color: '#666' }}>{members.length} alunos cadastrados</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#444' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome ou email..."
          className="w-full h-10 pl-10 pr-4 text-sm border"
          style={{ background: '#1a1a1a', borderColor: '#2a2a2a', color: '#fff' }}
        />
      </div>

      {/* Table */}
      <div className="border" style={{ borderColor: '#2a2a2a' }}>
        <div
          className="grid grid-cols-[1fr_120px_80px_80px_80px_80px_60px] gap-2 px-4 py-3 text-[10px] tracking-[2px] uppercase"
          style={{ color: '#666', borderBottom: '1px solid #2a2a2a', background: '#151515' }}
        >
          <span>Aluno</span>
          <span>Email</span>
          <span className="text-center">Score</span>
          <span className="text-center">Streak</span>
          <span className="text-center">Progresso</span>
          <span className="text-center">Logins</span>
          <span className="text-center">Status</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: '#666' }}>Nenhum membro encontrado.</div>
        ) : (
          filtered.map((m, i) => {
            const pct = m.totalLessons > 0 ? Math.round((m.completedLessons / m.totalLessons) * 100) : 0;
            const lastLogin = m.ultimo_login ? new Date(m.ultimo_login).toLocaleDateString('pt-BR') : '—';
            const isActive = m.status === 'ativo';

            return (
              <div
                key={m.user_id}
                className="grid grid-cols-[1fr_120px_80px_80px_80px_80px_60px] gap-2 px-4 py-3 items-center"
                style={{ borderBottom: '1px solid #1a1a1a' }}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.nome}</p>
                  <p className="text-[10px] truncate" style={{ color: '#444' }}>Último: {lastLogin}</p>
                </div>
                <span className="text-[10px] truncate" style={{ color: '#666' }}>{m.email || '—'}</span>
                <div className="text-center">
                  <span className="text-sm font-bold">{m.engagement_score}</span>
                </div>
                <div className="text-center flex items-center justify-center gap-1">
                  <Flame className="w-3 h-3" style={{ color: m.dias_consecutivos > 0 ? '#FF1657' : '#333' }} />
                  <span className="text-xs">{m.dias_consecutivos}</span>
                </div>
                <div className="text-center">
                  <span className="text-xs">{pct}%</span>
                </div>
                <div className="text-center">
                  <span className="text-xs">{m.total_login_count}</span>
                </div>
                <div className="text-center">
                  <button onClick={() => toggleStatus(m.user_id, m.status)} className="hover:opacity-80">
                    {isActive
                      ? <ToggleRight className="w-5 h-5" style={{ color: '#00FF78' }} />
                      : <ToggleLeft className="w-5 h-5" style={{ color: '#666' }} />
                    }
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
