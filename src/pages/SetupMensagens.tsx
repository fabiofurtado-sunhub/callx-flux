import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FUNNEL_STAGES } from '@/data/mockData';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import CadenciaTimeline from '@/components/CadenciaTimeline';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, Clock, MessageSquare, GripVertical } from 'lucide-react';
import { toast } from 'sonner';

interface MessageTemplate {
  id: string;
  funil: string;
  etapa: string;
  titulo: string;
  conteudo: string;
  delay_horas: number;
  ativo: boolean;
  ordem: number;
}

const FUNNEL_OPTIONS = [
  { key: 'callx', label: 'Funil CallX' },
  { key: 'core_ai', label: 'Funil Core AI' },
  { key: 'playbook_mx3', label: 'Playbook MX3' },
  { key: 'revenue_os', label: 'Revenue OS' },
];

export default function SetupMensagens() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [activeFunil, setActiveFunil] = useState('callx');
  const [activeEtapa, setActiveEtapa] = useState('lead');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [horarioSugerido, setHorarioSugerido] = useState('');
  const [savingHorario, setSavingHorario] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from('message_templates')
      .select('*')
      .order('ordem', { ascending: true });
    if (!error && data) {
      setTemplates(data as MessageTemplate[]);
    }
    setLoading(false);
  }, []);

  const fetchHorario = useCallback(async () => {
    const { data } = await supabase
      .from('configuracoes')
      .select('horario_sugerido_texto')
      .limit(1)
      .single();
    if (data?.horario_sugerido_texto) {
      setHorarioSugerido(data.horario_sugerido_texto);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchHorario();
  }, [fetchTemplates, fetchHorario]);

  const filteredTemplates = templates.filter(
    t => t.funil === activeFunil && t.etapa === activeEtapa
  );

  const handleUpdate = (id: string, field: keyof MessageTemplate, value: any) => {
    setTemplates(prev =>
      prev.map(t => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave = templates.filter(t => t.funil === activeFunil && t.etapa === activeEtapa);
      for (const t of toSave) {
        await supabase
          .from('message_templates')
          .update({
            titulo: t.titulo,
            conteudo: t.conteudo,
            delay_horas: t.delay_horas,
            ativo: t.ativo,
            ordem: t.ordem,
          })
          .eq('id', t.id);
      }
      toast.success('Templates salvos com sucesso!');
    } catch {
      toast.error('Erro ao salvar templates');
    }
    setSaving(false);
  };

  const handleAdd = async () => {
    const maxOrdem = filteredTemplates.reduce((max, t) => Math.max(max, t.ordem), 0);
    const { data, error } = await supabase
      .from('message_templates')
      .insert({
        funil: activeFunil,
        etapa: activeEtapa,
        titulo: 'Nova mensagem',
        conteudo: '',
        delay_horas: activeEtapa === 'lead' ? 0 : 24,
        ativo: true,
        ordem: maxOrdem + 1,
      })
      .select()
      .single();
    if (!error && data) {
      setTemplates(prev => [...prev, data as MessageTemplate]);
      toast.success('Template adicionado');
    } else {
      toast.error('Erro ao adicionar template');
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('message_templates').delete().eq('id', id);
    if (!error) {
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success('Template removido');
    } else {
      toast.error('Erro ao remover template');
    }
  };

  const stagesWithCount = FUNNEL_STAGES.map(s => ({
    ...s,
    count: templates.filter(t => t.funil === activeFunil && t.etapa === s.key).length,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground animate-pulse">Carregando templates...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Setup de Mensagens</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure os templates de mensagens WhatsApp por funil e etapa
        </p>
      </div>

      {/* Funil selector */}
      <Tabs value={activeFunil} onValueChange={setActiveFunil}>
        <TabsList>
          {FUNNEL_OPTIONS.map(f => (
            <TabsTrigger key={f.key} value={f.key}>{f.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Cadência Timeline for Playbook MX3 */}
      {activeFunil === 'playbook_mx3' && (
        <CadenciaTimeline />
      )}

      {/* Stage selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {stagesWithCount.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveEtapa(s.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
              activeEtapa === s.key
                ? 'bg-primary/10 border-primary text-primary'
                : 'bg-card border-border text-muted-foreground hover:border-primary/40'
            }`}
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
            {s.label}
            {s.count > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {s.count}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Horário sugerido config */}
      <Card className="p-5 space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Variável {'{{horario_sugerido}}'}
        </Label>
        <p className="text-xs text-muted-foreground">
          Texto que substitui {'{{horario_sugerido}}'} nas mensagens. Ex: "amanhã às 17:00 ou 18:00"
        </p>
        <div className="flex gap-2">
          <Input
            value={horarioSugerido}
            onChange={e => setHorarioSugerido(e.target.value)}
            placeholder="amanhã às 17:00 ou 18:00, ou no dia seguinte pela manhã"
            className="text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={savingHorario}
            onClick={async () => {
              setSavingHorario(true);
              const { error } = await supabase
                .from('configuracoes')
                .update({ horario_sugerido_texto: horarioSugerido })
                .eq('id', (await supabase.from('configuracoes').select('id').limit(1).single()).data?.id ?? '');
              if (!error) toast.success('Horário sugerido salvo!');
              else toast.error('Erro ao salvar');
              setSavingHorario(false);
            }}
          >
            <Save className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Templates list */}
      <div className="space-y-4">
        {filteredTemplates.map((template, idx) => (
          <Card key={template.id} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <Input
                    value={template.titulo}
                    onChange={e => handleUpdate(template.id, 'titulo', e.target.value)}
                    className="font-semibold text-sm"
                    placeholder="Título do template"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={template.ativo}
                    onCheckedChange={v => handleUpdate(template.id, 'ativo', v)}
                  />
                  <Label className="text-xs text-muted-foreground">
                    {template.ativo ? 'Ativo' : 'Inativo'}
                  </Label>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(template.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Conteúdo da mensagem
              </Label>
              <Textarea
                value={template.conteudo}
                onChange={e => handleUpdate(template.id, 'conteudo', e.target.value)}
                placeholder="Use {{nome}} para inserir o nome do lead..."
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Variáveis disponíveis: {'{{nome}}'}, {'{{telefone}}'}, {'{{email}}'}, {'{{horario_sugerido}}'}
              </p>
            </div>

            <div className="flex items-center gap-4 border-t border-border pt-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">Delay de envio (horas):</Label>
                <Input
                  type="number"
                  min={0}
                  value={template.delay_horas}
                  onChange={e => handleUpdate(template.id, 'delay_horas', parseInt(e.target.value) || 0)}
                  className="w-20 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Ordem:</Label>
                <Input
                  type="number"
                  min={1}
                  value={template.ordem}
                  onChange={e => handleUpdate(template.id, 'ordem', parseInt(e.target.value) || 1)}
                  className="w-16 text-sm"
                />
              </div>
            </div>
          </Card>
        ))}

        {filteredTemplates.length === 0 && (
          <Card className="p-8 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum template configurado para esta etapa
            </p>
          </Card>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handleAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Template
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  );
}
