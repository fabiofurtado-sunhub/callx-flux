import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, BarChart3, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GaLog {
  id: string;
  lead_id: string;
  event_name: string;
  stage: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  mensagem_enviada: 'Msg Enviada',
  reuniao: 'Reunião',
  reuniao_realizada: 'Reunião Realizada',
  proposta: 'Proposta',
  venda: 'Venda',
  perdido: 'Perdido',
};

interface GoogleAnalyticsLogsProps {
  leadId?: string;
  limit?: number;
}

export default function GoogleAnalyticsLogs({ leadId, limit = 10 }: GoogleAnalyticsLogsProps) {
  const [logs, setLogs] = useState<GaLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    let query = supabase
      .from('ga4_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }

    const { data } = await query;
    if (data) setLogs(data as GaLog[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('ga4-logs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ga4_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [leadId, limit]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Clock className="w-3 h-3 animate-spin" />
        Carregando eventos...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">Nenhum evento GA4 registrado.</p>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div
          key={log.id}
          className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-background/50 text-xs"
        >
          {log.status === 'success' ? (
            <CheckCircle className="w-3.5 h-3.5 text-success mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                {log.event_name}
              </Badge>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium text-card-foreground">
                {STAGE_LABELS[log.stage] || log.stage}
              </span>
            </div>
            {log.error_message && (
              <p className="text-destructive mt-1 truncate">{log.error_message}</p>
            )}
            <p className="text-muted-foreground/70 mt-0.5">
              {new Date(log.created_at).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          </div>
          <BarChart3 className="w-3 h-3 text-primary/40 shrink-0 mt-0.5" />
        </div>
      ))}
    </div>
  );
}
