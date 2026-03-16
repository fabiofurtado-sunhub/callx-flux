import { useAppContext } from '@/contexts/AppContext';
import KpiCard from '@/components/KpiCard';
import {
  Users, CalendarCheck, FileText, Trophy, DollarSign, Target,
  TrendingUp, Clock, ArrowRightLeft, MessageSquare, Flame, Bell, CheckCircle2, CalendarDays
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList, LineChart, Line, Legend,
} from 'recharts';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, subDays, subMonths, startOfMonth, endOfMonth, isAfter, isBefore, startOfWeek, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePermissions } from '@/hooks/usePermissions';

export default function Dashboard() {
  const { leads, settings } = useAppContext();
  const { can, isStrategic, isSdr, isSuporte, isVendedor } = usePermissions();
  const [alertas, setAlertas] = useState<any[]>([]);
  const [activeFunil, setActiveFunil] = useState<string>('todos');
  const [selectedFaixa, setSelectedFaixa] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>('todos');
  const [evolucaoMode, setEvolucaoMode] = useState<'semana' | 'mes'>('semana');

  const showFinancials = !isVendedor && (can('reports', 'view_company') || isStrategic);
  const showTeamMetrics = !isVendedor && (can('reports', 'view_team') || isStrategic);

  const fetchAlertas = useCallback(async () => {
    const { data } = await supabase
      .from('alertas_comerciais')
      .select('*, leads(nome, score_lead, vendedor_nome, status_funil)')
      .eq('lido', false)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setAlertas(data);
  }, []);

  useEffect(() => {
    fetchAlertas();
    const channel = supabase
      .channel('alertas-dashboard')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertas_comerciais' }, () => fetchAlertas())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAlertas]);

  const markAsRead = async (id: string) => {
    await supabase.from('alertas_comerciais').update({ lido: true, lido_em: new Date().toISOString() }).eq('id', id);
    setAlertas(prev => prev.filter(a => a.id !== id));
  };

  const funilLabels: Record<string, string> = {
    todos: 'Acumulado',
    callx: 'CallX',
    core_ai: 'Core AI',
    playbook_mx3: 'Playbook MX3',
    revenue_os: 'Revenue OS',
    revenue_ia: 'Revenue IA',
    diagnostico: 'Diagnóstico',
    reaquecimento: 'Reaquecimento',
    protocolo_solar: 'Protocolo Solar',
  };

  const allFunnels = ['todos', 'callx', 'core_ai', 'playbook_mx3', 'revenue_os', 'revenue_ia', 'diagnostico', 'reaquecimento', 'protocolo_solar'];

  // Time range filter
  const getTimeRangeStart = useCallback((): Date | null => {
    const now = new Date();
    switch (timeRange) {
      case '7d': return subDays(now, 7);
      case '15d': return subDays(now, 15);
      case '30d': return subDays(now, 30);
      case '90d': return subDays(now, 90);
      case 'mes_atual': return startOfMonth(now);
      case 'mes_passado': return startOfMonth(subMonths(now, 1));
      default: return null;
    }
  }, [timeRange]);

  const getTimeRangeEnd = useCallback((): Date | null => {
    if (timeRange === 'mes_passado') return endOfMonth(subMonths(new Date(), 1));
    return null;
  }, [timeRange]);

  const isInTimeRange = useCallback((dateStr: string) => {
    const rangeStart = getTimeRangeStart();
    const rangeEnd = getTimeRangeEnd();
    if (!rangeStart) return true;
    const d = new Date(dateStr);
    if (isBefore(d, rangeStart)) return false;
    if (rangeEnd && isAfter(d, rangeEnd)) return false;
    return true;
  }, [getTimeRangeStart, getTimeRangeEnd]);

  // Leads filtrados por funil apenas
  const filteredByFunilOnly = useMemo(() => {
    return activeFunil === 'todos' ? leads : leads.filter(l => (l.funil || 'callx') === activeFunil);
  }, [leads, activeFunil]);

  // Total leads: filtra por data_entrada (novos leads no período)
  const filteredByFunil = useMemo(() => {
    return filteredByFunilOnly.filter(l => isInTimeRange(l.data_entrada));
  }, [filteredByFunilOnly, isInTimeRange]);

  // Métricas de status (vendas, reuniões, propostas): filtra por data_ultimo_movimento
  const filteredByMovimento = useMemo(() => {
    return filteredByFunilOnly.filter(l => isInTimeRange(l.data_ultimo_movimento));
  }, [filteredByFunilOnly, isInTimeRange]);

  const totalLeads = filteredByFunil.length;
  const leadsEtapaLead = filteredByFunil.filter(l => l.status_funil === 'lead').length;
  const mensagensEnviadas = filteredByMovimento.filter(l => l.status_funil === 'mensagem_enviada').length;
  const reunioes = filteredByMovimento.filter(l => l.status_funil === 'reuniao' || l.status_funil === 'no_show' || l.status_funil === 'reuniao_realizada' || l.status_funil === 'proposta' || l.status_funil === 'venda').length;
  const propostasLeads = filteredByMovimento.filter(l => l.status_funil === 'proposta' || l.status_funil === 'venda');
  const propostas = propostasLeads.length;
  const valorPropostas = propostasLeads.reduce((sum, l) => sum + (l.valor_proposta || 0), 0);
  const vendas = filteredByMovimento.filter(l => l.status_funil === 'venda');
  const vendasCount = vendas.length;
  const receitaTotal = vendas.reduce((sum, l) => sum + (l.valor_venda || 0), 0);
  const ticketMedio = vendasCount > 0 ? receitaTotal / vendasCount : 0;
  const taxaConversao = totalLeads > 0 ? ((vendasCount / totalLeads) * 100).toFixed(1) : '0';
  const taxaLeadReuniao = totalLeads > 0 ? ((reunioes / totalLeads) * 100).toFixed(1) : '0';
  const taxaReuniaoVenda = reunioes > 0 ? ((vendasCount / reunioes) * 100).toFixed(1) : '0';
  const leadTimeMedio = vendas.filter(v => v.lead_time).reduce((sum, v) => sum + (v.lead_time || 0), 0) / (vendas.filter(v => v.lead_time).length || 1);

  // Receita por vendedor
  const vendedorReceitaMap = new Map<string, number>();
  vendas.forEach(v => vendedorReceitaMap.set(v.vendedor_nome, (vendedorReceitaMap.get(v.vendedor_nome) || 0) + (v.valor_venda || 0)));
  const receitaPorVendedor = Array.from(vendedorReceitaMap, ([name, value]) => ({ name: name.split(' ')[0], value }));

  // Motivos de perda
  const perdidos = filteredByMovimento.filter(l => l.status_funil === 'perdido');
  const motivoMap = new Map<string, number>();
  perdidos.forEach(l => { if (l.motivo_perda) motivoMap.set(l.motivo_perda, (motivoMap.get(l.motivo_perda) || 0) + 1); });
  const motivosPerda = Array.from(motivoMap, ([name, value]) => ({ name, value }));

  // Leads por faixa de faturamento
  const faixas = [
    { label: 'Sem info', min: -1, max: 0 },
    { label: 'Até 50k', min: 0, max: 49999 },
    { label: '50k–100k', min: 50000, max: 99999 },
    { label: '100k–500k', min: 100000, max: 499999 },
    { label: '500k–1M', min: 500000, max: 999999 },
    { label: 'Acima 1M', min: 1000000, max: Infinity },
  ];

  const getLeadsForFaixa = (label: string) => {
    const f = faixas.find(fx => fx.label === label);
    if (!f) return [];
    return filteredByFunil.filter(l => {
      if (f.min === -1) return !l.faturamento;
      return l.faturamento != null && l.faturamento >= f.min && l.faturamento <= f.max;
    });
  };

  const leadsPorFaturamento = faixas.map(f => {
    const count = getLeadsForFaixa(f.label).length;
    return { name: f.label, value: count };
  }).filter(d => d.value > 0);

  const selectedFaixaLeads = selectedFaixa ? getLeadsForFaixa(selectedFaixa) : [];

  const statusLabels: Record<string, string> = {
    lead: 'Lead', mensagem_enviada: 'Msg Enviada', fup_1: 'FUP 1', ia_call: 'IA Call',
    ia_call_2: 'IA Call 2', ultima_mensagem: 'Última Msg', reuniao: 'Reunião',
    no_show: 'No-Show', reuniao_realizada: 'Reunião Realizada', proposta: 'Proposta',
    venda: 'Venda', perdido: 'Perdido',
  };

  const funilLabelMap: Record<string, string> = { callx: 'CallX', core_ai: 'Core AI', playbook_mx3: 'Playbook MX3', revenue_os: 'Revenue OS', revenue_ia: 'Revenue IA', diagnostico: 'Diagnóstico', reaquecimento: 'Reaquecimento', protocolo_solar: 'Protocolo Solar' };

  // Funil data
  const funnelData = [
    { name: 'Lead', value: filteredByFunil.filter(l => l.status_funil === 'lead').length },
    { name: 'Msg Enviada', value: mensagensEnviadas },
    { name: 'Reunião', value: filteredByMovimento.filter(l => l.status_funil === 'reuniao' || l.status_funil === 'reuniao_realizada').length },
    { name: 'No-Show', value: filteredByMovimento.filter(l => l.status_funil === 'no_show').length },
    { name: 'Proposta', value: filteredByMovimento.filter(l => l.status_funil === 'proposta').length },
    { name: 'Venda', value: vendasCount },
    { name: 'Perdido', value: perdidos.length },
  ];

  const PIE_COLORS = ['hsl(199,89%,48%)', 'hsl(38,92%,50%)', 'hsl(18,100%,60%)', 'hsl(0,72%,51%)', 'hsl(215,20%,55%)'];

  const timeRangeLabel: Record<string, string> = {
    todos: 'Todo período',
    '7d': 'Últimos 7 dias',
    '15d': 'Últimos 15 dias',
    '30d': 'Últimos 30 dias',
    '90d': 'Últimos 90 dias',
    mes_atual: 'Mês atual',
    mes_passado: 'Mês passado',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Executivo</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão geral da operação comercial</p>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(timeRangeLabel).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allFunnels.map(f => (
            <Button
              key={f}
              size="sm"
              variant={activeFunil === f ? 'default' : 'outline'}
              onClick={() => setActiveFunil(f)}
              className="text-xs h-7 px-2.5"
            >
              {funilLabels[f]}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard title="Total Leads" value={totalLeads} icon={Users} variant="primary" />
        <KpiCard title="Msg Enviadas" value={mensagensEnviadas} icon={MessageSquare} />
        <KpiCard title="Reuniões" value={reunioes} icon={CalendarCheck} variant="warning" />
        {showFinancials && <KpiCard title="Propostas" value={propostas} icon={FileText} />}
        {showFinancials && <KpiCard title="Vlr Propostas" value={`R$ ${(valorPropostas / 1000).toFixed(0)}k`} icon={Target} variant="warning" />}
        {showFinancials && <KpiCard title="Vendas" value={vendasCount} icon={Trophy} variant="success" />}
        {showFinancials && <KpiCard title="Receita Total" value={`R$ ${(receitaTotal / 1000).toFixed(0)}k`} icon={DollarSign} variant="primary" />}
      </div>

      {showFinancials && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard title="Ticket Médio" value={`R$ ${ticketMedio.toFixed(0)}`} icon={Target} />
          <KpiCard title="Conv. Lead→Reunião" value={`${taxaLeadReuniao}%`} icon={ArrowRightLeft} variant="warning" />
          <KpiCard title="Conv. Lead→Venda" value={`${taxaConversao}%`} icon={TrendingUp} variant="success" />
          <KpiCard title="Conv. Reunião→Venda" value={`${taxaReuniaoVenda}%`} icon={ArrowRightLeft} />
          <KpiCard title="Lead Time Médio" value={`${leadTimeMedio.toFixed(0)} dias`} icon={Clock} variant="warning" />
        </div>
      )}

      {/* Alertas Comerciais + Leads Quentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertas */}
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-display font-semibold text-card-foreground">Alertas Comerciais</h3>
            {alertas.length > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{alertas.length}</Badge>
            )}
          </div>
          {alertas.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum alerta pendente</p>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {alertas.map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <Flame className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-card-foreground truncate">
                      {a.leads?.nome || 'Lead'}
                      {a.leads?.score_lead && (
                        <span className="ml-2 text-[10px] text-destructive font-bold">Score {a.leads.score_lead}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.mensagem}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(a.created_at), 'dd/MM HH:mm')}</p>
                  </div>
                  <button onClick={() => markAsRead(a.id)} className="text-muted-foreground hover:text-success transition-colors flex-shrink-0" title="Marcar como lido">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leads Quentes (score >= 91) */}
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-display font-semibold text-card-foreground">Oportunidades Quentes</h3>
            <Badge className="text-[10px] px-1.5 py-0 bg-warning/20 text-warning border-warning/30">Score ≥ 91</Badge>
          </div>
          {(() => {
            const hotLeads = leads.filter(l => l.score_lead >= 91 && l.status_funil !== 'venda' && l.status_funil !== 'perdido');
            if (hotLeads.length === 0) return <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead com score ≥ 91</p>;
            return (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {hotLeads.sort((a, b) => b.score_lead - a.score_lead).slice(0, 10).map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-warning">{l.score_lead}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-card-foreground truncate">{l.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{l.vendedor_nome || 'Sem vendedor'} · {l.status_funil.replace(/_/g, ' ')}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">
                      {l.probabilidade_fechamento}%
                    </Badge>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Funil Comercial</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} />
              <Bar dataKey="value" fill="hsl(18,100%,60%)" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="value" position="top" fill="hsl(210,40%,95%)" fontSize={11} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
         <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Leads por Faixa de Faturamento</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={leadsPorFaturamento} onClick={(e) => { if (e?.activeLabel) setSelectedFaixa(e.activeLabel); }} style={{ cursor: 'pointer' }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} />
              <Bar dataKey="value" fill="hsl(38,92%,50%)" radius={[6, 6, 0, 0]} className="cursor-pointer">
                <LabelList dataKey="value" position="top" fill="hsl(210,40%,95%)" fontSize={11} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Evolução Temporal de Leads */}
      {(() => {
        const leadsSource = filteredByFunil;
        const dataMap = new Map<string, { leads: number; vendas: number; reunioes: number }>();

        if (evolucaoMode === 'semana') {
          leadsSource.forEach(l => {
            const d = new Date(l.data_entrada);
            const weekStart = startOfWeek(d, { weekStartsOn: 1 });
            const key = format(weekStart, 'dd/MM', { locale: ptBR });
            const entry = dataMap.get(key) || { leads: 0, vendas: 0, reunioes: 0 };
            entry.leads++;
            if (l.status_funil === 'venda') entry.vendas++;
            if (['reuniao', 'reuniao_realizada', 'no_show', 'proposta', 'venda'].includes(l.status_funil)) entry.reunioes++;
            dataMap.set(key, entry);
          });
        } else {
          leadsSource.forEach(l => {
            const d = new Date(l.data_entrada);
            const key = format(d, 'MMM/yy', { locale: ptBR });
            const entry = dataMap.get(key) || { leads: 0, vendas: 0, reunioes: 0 };
            entry.leads++;
            if (l.status_funil === 'venda') entry.vendas++;
            if (['reuniao', 'reuniao_realizada', 'no_show', 'proposta', 'venda'].includes(l.status_funil)) entry.reunioes++;
            dataMap.set(key, entry);
          });
        }

        // Sort by date
        const sortedData = Array.from(dataMap, ([name, vals]) => ({ name, ...vals }));

        return (
          <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-display font-semibold text-card-foreground">Evolução Temporal</h3>
              <div className="flex gap-1">
                <Button size="sm" variant={evolucaoMode === 'semana' ? 'default' : 'outline'} onClick={() => setEvolucaoMode('semana')} className="text-[10px] h-6 px-2">Semana</Button>
                <Button size="sm" variant={evolucaoMode === 'mes' ? 'default' : 'outline'} onClick={() => setEvolucaoMode('mes')} className="text-[10px] h-6 px-2">Mês</Button>
              </div>
            </div>
            {sortedData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados no período</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={sortedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="leads" stroke="hsl(199,89%,48%)" strokeWidth={2} name="Leads" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="reunioes" stroke="hsl(38,92%,50%)" strokeWidth={2} name="Reuniões" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="vendas" stroke="hsl(142,71%,45%)" strokeWidth={2} name="Vendas" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      })()}

      {/* Valor de Entrada por Funil */}
      {showFinancials && (() => {
        const funisComValor = Object.keys(funilLabels).filter(f => f !== 'todos');
        const dataEntradaPorFunil = funisComValor.map(f => {
          const leadsDoFunil = leads.filter(l => (l.funil || 'callx') === f);
          const total = leadsDoFunil.reduce((sum, l) => sum + (l.valor_entrada || 0), 0);
          return { name: funilLabels[f], value: total };
        }).filter(d => d.value > 0);
        return (
          <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Valor de Entrada por Funil</h3>
            {dataEntradaPorFunil.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhum valor de entrada registrado</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dataEntradaPorFunil}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, 'Valor Entrada']} />
                  <Bar dataKey="value" fill="hsl(199,89%,48%)" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="value" position="top" fill="hsl(210,40%,95%)" fontSize={10} fontWeight={600} formatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      })()}

      {/* Charts Row 2 - Financial (hidden for SDR/Suporte) */}
      {showFinancials && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Receita por Vendedor</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={receitaPorVendedor}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} formatter={(v: number) => [`R$ ${v.toLocaleString()}`, 'Receita']} />
              <Bar dataKey="value" fill="hsl(142,71%,45%)" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="value" position="top" fill="hsl(210,40%,95%)" fontSize={11} fontWeight={600} formatter={(v: number) => `R$${(v/1000).toFixed(0)}k`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Motivos de Perda</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={motivosPerda} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {motivosPerda.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {/* Dialog de leads por faixa de faturamento */}
      <Dialog open={!!selectedFaixa} onOpenChange={(open) => { if (!open) setSelectedFaixa(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Leads — Faturamento: {selectedFaixa}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Estágio</TableHead>
                <TableHead>Funil</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedFaixaLeads.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell>{l.empresa || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {statusLabels[l.status_funil] || l.status_funil}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
                      {funilLabelMap[l.funil] || l.funil}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {l.faturamento ? `R$ ${l.faturamento.toLocaleString('pt-BR')}` : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-2">{selectedFaixaLeads.length} lead(s) nesta faixa</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
