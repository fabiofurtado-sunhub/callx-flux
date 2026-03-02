import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHubAuth } from '@/contexts/HubAuthContext';
import { User, Flame, BarChart3, BookOpen, CheckCircle2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function HubProfile() {
  const { user, hubProfile } = useHubAuth();
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ completed: 0, total: 0 });

  useEffect(() => {
    if (hubProfile) {
      setNome(hubProfile.nome);
      setTelefone(hubProfile.telefone || '');
    }
  }, [hubProfile]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: lessons } = await supabase.from('hub_lessons').select('id');
      const { data: progress } = await supabase
        .from('hub_user_progress')
        .select('concluida')
        .eq('user_id', user.id);
      setStats({
        total: lessons?.length || 0,
        completed: (progress || []).filter(p => p.concluida).length,
      });
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('hub_profiles')
      .update({ nome, telefone })
      .eq('user_id', user.id);
    if (error) toast.error(error.message);
    else toast.success('Perfil atualizado');
    setSaving(false);
  };

  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <User className="w-5 h-5" style={{ color: '#FF1657' }} />
          Meu Perfil
        </h1>
        <p className="text-xs mt-1" style={{ color: '#666' }}>Seus dados e progresso na plataforma</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <Flame className="w-4 h-4 mb-2" style={{ color: '#FF1657' }} />
          <p className="text-2xl font-bold">{hubProfile?.engagement_score ?? 0}</p>
          <p className="text-[10px]" style={{ color: '#666' }}>Engajamento</p>
        </div>
        <div className="p-4 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <BarChart3 className="w-4 h-4 mb-2" style={{ color: '#FF1657' }} />
          <p className="text-2xl font-bold">{hubProfile?.dias_consecutivos ?? 0}</p>
          <p className="text-[10px]" style={{ color: '#666' }}>Dias consecutivos</p>
        </div>
        <div className="p-4 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <BookOpen className="w-4 h-4 mb-2" style={{ color: '#FF1657' }} />
          <p className="text-2xl font-bold">{pct}%</p>
          <p className="text-[10px]" style={{ color: '#666' }}>Progresso</p>
        </div>
        <div className="p-4 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <CheckCircle2 className="w-4 h-4 mb-2" style={{ color: '#FF1657' }} />
          <p className="text-2xl font-bold">{hubProfile?.total_login_count ?? 0}</p>
          <p className="text-[10px]" style={{ color: '#666' }}>Acessos</p>
        </div>
      </div>

      {/* Edit form */}
      <div className="border p-6 space-y-4" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
        <h2 className="text-sm font-semibold">Dados Pessoais</h2>
        <div>
          <label className="text-[10px] tracking-[2px] uppercase block mb-1" style={{ color: '#666' }}>Nome</label>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="w-full h-9 px-3 text-sm border"
            style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }}
          />
        </div>
        <div>
          <label className="text-[10px] tracking-[2px] uppercase block mb-1" style={{ color: '#666' }}>Telefone</label>
          <input
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            className="w-full h-9 px-3 text-sm border"
            style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }}
            placeholder="(11) 99999-9999"
          />
        </div>
        <div>
          <label className="text-[10px] tracking-[2px] uppercase block mb-1" style={{ color: '#666' }}>Email</label>
          <input
            value={user?.email || ''}
            disabled
            className="w-full h-9 px-3 text-sm border opacity-60"
            style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 h-9 px-5 text-xs font-medium"
          style={{ background: '#FF1657', color: '#fff' }}
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
