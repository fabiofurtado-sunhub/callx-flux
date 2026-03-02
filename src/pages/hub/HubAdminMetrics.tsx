import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, BookOpen, Flame, TrendingUp, AlertTriangle, Trophy } from 'lucide-react';

interface Metrics {
  totalAlunos: number;
  alunosAtivos: number;
  avgEngagement: number;
  totalAulas: number;
  totalConclusoes: number;
  inativos3dias: number;
  inativos7dias: number;
  topStudents: { nome: string; score: number }[];
}

export default function HubAdminMetrics() {
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: profiles } = await supabase
        .from('hub_profiles')
        .select('*')
        .order('engagement_score', { ascending: false });

      const { data: lessons } = await supabase.from('hub_lessons').select('id');
      const { data: progress } = await supabase.from('hub_user_progress').select('concluida');

      const now = Date.now();
      const profs = profiles || [];

      const ativos = profs.filter(p => {
        if (!p.ultimo_login) return false;
        return (now - new Date(p.ultimo_login).getTime()) / 86400000 < 3;
      });

      const inativos3 = profs.filter(p => {
        if (!p.ultimo_login) return true;
        const d = (now - new Date(p.ultimo_login).getTime()) / 86400000;
        return d >= 3 && d < 7;
      });

      const inativos7 = profs.filter(p => {
        if (!p.ultimo_login) return true;
        return (now - new Date(p.ultimo_login).getTime()) / 86400000 >= 7;
      });

      const avgEng = profs.length > 0
        ? Math.round(profs.reduce((a, p) => a + p.engagement_score, 0) / profs.length)
        : 0;

      setM({
        totalAlunos: profs.length,
        alunosAtivos: ativos.length,
        avgEngagement: avgEng,
        totalAulas: lessons?.length || 0,
        totalConclusoes: (progress || []).filter(p => p.concluida).length,
        inativos3dias: inativos3.length,
        inativos7dias: inativos7.length,
        topStudents: profs.slice(0, 5).map(p => ({ nome: p.nome, score: p.engagement_score })),
      });
    };
    load();
  }, []);

  if (!m) return <div className="p-10 text-sm animate-pulse" style={{ color: '#666' }}>Carregando métricas...</div>;

  const kpis = [
    { label: 'Total Alunos', value: m.totalAlunos, icon: Users, color: '#FF1657' },
    { label: 'Ativos Agora', value: m.alunosAtivos, icon: TrendingUp, color: '#00FF78' },
    { label: 'Engajamento Médio', value: m.avgEngagement, icon: Flame, color: '#F59E0B' },
    { label: 'Total Aulas', value: m.totalAulas, icon: BookOpen, color: '#00D2C8' },
    { label: 'Conclusões', value: m.totalConclusoes, icon: Trophy, color: '#FF1657' },
    { label: 'Inativos ≥3d', value: m.inativos3dias, icon: AlertTriangle, color: '#F59E0B' },
    { label: 'Inativos ≥7d', value: m.inativos7dias, icon: AlertTriangle, color: '#FF4455' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-8 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard Admin</h1>
        <p className="text-xs mt-1" style={{ color: '#666' }}>Visão geral da plataforma</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="p-5 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
            <div className="flex items-center gap-2 mb-3">
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
              <span className="text-[10px] tracking-[2px] uppercase" style={{ color: '#666' }}>{k.label}</span>
            </div>
            <p className="text-2xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Top Students */}
      <div className="border p-5" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: '#FF1657' }} />
          Top 5 Alunos
        </h2>
        <div className="space-y-2">
          {m.topStudents.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid #2a2a2a' }}>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold w-5" style={{ color: i < 3 ? '#FF1657' : '#666' }}>{i + 1}</span>
                <span className="text-sm">{s.nome}</span>
              </div>
              <span className="text-sm font-bold">{s.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
