import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Clock, CheckCircle, XCircle, PhoneCall, FileText, TrendingUp, BarChart3, Users, PhoneIncoming, PhoneMissed } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

const CHART_BLUE = 'hsl(213, 90%, 55%)';
const CHART_BLUE_LIGHT = 'hsl(213, 90%, 70%)';
const CHART_GREEN = 'hsl(142, 71%, 45%)';
const CHART_ORANGE = 'hsl(18, 100%, 60%)';
const CHART_RED = 'hsl(0, 72%, 51%)';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatMinSec(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export default function Chamadas() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null);

  const fetchCalls = async () => {
    const { data, error } = await supabase
      .from('call_logs')
      .select('*, leads(nome)')
      .order('created_at', { ascending: false })
      .limit(1000);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'call_logs' }, () => fetchCalls())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // === Computed analytics ===
  const analytics = useMemo(() => {
    const total = calls.length;
    // A call is truly "connected" only if completed AND duration > 0
    const connected = calls.filter(c => c.status === 'completed' && (c.duration_seconds || 0) > 0);
    const completedNoTalk = calls.filter(c => c.status === 'completed' && (c.duration_seconds || 0) === 0);
    const answered = connected.length;
    const unanswered = calls.filter(c => ['failed', 'busy', 'no-answer', 'canceled'].includes(c.status)).length + completedNoTalk.length;
    const inProgress = calls.filter(c => ['initiated', 'ringing', 'in-progress'].includes(c.status)).length;
    const connectRate = total > 0 ? ((answered / total) * 100).toFixed(1) : '0';

    const totalTalkSeconds = connected.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const avgTalkSeconds = answered > 0 ? Math.round(totalTalkSeconds / answered) : 0;
    const longestCall = connected.reduce((max, c) => Math.max(max, c.duration_seconds || 0), 0);
    const withTranscription = calls.filter(c => c.transcricao).length;

    // Calls per day
    const dailyMap = new Map<string, { total: number; answered: number; talkSeconds: number }>();
    calls.forEach(c => {
      const day = new Date(c.created_at).toISOString().split('T')[0];
      const entry = dailyMap.get(day) || { total: 0, answered: 0, talkSeconds: 0 };
      entry.total++;
      if (c.status === 'completed' && (c.duration_seconds || 0) > 0) {
        entry.answered++;
        entry.talkSeconds += c.duration_seconds || 0;
      }
      dailyMap.set(day, entry);
    });
    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, d]) => ({
        day: new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        total: d.total,
        answered: d.answered,
        talkMinutes: Math.round(d.talkSeconds / 60),
      }));

    const peakDay = dailyData.reduce((max, d) => d.total > max.total ? d : max, { day: '-', total: 0, answered: 0, talkMinutes: 0 });

    // Status breakdown for donut
    const statusBreakdown = [
      { name: 'Conectadas', value: answered, color: CHART_GREEN },
      { name: 'Não Conectou', value: unanswered, color: CHART_RED },
      { name: 'Em Andamento', value: inProgress, color: CHART_ORANGE },
    ].filter(s => s.value > 0);

    // Call end reasons (from status)
    const reasonMap = new Map<string, number>();
    calls.forEach(c => {
      const label = (statusConfig[c.status] || statusConfig.initiated).label;
      reasonMap.set(label, (reasonMap.get(label) || 0) + 1);
    });
    const reasonData = Array.from(reasonMap.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    // Heatmap: day of week x hour
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    calls.forEach(c => {
      const d = new Date(c.created_at);
      heatmap[d.getDay()][d.getHours()]++;
    });

    const totalMinutes = Math.round(totalTalkSeconds / 60);

    return {
      total, answered, unanswered, inProgress, connectRate,
      totalTalkSeconds, avgTalkSeconds, longestCall, withTranscription,
      dailyData, peakDay, statusBreakdown, reasonData, heatmap, totalMinutes,
    };
  }, [calls]);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground animate-pulse">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Chamadas IA</h1>
        <p className="text-sm text-muted-foreground">Visão geral de performance e métricas das chamadas</p>
      </div>

      {/* ─── Performance Summary Bar ─── */}
      <Card className="bg-card border-border" style={{ boxShadow: 'var(--shadow-card)' }}>
        <CardContent className="py-5 px-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/15">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-display font-semibold text-foreground">Performance Summary</h2>
              <p className="text-xs text-muted-foreground">Indicadores-chave de desempenho</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'Total Chamadas', value: analytics.total.toLocaleString(), color: 'text-primary' },
              { label: 'Conectadas', value: analytics.answered.toLocaleString(), color: 'text-emerald-400' },
              { label: 'Não Conectou', value: analytics.unanswered.toLocaleString(), color: 'text-red-400' },
              { label: 'Taxa Conexão', value: `${analytics.connectRate}%`, color: 'text-emerald-400' },
              { label: 'Tempo Total', value: formatDuration(analytics.totalTalkSeconds), color: 'text-blue-400' },
              { label: 'Duração Média', value: formatDuration(analytics.avgTalkSeconds), color: 'text-violet-400' },
              { label: 'Maior Chamada', value: formatDuration(analytics.longestCall), color: 'text-orange-400' },
            ].map(kpi => (
              <div key={kpi.label} className="text-center">
                <p className={`text-xl md:text-2xl font-display font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Calls Overview + Donut ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card border-border" style={{ boxShadow: 'var(--shadow-card)' }}>
            <CardContent className="py-5 px-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/15">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm font-display font-semibold text-foreground">Visão Geral das Chamadas</h2>
                  <p className="text-xs text-muted-foreground">Métricas de atividade e engajamento</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <MetricCard icon={PhoneIncoming} label="Total de Tentativas" value={analytics.total} color="text-blue-400" subtitle="Todas as chamadas realizadas" />
                <MetricCard icon={TrendingUp} label="Taxa de Conexão" value={`${analytics.connectRate}%`} color="text-emerald-400" subtitle="(Conectadas ÷ Total)" />
                <MetricCard icon={CheckCircle} label="Conectadas" value={analytics.answered} color="text-emerald-400" subtitle="Chamadas com conversa real (>0s)" />
                <MetricCard icon={PhoneMissed} label="Não Conectou" value={analytics.unanswered} color="text-red-400" subtitle="Sem conversa, falha ou sem resposta" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Donut */}
        <Card className="bg-card border-border" style={{ boxShadow: 'var(--shadow-card)' }}>
          <CardContent className="py-5 px-6">
            <h3 className="text-sm font-display font-semibold text-foreground mb-1">Distribuição de Status</h3>
            <p className="text-xs text-muted-foreground mb-4">Breakdown das chamadas por resultado</p>
            {analytics.statusBreakdown.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={analytics.statusBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {analytics.statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(216 50% 10%)', border: '1px solid hsl(216 30% 18%)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-2">
                  {analytics.statusBreakdown.map(s => (
                    <div key={s.name} className="text-center">
                      <div className="flex items-center gap-1.5 justify-center">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                        <span className="text-[10px] text-muted-foreground">{s.name}</span>
                      </div>
                      <p className="text-sm font-bold text-foreground">{s.value.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {analytics.total > 0 ? ((s.value / analytics.total) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Calls Distribution by Day (Area Chart) ─── */}
      <Card className="bg-card border-border" style={{ boxShadow: 'var(--shadow-card)' }}>
        <CardContent className="py-5 px-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/15">
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-display font-semibold text-foreground">Chamadas por Dia</h2>
                <p className="text-xs text-muted-foreground">Tendência de volume ao longo do tempo</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase">Dia de Pico</p>
              <p className="text-lg font-display font-bold text-primary">{analytics.peakDay.total.toLocaleString()}</p>
            </div>
          </div>
          {analytics.dailyData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={analytics.dailyData}>
                  <defs>
                    <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradAnswered" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_BLUE_LIGHT} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={CHART_BLUE_LIGHT} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 30% 18%)" />
                  <XAxis dataKey="day" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'hsl(216 50% 10%)', border: '1px solid hsl(216 30% 18%)', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="total" name="Total" stroke={CHART_BLUE} fill="url(#gradTotal)" strokeWidth={2} />
                  <Area type="monotone" dataKey="answered" name="Atendidas" stroke={CHART_BLUE_LIGHT} fill="url(#gradAnswered)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-12 mt-4">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">Total Chamadas</p>
                  <p className="text-lg font-display font-bold text-primary">{analytics.total.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Méd.: {analytics.dailyData.length > 0 ? Math.round(analytics.total / analytics.dailyData.length) : 0}/dia</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">Atendidas</p>
                  <p className="text-lg font-display font-bold text-blue-400">{analytics.answered.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">Méd.: {analytics.dailyData.length > 0 ? Math.round(analytics.answered / analytics.dailyData.length) : 0}/dia</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">Sem dados para exibir</p>
          )}
        </CardContent>
      </Card>

      {/* ─── Talk Time Breakdown ─── */}
      <Card className="bg-card border-border" style={{ boxShadow: 'var(--shadow-card)' }}>
        <CardContent className="py-5 px-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-violet-500/15">
              <Clock className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-display font-semibold text-foreground">Tempo de Conversa</h2>
              <p className="text-xs text-muted-foreground">Breakdown do tempo de fala por dia</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard icon={Clock} label="Tempo Total" value={formatDuration(analytics.totalTalkSeconds)} color="text-blue-400" subtitle={`${analytics.totalMinutes} min totais`} />
            <MetricCard icon={BarChart3} label="Duração Média" value={formatDuration(analytics.avgTalkSeconds)} color="text-emerald-400" subtitle="Por chamada atendida" />
            <MetricCard icon={TrendingUp} label="Maior Chamada" value={formatDuration(analytics.longestCall)} color="text-orange-400" subtitle="Duração máxima registrada" />
            <MetricCard icon={FileText} label="Com Transcrição" value={analytics.withTranscription} color="text-violet-400" subtitle="Chamadas transcritas" />
          </div>
          {analytics.dailyData.length > 0 && (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={analytics.dailyData}>
                <defs>
                  <linearGradient id="gradTalk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 30% 18%)" />
                <XAxis dataKey="day" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} unit=" min" />
                <Tooltip contentStyle={{ background: 'hsl(216 50% 10%)', border: '1px solid hsl(216 30% 18%)', borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="talkMinutes" name="Minutos" stroke={CHART_BLUE} fill="url(#gradTalk)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ─── Call End Reasons (Bar Chart) ─── */}
      {analytics.reasonData.length > 0 && (
        <Card className="bg-card border-border" style={{ boxShadow: 'var(--shadow-card)' }}>
          <CardContent className="py-5 px-6">
            <h2 className="text-sm font-display font-semibold text-foreground mb-1">Motivo de Encerramento</h2>
            <p className="text-xs text-muted-foreground mb-4">Breakdown de como as chamadas terminaram</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analytics.reasonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(216 30% 18%)" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fill: 'hsl(215 20% 55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(216 50% 10%)', border: '1px solid hsl(216 30% 18%)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" name="Chamadas" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-6 mt-4">
              {analytics.reasonData.slice(0, 5).map(r => (
                <div key={r.name} className="text-center">
                  <p className="text-[10px] text-muted-foreground">{r.name}</p>
                  <p className="text-sm font-bold text-blue-400">{r.value.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{analytics.total > 0 ? ((r.value / analytics.total) * 100).toFixed(1) : 0}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Heatmap: Calls by Day x Hour ─── */}
      <Card className="bg-card border-border" style={{ boxShadow: 'var(--shadow-card)' }}>
        <CardContent className="py-5 px-6">
          <h2 className="text-sm font-display font-semibold text-foreground mb-1">Distribuição por Horário</h2>
          <p className="text-xs text-muted-foreground mb-4">Volume de chamadas por dia da semana e hora</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr>
                  <th className="text-left py-1 px-1 text-muted-foreground font-medium w-16" />
                  {Array.from({ length: 24 }, (_, i) => (
                    <th key={i} className="text-center py-1 px-0.5 text-muted-foreground font-medium">
                      {i}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analytics.heatmap.map((row, dayIdx) => {
                  const maxVal = Math.max(...analytics.heatmap.flat(), 1);
                  return (
                    <tr key={dayIdx}>
                      <td className="py-1 px-1 text-muted-foreground font-medium">{dayNames[dayIdx]}</td>
                      {row.map((val, h) => {
                        const intensity = val / maxVal;
                        return (
                          <td key={h} className="py-1 px-0.5 text-center" title={`${dayNames[dayIdx]} ${h}h: ${val}`}>
                            <div
                              className="w-full aspect-square rounded-sm flex items-center justify-center text-[9px]"
                              style={{
                                background: val === 0
                                  ? 'hsl(216 30% 15%)'
                                  : `hsl(213 90% ${55 + (1 - intensity) * 30}% / ${0.2 + intensity * 0.8})`,
                                color: intensity > 0.4 ? 'white' : 'hsl(215 20% 55%)',
                              }}
                            >
                              {val > 0 ? val : ''}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Call Logs Table ─── */}
      <Card className="bg-card border-border" style={{ boxShadow: 'var(--shadow-card)' }}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">Histórico de Chamadas</CardTitle>
        </CardHeader>
        <CardContent>
          {calls.length === 0 ? (
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
                  {calls.slice(0, 50).map((call) => {
                    // If completed but 0 duration, show as "Não Conectou"
                    const isCompletedNoTalk = call.status === 'completed' && (call.duration_seconds || 0) === 0;
                    const effectiveStatus = isCompletedNoTalk ? 'no-connect' : call.status;
                    const cfg = effectiveStatus === 'no-connect'
                      ? { label: 'Não Conectou', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: PhoneOff }
                      : (statusConfig[call.status] || statusConfig.initiated);
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
                          {call.duration_seconds ? formatMinSec(call.duration_seconds) : '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          {call.transcricao ? (
                            <Badge variant="secondary" className="text-[10px]">
                              <FileText className="w-3 h-3 mr-1" /> Disponível
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">-</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {calls.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-3">Mostrando 50 de {calls.length} chamadas</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Call Detail Modal ─── */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground">
              Detalhes da Chamada — {selectedCall?.lead_nome}
            </DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <InfoBlock label="Data" value={new Date(selectedCall.created_at).toLocaleString('pt-BR')} />
                <InfoBlock label="Telefone" value={selectedCall.telefone || '-'} />
                <InfoBlock label="Duração" value={selectedCall.duration_seconds ? formatMinSec(selectedCall.duration_seconds) : '-'} />
                <InfoBlock label="Status" value={(statusConfig[selectedCall.status] || statusConfig.initiated).label} />
              </div>
              {selectedCall.resumo && (
                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Resumo</h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded-lg p-3">{selectedCall.resumo}</p>
                </div>
              )}
              {selectedCall.transcricao ? (
                <div className="border-t border-border pt-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Transcrição Completa</h4>
                  <ScrollArea className="max-h-80">
                    <div className="space-y-2 bg-muted/30 rounded-lg p-4">
                      {selectedCall.transcricao.split('\n\n').map((line, i) => (
                        <p key={i} className={`text-sm ${line.startsWith('🤖') ? 'text-primary' : 'text-foreground'}`}>{line}</p>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="border-t border-border pt-3">
                  <p className="text-sm text-muted-foreground italic">Transcrição não disponível</p>
                </div>
              )}
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

/* ─── Sub-components ─── */

function MetricCard({ icon: Icon, label, value, color, subtitle }: { icon: any; label: string; value: string | number; color: string; subtitle: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-display font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] text-muted-foreground uppercase">{label}</span>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
