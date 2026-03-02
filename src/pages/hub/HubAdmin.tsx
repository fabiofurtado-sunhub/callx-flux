import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useHubAuth } from '@/contexts/HubAuthContext';
import {
  Trophy, AlertTriangle, BookOpen, Plus, Trash2, ChevronDown, ChevronRight,
  Pencil, Save, X, Users, Flame
} from 'lucide-react';
import { toast } from 'sonner';

/* ───── types ───── */
interface StudentRow {
  user_id: string;
  nome: string;
  engagement_score: number;
  total_login_count: number;
  dias_consecutivos: number;
  ultimo_login: string | null;
  status: string;
  completedLessons: number;
  totalLessons: number;
}

interface CourseRow {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  modules: ModuleRow[];
}

interface ModuleRow {
  id: string;
  nome: string;
  ordem: number;
  course_id: string;
  lessons: LessonRow[];
}

interface LessonRow {
  id: string;
  nome: string;
  ordem: number;
  video_url: string | null;
  module_id: string;
}

type Tab = 'ranking' | 'alertas' | 'conteudo';

export default function HubAdmin() {
  const { user } = useHubAuth();
  const [tab, setTab] = useState<Tab>('ranking');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'ranking', label: 'Ranking', icon: <Trophy className="w-3.5 h-3.5" /> },
    { key: 'alertas', label: 'Alertas', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    { key: 'conteudo', label: 'Conteúdo', icon: <BookOpen className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel Admin</h1>
        <p className="text-sm mt-1" style={{ color: '#666' }}>
          Gerencie alunos, conteúdo e acompanhe engajamento.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b" style={{ borderColor: '#2a2a2a' }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs tracking-wide transition-colors"
            style={{
              color: tab === t.key ? '#FF1657' : '#666',
              borderBottom: tab === t.key ? '2px solid #FF1657' : '2px solid transparent',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ranking' && <RankingTab />}
      {tab === 'alertas' && <AlertasTab />}
      {tab === 'conteudo' && <ConteudoTab />}
    </div>
  );
}

/* ════════════════════════════════════════
   RANKING TAB
   ════════════════════════════════════════ */
function RankingTab() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: profiles } = await supabase
        .from('hub_profiles')
        .select('*')
        .order('engagement_score', { ascending: false });

      if (!profiles) { setLoading(false); return; }

      // Get all lessons count per user
      const { data: progress } = await supabase
        .from('hub_user_progress')
        .select('user_id, concluida');

      const { data: allLessons } = await supabase.from('hub_lessons').select('id');
      const totalLessons = allLessons?.length || 0;

      const completedMap = new Map<string, number>();
      (progress || []).forEach((p) => {
        if (p.concluida) {
          completedMap.set(p.user_id, (completedMap.get(p.user_id) || 0) + 1);
        }
      });

      setStudents(
        profiles.map((p) => ({
          user_id: p.user_id,
          nome: p.nome,
          engagement_score: p.engagement_score,
          total_login_count: p.total_login_count,
          dias_consecutivos: p.dias_consecutivos,
          ultimo_login: p.ultimo_login,
          status: p.status,
          completedLessons: completedMap.get(p.user_id) || 0,
          totalLessons,
        }))
      );
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <p className="text-sm animate-pulse" style={{ color: '#666' }}>Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4" style={{ color: '#FF1657' }} />
        <span className="text-sm font-semibold">{students.length} alunos</span>
      </div>

      <div className="border" style={{ borderColor: '#2a2a2a' }}>
        {/* Header */}
        <div
          className="grid grid-cols-[40px_1fr_80px_80px_80px_100px] gap-2 px-4 py-3 text-[10px] tracking-[2px] uppercase"
          style={{ color: '#666', borderBottom: '1px solid #2a2a2a', background: '#151515' }}
        >
          <span>#</span>
          <span>Aluno</span>
          <span className="text-center">Score</span>
          <span className="text-center">Streak</span>
          <span className="text-center">Aulas</span>
          <span className="text-right">Último Login</span>
        </div>

        {students.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: '#666' }}>Nenhum aluno cadastrado.</div>
        ) : (
          students.map((s, i) => {
            const pct = s.totalLessons > 0 ? Math.round((s.completedLessons / s.totalLessons) * 100) : 0;
            const lastLogin = s.ultimo_login
              ? new Date(s.ultimo_login).toLocaleDateString('pt-BR')
              : '—';

            return (
              <div
                key={s.user_id}
                className="grid grid-cols-[40px_1fr_80px_80px_80px_100px] gap-2 px-4 py-3 items-center transition-colors"
                style={{ borderBottom: '1px solid #1a1a1a' }}
              >
                <span className="text-xs font-bold" style={{ color: i < 3 ? '#FF1657' : '#666' }}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.nome}</p>
                  <p className="text-[10px]" style={{ color: '#444' }}>{s.total_login_count} logins</p>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold">{s.engagement_score}</span>
                </div>
                <div className="text-center flex items-center justify-center gap-1">
                  <Flame className="w-3 h-3" style={{ color: s.dias_consecutivos > 0 ? '#FF1657' : '#333' }} />
                  <span className="text-xs">{s.dias_consecutivos}</span>
                </div>
                <div className="text-center">
                  <span className="text-xs">{pct}%</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px]" style={{ color: '#666' }}>{lastLogin}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   ALERTAS TAB
   ════════════════════════════════════════ */
function AlertasTab() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: profiles } = await supabase
        .from('hub_profiles')
        .select('*')
        .order('ultimo_login', { ascending: true, nullsFirst: true });

      if (!profiles) { setLoading(false); return; }

      const now = new Date();
      const inactive = profiles.filter((p) => {
        if (!p.ultimo_login) return true;
        const diff = (now.getTime() - new Date(p.ultimo_login).getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 3;
      });

      setStudents(
        inactive.map((p) => ({
          user_id: p.user_id,
          nome: p.nome,
          engagement_score: p.engagement_score,
          total_login_count: p.total_login_count,
          dias_consecutivos: p.dias_consecutivos,
          ultimo_login: p.ultimo_login,
          status: p.status,
          completedLessons: 0,
          totalLessons: 0,
        }))
      );
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <p className="text-sm animate-pulse" style={{ color: '#666' }}>Carregando...</p>;

  const getDaysInactive = (last: string | null) => {
    if (!last) return 999;
    return Math.floor((Date.now() - new Date(last).getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" style={{ color: '#FF1657' }} />
        <span className="text-sm font-semibold">{students.length} alunos inativos (≥3 dias)</span>
      </div>

      {students.length === 0 ? (
        <div className="p-8 border text-center" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <p className="text-sm" style={{ color: '#666' }}>Todos os alunos estão ativos. 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((s) => {
            const days = getDaysInactive(s.ultimo_login);
            const severe = days >= 7;

            return (
              <div
                key={s.user_id}
                className="flex items-center justify-between p-4 border"
                style={{
                  background: '#1a1a1a',
                  borderColor: severe ? '#FF1657' : '#2a2a2a',
                }}
              >
                <div>
                  <p className="text-sm font-medium">{s.nome}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#666' }}>
                    Score: {s.engagement_score} · {s.total_login_count} logins
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-sm font-bold"
                    style={{ color: severe ? '#FF1657' : '#F59E0B' }}
                  >
                    {days === 999 ? 'Nunca acessou' : `${days} dias`}
                  </p>
                  <p className="text-[10px]" style={{ color: '#666' }}>
                    {severe ? '⚠ Alerta crítico' : '⏳ Em risco'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   CONTEÚDO TAB — CRUD courses/modules/lessons
   ════════════════════════════════════════ */
function ConteudoTab() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Inline editing
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // New items
  const [newCourseName, setNewCourseName] = useState('');
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleCourseId, setNewModuleCourseId] = useState('');
  const [newLessonName, setNewLessonName] = useState('');
  const [newLessonUrl, setNewLessonUrl] = useState('');
  const [newLessonModuleId, setNewLessonModuleId] = useState('');

  const fetchAll = useCallback(async () => {
    const [coursesRes, modulesRes, lessonsRes] = await Promise.all([
      supabase.from('hub_courses').select('*').order('created_at'),
      supabase.from('hub_modules').select('*').order('ordem'),
      supabase.from('hub_lessons').select('*').order('ordem'),
    ]);

    const lessonsMap = new Map<string, LessonRow[]>();
    (lessonsRes.data || []).forEach((l: any) => {
      const arr = lessonsMap.get(l.module_id) || [];
      arr.push({ id: l.id, nome: l.nome, ordem: l.ordem, video_url: l.video_url, module_id: l.module_id });
      lessonsMap.set(l.module_id, arr);
    });

    const modulesMap = new Map<string, ModuleRow[]>();
    (modulesRes.data || []).forEach((m: any) => {
      const arr = modulesMap.get(m.course_id) || [];
      arr.push({ id: m.id, nome: m.nome, ordem: m.ordem, course_id: m.course_id, lessons: lessonsMap.get(m.id) || [] });
      modulesMap.set(m.course_id, arr);
    });

    setCourses(
      (coursesRes.data || []).map((c: any) => ({
        id: c.id,
        nome: c.nome,
        descricao: c.descricao,
        ativo: c.ativo,
        modules: modulesMap.get(c.id) || [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Course CRUD ── */
  const addCourse = async () => {
    if (!newCourseName.trim()) return;
    const { error } = await supabase.from('hub_courses').insert({ nome: newCourseName.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success('Curso criado');
    setNewCourseName('');
    fetchAll();
  };

  const saveCourse = async (id: string) => {
    const { error } = await supabase.from('hub_courses').update({ nome: editName, descricao: editDesc }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Curso atualizado');
    setEditingCourse(null);
    fetchAll();
  };

  const toggleCourseActive = async (id: string, ativo: boolean) => {
    await supabase.from('hub_courses').update({ ativo: !ativo }).eq('id', id);
    fetchAll();
  };

  const deleteCourse = async (id: string) => {
    if (!confirm('Excluir este curso e todo seu conteúdo?')) return;
    // Delete lessons, modules, then course
    const { data: mods } = await supabase.from('hub_modules').select('id').eq('course_id', id);
    const modIds = (mods || []).map((m) => m.id);
    if (modIds.length > 0) {
      await supabase.from('hub_lessons').delete().in('module_id', modIds);
      await supabase.from('hub_modules').delete().eq('course_id', id);
    }
    await supabase.from('hub_courses').delete().eq('id', id);
    toast.success('Curso excluído');
    fetchAll();
  };

  /* ── Module CRUD ── */
  const addModule = async (courseId: string) => {
    if (!newModuleName.trim()) return;
    const maxOrdem = courses.find((c) => c.id === courseId)?.modules.length || 0;
    const { error } = await supabase.from('hub_modules').insert({
      nome: newModuleName.trim(),
      course_id: courseId,
      ordem: maxOrdem,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Módulo criado');
    setNewModuleName('');
    setNewModuleCourseId('');
    fetchAll();
  };

  const deleteModule = async (id: string) => {
    if (!confirm('Excluir módulo e aulas?')) return;
    await supabase.from('hub_lessons').delete().eq('module_id', id);
    await supabase.from('hub_modules').delete().eq('id', id);
    toast.success('Módulo excluído');
    fetchAll();
  };

  /* ── Lesson CRUD ── */
  const addLesson = async (moduleId: string) => {
    if (!newLessonName.trim()) return;
    const mod = courses.flatMap((c) => c.modules).find((m) => m.id === moduleId);
    const maxOrdem = mod?.lessons.length || 0;
    const { error } = await supabase.from('hub_lessons').insert({
      nome: newLessonName.trim(),
      module_id: moduleId,
      video_url: newLessonUrl.trim() || null,
      ordem: maxOrdem,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Aula criada');
    setNewLessonName('');
    setNewLessonUrl('');
    setNewLessonModuleId('');
    fetchAll();
  };

  const deleteLesson = async (id: string) => {
    if (!confirm('Excluir esta aula?')) return;
    await supabase.from('hub_lessons').delete().eq('id', id);
    toast.success('Aula excluída');
    fetchAll();
  };

  if (loading) return <p className="text-sm animate-pulse" style={{ color: '#666' }}>Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Add course */}
      <div className="flex items-center gap-2">
        <input
          value={newCourseName}
          onChange={(e) => setNewCourseName(e.target.value)}
          placeholder="Nome do novo curso"
          className="flex-1 h-9 px-3 text-sm border"
          style={{ background: '#1a1a1a', borderColor: '#2a2a2a', color: '#fff' }}
          onKeyDown={(e) => e.key === 'Enter' && addCourse()}
        />
        <button
          onClick={addCourse}
          className="flex items-center gap-1 h-9 px-4 text-xs font-medium"
          style={{ background: '#FF1657', color: '#fff' }}
        >
          <Plus className="w-3.5 h-3.5" /> Curso
        </button>
      </div>

      {/* Courses list */}
      {courses.length === 0 ? (
        <div className="p-8 border text-center" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <p className="text-sm" style={{ color: '#666' }}>Nenhum curso criado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {courses.map((course) => {
            const isExpanded = expandedCourse === course.id;
            const isEditing = editingCourse === course.id;

            return (
              <div key={course.id} className="border" style={{ borderColor: '#2a2a2a', background: '#151515' }}>
                {/* Course header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setExpandedCourse(isExpanded ? null : course.id)}>
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4" style={{ color: '#FF1657' }} />
                      : <ChevronRight className="w-4 h-4" style={{ color: '#666' }} />}
                  </button>

                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 h-8 px-2 text-sm border"
                        style={{ background: '#1a1a1a', borderColor: '#2a2a2a', color: '#fff' }}
                      />
                      <input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Descrição"
                        className="flex-1 h-8 px-2 text-sm border"
                        style={{ background: '#1a1a1a', borderColor: '#2a2a2a', color: '#fff' }}
                      />
                      <button onClick={() => saveCourse(course.id)}>
                        <Save className="w-4 h-4" style={{ color: '#FF1657' }} />
                      </button>
                      <button onClick={() => setEditingCourse(null)}>
                        <X className="w-4 h-4" style={{ color: '#666' }} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-3 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{course.nome}</p>
                        <p className="text-[10px]" style={{ color: '#666' }}>
                          {course.modules.length} módulos · {course.modules.reduce((a, m) => a + m.lessons.length, 0)} aulas
                        </p>
                      </div>
                      <button
                        onClick={() => toggleCourseActive(course.id, course.ativo)}
                        className="text-[10px] px-2 py-0.5 border"
                        style={{
                          borderColor: course.ativo ? '#FF1657' : '#333',
                          color: course.ativo ? '#FF1657' : '#666',
                        }}
                      >
                        {course.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                      <button onClick={() => { setEditingCourse(course.id); setEditName(course.nome); setEditDesc(course.descricao || ''); }}>
                        <Pencil className="w-3.5 h-3.5" style={{ color: '#666' }} />
                      </button>
                      <button onClick={() => deleteCourse(course.id)}>
                        <Trash2 className="w-3.5 h-3.5" style={{ color: '#666' }} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded: modules */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid #2a2a2a' }}>
                    {/* Add module */}
                    {newModuleCourseId === course.id ? (
                      <div className="flex items-center gap-2 mt-3 pl-6">
                        <input
                          value={newModuleName}
                          onChange={(e) => setNewModuleName(e.target.value)}
                          placeholder="Nome do módulo"
                          className="flex-1 h-8 px-2 text-xs border"
                          style={{ background: '#1a1a1a', borderColor: '#2a2a2a', color: '#fff' }}
                          onKeyDown={(e) => e.key === 'Enter' && addModule(course.id)}
                          autoFocus
                        />
                        <button onClick={() => addModule(course.id)}>
                          <Save className="w-3.5 h-3.5" style={{ color: '#FF1657' }} />
                        </button>
                        <button onClick={() => setNewModuleCourseId('')}>
                          <X className="w-3.5 h-3.5" style={{ color: '#666' }} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setNewModuleCourseId(course.id)}
                        className="flex items-center gap-1 mt-3 pl-6 text-[10px] tracking-[1px] uppercase"
                        style={{ color: '#FF1657' }}
                      >
                        <Plus className="w-3 h-3" /> Módulo
                      </button>
                    )}

                    {course.modules.map((mod) => {
                      const modExpanded = expandedModule === mod.id;
                      return (
                        <div key={mod.id} className="ml-6">
                          {/* Module row */}
                          <div className="flex items-center gap-2 py-2" style={{ borderBottom: '1px solid #222' }}>
                            <button onClick={() => setExpandedModule(modExpanded ? null : mod.id)}>
                              {modExpanded
                                ? <ChevronDown className="w-3 h-3" style={{ color: '#FF1657' }} />
                                : <ChevronRight className="w-3 h-3" style={{ color: '#444' }} />}
                            </button>
                            <p className="text-xs font-medium flex-1">{mod.nome}</p>
                            <span className="text-[10px]" style={{ color: '#666' }}>{mod.lessons.length} aulas</span>
                            <button onClick={() => deleteModule(mod.id)}>
                              <Trash2 className="w-3 h-3" style={{ color: '#666' }} />
                            </button>
                          </div>

                          {/* Expanded: lessons */}
                          {modExpanded && (
                            <div className="ml-5 space-y-1 py-2">
                              {mod.lessons.map((lesson) => (
                                <div
                                  key={lesson.id}
                                  className="flex items-center gap-2 py-1.5 px-2"
                                  style={{ background: '#1a1a1a' }}
                                >
                                  <p className="text-xs flex-1 truncate">{lesson.nome}</p>
                                  {lesson.video_url && (
                                    <span className="text-[9px] px-1.5 py-0.5" style={{ background: '#2a2a2a', color: '#666' }}>
                                      YT
                                    </span>
                                  )}
                                  <button onClick={() => deleteLesson(lesson.id)}>
                                    <Trash2 className="w-3 h-3" style={{ color: '#666' }} />
                                  </button>
                                </div>
                              ))}

                              {/* Add lesson */}
                              {newLessonModuleId === mod.id ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <input
                                    value={newLessonName}
                                    onChange={(e) => setNewLessonName(e.target.value)}
                                    placeholder="Nome da aula"
                                    className="flex-1 h-7 px-2 text-xs border"
                                    style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }}
                                    autoFocus
                                  />
                                  <input
                                    value={newLessonUrl}
                                    onChange={(e) => setNewLessonUrl(e.target.value)}
                                    placeholder="URL YouTube (opcional)"
                                    className="flex-1 h-7 px-2 text-xs border"
                                    style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }}
                                    onKeyDown={(e) => e.key === 'Enter' && addLesson(mod.id)}
                                  />
                                  <button onClick={() => addLesson(mod.id)}>
                                    <Save className="w-3 h-3" style={{ color: '#FF1657' }} />
                                  </button>
                                  <button onClick={() => setNewLessonModuleId('')}>
                                    <X className="w-3 h-3" style={{ color: '#666' }} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setNewLessonModuleId(mod.id)}
                                  className="flex items-center gap-1 text-[10px] tracking-[1px] uppercase mt-1"
                                  style={{ color: '#FF1657' }}
                                >
                                  <Plus className="w-3 h-3" /> Aula
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
