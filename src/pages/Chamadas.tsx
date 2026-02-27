import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Clock, CheckCircle, XCircle, PhoneCall, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CallLog {
  id: string;
  lead_id: string;
  call_sid: string | null;
  agent_type: string;
  status: string;
  duration_seconds: number | null;
  telefone: string | null;
  transcricao: string | null;
  resumo: string | null;
  sentimento: string | null;
  erro: string | null;
  metadata: any;
  created_at: string;
  lead_nome?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Phone }> = {
  initiated: { label: 'Iniciada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Phone },
  ringing: { label: 'Tocando', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: PhoneCall },
  'in-progress': { label: 'Em Andamento', color: 'bg-green-500/10 text-green-400 border-green-500/20', icon: PhoneCall },
  completed: { label: 'Concluída', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
  failed: { label: 'Falhou', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
  busy: { label: 'Ocupado', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: PhoneOff },
  'no-answer': { label: 'Sem Resposta', color: 'bg-muted text-muted-foreground border-border', icon: PhoneOff },
  canceled: { label: 'Cancelada', color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

export default function Chamadas() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  const fetchCalls = async () => {
    const { data, error } = await supabase
      .from('call_logs')
      .select('*, leads(nome)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) {
      setCalls(data.map((c: any) => ({
        ...c,
        lead_nome: c.leads?.nome || 'Desconhecido',
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCalls();

    const channel = supabase
      .channel('call-logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => {
        fetchCalls();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // KPIs
  const total = calls.length;
  const completed = calls.filter(c => c.status === 'completed').length;
  const failed = calls.filter(c => ['failed', 'busy', 'no-answer', 'canceled'].includes(c.status)).length;
  const avgDuration = completed > 0
    ? Math.round(calls.filter(c => c.status === 'completed' && c.duration_seconds).reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completed)
    : 0;
  const withTranscription = calls.filter(c => c.transcricao).length;

  const kpis = [
    { label: 'Total Chamadas', value: total, icon: Phone, color: 'text-primary' },
    { label: 'Concluídas', value: completed, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Falhas', value: failed, icon: XCircle, color: 'text-red-400' },
    { label: 'Duração Média', value: `${Math.floor(avgDuration / 60)}:${String(avgDuration % 60).padStart(2, '0')}`, icon: Clock, color: 'text-blue-400' },
    { label: 'Com Transcrição', value: withTranscription, icon: FileText, color: 'text-violet-400' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Chamadas IA</h1>
        <p className="text-sm text-muted-foreground">Painel de monitoramento das chamadas ElevenLabs + Twilio</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Call Logs Table */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Histórico de Chamadas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
          ) : calls.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma chamada registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 px-3 text-xs font-medium">Data</th>
                    <th className="text-left py-2 px-3 text-xs font-medium">Lead</th>
                    <th className="text-left py-2 px-3 text-xs font-medium">Telefone</th>
                    <th className="text-left py-2 px-3 text-xs font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-xs font-medium">Duração</th>
                    <th className="text-left py-2 px-3 text-xs font-medium">Transcrição</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => {
                    const cfg = statusConfig[call.status] || statusConfig.initiated;
                    const StatusIcon = cfg.icon;
                    return (
                      <tr
                        key={call.id}
                        className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedCall(call)}
                      >
                        <td className="py-2.5 px-3 text-xs text-muted-foreground">
                          {new Date(call.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">{call.lead_nome}</td>
                        <td className="py-2.5 px-3 text-muted-foreground">{call.telefone || '-'}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className={`gap-1 text-[10px] ${cfg.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {call.duration_seconds
                            ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}`
                            : '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          {call.transcricao ? (
                            <Badge variant="secondary" className="text-[10px]">
                              <FileText className="w-3 h-3 mr-1" />
                              Disponível
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Call Detail Modal */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground">
              Detalhes da Chamada — {selectedCall?.lead_nome}
            </DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4 mt-2">
              {/* Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Data</span>
                  <p className="text-sm text-foreground">{new Date(selectedCall.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Telefone</span>
                  <p className="text-sm text-foreground">{selectedCall.telefone || '-'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Duração</span>
                  <p className="text-sm text-foreground">
                    {selectedCall.duration_seconds
                      ? `${Math.floor(selectedCall.duration_seconds / 60)}:${String(selectedCall.duration_seconds % 60).padStart(2, '0')}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase">Status</span>
                  <p className="text-sm text-foreground">
                    {(statusConfig[selectedCall.status] || statusConfig.initiated).label}
                  </p>
                </div>
              </div>

              {/* Resumo */}
              {selectedCall.resumo && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resumo da Chamada</h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">{selectedCall.resumo}</p>
                </div>
              )}

              {/* Transcrição */}
              {selectedCall.transcricao ? (
                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transcrição Completa</h4>
                  <ScrollArea className="max-h-80">
                    <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                      {selectedCall.transcricao.split('\n\n').map((line, i) => (
                        <p key={i} className={`text-sm ${line.startsWith('🤖') ? 'text-primary' : 'text-foreground'}`}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="border-t border-border pt-3">
                  <p className="text-sm text-muted-foreground italic">Transcrição não disponível para esta chamada</p>
                </div>
              )}

              {/* Erro */}
              {selectedCall.erro && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">Erro</h4>
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{selectedCall.erro}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
