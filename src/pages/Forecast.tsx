import { useAppContext, LeadStatus } from '@/contexts/AppContext';
import KpiCard from '@/components/KpiCard';
import { TrendingUp, FileText, Users, Layers, Target, DollarSign, BarChart3, CalendarIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LabelList,
} from 'recharts';
import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, startOfYear, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  mensagem_enviada: 'Msg Enviada',
  fup_1: 'FUP 1',
  ia_call: 'IA Call',
  ia_call_2: 'IA Call 2',
  ultima_mensagem: 'Última Msg',
  reuniao: 'Reunião Agendada',
  no_show: 'No-Show',
  reuniao_realizada: 'Reunião Realizada',
  proposta: 'Proposta',
  venda: 'Venda',
  perdido: 'Perdido',
};

const FUNNEL_LABELS: Record<string, string> = {
  callx: 'CallX',
  core_ai: 'Core AI',
  revenue_os: 'Revenue OS',
  revenue_ia: 'Revenue IA',
  diagnostico: 'Diagnóstico',
  reaquecimento: 'Reaquecimento',
};

const STAGE_WEIGHTS: Record<string, number> = {
  lead: 5,
  mensagem_enviada: 8,
  fup_1: 12,
  ia_call: 18,
  ia_call_2: 22,
  ultima_mensagem: 25,
  reuniao: 35,
  no_show: 15,
  reuniao_realizada: 50,
  proposta: 70,
  venda: 100,
  perdido: 0,
};

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 200 70% 50%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
];

const BAR_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 200 70% 50%))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(160 60% 45%)',
  'hsl(340 70% 55%)',
  'hsl(50 80% 50%)',
  'hsl(210 60% 50%)',
  'hsl(120 50% 40%)',
];

export default function Forecast() {
  const { leads } = useAppContext();
  const [selectedFunis, setSelectedFunis] = useState<string[]>([]);

  const toggleFunil = (f: string) => {
    setSelectedFunis(prev => {
      if (prev.includes(f)) {
        return prev.filter(x => x !== f);
      }
      return [...prev, f];
    });
  };

  const [activePeriod, setActivePeriod] = useState<string>('all');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  // Date range based on period selection
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (activePeriod) {
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month': { const m = subMonths(now, 1); return { start: startOfMonth(m), end: endOfMonth(m) }; }
      case 'quarter': return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'last_quarter': { const q = subQuarters(now, 1); return { start: startOfQuarter(q), end: endOfQuarter(q) }; }
      case 'year': return { start: startOfYear(now), end: now };
      case 'custom':
        if (customDateFrom && customDateTo) return { start: customDateFrom, end: customDateTo };
        if (customDateFrom) return { start: customDateFrom, end: now };
        return null;
      default: return null; // 'all'
    }
  }, [activePeriod, customDateFrom, customDateTo]);

  const filterByDate = (list: typeof leads) => {
    if (!dateRange) return list;
    return list.filter(l => {
      const d = new Date(l.data_entrada);
      return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
    });
  };

  const activeLeads = useMemo(() => {
    let filtered = leads.filter(l => l.status_funil !== 'perdido' && l.status_funil !== 'venda');
    if (selectedFunis.length > 0) filtered = filtered.filter(l => selectedFunis.includes(l.funil));
    return filterByDate(filtered);
  }, [leads, selectedFunis, dateRange]);

  const allFilteredLeads = useMemo(() => {
    let filtered = selectedFunis.length === 0 ? leads : leads.filter(l => selectedFunis.includes(l.funil));
    return filterByDate(filtered);
  }, [leads, selectedFunis, dateRange]);

  // KPI: Previsão de fechamento (weighted pipeline)
  const forecastValue = useMemo(() => {
    return activeLeads.reduce((sum, l) => {
      const weight = (STAGE_WEIGHTS[l.status_funil] || 0) / 100;
      const value = l.valor_proposta || 0;
      return sum + value * weight;
    }, 0);
  }, [activeLeads]);

  // KPI: Total pipeline value
  const totalPipelineValue = useMemo(() => {
    return activeLeads.reduce((sum, l) => sum + (l.valor_proposta || 0), 0);
  }, [activeLeads]);

  // KPI: Propostas
  const propostas = useMemo(() => allFilteredLeads.filter(l => l.status_funil === 'proposta'), [allFilteredLeads]);
  const propostasValue = useMemo(() => propostas.reduce((sum, l) => sum + (l.valor_proposta || 0), 0), [propostas]);

  // KPI: Reuniões agendadas
  const reunioes = useMemo(() => activeLeads.filter(l => l.status_funil === 'reuniao' || l.status_funil === 'reuniao_realizada'), [activeLeads]);

  // Leads por funil
  const leadsByFunnel = useMemo(() => {
    const map: Record<string, number> = {};
    activeLeads.forEach(l => {
      map[l.funil] = (map[l.funil] || 0) + 1;
    });
    return Object.entries(map).map(([funil, count]) => ({
      name: FUNNEL_LABELS[funil] || funil,
      value: count,
    })).sort((a, b) => b.value - a.value);
  }, [activeLeads]);

  // Leads por etapa
  const leadsByStage = useMemo(() => {
    const map: Record<string, number> = {};
    activeLeads.forEach(l => {
      map[l.status_funil] = (map[l.status_funil] || 0) + 1;
    });
    const stageOrder: LeadStatus[] = ['lead', 'mensagem_enviada', 'fup_1', 'ia_call', 'ia_call_2', 'ultima_mensagem', 'reuniao', 'no_show', 'reuniao_realizada', 'proposta'];
    return stageOrder
      .filter(s => map[s])
      .map(s => ({
        name: STAGE_LABELS[s] || s,
        stage: s,
        count: map[s] || 0,
        weight: STAGE_WEIGHTS[s] || 0,
      }));
  }, [activeLeads]);

  // Forecast por etapa (weighted value)
  const forecastByStage = useMemo(() => {
    const map: Record<string, { value: number; weighted: number; count: number }> = {};
    activeLeads.forEach(l => {
      const s = l.status_funil;
      if (!map[s]) map[s] = { value: 0, weighted: 0, count: 0 };
      const v = l.valor_proposta || 0;
      map[s].value += v;
      map[s].weighted += v * (STAGE_WEIGHTS[s] || 0) / 100;
      map[s].count += 1;
    });
    const stageOrder: LeadStatus[] = ['lead', 'mensagem_enviada', 'fup_1', 'ia_call', 'ia_call_2', 'ultima_mensagem', 'reuniao', 'no_show', 'reuniao_realizada', 'proposta'];
    return stageOrder
      .filter(s => map[s])
      .map(s => ({
        name: STAGE_LABELS[s] || s,
        total: map[s].value,
        forecast: map[s].weighted,
        count: map[s].count,
      }));
  }, [activeLeads]);

  // Conversion funnel data
  const conversionData = useMemo(() => {
    const totalLeads = allFilteredLeads.length;
    const vendas = allFilteredLeads.filter(l => l.status_funil === 'venda').length;
    const propostasCount = allFilteredLeads.filter(l => l.status_funil === 'proposta' || l.status_funil === 'venda').length;
    const reunioesCount = allFilteredLeads.filter(l => ['reuniao', 'no_show', 'reuniao_realizada', 'proposta', 'venda'].includes(l.status_funil)).length;
    return {
      totalLeads,
      reunioes: reunioesCount,
      propostas: propostasCount,
      vendas,
      taxaConversao: totalLeads > 0 ? ((vendas / totalLeads) * 100).toFixed(1) : '0',
      taxaReuniao: totalLeads > 0 ? ((reunioesCount / totalLeads) * 100).toFixed(1) : '0',
      taxaProposta: reunioesCount > 0 ? ((propostasCount / reunioesCount) * 100).toFixed(1) : '0',
    };
  }, [allFilteredLeads]);

  // Performance por vendedor
  const vendedorData = useMemo(() => {
    const map: Record<string, { leads: number; propostas: number; vendas: number; vgv: number; forecast: number; reunioes: number }> = {};
    allFilteredLeads.forEach(l => {
      const nome = l.vendedor_nome || 'Sem vendedor';
      if (!map[nome]) map[nome] = { leads: 0, propostas: 0, vendas: 0, vgv: 0, forecast: 0, reunioes: 0 };
      map[nome].leads += 1;
      map[nome].vgv += l.valor_proposta || 0;
      map[nome].forecast += (l.valor_proposta || 0) * (STAGE_WEIGHTS[l.status_funil] || 0) / 100;
      if (l.status_funil === 'proposta') map[nome].propostas += 1;
      if (l.status_funil === 'venda') map[nome].vendas += 1;
      if (['reuniao', 'reuniao_realizada'].includes(l.status_funil)) map[nome].reunioes += 1;
    });
    return Object.entries(map)
      .map(([nome, d]) => ({ nome, ...d, conversao: d.leads > 0 ? ((d.vendas / d.leads) * 100) : 0 }))
      .sort((a, b) => b.forecast - a.forecast);
  }, [allFilteredLeads]);

  const fmt = (v: number) =>
    v >= 1000000
      ? `R$ ${(v / 1000000).toFixed(1)}M`
      : v >= 1000
        ? `R$ ${(v / 1000).toFixed(0)}k`
        : `R$ ${v.toFixed(0)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Forecast de Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">Previsibilidade e pipeline de receita</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedFunis([])}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedFunis.length === 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Todos
          </button>
          {['callx', 'core_ai', 'playbook_mx3', 'revenue_os'].map(f => (
            <button
              key={f}
              onClick={() => toggleFunil(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedFunis.includes(f)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {FUNNEL_LABELS[f] || f}
            </button>
          ))}
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground mr-1">Período:</span>
        {([
          ['all', 'Tudo'],
          ['month', 'Mês atual'],
          ['last_month', 'Mês anterior'],
          ['quarter', 'Trimestre atual'],
          ['last_quarter', 'Trimestre anterior'],
          ['year', 'Ano'],
          ['custom', 'Personalizado'],
        ] as [string, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActivePeriod(key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              activePeriod === key
                ? 'bg-accent text-accent-foreground ring-1 ring-primary/30'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
          >
            {label}
          </button>
        ))}
        {activePeriod === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-7 text-xs gap-1.5", !customDateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="w-3 h-3" />
                  {customDateFrom ? format(customDateFrom, 'dd/MM/yy') : 'De'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customDateFrom} onSelect={setCustomDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">→</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-7 text-xs gap-1.5", !customDateTo && "text-muted-foreground")}>
                  <CalendarIcon className="w-3 h-3" />
                  {customDateTo ? format(customDateTo, 'dd/MM/yy') : 'Até'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={customDateTo} onSelect={setCustomDateTo} initialFocus className={cn("p-3 pointer-events-auto")} locale={ptBR} />
              </PopoverContent>
            </Popover>
          </div>
        )}
        {dateRange && (
          <span className="text-[10px] text-muted-foreground ml-1">
            {format(dateRange.start, 'dd/MM/yy')} – {format(dateRange.end, 'dd/MM/yy')}
          </span>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Forecast Ponderado"
          value={fmt(forecastValue)}
          subtitle="Valor ajustado por probabilidade"
          icon={TrendingUp}
          variant="primary"
        />
        <KpiCard
          title="Pipeline Total"
          value={fmt(totalPipelineValue)}
          subtitle={`${activeLeads.length} leads ativos`}
          icon={Target}
          variant="default"
        />
        <KpiCard
          title="Propostas Ativas"
          value={propostas.length}
          subtitle={fmt(propostasValue)}
          icon={FileText}
          variant="warning"
        />
        <KpiCard
          title="Reuniões no Pipe"
          value={reunioes.length}
          subtitle="Agendadas + realizadas"
          icon={Users}
          variant="success"
        />
      </div>

      {/* Conversion Funnel Summary */}
      <Card className="p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Funil de Conversão</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{conversionData.totalLeads}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{conversionData.reunioes}</p>
            <p className="text-xs text-muted-foreground">Reuniões ({conversionData.taxaReuniao}%)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground">{conversionData.propostas}</p>
            <p className="text-xs text-muted-foreground">Propostas ({conversionData.taxaProposta}%)</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{conversionData.vendas}</p>
            <p className="text-xs text-muted-foreground">Vendas ({conversionData.taxaConversao}%)</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Conversão geral</span>
          <Progress value={Number(conversionData.taxaConversao)} className="flex-1 h-2" />
          <span className="text-xs font-medium text-foreground">{conversionData.taxaConversao}%</span>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Forecast por etapa */}
        <Card className="p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Forecast por Etapa</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastByStage} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} angle={-30} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => [
                    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
                    name === 'forecast' ? 'Forecast' : 'Total Pipeline'
                  ]}
                />
                <Bar dataKey="total" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} name="total" />
                <Bar dataKey="forecast" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="forecast" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Leads por funil (pie) */}
        <Card className="p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Leads por Funil</h3>
          {selectedFunis.length === 1 ? (
            <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
              Selecione "Todos" para ver a distribuição por funil
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadsByFunnel}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {leadsByFunnel.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                    <LabelList dataKey="value" position="outside" fill="hsl(var(--foreground))" fontSize={12} />
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 -mt-2">
                {leadsByFunnel.map((f, i) => (
                  <div key={f.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground">{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Leads por etapa (horizontal bar) */}
      <Card className="p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Leads por Etapa do Funil</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={leadsByStage} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={120} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number) => [`${value} leads`, 'Quantidade']}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {leadsByStage.map((entry, i) => (
                  <Cell key={entry.stage} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
                <LabelList dataKey="count" position="right" fill="hsl(var(--foreground))" fontSize={12} fontWeight={600} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Detailed table */}
      <Card className="p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Detalhamento por Etapa</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Etapa</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Leads</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Prob. (%)</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">VGV Total</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Forecast</th>
              </tr>
            </thead>
            <tbody>
              {forecastByStage.map((row) => (
                <tr key={row.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-foreground">{row.name}</td>
                  <td className="py-2.5 px-3 text-center">
                    <Badge variant="secondary" className="text-xs">{row.count}</Badge>
                  </td>
                  <td className="py-2.5 px-3 text-center text-muted-foreground">
                    {row.total > 0 ? ((row.forecast / row.total) * 100).toFixed(0) : 0}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">
                    {row.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-primary">
                    {row.forecast.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/40 font-semibold">
                <td className="py-2.5 px-3 text-foreground">Total</td>
                <td className="py-2.5 px-3 text-center">{activeLeads.length}</td>
                <td className="py-2.5 px-3 text-center text-muted-foreground">
                  {totalPipelineValue > 0 ? ((forecastValue / totalPipelineValue) * 100).toFixed(0) : 0}%
                </td>
                <td className="py-2.5 px-3 text-right text-muted-foreground">
                  {totalPipelineValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                </td>
                <td className="py-2.5 px-3 text-right text-primary">
                  {forecastValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      {/* Performance por Vendedor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Forecast por Vendedor</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendedorData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number, name: string) => [
                    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`,
                    name === 'forecast' ? 'Forecast' : 'VGV Total'
                  ]}
                />
                <Bar dataKey="vgv" fill="hsl(var(--muted-foreground) / 0.25)" radius={[0, 4, 4, 0]} name="vgv" />
                <Bar dataKey="forecast" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="forecast" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Atividade por Vendedor</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendedorData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="leads" fill="hsl(var(--muted-foreground) / 0.3)" radius={[0, 4, 4, 0]} name="Leads" />
                <Bar dataKey="reunioes" fill="hsl(var(--chart-2, 200 70% 50%))" radius={[0, 4, 4, 0]} name="Reuniões" />
                <Bar dataKey="propostas" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} name="Propostas" />
                <Bar dataKey="vendas" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} name="Vendas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tabela detalhada por vendedor */}
      <Card className="p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-semibold text-foreground mb-4">Ranking de Vendedores</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Vendedor</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Leads</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Reuniões</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Propostas</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Vendas</th>
                <th className="text-center py-2 px-3 text-muted-foreground font-medium">Conversão</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">VGV</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Forecast</th>
              </tr>
            </thead>
            <tbody>
              {vendedorData.map((v, i) => (
                <tr key={v.nome} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-foreground flex items-center gap-2">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i < 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {i + 1}
                    </span>
                    {v.nome}
                  </td>
                  <td className="py-2.5 px-3 text-center">{v.leads}</td>
                  <td className="py-2.5 px-3 text-center">{v.reunioes}</td>
                  <td className="py-2.5 px-3 text-center">{v.propostas}</td>
                  <td className="py-2.5 px-3 text-center font-medium text-foreground">{v.vendas}</td>
                  <td className="py-2.5 px-3 text-center">
                    <Badge variant={v.conversao >= 20 ? 'default' : 'secondary'} className="text-xs">
                      {v.conversao.toFixed(1)}%
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">
                    {v.vgv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-primary">
                    {v.forecast.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
