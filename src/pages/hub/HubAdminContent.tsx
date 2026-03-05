import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Pencil, Save, X,
  ArrowLeft, GripVertical, BookOpen, Video, MoreHorizontal, Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface CourseRow {
  id: string; nome: string; descricao: string | null; ativo: boolean;
  capa_url: string | null; modules: ModuleRow[];
}
interface ModuleRow {
  id: string; nome: string; ordem: number; course_id: string; capa_url: string | null; lessons: LessonRow[];
}
interface LessonRow {
  id: string; nome: string; ordem: number; video_url: string | null;
  material_url: string | null; module_id: string; capa_url: string | null;
}

type View = 'grid' | 'course-detail';

export default function HubAdminContent() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('grid');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [coursesRes, modulesRes, lessonsRes] = await Promise.all([
      supabase.from('hub_courses').select('*').order('created_at'),
      supabase.from('hub_modules').select('*').order('ordem'),
      supabase.from('hub_lessons').select('*').order('ordem'),
    ]);

    const lessonsMap = new Map<string, LessonRow[]>();
    (lessonsRes.data || []).forEach((l: any) => {
      const arr = lessonsMap.get(l.module_id) || [];
      arr.push({ id: l.id, nome: l.nome, ordem: l.ordem, video_url: l.video_url, material_url: l.material_url, module_id: l.module_id, capa_url: l.capa_url });
      lessonsMap.set(l.module_id, arr);
    });

    const modulesMap = new Map<string, ModuleRow[]>();
    (modulesRes.data || []).forEach((m: any) => {
      const arr = modulesMap.get(m.course_id) || [];
      arr.push({ id: m.id, nome: m.nome, ordem: m.ordem, course_id: m.course_id, capa_url: m.capa_url, lessons: lessonsMap.get(m.id) || [] });
      modulesMap.set(m.course_id, arr);
    });

    setCourses(
      (coursesRes.data || []).map((c: any) => ({
        id: c.id, nome: c.nome, descricao: c.descricao, ativo: c.ativo,
        capa_url: c.capa_url, modules: modulesMap.get(c.id) || [],
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const selectedCourse = courses.find(c => c.id === selectedCourseId) || null;

  const openCourse = (id: string) => {
    setSelectedCourseId(id);
    setView('course-detail');
  };

  if (loading) return <div className="p-10 text-sm animate-pulse" style={{ color: '#666' }}>Carregando...</div>;

  return (
    <div className="max-w-6xl mx-auto px-8 py-10">
      {view === 'grid' && (
        <CourseGrid courses={courses} onOpen={openCourse} onRefresh={fetchAll} />
      )}
      {view === 'course-detail' && selectedCourse && (
        <CourseDetail
          course={selectedCourse}
          onBack={() => setView('grid')}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
}

/* ───────────────── GRID VIEW ───────────────── */
function CourseGrid({ courses, onOpen, onRefresh }: {
  courses: CourseRow[]; onOpen: (id: string) => void; onRefresh: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const addCourse = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('hub_courses').insert({ nome: newName.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success('Curso criado');
    setNewName('');
    setCreating(false);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Gestão de Conteúdo</h1>
        <p className="text-xs mt-1" style={{ color: '#666' }}>Crie e organize cursos, módulos e aulas da plataforma</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {/* New course card */}
        {creating ? (
          <div className="aspect-[3/4] border-2 border-dashed flex flex-col items-center justify-center gap-3 p-4"
            style={{ borderColor: '#FF1657', background: '#1a1a1a' }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCourse()}
              placeholder="Nome do curso"
              className="w-full h-9 px-3 text-sm border text-center"
              style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }}
            />
            <div className="flex gap-2">
              <button onClick={addCourse} className="h-8 px-4 text-xs font-medium" style={{ background: '#FF1657', color: '#fff' }}>
                Criar
              </button>
              <button onClick={() => { setCreating(false); setNewName(''); }} className="h-8 px-3 text-xs" style={{ color: '#666' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="aspect-[3/4] border-2 border-dashed flex flex-col items-center justify-center gap-2 hover:border-[#FF1657] transition-colors group"
            style={{ borderColor: '#333', background: '#1a1a1a' }}
          >
            <Plus className="w-8 h-8 transition-colors" style={{ color: '#444' }} />
            <span className="text-xs font-medium" style={{ color: '#666' }}>Novo Curso</span>
          </button>
        )}

        {/* Course cards */}
        {courses.map(course => (
          <button
            key={course.id}
            onClick={() => onOpen(course.id)}
            className="aspect-[3/4] border relative overflow-hidden group text-left flex flex-col"
            style={{ borderColor: '#2a2a2a', background: '#1a1a1a' }}
          >
            {/* Cover */}
            <div className="flex-1 relative overflow-hidden" style={{ background: '#111' }}>
              {course.capa_url ? (
                <img src={course.capa_url} alt={course.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="w-10 h-10" style={{ color: '#333' }} />
                </div>
              )}
              {/* Status badge */}
              <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 font-medium"
                style={{
                  background: course.ativo ? '#00FF7830' : '#FF165730',
                  color: course.ativo ? '#00FF78' : '#FF1657',
                  backdropFilter: 'blur(4px)',
                }}>
                {course.ativo ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            {/* Info */}
            <div className="p-3 space-y-1" style={{ borderTop: '1px solid #2a2a2a' }}>
              <p className="text-sm font-medium truncate">{course.nome}</p>
              <p className="text-[10px]" style={{ color: '#555' }}>
                {course.modules.length} módulo{course.modules.length !== 1 ? 's' : ''} · {course.modules.reduce((s, m) => s + m.lessons.length, 0)} aula{course.modules.reduce((s, m) => s + m.lessons.length, 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────────────── COURSE DETAIL ───────────────── */
function CourseDetail({ course, onBack, onRefresh }: {
  course: CourseRow; onBack: () => void; onRefresh: () => void;
}) {
  const [editingInfo, setEditingInfo] = useState(false);
  const [nome, setNome] = useState(course.nome);
  const [descricao, setDescricao] = useState(course.descricao || '');
  const [capaUrl, setCapaUrl] = useState(course.capa_url || '');
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [addingLessonToModule, setAddingLessonToModule] = useState<string | null>(null);
  const [newLessonName, setNewLessonName] = useState('');
  const [newLessonVideoUrl, setNewLessonVideoUrl] = useState('');
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editModuleName, setEditModuleName] = useState('');
  const [editModuleCapaUrl, setEditModuleCapaUrl] = useState('');
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [editLessonName, setEditLessonName] = useState('');
  const [editLessonVideoUrl, setEditLessonVideoUrl] = useState('');
  const [editLessonCapaUrl, setEditLessonCapaUrl] = useState('');
  const [newModuleCapaUrl, setNewModuleCapaUrl] = useState('');
  const [newLessonCapaUrl, setNewLessonCapaUrl] = useState('');

  const saveCourseInfo = async () => {
    const { error } = await supabase.from('hub_courses').update({
      nome: nome.trim(), descricao: descricao.trim() || null, capa_url: capaUrl.trim() || null,
    }).eq('id', course.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Curso atualizado');
    setEditingInfo(false);
    onRefresh();
  };

  const toggleActive = async () => {
    await supabase.from('hub_courses').update({ ativo: !course.ativo }).eq('id', course.id);
    toast.success(course.ativo ? 'Curso desativado' : 'Curso ativado');
    onRefresh();
  };

  const deleteCourse = async () => {
    if (!confirm('Excluir este curso e todo seu conteúdo?')) return;
    const modIds = course.modules.map(m => m.id);
    if (modIds.length > 0) {
      await supabase.from('hub_lessons').delete().in('module_id', modIds);
      await supabase.from('hub_modules').delete().eq('course_id', course.id);
    }
    await supabase.from('hub_courses').delete().eq('id', course.id);
    toast.success('Curso excluído');
    onBack();
    onRefresh();
  };

  const addModule = async () => {
    if (!newModuleName.trim()) return;
    const ordem = course.modules.length;
    const { error } = await supabase.from('hub_modules').insert({
      nome: newModuleName.trim(), course_id: course.id, ordem, capa_url: newModuleCapaUrl.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Módulo criado');
    setNewModuleName('');
    setNewModuleCapaUrl('');
    setAddingModule(false);
    onRefresh();
  };

  const deleteModule = async (id: string) => {
    if (!confirm('Excluir módulo e todas as aulas?')) return;
    await supabase.from('hub_lessons').delete().eq('module_id', id);
    await supabase.from('hub_modules').delete().eq('id', id);
    toast.success('Módulo excluído');
    onRefresh();
  };

  const saveModule = async (id: string) => {
    const { error } = await supabase.from('hub_modules').update({ nome: editModuleName.trim(), capa_url: editModuleCapaUrl.trim() || null }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Módulo atualizado');
    setEditingModule(null);
    onRefresh();
  };

  const addLesson = async (moduleId: string) => {
    if (!newLessonName.trim()) return;
    const mod = course.modules.find(m => m.id === moduleId);
    const ordem = mod?.lessons.length || 0;
    const { error } = await supabase.from('hub_lessons').insert({
      nome: newLessonName.trim(), module_id: moduleId,
      video_url: newLessonVideoUrl.trim() || null, ordem,
      capa_url: newLessonCapaUrl.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Aula criada');
    setNewLessonName('');
    setNewLessonVideoUrl('');
    setNewLessonCapaUrl('');
    setAddingLessonToModule(null);
    onRefresh();
  };

  const saveLesson = async (id: string) => {
    const { error } = await supabase.from('hub_lessons').update({
      nome: editLessonName.trim(), video_url: editLessonVideoUrl.trim() || null,
      capa_url: editLessonCapaUrl.trim() || null,
    }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Aula atualizada');
    setEditingLesson(null);
    onRefresh();
  };

  const deleteLesson = async (id: string) => {
    if (!confirm('Excluir esta aula?')) return;
    await supabase.from('hub_lessons').delete().eq('id', id);
    toast.success('Aula excluída');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:opacity-70 transition-opacity" style={{ color: '#666' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold tracking-tight flex-1">{course.nome}</h1>
        <span className="text-[10px] px-2 py-0.5 font-medium"
          style={{
            background: course.ativo ? '#00FF7820' : '#FF165720',
            color: course.ativo ? '#00FF78' : '#FF1657',
          }}>
          {course.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </div>

      {/* Course info card */}
      <div className="border p-5 space-y-4" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
        <div className="flex items-start justify-between">
          <h2 className="text-sm font-semibold" style={{ color: '#ccc' }}>Informações do Curso</h2>
          <div className="flex gap-2">
            {!editingInfo && (
              <>
                <button onClick={() => setEditingInfo(true)} className="flex items-center gap-1 text-[10px] px-3 py-1.5 border transition-colors hover:border-[#FF1657]"
                  style={{ borderColor: '#333', color: '#888' }}>
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button onClick={toggleActive} className="text-[10px] px-3 py-1.5 border transition-colors hover:border-[#FF1657]"
                  style={{ borderColor: '#333', color: '#888' }}>
                  {course.ativo ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={deleteCourse} className="text-[10px] px-3 py-1.5 border transition-colors hover:border-[#FF4455]"
                  style={{ borderColor: '#333', color: '#FF4455' }}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {editingInfo ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium mb-1 block" style={{ color: '#888' }}>Nome do Curso</label>
              <input value={nome} onChange={e => setNome(e.target.value)}
                className="w-full h-9 px-3 text-sm border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
            </div>
            <div>
              <label className="text-[10px] font-medium mb-1 block" style={{ color: '#888' }}>Descrição</label>
              <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
                className="w-full px-3 py-2 text-sm border resize-none" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
            </div>
            <div>
              <label className="text-[10px] font-medium mb-1 block" style={{ color: '#888' }}>URL da Capa</label>
              <div className="flex gap-3">
                <input value={capaUrl} onChange={e => setCapaUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 h-9 px-3 text-sm border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
                {capaUrl && (
                  <div className="w-16 h-9 border overflow-hidden flex-shrink-0" style={{ borderColor: '#2a2a2a' }}>
                    <img src={capaUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveCourseInfo} className="h-8 px-5 text-xs font-medium" style={{ background: '#FF1657', color: '#fff' }}>
                Salvar
              </button>
              <button onClick={() => { setEditingInfo(false); setNome(course.nome); setDescricao(course.descricao || ''); setCapaUrl(course.capa_url || ''); }}
                className="h-8 px-4 text-xs" style={{ color: '#666' }}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-5">
            {/* Cover preview */}
            <div className="w-28 h-36 flex-shrink-0 border overflow-hidden flex items-center justify-center"
              style={{ borderColor: '#2a2a2a', background: '#111' }}>
              {course.capa_url ? (
                <img src={course.capa_url} alt={course.nome} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-8 h-8" style={{ color: '#333' }} />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{course.nome}</p>
              <p className="text-xs" style={{ color: '#666' }}>{course.descricao || 'Sem descrição'}</p>
              <p className="text-[10px] mt-2" style={{ color: '#444' }}>
                {course.modules.length} módulo{course.modules.length !== 1 ? 's' : ''} · {course.modules.reduce((s, m) => s + m.lessons.length, 0)} aula{course.modules.reduce((s, m) => s + m.lessons.length, 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modules section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: '#ccc' }}>Módulos</h2>
          <button onClick={() => setAddingModule(true)}
            className="flex items-center gap-1 h-8 px-4 text-xs font-medium transition-opacity hover:opacity-90"
            style={{ background: '#FF1657', color: '#fff' }}>
            <Plus className="w-3.5 h-3.5" /> Módulo
          </button>
        </div>

        {addingModule && (
          <div className="border p-4 space-y-3" style={{ background: '#1a1a1a', borderColor: '#FF165740' }}>
            <div className="flex items-center gap-3">
              <input autoFocus value={newModuleName} onChange={e => setNewModuleName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addModule()}
                placeholder="Nome do módulo"
                className="flex-1 h-9 px-3 text-sm border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
            </div>
            <div className="flex items-center gap-3">
              <ImageIcon className="w-4 h-4 flex-shrink-0" style={{ color: '#555' }} />
              <input value={newModuleCapaUrl} onChange={e => setNewModuleCapaUrl(e.target.value)}
                placeholder="URL da capa do módulo (opcional)"
                className="flex-1 h-9 px-3 text-sm border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
              {newModuleCapaUrl && (
                <div className="w-12 h-9 border overflow-hidden flex-shrink-0" style={{ borderColor: '#2a2a2a' }}>
                  <img src={newModuleCapaUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={addModule} className="h-9 px-5 text-xs font-medium" style={{ background: '#FF1657', color: '#fff' }}>Criar</button>
              <button onClick={() => { setAddingModule(false); setNewModuleName(''); setNewModuleCapaUrl(''); }}>
                <X className="w-4 h-4" style={{ color: '#666' }} />
              </button>
            </div>
          </div>
        )}

        {course.modules.length === 0 && !addingModule && (
          <div className="border p-8 text-center" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
            <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: '#333' }} />
            <p className="text-xs" style={{ color: '#555' }}>Nenhum módulo criado. Clique em "+ Módulo" para começar.</p>
          </div>
        )}

        {course.modules.map(mod => {
          const isExpanded = expandedModule === mod.id;
          const isEditingMod = editingModule === mod.id;

          return (
            <div key={mod.id} className="border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
              {/* Module header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <button onClick={() => setExpandedModule(isExpanded ? null : mod.id)} className="flex-shrink-0">
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4" style={{ color: '#FF1657' }} />
                    : <ChevronRight className="w-4 h-4" style={{ color: '#555' }} />}
                </button>

                {isEditingMod ? (
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input value={editModuleName} onChange={e => setEditModuleName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveModule(mod.id)}
                        placeholder="Nome do módulo"
                        className="flex-1 h-8 px-3 text-sm border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#555' }} />
                      <input value={editModuleCapaUrl} onChange={e => setEditModuleCapaUrl(e.target.value)}
                        placeholder="URL da capa do módulo"
                        className="flex-1 h-8 px-3 text-xs border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
                      {editModuleCapaUrl && (
                        <div className="w-10 h-8 border overflow-hidden flex-shrink-0" style={{ borderColor: '#2a2a2a' }}>
                          <img src={editModuleCapaUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveModule(mod.id)}>
                        <Save className="w-4 h-4" style={{ color: '#00FF78' }} />
                      </button>
                      <button onClick={() => setEditingModule(null)}>
                        <X className="w-4 h-4" style={{ color: '#666' }} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium flex-1">{mod.nome}</span>
                    <span className="text-[10px] px-2 py-0.5" style={{ background: '#00FF7820', color: '#00FF78' }}>
                      {mod.lessons.length} aula{mod.lessons.length !== 1 ? 's' : ''}
                    </span>
                    <button onClick={() => { setAddingLessonToModule(mod.id); setExpandedModule(mod.id); }}
                      className="text-[10px] px-3 py-1.5 border transition-colors hover:border-[#FF1657]"
                      style={{ borderColor: '#333', color: '#888' }}>
                      + Aula
                    </button>
                    <button onClick={() => { setEditingModule(mod.id); setEditModuleName(mod.nome); }}>
                      <Pencil className="w-3.5 h-3.5" style={{ color: '#555' }} />
                    </button>
                    <button onClick={() => deleteModule(mod.id)}>
                      <Trash2 className="w-3.5 h-3.5" style={{ color: '#FF4455' }} />
                    </button>
                  </>
                )}
              </div>

              {/* Lessons */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-1" style={{ borderTop: '1px solid #222' }}>
                  {/* Add lesson form */}
                  {addingLessonToModule === mod.id && (
                    <div className="pt-3 pb-2 flex items-center gap-2">
                      <input autoFocus value={newLessonName} onChange={e => setNewLessonName(e.target.value)}
                        placeholder="Nome da aula"
                        className="flex-1 h-8 px-3 text-xs border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
                      <input value={newLessonVideoUrl} onChange={e => setNewLessonVideoUrl(e.target.value)}
                        placeholder="URL do vídeo (opcional)"
                        className="flex-1 h-8 px-3 text-xs border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
                      <button onClick={() => addLesson(mod.id)} className="h-8 px-4 text-xs font-medium" style={{ background: '#FF1657', color: '#fff' }}>Criar</button>
                      <button onClick={() => { setAddingLessonToModule(null); setNewLessonName(''); setNewLessonVideoUrl(''); }}>
                        <X className="w-4 h-4" style={{ color: '#666' }} />
                      </button>
                    </div>
                  )}

                  {mod.lessons.length === 0 && addingLessonToModule !== mod.id && (
                    <p className="text-[11px] pt-3" style={{ color: '#444' }}>Nenhuma aula neste módulo.</p>
                  )}

                  {mod.lessons.map(lesson => {
                    const isEditingL = editingLesson === lesson.id;
                    return (
                      <div key={lesson.id} className="ml-6 flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid #1e1e1e' }}>
                        {isEditingL ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input value={editLessonName} onChange={e => setEditLessonName(e.target.value)}
                              className="flex-1 h-7 px-2 text-xs border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
                            <input value={editLessonVideoUrl} onChange={e => setEditLessonVideoUrl(e.target.value)}
                              placeholder="URL do vídeo"
                              className="flex-1 h-7 px-2 text-xs border" style={{ background: '#111', borderColor: '#2a2a2a', color: '#fff' }} />
                            <button onClick={() => saveLesson(lesson.id)}>
                              <Save className="w-3.5 h-3.5" style={{ color: '#00FF78' }} />
                            </button>
                            <button onClick={() => setEditingLesson(null)}>
                              <X className="w-3.5 h-3.5" style={{ color: '#666' }} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Video className="w-3.5 h-3.5 flex-shrink-0" style={{ color: lesson.video_url ? '#FF1657' : '#333' }} />
                            <span className="text-xs flex-1">{lesson.nome}</span>
                            {lesson.video_url && (
                              <span className="text-[9px] px-1.5 py-0.5" style={{ background: '#FF165715', color: '#FF1657' }}>vídeo</span>
                            )}
                            <button onClick={() => { setEditingLesson(lesson.id); setEditLessonName(lesson.nome); setEditLessonVideoUrl(lesson.video_url || ''); }}>
                              <Pencil className="w-3 h-3" style={{ color: '#555' }} />
                            </button>
                            <button onClick={() => deleteLesson(lesson.id)}>
                              <Trash2 className="w-3 h-3" style={{ color: '#FF4455' }} />
                            </button>
                          </>
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
    </div>
  );
}
