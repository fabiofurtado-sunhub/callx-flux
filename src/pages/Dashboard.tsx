import { useAppContext } from '@/contexts/AppContext';
import KpiCard from '@/components/KpiCard';
import {
  Users, CalendarCheck, FileText, Trophy, DollarSign, Target,
  TrendingUp, Clock, ArrowRightLeft, MessageSquare, Flame, Bell, CheckCircle2
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
} from 'recharts';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { usePermissions } from '@/hooks/usePermissions';

export default function Dashboard() {
  const { leads, settings } = useAppContext();
  const { can, isStrategic, isSdr, isSuporte } = usePermissions();
  const [alertas, setAlertas] = useState<any[]>([]);
  const [activeFunil, setActiveFunil] = useState<string>('todos');

  const showFinancials = can('reports', 'view_company') || isStrategic;
  const showTeamMetrics = can('reports', 'view_team') || isStrategic;

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

  const funilLabels: Record<string, string> = { todos: 'Acumulado', callx: 'Funil CallX', core_ai: 'Funil Core AI', playbook_mx3: 'Playbook MX3' };

  const filteredByFunil = useMemo(() =>
    activeFunil === 'todos' ? leads : leads.filter(l => (l.funil || 'callx') === activeFunil),
    [leads, activeFunil]
  );

  const totalLeads = filteredByFunil.length;
  const leadsEtapaLead = filteredByFunil.filter(l => l.status_funil === 'lead').length;
  const mensagensEnviadas = filteredByFunil.filter(l => l.status_funil === 'mensagem_enviada').length;
  const reunioes = filteredByFunil.filter(l => l.status_funil === 'reuniao' || l.status_funil === 'no_show' || l.status_funil === 'reuniao_realizada' || l.status_funil === 'proposta' || l.status_funil === 'venda').length;
  const propostasLeads = filteredByFunil.filter(l => l.status_funil === 'proposta' || l.status_funil === 'venda');
  const propostas = propostasLeads.length;
  const valorPropostas = propostasLeads.reduce((sum, l) => sum + (l.valor_proposta || 0), 0);
  const vendas = filteredByFunil.filter(l => l.status_funil === 'venda');
  const vendasCount = vendas.length;
  const receitaTotal = vendas.reduce((sum, l) => sum + (l.valor_venda || 0), 0);
  const ticketMedio = vendasCount > 0 ? receitaTotal / vendasCount : 0;
  const taxaConversao = totalLeads > 0 ? ((vendasCount / totalLeads) * 100).toFixed(1) : '0';
  const taxaLeadReuniao = totalLeads > 0 ? ((reunioes / totalLeads) * 100).toFixed(1) : '0';
  const taxaReuniaoVenda = reunioes > 0 ? ((vendasCount / reunioes) * 100).toFixed(1) : '0';
  const leadTimeMedio = vendas.filter(v => v.lead_time).reduce((sum, v) => sum + (v.lead_time || 0), 0) / (vendas.filter(v => v.lead_time).length || 1);

  // Leads por criativo (adset)
  const criativoMap = new Map<string, number>();
  filteredByFunil.forEach(l => { const key = l.adset || 'Sem criativo'; criativoMap.set(key, (criativoMap.get(key) || 0) + 1); });
  const leadsPorCriativo = Array.from(criativoMap, ([name, value]) => ({ name: name.substring(0, 20), value }));

  // Receita por vendedor
  const vendedorReceitaMap = new Map<string, number>();
  vendas.forEach(v => vendedorReceitaMap.set(v.vendedor_nome, (vendedorReceitaMap.get(v.vendedor_nome) || 0) + (v.valor_venda || 0)));
  const receitaPorVendedor = Array.from(vendedorReceitaMap, ([name, value]) => ({ name: name.split(' ')[0], value }));

  // Motivos de perda
  const perdidos = filteredByFunil.filter(l => l.status_funil === 'perdido');
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
  const leadsPorFaturamento = faixas.map(f => {
    const count = filteredByFunil.filter(l => {
      if (f.min === -1) return !l.faturamento;
      return l.faturamento != null && l.faturamento >= f.min && l.faturamento <= f.max;
    }).length;
    return { name: f.label, value: count };
  }).filter(d => d.value > 0);

  // Funil data
  const funnelData = [
    { name: 'Lead', value: filteredByFunil.filter(l => l.status_funil === 'lead').length },
    { name: 'Msg Enviada', value: mensagensEnviadas },
    { name: 'Reunião', value: filteredByFunil.filter(l => l.status_funil === 'reuniao' || l.status_funil === 'reuniao_realizada').length },
    { name: 'No-Show', value: filteredByFunil.filter(l => l.status_funil === 'no_show').length },
    { name: 'Proposta', value: filteredByFunil.filter(l => l.status_funil === 'proposta').length },
    { name: 'Venda', value: vendasCount },
    { name: 'Perdido', value: perdidos.length },
  ];

  const PIE_COLORS = ['hsl(199,89%,48%)', 'hsl(38,92%,50%)', 'hsl(18,100%,60%)', 'hsl(0,72%,51%)', 'hsl(215,20%,55%)'];
  const CHART_COLORS = ['hsl(18,100%,60%)'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Executivo</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral da operação comercial</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {['todos', 'callx', 'core_ai', 'playbook_mx3'].map(f => (
            <Button
              key={f}
              size="sm"
              variant={activeFunil === f ? 'default' : 'outline'}
              onClick={() => setActiveFunil(f)}
              className="text-xs"
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
          <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Leads por Criativo</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={leadsPorCriativo} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} width={120} />
              <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} />
              <Bar dataKey="value" fill="hsl(199,89%,48%)" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" fill="hsl(210,40%,95%)" fontSize={11} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Leads por Faixa de Faturamento</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={leadsPorFaturamento}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} />
              <Bar dataKey="value" fill="hsl(38,92%,50%)" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="value" position="top" fill="hsl(210,40%,95%)" fontSize={11} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
