import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useHubAuth } from '@/contexts/HubAuthContext';
import { Flame, BarChart3, BookOpen, ChevronRight, CheckCircle2 } from 'lucide-react';

interface CourseSummary {
  id: string;
  nome: string;
  totalLessons: number;
  completedLessons: number;
}

export default function HubDashboard() {
  const { user, hubProfile } = useHubAuth();
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [recentLesson, setRecentLesson] = useState<{ nome: string; courseId: string } | null>(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const { data: coursesData } = await supabase
        .from('hub_courses')
        .select('id, nome')
        .eq('ativo', true)
        .order('created_at');

      if (!coursesData) return;

      const { data: modules } = await supabase.from('hub_modules').select('id, course_id');
      const { data: lessons } = await supabase.from('hub_lessons').select('id, module_id');
      const { data: progress } = await supabase
        .from('hub_user_progress')
        .select('lesson_id, concluida')
        .eq('user_id', user.id);

      const completedSet = new Set(
        (progress || []).filter((p) => p.concluida).map((p) => p.lesson_id)
      );

      const moduleMap = new Map<string, string>();
      (modules || []).forEach((m) => moduleMap.set(m.id, m.course_id));

      const courseLessons = new Map<string, string[]>();
      (lessons || []).forEach((l) => {
        const cId = moduleMap.get(l.module_id);
        if (cId) {
          const arr = courseLessons.get(cId) || [];
          arr.push(l.id);
          courseLessons.set(cId, arr);
        }
      });

      setCourses(
        coursesData.map((c) => {
          const ids = courseLessons.get(c.id) || [];
          return {
            id: c.id,
            nome: c.nome,
            totalLessons: ids.length,
            completedLessons: ids.filter((id) => completedSet.has(id)).length,
          };
        })
      );

      // Recent lesson
      const { data: recent } = await supabase
        .from('hub_user_progress')
        .select('lesson_id, hub_lessons(nome, module_id, hub_modules:module_id(course_id))')
        .eq('user_id', user.id)
        .order('ultimo_acesso', { ascending: false })
        .limit(1);

      if (recent && recent.length > 0) {
        const r = recent[0] as any;
        const lessonName = r.hub_lessons?.nome || '';
        const courseIdVal = r.hub_lessons?.hub_modules?.course_id || '';
        if (lessonName) setRecentLesson({ nome: lessonName, courseId: courseIdVal });
      }
    };

    load();
  }, [user]);

  const totalCompleted = courses.reduce((a, c) => a + c.completedLessons, 0);
  const totalLessons = courses.reduce((a, c) => a + c.totalLessons, 0);
  const overallPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              Progresso
            </span>
          </div>
          <p className="text-3xl font-bold">{overallPct}%</p>
          <p className="text-xs mt-1" style={{ color: '#444' }}>
            {totalCompleted}/{totalLessons} aulas
          </p>
        </div>

        <div className="p-5 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <div className="flex items-center gap-3 mb-3">
            <CheckCircle2 className="w-4 h-4" style={{ color: '#FF1657' }} />
            <span className="text-[10px] tracking-[2px] uppercase" style={{ color: '#666' }}>
              Acessos
            </span>
          </div>
          <p className="text-3xl font-bold">{hubProfile?.total_login_count ?? 0}</p>
          <p className="text-xs mt-1" style={{ color: '#444' }}>logins registrados</p>
        </div>
      </div>

      {/* Continue studying */}
      {recentLesson && (
        <Link
          to={`/plataforma/cursos/${recentLesson.courseId}`}
          className="flex items-center justify-between p-4 border transition-colors hover:border-[#FF1657]/40"
          style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
        >
          <div>
            <p className="text-[10px] tracking-[2px] uppercase mb-1" style={{ color: '#666' }}>
              Continuar assistindo
            </p>
            <p className="text-sm font-medium">{recentLesson.nome}</p>
          </div>
          <ChevronRight className="w-4 h-4" style={{ color: '#FF1657' }} />
        </Link>
      )}

      {/* Courses summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-tight">Meus Cursos</h2>
          <Link
            to="/plataforma/cursos"
            className="text-[10px] tracking-[2px] uppercase hover:underline"
            style={{ color: '#FF1657' }}
          >
            Ver todos
          </Link>
        </div>

        {courses.length === 0 ? (
          <div
            className="p-8 border text-center"
            style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
          >
            <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: '#333' }} />
            <p className="text-sm" style={{ color: '#666' }}>
              Nenhum curso disponível ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {courses.map((c) => {
              const pct =
                c.totalLessons > 0
                  ? Math.round((c.completedLessons / c.totalLessons) * 100)
                  : 0;
              return (
                <Link
                  key={c.id}
                  to={`/plataforma/cursos/${c.id}`}
                  className="flex items-center gap-4 p-4 border transition-colors hover:border-[#FF1657]/40"
                  style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.nome}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#666' }}>
                      {c.completedLessons}/{c.totalLessons} aulas · {pct}%
                    </p>
                  </div>
                  <div className="w-24 h-1" style={{ background: '#2a2a2a' }}>
                    <div
                      className="h-full"
                      style={{ width: `${pct}%`, background: '#FF1657' }}
                    />
                  </div>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#444' }} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
