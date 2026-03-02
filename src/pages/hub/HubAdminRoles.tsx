import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Search, UserCog } from 'lucide-react';
import { toast } from 'sonner';

type HubRole = 'aluno_hub' | 'admin_hub' | 'suporte_hub';

interface MemberRole {
  user_id: string;
  nome: string;
  email: string | null;
  roles: HubRole[];
}

const ROLE_LABELS: Record<HubRole, string> = {
  aluno_hub: 'Aluno',
  admin_hub: 'Admin',
  suporte_hub: 'Suporte',
};

const ROLE_COLORS: Record<HubRole, string> = {
  aluno_hub: '#00D2C8',
  admin_hub: '#FF1657',
  suporte_hub: '#F59E0B',
};

export default function HubAdminRoles() {
  const [members, setMembers] = useState<MemberRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchAll = async () => {
    const { data: profiles } = await supabase.from('hub_profiles').select('user_id, nome').order('nome');
    if (!profiles) { setLoading(false); return; }

    const userIds = profiles.map(p => p.user_id);

    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds)
      .in('role', ['aluno_hub', 'admin_hub', 'suporte_hub']);

    const { data: appProfiles } = await supabase
      .from('profiles')
      .select('user_id, email')
      .in('user_id', userIds);

    const emailMap = new Map<string, string>();
    (appProfiles || []).forEach(p => emailMap.set(p.user_id, p.email));

    const roleMap = new Map<string, HubRole[]>();
    (roles || []).forEach(r => {
      const arr = roleMap.get(r.user_id) || [];
      arr.push(r.role as HubRole);
      roleMap.set(r.user_id, arr);
    });

    setMembers(
      profiles.map(p => ({
        user_id: p.user_id,
        nome: p.nome,
        email: emailMap.get(p.user_id) || null,
        roles: roleMap.get(p.user_id) || [],
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleRole = async (userId: string, role: HubRole, hasRole: boolean) => {
    if (hasRole) {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
      if (error) { toast.error(error.message); return; }
      toast.success(`Role ${ROLE_LABELS[role]} removida`);
    } else {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) { toast.error(error.message); return; }
      toast.success(`Role ${ROLE_LABELS[role]} atribuída`);
    }
    fetchAll();
  };

  const filtered = members.filter(m =>
    m.nome.toLowerCase().includes(search.toLowerCase()) ||
    (m.email?.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="p-10 text-sm animate-pulse" style={{ color: '#666' }}>Carregando...</div>;

  return (
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <UserCog className="w-5 h-5" style={{ color: '#FF1657' }} />
          Gestão de Roles
        </h1>
        <p className="text-xs mt-1" style={{ color: '#666' }}>Atribua ou remova papéis dos membros da plataforma</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#444' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar membro..."
          className="w-full h-10 pl-10 pr-4 text-sm border"
          style={{ background: '#1a1a1a', borderColor: '#2a2a2a', color: '#fff' }}
        />
      </div>

      <div className="border" style={{ borderColor: '#2a2a2a' }}>
        <div
          className="grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-3 text-[10px] tracking-[2px] uppercase"
          style={{ color: '#666', borderBottom: '1px solid #2a2a2a', background: '#151515' }}
        >
          <span>Membro</span>
          {(['aluno_hub', 'admin_hub', 'suporte_hub'] as HubRole[]).map(r => (
            <span key={r} className="text-center">{ROLE_LABELS[r]}</span>
          ))}
        </div>

        {filtered.map((m) => (
          <div key={m.user_id} className="grid grid-cols-[1fr_100px_100px_100px] gap-2 px-4 py-3 items-center" style={{ borderBottom: '1px solid #1a1a1a' }}>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{m.nome}</p>
              <p className="text-[10px] truncate" style={{ color: '#444' }}>{m.email || '—'}</p>
            </div>
            {(['aluno_hub', 'admin_hub', 'suporte_hub'] as HubRole[]).map(role => {
              const has = m.roles.includes(role);
              return (
                <div key={role} className="text-center">
                  <button
                    onClick={() => toggleRole(m.user_id, role, has)}
                    className="px-3 py-1 text-[10px] font-medium border transition-all"
                    style={{
                      background: has ? `${ROLE_COLORS[role]}20` : 'transparent',
                      borderColor: has ? ROLE_COLORS[role] : '#2a2a2a',
                      color: has ? ROLE_COLORS[role] : '#666',
                    }}
                  >
                    {has ? '✓' : '—'}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
