import { useAppContext } from '@/contexts/AppContext';
import { FUNNEL_STAGES, LeadStatus, Lead, getScoreLabel, getScoreColor } from '@/data/mockData';
import { useState } from 'react';
import { GripVertical } from 'lucide-react';

export default function Pipeline() {
  const { leads, moveLeadToStage } = useAppContext();
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStatus | null>(null);

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
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Pipeline Comercial</h1>
        <p className="text-sm text-muted-foreground mt-1">Arraste os leads entre as etapas</p>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {FUNNEL_STAGES.map(stage => {
          const stageLeads = leads.filter(l => l.status_funil === stage.key);
          const isOver = dragOverStage === stage.key;

          return (
            <div
              key={stage.key}
              className={`flex-shrink-0 w-72 rounded-xl border bg-card/50 transition-all ${
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
                    className={`rounded-lg border border-border bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-all ${
                      draggedLead === lead.id ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-card-foreground">{lead.nome}</p>
                      <GripVertical className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{lead.campanha}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{lead.vendedor}</span>
                      <span className={`text-[10px] font-bold uppercase ${getScoreColor(lead.score_lead)}`}>
                        {getScoreLabel(lead.score_lead)}
                      </span>
                    </div>
                    {lead.valor_proposta && (
                      <p className="text-xs font-semibold text-primary mt-2">
                        R$ {lead.valor_proposta.toLocaleString()}
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
    </div>
  );
}
