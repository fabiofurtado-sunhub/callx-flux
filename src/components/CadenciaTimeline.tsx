import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Mail, MessageSquare, ChevronDown, ChevronUp, GitBranch, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface CadenciaEtapa {
  id: string;
  funil: string;
  dia: number;
  canal: string;
  titulo: string;
  conteudo: string;
  condicional: boolean;
  condicao_tipo: string | null;
  condicao_referencia_id: string | null;
  ativo: boolean;
  ordem: number;
}

export default function CadenciaTimeline() {
  const [etapas, setEtapas] = useState<CadenciaEtapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEtapas = useCallback(async () => {
    const { data, error } = await supabase
      .from('cadencia_etapas')
      .select('*')
      .eq('funil', 'playbook_mx3')
      .order('ordem', { ascending: true });
    if (!error && data) {
      setEtapas(data as CadenciaEtapa[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEtapas();
  }, [fetchEtapas]);

  const handleUpdate = (id: string, field: keyof CadenciaEtapa, value: any) => {
    setEtapas(prev => prev.map(e => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const e of etapas) {
        await supabase
          .from('cadencia_etapas')
          .update({
            titulo: e.titulo,
            conteudo: e.conteudo,
            ativo: e.ativo,
          })
          .eq('id', e.id);
      }
      toast.success('Cadência salva com sucesso!');
    } catch {
      toast.error('Erro ao salvar cadência');
    }
    setSaving(false);
  };

  const canalIcon = (canal: string) =>
    canal === 'email' ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />;

  const canalColor = (canal: string) =>
    canal === 'email' ? 'bg-blue-500/15 text-blue-600 border-blue-500/30' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30';

  const conditionLabel = (tipo: string | null) => {
    switch (tipo) {
      case 'nao_abriu_email': return 'Se NÃO abriu email anterior';
      case 'nao_clicou_cta': return 'Se NÃO clicou no CTA';
      case 'nao_converteu': return 'Se NÃO converteu';
      default: return tipo || '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group by day
  const days = [...new Set(etapas.map(e => e.dia))].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-display font-semibold text-foreground">Cadência Playbook MX3</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Timeline de 10 dias com lógica condicional</p>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[22px] top-4 bottom-4 w-0.5 bg-border" />

        <div className="space-y-3">
          {days.map(dia => {
            const dayEtapas = etapas.filter(e => e.dia === dia);
            return (
              <div key={dia} className="relative">
                {/* Day marker */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="relative z-10 w-11 h-7 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">D+{dia}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {dia === 0 ? 'Entrada na cadência' : `${dia} dia${dia > 1 ? 's' : ''} após entrada`}
                  </span>
                </div>

                {/* Steps for this day */}
                <div className="ml-14 space-y-2">
                  {dayEtapas.map(etapa => {
                    const isExpanded = expandedId === etapa.id;
                    return (
                      <Card
                        key={etapa.id}
                        className={`p-3 transition-all ${!etapa.ativo ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Canal badge */}
                          <Badge variant="outline" className={`gap-1 text-[10px] px-2 py-0.5 ${canalColor(etapa.canal)}`}>
                            {canalIcon(etapa.canal)}
                            {etapa.canal === 'email' ? 'Email' : 'WhatsApp'}
                          </Badge>

                          {/* Conditional badge */}
                          {etapa.condicional && (
                            <Badge variant="outline" className="gap-1 text-[10px] px-2 py-0.5 bg-amber-500/10 text-amber-600 border-amber-500/30">
                              <GitBranch className="w-3 h-3" />
                              Condicional
                            </Badge>
                          )}

                          {/* Title */}
                          <span className="text-sm font-medium text-foreground flex-1 truncate">{etapa.titulo}</span>

                          {/* Controls */}
                          <Switch
                            checked={etapa.ativo}
                            onCheckedChange={v => handleUpdate(etapa.id, 'ativo', v)}
                          />
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : etapa.id)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Condition info */}
                        {etapa.condicional && etapa.condicao_tipo && (
                          <p className="text-[10px] text-amber-600 mt-1.5 ml-1">
                            ⚡ {conditionLabel(etapa.condicao_tipo)}
                          </p>
                        )}

                        {/* Expanded content */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-border space-y-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">Título</Label>
                              <Input
                                value={etapa.titulo}
                                onChange={e => handleUpdate(etapa.id, 'titulo', e.target.value)}
                                className="mt-1 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Conteúdo {etapa.canal === 'email' ? '(HTML)' : '(Texto)'}
                              </Label>
                              <Textarea
                                value={etapa.conteudo}
                                onChange={e => handleUpdate(etapa.id, 'conteudo', e.target.value)}
                                rows={6}
                                className="mt-1 font-mono text-xs"
                              />
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Variáveis: {'{{nome}}'}, {'{{email}}'}, {'{{telefone}}'}
                              </p>
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
