import { useAppContext, LeadStatus, Lead } from '@/contexts/AppContext';
import { FUNNEL_STAGES, PLAYBOOK_STAGES, REVENUE_OS_STAGES, CORE_AI_STAGES, getScoreLabel, getScoreColor } from '@/data/mockData';
import { useState, useEffect } from 'react';
import { GripVertical, Search, Phone, Mail, Megaphone, Layers, Users, Calendar, Clock, MessageSquare, AlertTriangle, Building2, Filter, DollarSign, ClipboardList, ArrowRightLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import LeadEditModal from '@/components/LeadEditModal';
import LossReasonDialog from '@/components/LossReasonDialog';
import DiagnosticoModal from '@/components/DiagnosticoModal';
import VoiceAgentButton from '@/components/VoiceAgentButton';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

export default function Pipeline() {
  const { leads, moveLeadToStage, refreshLeads } = useAppContext();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null);
  const [search, setSearch] = useState('');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [pendingLossLeadId, setPendingLossLeadId] = useState<string | null>(null);
  const [activeFunil, setActiveFunil] = useState<'callx' | 'core_ai' | 'playbook_mx3' | 'revenue_os'>('callx');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('todos');
  const [selectedFaturamento, setSelectedFaturamento] = useState<string>('todos');
  const [diagnosticoLead, setDiagnosticoLead] = useState<Lead | null>(null);
  const [diagnosticoStatuses, setDiagnosticoStatuses] = useState<Record<string, string>>({});
  const [migratingLeadId, setMigratingLeadId] = useState<string | null>(null);

  const allFunnels = [
    { value: 'callx', label: 'Funil CallX' },
    { value: 'core_ai', label: 'Funil Core AI' },
    { value: 'playbook_mx3', label: 'Playbook MX3' },
    { value: 'revenue_os', label: 'Revenue OS' },
  ];

  const funilLabels: Record<string, string> = { callx: 'Funil CallX', core_ai: 'Funil Core AI', playbook_mx3: 'Playbook MX3', revenue_os: 'Revenue OS' };
  const funilLabel = funilLabels[activeFunil] || activeFunil;

  // Load diagnostico statuses for Revenue OS leads
  useEffect(() => {
    if (activeFunil !== 'revenue_os') return;
    const revenueLeadIds = leads.filter(l => (l.funil || 'callx') === 'revenue_os').map(l => l.id);
    if (revenueLeadIds.length === 0) return;
    (async () => {
      const { data } = await supabase.from('diagnosticos').select('lead_id, status').in('lead_id', revenueLeadIds);
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((d: any) => { map[d.lead_id] = d.status; });
        setDiagnosticoStatuses(map);
      }
    })();
  }, [activeFunil, leads]);

  const vendedores = Array.from(new Set(leads.map(l => l.vendedor_nome).filter(Boolean))) as string[];

  const faturamentoRanges: { label: string; value: string; min: number; max: number }[] = [
    { label: 'Sem info', value: 'sem_info', min: -1, max: -1 },
    { label: 'Até 50k', value: 'ate_50k', min: 0, max: 50000 },
    { label: '50k – 100k', value: '50k_100k', min: 50000, max: 100000 },
    { label: '100k – 500k', value: '100k_500k', min: 100000, max: 500000 },
    { label: '500k – 1M', value: '500k_1m', min: 500000, max: 1000000 },
    { label: 'Acima de 1M', value: 'acima_1m', min: 1000000, max: Infinity },
  ];

  const matchesFaturamento = (lead: Lead) => {
    if (selectedFaturamento === 'todos') return true;
    const range = faturamentoRanges.find(r => r.value === selectedFaturamento);
    if (!range) return true;
    if (range.value === 'sem_info') return lead.faturamento == null;
    if (lead.faturamento == null) return false;
    return lead.faturamento >= range.min && lead.faturamento < range.max;
  };

  const filteredLeads = leads.filter(l =>
    (l.funil || 'callx') === activeFunil &&
    (selectedVendedor === 'todos' || l.vendedor_nome === selectedVendedor) &&
    matchesFaturamento(l)
  );

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId);
  };

  const handleDragOver = (e: React.DragEvent, stage: LeadStatus) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDrop = (stage: LeadStatus) => {
    if (draggedLead) {
      if (stage === 'perdido') {
        setPendingLossLeadId(draggedLead);
        setLossDialogOpen(true);
      } else {
        moveLeadToStage(draggedLead, stage);
      }
      setDraggedLead(null);
      setDragOverStage(null);
    }
  };

  const handleLossConfirm = async (motivo: string) => {
    if (pendingLossLeadId) {
      await moveLeadToStage(pendingLossLeadId, 'perdido');
      await supabase.from('leads').update({ motivo_perda: motivo }).eq('id', pendingLossLeadId);
      setPendingLossLeadId(null);
      setLossDialogOpen(false);
    }
  };

  const handleMigrateFunnel = async (leadId: string, targetFunil: string) => {
    await supabase.from('leads').update({ funil: targetFunil, data_ultimo_movimento: new Date().toISOString() }).eq('id', leadId);
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      await supabase.from('lead_logs').insert({
        lead_id: leadId,
        acao: `Migração de pipeline: ${funilLabels[lead.funil || 'callx']} → ${funilLabels[targetFunil]}`,
        de: lead.funil || 'callx',
        para: targetFunil,
      });
    }
    setMigratingLeadId(null);
    setActiveFunil(targetFunil as typeof activeFunil);
    await refreshLeads();
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverStage(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">{funilLabel}</h1>
            <p className="text-sm text-muted-foreground mt-1">Arraste os leads entre as etapas</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select value={selectedVendedor} onValueChange={setSelectedVendedor}>
              <SelectTrigger className="w-full sm:w-48 bg-background border-border">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os vendedores</SelectItem>
                {vendedores.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedFaturamento} onValueChange={setSelectedFaturamento}>
              <SelectTrigger className="w-full sm:w-48 bg-background border-border">
                <DollarSign className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Faturamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos faturamentos</SelectItem>
                {faturamentoRanges.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, telefone, campanha..."
                className="pl-9 bg-background border-border"
              />
            </div>
          </div>
        </div>
        <Tabs value={activeFunil} onValueChange={v => setActiveFunil(v as 'callx' | 'core_ai' | 'playbook_mx3' | 'revenue_os')}>
          <TabsList>
            <TabsTrigger value="callx">Funil CallX</TabsTrigger>
            <TabsTrigger value="core_ai">Funil Core AI</TabsTrigger>
            <TabsTrigger value="playbook_mx3">Playbook MX3</TabsTrigger>
            <TabsTrigger value="revenue_os">Revenue OS</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {(activeFunil === 'playbook_mx3' ? PLAYBOOK_STAGES : activeFunil === 'revenue_os' ? REVENUE_OS_STAGES : activeFunil === 'core_ai' ? CORE_AI_STAGES : FUNNEL_STAGES).map(stage => {
          const searchLower = search.toLowerCase();
          const stageLeads = filteredLeads.filter(l =>
            l.status_funil === stage.key &&
            (!search || l.nome.toLowerCase().includes(searchLower) ||
              l.telefone.includes(search) ||
              (l.campanha || '').toLowerCase().includes(searchLower) ||
              (l.adset || '').toLowerCase().includes(searchLower) ||
              (l.grupo_anuncios || '').toLowerCase().includes(searchLower) ||
              (l.vendedor_nome || '').toLowerCase().includes(searchLower) ||
              (l.email || '').toLowerCase().includes(searchLower) ||
              (l.observacoes || '').toLowerCase().includes(searchLower))
          );
          const isOver = dragOverStage === stage.key;

          return (
            <div
              key={stage.key}
              className={`flex-shrink-0 w-80 rounded-xl border bg-card/50 transition-all ${
                isOver ? 'border-primary ring-1 ring-primary/30' : 'border-border'
              }`}
              onDragOver={e => handleDragOver(e, stage.key)}
              onDrop={() => handleDrop(stage.key)}
              onDragLeave={() => setDragOverStage(null)}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <div className="min-w-0">
                    <h3 className="text-sm font-display font-semibold text-card-foreground truncate">{stage.label}</h3>
                    {'cadenciaDia' in stage && (stage as any).cadenciaDia && (
                      <p className="text-[10px] text-muted-foreground truncate">{(stage as any).cadenciaDia}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full flex-shrink-0">
                  {stageLeads.length}
                </span>
              </div>

              <div className="p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
                {stageLeads.map(lead => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => handleDragStart(lead.id)}
                    onDragEnd={handleDragEnd}
                    className={`rounded-lg border border-border bg-card p-3.5 cursor-pointer hover:border-primary/40 transition-all space-y-2.5 ${
                      draggedLead === lead.id ? 'opacity-40' : ''
                    }`}
                    onClick={() => setEditingLead(lead)}
                  >
                    {/* Header: Nome + Etapa + Score + Grip */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-card-foreground truncate">{lead.nome}</p>
                        <span
                          className="inline-block mt-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
                          style={{ background: `${stage.color}20`, color: stage.color }}
                        >
                          {stage.label}
                        </span>
                        {lead.empresa && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{lead.empresa}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${getScoreColor(lead.score_lead)}`}>
                          {getScoreLabel(lead.score_lead)}
                        </span>
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Contato */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{lead.telefone}</span>
                      </div>
                      {lead.email && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{lead.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Campanha / Adset / Grupo */}
                    {(lead.campanha || lead.adset || lead.grupo_anuncios) && (
                      <div className="space-y-1 border-t border-border/50 pt-2">
                        {lead.campanha && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Megaphone className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{lead.campanha}</span>
                          </div>
                        )}
                        {lead.adset && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Layers className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span className="truncate">{lead.adset}</span>
                          </div>
                        )}
                        {lead.grupo_anuncios && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Users className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span className="truncate">{lead.grupo_anuncios}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Gargalo + Setor */}
                    {(lead.maior_gargalo_comercial || lead.setor_empresa) && (
                      <div className="space-y-1 border-t border-border/50 pt-2">
                        {lead.maior_gargalo_comercial && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-warning" />
                            <span className="truncate">{lead.maior_gargalo_comercial}</span>
                          </div>
                        )}
                        {lead.setor_empresa && (
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Building2 className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span className="truncate">{lead.setor_empresa}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Vendedor + Data */}
                    <div className="flex items-center justify-between border-t border-border/50 pt-2">
                      <span className="text-xs text-muted-foreground truncate">
                        {lead.vendedor_nome || 'Sem vendedor'}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(lead.data_entrada), 'dd/MM/yy')}
                      </div>
                    </div>

                    {/* Lead Time + WhatsApp Status */}
                    <div className="flex items-center justify-between">
                      {lead.lead_time != null && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {lead.lead_time}d
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                        <MessageSquare className="w-3 h-3" />
                        {lead.envio_whatsapp_status}
                      </div>
                    </div>

                    {/* Valores */}
                    {(lead.valor_proposta || lead.valor_venda) && (
                      <div className="flex items-center gap-3 border-t border-border/50 pt-2">
                        {lead.valor_proposta && (
                          <span className="text-xs font-semibold text-primary">
                            Proposta: R$ {lead.valor_proposta.toLocaleString()}
                          </span>
                        )}
                        {lead.valor_venda && (
                          <span className="text-xs font-semibold text-accent-foreground">
                            Venda: R$ {lead.valor_venda.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Botão Migração de Pipeline */}
                    <div className="border-t border-border/50 pt-2">
                      <Popover open={migratingLeadId === lead.id} onOpenChange={(open) => { if (!open) setMigratingLeadId(null); }}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMigratingLeadId(lead.id); }}
                            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Migrar Pipeline
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
                          <p className="text-xs font-medium text-muted-foreground px-2 py-1.5">Mover para:</p>
                          {allFunnels.filter(f => f.value !== activeFunil).map(f => (
                            <Button
                              key={f.value}
                              variant="ghost"
                              size="sm"
                              className="w-full justify-start text-xs h-8"
                              onClick={() => handleMigrateFunnel(lead.id, f.value)}
                            >
                              {f.label}
                            </Button>
                          ))}
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Observações */}
                    {lead.observacoes && (
                      <p className="text-[10px] text-muted-foreground/70 italic line-clamp-2 border-t border-border/50 pt-2">
                        {lead.observacoes}
                      </p>
                    )}

                    {/* Botão Diagnóstico - apenas Revenue OS */}
                    {activeFunil === 'revenue_os' && (
                      <div className="border-t border-border/50 pt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDiagnosticoLead(lead); }}
                          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs font-medium bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <ClipboardList className="w-3.5 h-3.5" />
                            Diagnóstico Comercial
                          </span>
                          <Badge variant={diagnosticoStatuses[lead.id] === 'finalizado' ? 'default' : 'secondary'} className={cn("text-[10px] px-1.5 py-0", diagnosticoStatuses[lead.id] === 'finalizado' ? 'bg-green-600 text-white' : '')}>
                            {diagnosticoStatuses[lead.id] === 'finalizado' ? 'Preenchido' : 'Pendente'}
                          </Badge>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {stageLeads.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LeadEditModal
        lead={editingLead}
        open={!!editingLead}
        onOpenChange={open => { if (!open) setEditingLead(null); }}
        onSaved={refreshLeads}
      />

      <LossReasonDialog
        open={lossDialogOpen}
        onOpenChange={(open) => {
          setLossDialogOpen(open);
          if (!open) setPendingLossLeadId(null);
        }}
        onConfirm={handleLossConfirm}
      />

      {diagnosticoLead && (
        <DiagnosticoModal
          lead={diagnosticoLead}
          open={!!diagnosticoLead}
          onOpenChange={(open) => { if (!open) setDiagnosticoLead(null); }}
          onSaved={() => {
            refreshLeads();
            // Refresh diagnostico statuses
            const revenueLeadIds = leads.filter(l => (l.funil || 'callx') === 'revenue_os').map(l => l.id);
            supabase.from('diagnosticos').select('lead_id, status').in('lead_id', revenueLeadIds).then(({ data }) => {
              if (data) {
                const map: Record<string, string> = {};
                data.forEach((d: any) => { map[d.lead_id] = d.status; });
                setDiagnosticoStatuses(map);
              }
            });
          }}
        />
      )}

      <VoiceAgentButton />
    </div>
  );
}
