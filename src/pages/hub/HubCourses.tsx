import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useHubAuth } from '@/contexts/HubAuthContext';
import { BookOpen, ChevronRight } from 'lucide-react';

interface Course {
  id: string;
  nome: string;
  descricao: string | null;
  totalLessons: number;
  completedLessons: number;
}

export default function HubCourses() {
  const { user } = useHubAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchCourses = async () => {
      // Fetch courses
      const { data: coursesData } = await supabase
        .from('hub_courses')
        .select('id, nome, descricao')
        .eq('ativo', true)
        .order('created_at', { ascending: true });

      if (!coursesData) {
        setLoading(false);
        return;
      }

      // Fetch all lessons grouped by course via modules
      const { data: modules } = await supabase
        .from('hub_modules')
        .select('id, course_id');

      const { data: lessons } = await supabase
        .from('hub_lessons')
        .select('id, module_id');

      // Fetch user progress
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
        const courseId = moduleMap.get(l.module_id);
        if (courseId) {
          const arr = courseLessons.get(courseId) || [];
          arr.push(l.id);
          courseLessons.set(courseId, arr);
        }
      });

      const mapped: Course[] = coursesData.map((c) => {
        const lessonIds = courseLessons.get(c.id) || [];
        return {
          id: c.id,
          nome: c.nome,
          descricao: c.descricao,
          totalLessons: lessonIds.length,
          completedLessons: lessonIds.filter((id) => completedSet.has(id)).length,
        };
      });

      setCourses(mapped);
      setLoading(false);
    };

    fetchCourses();
  }, [user]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-sm animate-pulse" style={{ color: '#666' }}>Carregando cursos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cursos</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>
          Acesse os conteúdos disponíveis para sua evolução comercial.
        </p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((course) => {
            const pct = course.totalLessons > 0
              ? Math.round((course.completedLessons / course.totalLessons) * 100)
              : 0;

            return (
              <Link
                key={course.id}
                to={`/plataforma/cursos/${course.id}`}
                className="group block p-5 border transition-colors hover:border-[#FF1657]/40"
                style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold tracking-tight truncate">
                      {course.nome}
                    </h3>
                    {course.descricao && (
                      <p
                        className="text-xs mt-1 line-clamp-2"
                        style={{ color: '#666' }}
                      >
                        {course.descricao}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    className="w-4 h-4 flex-shrink-0 ml-3 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: '#FF1657' }}
                  />
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[10px] mb-1.5">
                    <span style={{ color: '#666' }}>
                      {course.completedLessons}/{course.totalLessons} aulas
                    </span>
                    <span style={{ color: pct === 100 ? '#FF1657' : '#666' }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1 w-full" style={{ background: '#2a2a2a' }}>
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: '#FF1657',
                      }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
