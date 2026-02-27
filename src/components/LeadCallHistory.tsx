import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Phone, CheckCircle, XCircle, PhoneOff, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface CallLog {
  id: string;
  call_sid: string | null;
  status: string;
  duration_seconds: number | null;
  transcricao: string | null;
  resumo: string | null;
  created_at: string;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  initiated: { label: 'Iniciada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  completed: { label: 'Concluída', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  failed: { label: 'Falhou', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  busy: { label: 'Ocupado', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  'no-answer': { label: 'Sem Resposta', color: 'bg-muted text-muted-foreground border-border' },
  'in-progress': { label: 'Em Andamento', color: 'bg-green-500/10 text-green-400 border-green-500/20' },
};

export default function LeadCallHistory({ leadId }: { leadId: string }) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('call_logs')
      .select('id, call_sid, status, duration_seconds, transcricao, resumo, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setCalls(data || []);
        setLoading(false);
      });
  }, [leadId]);

  if (loading) return <p className="text-xs text-muted-foreground animate-pulse">Carregando chamadas...</p>;
  if (calls.length === 0) return <p className="text-xs text-muted-foreground">Nenhuma chamada registrada</p>;

  return (
    <div className="space-y-2">
      {calls.map((call) => {
        const cfg = statusLabels[call.status] || statusLabels.initiated;
        const expanded = expandedId === call.id;
        return (
          <div key={call.id} className="rounded-lg border border-border bg-muted/20">
            <button
              onClick={() => setExpandedId(expanded ? null : call.id)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left"
            >
              <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                {new Date(call.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
              {call.duration_seconds && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {Math.floor(call.duration_seconds / 60)}:{String(call.duration_seconds % 60).padStart(2, '0')}
                </span>
              )}
              <span className="ml-auto">
                {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </span>
            </button>
            {expanded && (
              <div className="px-3 pb-3 space-y-2">
                {call.resumo && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Resumo</p>
                    <p className="text-xs text-foreground bg-background rounded p-2">{call.resumo}</p>
                  </div>
                )}
                {call.transcricao ? (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Transcrição</p>
                    <div className="text-xs text-foreground bg-background rounded p-2 max-h-40 overflow-y-auto space-y-1">
                      {call.transcricao.split('\n\n').map((line, i) => (
                        <p key={i} className={line.startsWith('🤖') ? 'text-primary' : ''}>{line}</p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Transcrição não disponível</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
