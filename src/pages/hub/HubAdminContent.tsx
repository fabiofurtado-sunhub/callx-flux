import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Pencil, Save, X
} from 'lucide-react';
import { toast } from 'sonner';

interface CourseRow { id: string; nome: string; descricao: string | null; ativo: boolean; modules: ModuleRow[]; }
interface ModuleRow { id: string; nome: string; ordem: number; course_id: string; lessons: LessonRow[]; }
interface LessonRow { id: string; nome: string; ordem: number; video_url: string | null; module_id: string; }

export default function HubAdminContent() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
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
        id: c.id, nome: c.nome, descricao: c.descricao, ativo: c.ativo,
        modules: modulesMap.get(c.id) || [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

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

  const addModule = async (courseId: string) => {
    if (!newModuleName.trim()) return;
    const maxOrdem = courses.find((c) => c.id === courseId)?.modules.length || 0;
    const { error } = await supabase.from('hub_modules').insert({ nome: newModuleName.trim(), course_id: courseId, ordem: maxOrdem });
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

  const addLesson = async (moduleId: string) => {
    if (!newLessonName.trim()) return;
    const mod = courses.flatMap((c) => c.modules).find((m) => m.id === moduleId);
    const maxOrdem = mod?.lessons.length || 0;
    const { error } = await supabase.from('hub_lessons').insert({ nome: newLessonName.trim(), module_id: moduleId, video_url: newLessonUrl.trim() || null, ordem: maxOrdem });
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

  if (loading) return <div className="p-10 text-sm animate-pulse" style={{ color: '#666' }}>Carregando...</div>;

  return (
    <div className="max-w-5xl mx-auto px-8 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Gestão de Conteúdo</h1>
        <p className="text-xs mt-1" style={{ color: '#666' }}>Crie e organize cursos, módulos e aulas</p>
      </div>

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
        <button onClick={addCourse} className="flex items-center gap-1 h-9 px-4 text-xs font-medium" style={{ background: '#FF1657', color: '#fff' }}>
          <Plus className="w-3.5 h-3.5" /> Curso
        </button>
      </div>

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
              <div key={course.id} className="border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
                {/* Course header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setExpandedCourse(isExpanded ? null : course.id)}>
                    {isExpanded ? <ChevronDown className="w-4 h-4" style={{ color: '#FF1657' }} /> : <ChevronRight className="w-4 h-4" style={{ color: '#666' }} />}
                  </button>
                  {isEditing ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 h-8 px-2 text-sm border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
                      <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Descrição" className="flex-1 h-8 px-2 text-sm border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
                      <button onClick={() => saveCourse(course.id)}><Save className="w-4 h-4" style={{ color: '#00FF78' }} /></button>
                      <button onClick={() => setEditingCourse(null)}><X className="w-4 h-4" style={{ color: '#666' }} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{course.nome}</p>
                        {course.descricao && <p className="text-[10px]" style={{ color: '#666' }}>{course.descricao}</p>}
                      </div>
                      <span className="text-[10px] px-2 py-0.5" style={{ background: course.ativo ? '#00FF7820' : '#FF165720', color: course.ativo ? '#00FF78' : '#FF1657' }}>
                        {course.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <button onClick={() => toggleCourseActive(course.id, course.ativo)} className="text-[10px] px-2 py-1 border" style={{ borderColor: '#2a2a2a', color: '#666' }}>
                        {course.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button onClick={() => { setEditingCourse(course.id); setEditName(course.nome); setEditDesc(course.descricao || ''); }}>
                        <Pencil className="w-3.5 h-3.5" style={{ color: '#666' }} />
                      </button>
                      <button onClick={() => deleteCourse(course.id)}><Trash2 className="w-3.5 h-3.5" style={{ color: '#FF4455' }} /></button>
                    </>
                  )}
                </div>

                {/* Modules */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-2" style={{ borderTop: '1px solid #2a2a2a' }}>
                    <div className="pt-3 flex items-center gap-2">
                      <input
                        value={newModuleCourseId === course.id ? newModuleName : ''}
                        onChange={(e) => { setNewModuleName(e.target.value); setNewModuleCourseId(course.id); }}
                        placeholder="Novo módulo"
                        className="flex-1 h-8 px-2 text-xs border"
                        style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }}
                        onKeyDown={(e) => e.key === 'Enter' && addModule(course.id)}
                      />
                      <button onClick={() => addModule(course.id)} className="h-8 px-3 text-[10px]" style={{ background: '#FF1657', color: '#fff' }}>
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {course.modules.map((mod) => {
                      const modExpanded = expandedModule === mod.id;
                      return (
                        <div key={mod.id} className="ml-4 border" style={{ borderColor: '#222', background: '#151515' }}>
                          <div className="flex items-center gap-2 px-3 py-2">
                            <button onClick={() => setExpandedModule(modExpanded ? null : mod.id)}>
                              {modExpanded ? <ChevronDown className="w-3.5 h-3.5" style={{ color: '#FF1657' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: '#666' }} />}
                            </button>
                            <span className="text-xs flex-1">{mod.nome}</span>
                            <span className="text-[10px]" style={{ color: '#444' }}>{mod.lessons.length} aulas</span>
                            <button onClick={() => deleteModule(mod.id)}><Trash2 className="w-3 h-3" style={{ color: '#FF4455' }} /></button>
                          </div>

                          {modExpanded && (
                            <div className="px-3 pb-3 space-y-1" style={{ borderTop: '1px solid #222' }}>
                              <div className="pt-2 flex items-center gap-2">
                                <input
                                  value={newLessonModuleId === mod.id ? newLessonName : ''}
                                  onChange={(e) => { setNewLessonName(e.target.value); setNewLessonModuleId(mod.id); }}
                                  placeholder="Nova aula"
                                  className="flex-1 h-7 px-2 text-[11px] border"
                                  style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }}
                                />
                                <input
                                  value={newLessonModuleId === mod.id ? newLessonUrl : ''}
                                  onChange={(e) => { setNewLessonUrl(e.target.value); setNewLessonModuleId(mod.id); }}
                                  placeholder="URL do vídeo"
                                  className="flex-1 h-7 px-2 text-[11px] border"
                                  style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }}
                                />
                                <button onClick={() => addLesson(mod.id)} className="h-7 px-2 text-[10px]" style={{ background: '#FF1657', color: '#fff' }}>
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              {mod.lessons.map((lesson) => (
                                <div key={lesson.id} className="ml-4 flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
                                  <span className="text-[11px] flex-1">{lesson.nome}</span>
                                  {lesson.video_url && <span className="text-[9px] px-1.5 py-0.5" style={{ background: '#FF165720', color: '#FF1657' }}>vídeo</span>}
                                  <button onClick={() => deleteLesson(lesson.id)}><Trash2 className="w-3 h-3" style={{ color: '#FF4455' }} /></button>
                                </div>
                              ))}
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
