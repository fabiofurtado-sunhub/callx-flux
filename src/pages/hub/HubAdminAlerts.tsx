import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Flame } from 'lucide-react';

interface InactiveStudent {
  user_id: string;
  nome: string;
  engagement_score: number;
  total_login_count: number;
  ultimo_login: string | null;
  daysInactive: number;
}

export default function HubAdminAlerts() {
  const [students, setStudents] = useState<InactiveStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: profiles } = await supabase
        .from('hub_profiles')
        .select('*')
        .order('ultimo_login', { ascending: true, nullsFirst: true });

      if (!profiles) { setLoading(false); return; }

      const now = Date.now();
      const inactive = profiles
        .map(p => {
          const days = p.ultimo_login
            ? Math.floor((now - new Date(p.ultimo_login).getTime()) / 86400000)
            : 999;
          return { ...p, daysInactive: days };
        })
        .filter(p => p.daysInactive >= 3);

      setStudents(
        inactive.map(p => ({
          user_id: p.user_id,
          nome: p.nome,
          engagement_score: p.engagement_score,
          total_login_count: p.total_login_count,
          ultimo_login: p.ultimo_login,
          daysInactive: p.daysInactive,
        }))
      );
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="p-10 text-sm animate-pulse" style={{ color: '#666' }}>Carregando...</div>;

  const critical = students.filter(s => s.daysInactive >= 7);
  const warning = students.filter(s => s.daysInactive >= 3 && s.daysInactive < 7);

  return (
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" style={{ color: '#FF1657' }} />
          Alertas de Inatividade
        </h1>
        <p className="text-xs mt-1" style={{ color: '#666' }}>
          {students.length} alunos inativos · {critical.length} críticos (≥7d) · {warning.length} em risco (3-6d)
        </p>
      </div>

      {students.length === 0 ? (
        <div className="p-10 border text-center" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <Flame className="w-8 h-8 mx-auto mb-3" style={{ color: '#00FF78' }} />
          <p className="text-sm" style={{ color: '#666' }}>Todos os alunos estão ativos. 🎉</p>
        </div>
      ) : (
        <>
          {critical.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs tracking-[2px] uppercase font-medium" style={{ color: '#FF4455' }}>
                ⚠ Alerta Crítico — ≥7 dias sem acesso
              </h2>
              {critical.map(s => (
                <AlertCard key={s.user_id} student={s} severe />
              ))}
            </div>
          )}

          {warning.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs tracking-[2px] uppercase font-medium" style={{ color: '#F59E0B' }}>
                ⏳ Em Risco — 3 a 6 dias sem acesso
              </h2>
              {warning.map(s => (
                <AlertCard key={s.user_id} student={s} severe={false} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AlertCard({ student, severe }: { student: InactiveStudent; severe: boolean }) {
  const lastLogin = student.ultimo_login
    ? new Date(student.ultimo_login).toLocaleDateString('pt-BR')
    : 'Nunca acessou';

  return (
    <div
      className="flex items-center justify-between p-4 border"
      style={{
        background: '#1a1a1a',
        borderColor: severe ? '#FF4455' : '#2a2a2a',
      }}
    >
      <div>
        <p className="text-sm font-medium">{student.nome}</p>
        <p className="text-[10px] mt-0.5" style={{ color: '#666' }}>
          Score: {student.engagement_score} · {student.total_login_count} logins · Último: {lastLogin}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold" style={{ color: severe ? '#FF4455' : '#F59E0B' }}>
          {student.daysInactive === 999 ? 'Nunca' : `${student.daysInactive} dias`}
        </p>
      </div>
    </div>
  );
}
