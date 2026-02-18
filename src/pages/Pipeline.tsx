import { useAppContext, LeadStatus, Lead } from '@/contexts/AppContext';
import { FUNNEL_STAGES, getScoreLabel, getScoreColor } from '@/data/mockData';
import { useState } from 'react';
import { GripVertical, Search, Phone, Mail, Megaphone, Layers, Users, Calendar, Clock, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import LeadEditModal from '@/components/LeadEditModal';

export default function Pipeline() {
  const { leads, moveLeadToStage, refreshLeads } = useAppContext();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null);
  const [search, setSearch] = useState('');
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const handleDragStart = (leadId: string) => {
    setDraggedLead(leadId);
  };

  const handleDragOver = (e: React.DragEvent, stage: LeadStatus) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDrop = (stage: LeadStatus) => {
    if (draggedLead) {
      moveLeadToStage(draggedLead, stage);
      setDraggedLead(null);
      setDragOverStage(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverStage(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Pipeline Comercial</h1>
          <p className="text-sm text-muted-foreground mt-1">Arraste os leads entre as etapas</p>
        </div>
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

      <div className="flex gap-4 overflow-x-auto pb-4">
        {FUNNEL_STAGES.map(stage => {
          const searchLower = search.toLowerCase();
          const stageLeads = leads.filter(l =>
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
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                  <h3 className="text-sm font-display font-semibold text-card-foreground">{stage.label}</h3>
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
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
                    {/* Header: Nome + Score + Grip */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-card-foreground truncate">{lead.nome}</p>
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

                    {/* Observações */}
                    {lead.observacoes && (
                      <p className="text-[10px] text-muted-foreground/70 italic line-clamp-2 border-t border-border/50 pt-2">
                        {lead.observacoes}
                      </p>
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
    </div>
  );
}
