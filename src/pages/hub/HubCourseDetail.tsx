import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useHubAuth } from '@/contexts/HubAuthContext';
import { ArrowLeft, CheckCircle2, Circle, Play } from 'lucide-react';
import { toast } from 'sonner';

interface Lesson {
  id: string;
  nome: string;
  ordem: number;
  video_url: string | null;
  material_url: string | null;
  duracao_total: number | null;
  module_id: string;
}

interface Module {
  id: string;
  nome: string;
  ordem: number;
  lessons: Lesson[];
}

interface CourseData {
  id: string;
  nome: string;
  descricao: string | null;
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export default function HubCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useHubAuth();
  const [course, setCourse] = useState<CourseData | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!courseId || !user) return;

    const [courseRes, modulesRes, lessonsRes, progressRes] = await Promise.all([
      supabase.from('hub_courses').select('id, nome, descricao').eq('id', courseId).single(),
      supabase.from('hub_modules').select('*').eq('course_id', courseId).order('ordem'),
      supabase
        .from('hub_lessons')
        .select('*')
        .in(
          'module_id',
          (await supabase.from('hub_modules').select('id').eq('course_id', courseId)).data?.map(
            (m) => m.id
          ) || []
        )
        .order('ordem'),
      supabase.from('hub_user_progress').select('lesson_id, concluida').eq('user_id', user.id),
    ]);

    setCourse(courseRes.data as CourseData | null);

    const completed = new Set<string>(
      (progressRes.data || []).filter((p) => p.concluida).map((p) => p.lesson_id)
    );
    setCompletedLessons(completed);

    const lessonsMap = new Map<string, Lesson[]>();
    (lessonsRes.data || []).forEach((l: any) => {
      const arr = lessonsMap.get(l.module_id) || [];
      arr.push(l as Lesson);
      lessonsMap.set(l.module_id, arr);
    });

    const mods: Module[] = (modulesRes.data || []).map((m: any) => ({
      ...m,
      lessons: lessonsMap.get(m.id) || [],
    }));

    setModules(mods);

    // Auto-select first incomplete lesson or first lesson
    if (!activeLesson) {
      const allLessons = mods.flatMap((m) => m.lessons);
      const firstIncomplete = allLessons.find((l) => !completed.has(l.id));
      setActiveLesson(firstIncomplete || allLessons[0] || null);
    }

    setLoading(false);
  }, [courseId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleComplete = async (lessonId: string) => {
    if (!user) return;
    const isCompleted = completedLessons.has(lessonId);

    if (isCompleted) {
      // Unmark
      await supabase
        .from('hub_user_progress')
        .update({ concluida: false, data_conclusao: null, porcentagem: 0 })
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId);

      setCompletedLessons((prev) => {
        const next = new Set(prev);
        next.delete(lessonId);
        return next;
      });
    } else {
      // Mark complete — upsert
      const { data: existing } = await supabase
        .from('hub_user_progress')
        .select('id')
        .eq('user_id', user.id)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('hub_user_progress')
          .update({ concluida: true, data_conclusao: new Date().toISOString(), porcentagem: 100 })
          .eq('id', existing.id);
      } else {
        await supabase.from('hub_user_progress').insert({
          user_id: user.id,
          lesson_id: lessonId,
          concluida: true,
          data_conclusao: new Date().toISOString(),
          porcentagem: 100,
        });
      }

      setCompletedLessons((prev) => new Set(prev).add(lessonId));
      toast.success('Aula concluída!');

      // Advance to next lesson
      const allLessons = modules.flatMap((m) => m.lessons);
      const idx = allLessons.findIndex((l) => l.id === lessonId);
      if (idx < allLessons.length - 1) {
        setActiveLesson(allLessons[idx + 1]);
      }
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-sm animate-pulse" style={{ color: '#666' }}>
          Carregando curso...
        </p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-sm" style={{ color: '#666' }}>Curso não encontrado.</p>
      </div>
    );
  }

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const pct = totalLessons > 0 ? Math.round((completedLessons.size / totalLessons) * 100) : 0;

  const ytId = activeLesson?.video_url ? extractYouTubeId(activeLesson.video_url) : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          to="/plataforma/cursos"
          className="flex items-center gap-1 text-xs hover:underline"
          style={{ color: '#FF1657' }}
        >
          <ArrowLeft className="w-3 h-3" />
          Cursos
        </Link>
        <span className="text-xs" style={{ color: '#333' }}>/</span>
        <span className="text-xs" style={{ color: '#666' }}>
          {course.nome}
        </span>
      </div>

      {/* Course header with progress */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">{course.nome}</h1>
        <span className="text-xs" style={{ color: pct === 100 ? '#FF1657' : '#666' }}>
          {pct}% concluído
        </span>
      </div>
      <div className="h-1 w-full" style={{ background: '#2a2a2a' }}>
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: '#FF1657' }}
        />
      </div>

      {/* Main content: video + sidebar */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Video player */}
        <div className="flex-1 min-w-0">
          {activeLesson ? (
            <div>
              {ytId ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    key={ytId}
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                    title={activeLesson.nome}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ border: 'none' }}
                  />
                </div>
              ) : (
                <div
                  className="flex items-center justify-center border"
                  style={{
                    background: '#1a1a1a',
                    borderColor: '#2a2a2a',
                    aspectRatio: '16/9',
                  }}
                >
                  <p className="text-xs" style={{ color: '#444' }}>
                    Nenhum vídeo disponível para esta aula.
                  </p>
                </div>
              )}

              {/* Lesson info bar */}
              <div
                className="flex items-center justify-between p-4 mt-0 border-x border-b"
                style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold truncate">{activeLesson.nome}</h3>
                  {activeLesson.duracao_total != null && activeLesson.duracao_total > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ color: '#666' }}>
                      {Math.ceil(activeLesson.duracao_total / 60)} min
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleComplete(activeLesson.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all"
                  style={{
                    background: completedLessons.has(activeLesson.id) ? '#FF1657' : 'transparent',
                    color: completedLessons.has(activeLesson.id) ? '#FFF' : '#FF1657',
                    border: '1px solid #FF1657',
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {completedLessons.has(activeLesson.id) ? 'Concluída' : 'Marcar como concluída'}
                </button>
              </div>

              {/* Material link */}
              {activeLesson.material_url && (
                <a
                  href={activeLesson.material_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 text-xs underline"
                  style={{ color: '#FF1657' }}
                >
                  📎 Material de apoio
                </a>
              )}
            </div>
          ) : (
            <div
              className="flex items-center justify-center border"
              style={{
                background: '#1a1a1a',
                borderColor: '#2a2a2a',
                aspectRatio: '16/9',
              }}
            >
              <p className="text-xs" style={{ color: '#444' }}>
                Selecione uma aula para começar.
              </p>
            </div>
          )}
        </div>

        {/* Sidebar — module/lesson list */}
        <div
          className="lg:w-80 flex-shrink-0 border overflow-y-auto"
          style={{
            background: '#1a1a1a',
            borderColor: '#2a2a2a',
            maxHeight: 'calc(100vh - 200px)',
          }}
        >
          {modules.length === 0 ? (
            <p className="p-4 text-xs" style={{ color: '#666' }}>
              Nenhum módulo disponível.
            </p>
          ) : (
            modules.map((mod) => (
              <div key={mod.id}>
                {/* Module header */}
                <div
                  className="px-4 py-3 border-b"
                  style={{ borderColor: '#2a2a2a' }}
                >
                  <p
                    className="text-[10px] tracking-[2px] uppercase font-medium"
                    style={{ color: '#666' }}
                  >
                    {mod.nome}
                  </p>
                </div>

                {/* Lessons */}
                {mod.lessons.map((lesson) => {
                  const isActive = activeLesson?.id === lesson.id;
                  const done = completedLessons.has(lesson.id);

                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setActiveLesson(lesson)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b"
                      style={{
                        borderColor: '#222',
                        background: isActive ? '#222' : 'transparent',
                      }}
                    >
                      {done ? (
                        <CheckCircle2
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: '#FF1657' }}
                        />
                      ) : isActive ? (
                        <Play
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: '#FF1657' }}
                        />
                      ) : (
                        <Circle
                          className="w-4 h-4 flex-shrink-0"
                          style={{ color: '#333' }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-xs truncate"
                          style={{
                            color: isActive ? '#FFF' : done ? '#888' : '#AAA',
                          }}
                        >
                          {lesson.nome}
                        </p>
                        {lesson.duracao_total != null && lesson.duracao_total > 0 && (
                          <p className="text-[10px]" style={{ color: '#444' }}>
                            {Math.ceil(lesson.duracao_total / 60)} min
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
