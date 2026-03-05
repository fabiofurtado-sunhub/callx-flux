import { useAppContext, LeadStatus, Lead } from '@/contexts/AppContext';
import { FUNNEL_STAGES, PLAYBOOK_STAGES, REVENUE_OS_STAGES, CORE_AI_STAGES, REVENUE_IA_STAGES, DIAGNOSTICO_STAGES, REAQUECIMENTO_STAGES, getScoreLabel, getScoreColor, getStagesForFunnel } from '@/data/mockData';
import { useState, useEffect } from 'react';
import { GripVertical, Search, Phone, Mail, Megaphone, Layers, Users, Calendar, Clock, MessageSquare, AlertTriangle, Building2, Filter, DollarSign, ClipboardList, ArrowRightLeft, Download, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import LeadEditModal from '@/components/LeadEditModal';
import LossReasonDialog from '@/components/LossReasonDialog';
import DiagnosticoModal from '@/components/DiagnosticoModal';
import VoiceAgentButton from '@/components/VoiceAgentButton';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { usePermissions } from '@/hooks/usePermissions';

// SDR max stage index for blocking moves
const SDR_MAX_STAGES: LeadStatus[] = ['lead', 'mensagem_enviada', 'fup_1', 'ultima_mensagem', 'reuniao'];

export default function Pipeline() {
  const { leads, moveLeadToStage, refreshLeads } = useAppContext();
  const { role, permissions, can, isStrategic, isSdr, isSuporte } = usePermissions();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null);
  const [search, setSearch] = useState('');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [pendingLossLeadId, setPendingLossLeadId] = useState<string | null>(null);
  const [activeFunil, setActiveFunil] = useState<'callx' | 'core_ai' | 'playbook_mx3' | 'revenue_os' | 'revenue_ia' | 'diagnostico' | 'reaquecimento'>('callx');
  const [selectedVendedor, setSelectedVendedor] = useState<string>('todos');
  const [selectedFaturamento, setSelectedFaturamento] = useState<string>('todos');
  const [diagnosticoLead, setDiagnosticoLead] = useState<Lead | null>(null);
  const [diagnosticoStatuses, setDiagnosticoStatuses] = useState<Record<string, string>>({});
  const [migratingLeadId, setMigratingLeadId] = useState<string | null>(null);
  const [migrationTargetFunil, setMigrationTargetFunil] = useState<string | null>(null);
  const [cnpjDialogOpen, setCnpjDialogOpen] = useState(false);
  const [pendingPropostaLeadId, setPendingPropostaLeadId] = useState<string | null>(null);
  const [cnpjValue, setCnpjValue] = useState('');
  const [newLeadDialogOpen, setNewLeadDialogOpen] = useState(false);
  const [newLead, setNewLead] = useState({ nome: '', telefone: '', email: '', empresa: '', funil: 'callx' });
  const canMovePipeline = can('opportunities', 'move_pipeline');
  const canChangeValue = can('opportunities', 'change_value');
  const canViewAllFields = permissions.pipeline?.view_fields?.includes('all');
  const showValores = canViewAllFields || permissions.pipeline?.view_fields?.includes('valor_proposta');
  const showProbabilidade = canViewAllFields || permissions.pipeline?.view_fields?.includes('probabilidade');

  const allFunnels = [
    { value: 'callx', label: 'Funil CallX' },
    { value: 'core_ai', label: 'Funil Core AI' },
    { value: 'playbook_mx3', label: 'Playbook MX3' },
    { value: 'revenue_os', label: 'Revenue OS' },
    { value: 'revenue_ia', label: 'Revenue IA' },
    { value: 'diagnostico', label: 'Funil Diagnóstico' },
    { value: 'reaquecimento', label: 'Reaquecimento' },
  ];

  const funilLabels: Record<string, string> = { callx: 'Funil CallX', core_ai: 'Funil Core AI', playbook_mx3: 'Playbook MX3', revenue_os: 'Revenue OS', revenue_ia: 'Revenue IA', diagnostico: 'Funil Diagnóstico', reaquecimento: 'Reaquecimento' };
  const funilLabel = funilLabels[activeFunil] || activeFunil;

  // Load diagnostico statuses for Revenue OS and Core AI leads
  useEffect(() => {
    if (!['revenue_os', 'core_ai', 'revenue_ia', 'diagnostico'].includes(activeFunil)) return;
    const funnelLeadIds = leads.filter(l => (l.funil || 'callx') === activeFunil).map(l => l.id);
    if (funnelLeadIds.length === 0) return;
    (async () => {
      const { data } = await supabase.from('diagnosticos').select('lead_id, status').in('lead_id', funnelLeadIds);
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
      // Suporte cannot move pipeline
      if (!canMovePipeline) {
        toast.error('Você não tem permissão para mover leads no pipeline');
        setDraggedLead(null);
        setDragOverStage(null);
        return;
      }

      // SDR max stage restriction
      if (isSdr && !SDR_MAX_STAGES.includes(stage)) {
        toast.error('SDRs só podem mover leads até a etapa Reunião');
        setDraggedLead(null);
        setDragOverStage(null);
        return;
      }

      const lead = leads.find(l => l.id === draggedLead);
      if (stage === 'perdido') {
        setPendingLossLeadId(draggedLead);
        setLossDialogOpen(true);
      } else if (stage === 'proposta' && lead?.status_funil === 'reuniao_realizada') {
        // Check if account has CNPJ via DB
        (async () => {
          const { data: dbLead } = await supabase.from('leads').select('account_id').eq('id', draggedLead).single();
          if (dbLead?.account_id) {
            const { data: acc } = await supabase.from('accounts').select('cnpj').eq('id', dbLead.account_id).single();
            if (acc?.cnpj && acc.cnpj.trim()) {
              moveLeadToStage(draggedLead, stage);
            } else {
              setPendingPropostaLeadId(draggedLead);
              setCnpjValue('');
              setCnpjDialogOpen(true);
            }
          } else {
            setPendingPropostaLeadId(draggedLead);
            setCnpjValue('');
            setCnpjDialogOpen(true);
          }
        })();
      } else {
        moveLeadToStage(draggedLead, stage);
      }
      setDraggedLead(null);
      setDragOverStage(null);
    }
  };

  const handleCnpjConfirm = async () => {
    if (!cnpjValue.trim()) {
      toast.error('CNPJ é obrigatório para avançar para Proposta');
      return;
    }
    if (pendingPropostaLeadId) {
      const { data: dbLead } = await supabase.from('leads').select('account_id').eq('id', pendingPropostaLeadId).single();
      if (dbLead?.account_id) {
        await supabase.from('accounts').update({ cnpj: cnpjValue.trim() }).eq('id', dbLead.account_id);
      }
      await moveLeadToStage(pendingPropostaLeadId, 'proposta');
      setPendingPropostaLeadId(null);
      setCnpjDialogOpen(false);
      toast.success('CNPJ salvo e lead movido para Proposta');
      refreshLeads();
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

  const handleMigrateFunnel = async (leadId: string, targetFunil: string, targetStage?: LeadStatus) => {
    const targetStages = getStagesForFunnel(targetFunil);
    const lead = leads.find(l => l.id === leadId);
    // Determine the stage: use chosen stage, or keep current if it exists in target, otherwise use first stage
    const finalStage = targetStage || (lead && targetStages.some(s => s.key === lead.status_funil) ? lead.status_funil : targetStages[0]?.key || 'lead');
    
    await supabase.from('leads').update({ 
      funil: targetFunil, 
      status_funil: finalStage,
      data_ultimo_movimento: new Date().toISOString() 
    }).eq('id', leadId);
    if (lead) {
      await supabase.from('lead_logs').insert({
        lead_id: leadId,
        acao: `Migração de pipeline: ${funilLabels[lead.funil || 'callx']} → ${funilLabels[targetFunil]} (etapa: ${finalStage})`,
        de: lead.funil || 'callx',
        para: targetFunil,
      });
    }
    setMigratingLeadId(null);
    setMigrationTargetFunil(null);
    setActiveFunil(targetFunil as typeof activeFunil);
    await refreshLeads();
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverStage(null);
  };

  const handleExportSpecialCSV = () => {
    const exportLeads = leads.filter(l =>
      (l.funil === 'playbook_mx3') ||
      (l.funil === 'callx' && (l.status_funil === 'fup_1' || l.status_funil === 'ia_call_2'))
    );
    const stageLabels: Record<string, string> = {
      lead: 'Lead', mensagem_enviada: 'Msg Enviada', fup_1: 'FUP 1', ia_call: 'IA Call', ia_call_2: 'IA Call 2',
      ultima_mensagem: 'Última Msg', reuniao: 'Reunião', no_show: 'No-Show', reuniao_realizada: 'Reunião Realizada',
      proposta: 'Proposta', venda: 'Venda', perdido: 'Perdido',
    };
    const funilMap: Record<string, string> = { callx: 'CallX', core_ai: 'Core AI', playbook_mx3: 'Playbook MX3', revenue_os: 'Revenue OS', revenue_ia: 'Revenue IA', diagnostico: 'Diagnóstico' };
    const headers = ['Nome', 'Email', 'Telefone', 'Empresa', 'Funil', 'Etapa', 'Vendedor', 'Campanha', 'Score', 'Faturamento', 'Data Entrada'];
    const escape = (v: any) => { if (v == null) return ''; const s = String(v); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = exportLeads.map(l => [
      l.nome, l.email, l.telefone, l.empresa, funilMap[l.funil] || l.funil,
      stageLabels[l.status_funil] || l.status_funil, l.vendedor_nome, l.campanha, l.score_lead,
      l.faturamento, l.data_entrada ? new Date(l.data_entrada).toLocaleDateString('pt-BR') : '',
    ].map(escape).join(','));
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_playbook_fup1_iacall2_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${exportLeads.length} leads exportados!`);
  };

  const handleCreateLead = async () => {
    if (!newLead.nome.trim() || !newLead.telefone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }
    const { error } = await supabase.from('leads').insert({
      nome: newLead.nome.trim(),
      telefone: newLead.telefone.trim(),
      email: newLead.email.trim() || null,
      empresa: newLead.empresa.trim() || null,
      funil: newLead.funil,
      status_funil: 'lead',
    });
    if (error) {
      toast.error('Erro ao criar lead: ' + error.message);
      return;
    }
    toast.success('Lead criado com sucesso!');
    setNewLeadDialogOpen(false);
    setNewLead({ nome: '', telefone: '', email: '', empresa: '', funil: 'callx' });
    await refreshLeads();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">{funilLabel}</h1>
              <p className="text-sm text-muted-foreground mt-1">Arraste os leads entre as etapas</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportSpecialCSV} className="gap-2 flex-shrink-0">
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
            <Button size="sm" onClick={() => { setNewLead(prev => ({ ...prev, funil: activeFunil })); setNewLeadDialogOpen(true); }} className="gap-2 flex-shrink-0">
              <Plus className="w-4 h-4" />
              Novo Lead
            </Button>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Vendedor filter - only for strategic roles */}
            {isStrategic && (
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
            )}
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
        <Tabs value={activeFunil} onValueChange={v => setActiveFunil(v as typeof activeFunil)}>
          <TabsList>
            <TabsTrigger value="callx">Funil CallX</TabsTrigger>
            <TabsTrigger value="core_ai">Funil Core AI</TabsTrigger>
            <TabsTrigger value="playbook_mx3">Playbook MX3</TabsTrigger>
            <TabsTrigger value="revenue_os">Revenue OS</TabsTrigger>
            <TabsTrigger value="revenue_ia">Revenue IA</TabsTrigger>
            <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
            <TabsTrigger value="reaquecimento">Reaquecimento</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {(activeFunil === 'playbook_mx3' ? PLAYBOOK_STAGES : activeFunil === 'revenue_os' ? REVENUE_OS_STAGES : activeFunil === 'core_ai' ? CORE_AI_STAGES : activeFunil === 'revenue_ia' ? REVENUE_IA_STAGES : activeFunil === 'diagnostico' ? DIAGNOSTICO_STAGES : activeFunil === 'reaquecimento' ? REAQUECIMENTO_STAGES : FUNNEL_STAGES).map(stage => {
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
                    draggable={canMovePipeline}
                    onDragStart={() => canMovePipeline && handleDragStart(lead.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'rounded-lg border bg-card p-3.5 cursor-pointer hover:border-primary/40 transition-all space-y-2.5',
                      draggedLead === lead.id ? 'opacity-40' : '',
                      lead.faturamento != null && lead.faturamento >= 500000
                        ? 'border-amber-400/70 ring-1 ring-amber-400/30 shadow-[0_0_12px_-2px_rgba(251,191,36,0.25)]'
                        : 'border-border'
                    )}
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
                      <div className="flex flex-col items-end text-[10px] text-muted-foreground flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(lead.data_entrada), 'dd/MM/yy')}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(lead.data_entrada), 'HH:mm')}
                        </div>
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

                    {/* Valores - hidden for SDR/Suporte */}
                    {showValores && (lead.valor_proposta || lead.valor_venda) && (
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

                    {/* Botão Migração de Pipeline - only strategic roles */}
                    {isStrategic && (
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
                    )}

                    {/* Observações */}
                    {lead.observacoes && (
                      <p className="text-[10px] text-muted-foreground/70 italic line-clamp-2 border-t border-border/50 pt-2">
                        {lead.observacoes}
                      </p>
                    )}

                    {/* Botão Diagnóstico - Revenue OS e Core AI */}
                    {(activeFunil === 'revenue_os' || activeFunil === 'core_ai') && (
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
            const funnelLeadIds = leads.filter(l => ['revenue_os', 'core_ai'].includes(l.funil || 'callx')).map(l => l.id);
            supabase.from('diagnosticos').select('lead_id, status').in('lead_id', funnelLeadIds).then(({ data }) => {
              if (data) {
                const map: Record<string, string> = {};
                data.forEach((d: any) => { map[d.lead_id] = d.status; });
                setDiagnosticoStatuses(map);
              }
            });
          }}
        />
      )}

      {/* CNPJ Dialog */}
      <Dialog open={cnpjDialogOpen} onOpenChange={(open) => { setCnpjDialogOpen(open); if (!open) setPendingPropostaLeadId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>CNPJ obrigatório</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Para mover para <strong>Proposta</strong>, informe o CNPJ da empresa.
          </p>
          <div className="space-y-2">
            <Label className="text-xs">CNPJ</Label>
            <Input
              placeholder="00.000.000/0000-00"
              value={cnpjValue}
              onChange={(e) => setCnpjValue(e.target.value)}
              className="bg-background border-border"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCnpjDialogOpen(false); setPendingPropostaLeadId(null); }}>Cancelar</Button>
            <Button onClick={handleCnpjConfirm}>Confirmar e Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Novo Lead */}
      <Dialog open={newLeadDialogOpen} onOpenChange={setNewLeadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funil</Label>
              <Select value={newLead.funil} onValueChange={v => setNewLead(prev => ({ ...prev, funil: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allFunnels.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={newLead.nome} onChange={e => setNewLead(prev => ({ ...prev, nome: e.target.value }))} placeholder="Nome do lead" />
            </div>
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input value={newLead.telefone} onChange={e => setNewLead(prev => ({ ...prev, telefone: e.target.value }))} placeholder="5511999999999" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={newLead.email} onChange={e => setNewLead(prev => ({ ...prev, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input value={newLead.empresa} onChange={e => setNewLead(prev => ({ ...prev, empresa: e.target.value }))} placeholder="Nome da empresa" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewLeadDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateLead}>Criar Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VoiceAgentButton />
    </div>
  );
}
