import { useMemo, useState } from 'react';
import { useAppContext, type Lead } from '@/contexts/AppContext';
import KpiCard from '@/components/KpiCard';
import { Trophy, DollarSign, Target, TrendingUp, Users, ArrowRightLeft, CalendarIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell, LabelList,
} from 'recharts';
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth, eachWeekOfInterval, eachMonthOfInterval, isWithinInterval, subMonths, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type DateRange } from 'react-day-picker';

const FUNNEL_LABELS: Record<string, string> = {
  callx: 'CallX',
  core_ai: 'Core AI',
  revenue_os: 'Revenue OS',
  revenue_ia: 'Revenue IA',
  diagnostico: 'Diagnóstico',
};

const FUNNEL_COLORS: Record<string, string> = {
  callx: 'hsl(18,100%,60%)',
  core_ai: 'hsl(199,89%,48%)',
  revenue_os: 'hsl(38,92%,50%)',
  revenue_ia: 'hsl(160,60%,45%)',
  diagnostico: 'hsl(280,60%,55%)',
};

const PIE_COLORS = [
  'hsl(18,100%,60%)', 'hsl(199,89%,48%)', 'hsl(38,92%,50%)',
  'hsl(160,60%,45%)', 'hsl(280,60%,55%)',
];

const TOOLTIP_STYLE = {
  background: 'hsl(216,50%,10%)',
  border: '1px solid hsl(216,30%,18%)',
  borderRadius: 8,
  color: 'hsl(210,40%,95%)',
};

type QuickFilter = 'mes_atual' | 'mes_passado' | '90d' | 'custom';

export default function Vendas() {
  const { leads } = useAppContext();
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('mes_atual');
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [evolucaoMode, setEvolucaoMode] = useState<'semana' | 'mes'>('mes');

  // Compute effective date range from quick filter
  const dateRange = useMemo((): DateRange | undefined => {
    const now = new Date();
    switch (quickFilter) {
      case 'mes_atual':
        return { from: startOfMonth(now), to: now };
      case 'mes_passado':
        return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
      case '90d':
        return { from: subDays(now, 90), to: now };
      case 'custom':
        return customRange;
      default:
        return undefined;
    }
  }, [quickFilter, customRange]);

  // Only sales leads from allowed funnels
  const allVendas = useMemo(() =>
    leads.filter(l =>
      l.status_funil === 'venda' &&
      Object.keys(FUNNEL_LABELS).includes(l.funil)
    ),
    [leads]
  );

  // Filter by date range (using data_ultimo_movimento as sale date)
  const vendas = useMemo(() => {
    if (!dateRange?.from) return allVendas;
    return allVendas.filter(l => {
      const d = new Date(l.data_ultimo_movimento);
      const from = dateRange.from!;
      const to = dateRange.to || new Date();
      return d >= from && d <= to;
    });
  }, [allVendas, dateRange]);

  // --- KPIs ---
  const totalVendas = vendas.length;
  const receitaTotal = vendas.reduce((s, l) => s + (l.valor_venda || 0), 0);
  const ticketMedio = totalVendas > 0 ? receitaTotal / totalVendas : 0;
  const valorEntradaTotal = vendas.reduce((s, l) => s + (l.valor_entrada || 0), 0);
  const mrrTotal = vendas.reduce((s, l) => s + (l.valor_mrr || 0), 0);

  // Leads no período (filtered by data_entrada)
  const leadsNoPeriodo = useMemo(() => {
    if (!dateRange?.from) return leads.filter(l => Object.keys(FUNNEL_LABELS).includes(l.funil));
    return leads.filter(l => {
      if (!Object.keys(FUNNEL_LABELS).includes(l.funil)) return false;
      const d = new Date(l.data_entrada);
      const from = dateRange.from!;
      const to = dateRange.to || new Date();
      return d >= from && d <= to;
    });
  }, [leads, dateRange]);

  const taxaConversao = leadsNoPeriodo.length > 0 ? ((totalVendas / leadsNoPeriodo.length) * 100).toFixed(1) : '0';
  const leadTimeMedio = vendas.filter(v => v.lead_time).length > 0
    ? vendas.filter(v => v.lead_time).reduce((s, v) => s + (v.lead_time || 0), 0) / vendas.filter(v => v.lead_time).length
    : 0;

  // --- Evolução temporal ---
  const evolucaoData = useMemo(() => {
    if (!dateRange?.from) return [];
    const from = dateRange.from;
    const to = dateRange.to || new Date();

    if (evolucaoMode === 'semana') {
      const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
      return weeks.map(weekStart => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const vendasSemana = vendas.filter(l => {
          const d = new Date(l.data_ultimo_movimento);
          return isWithinInterval(d, { start: weekStart, end: weekEnd });
        });
        return {
          label: format(weekStart, 'dd/MM', { locale: ptBR }),
          vendas: vendasSemana.length,
          receita: vendasSemana.reduce((s, l) => s + (l.valor_venda || 0), 0),
        };
      });
    } else {
      const months = eachMonthOfInterval({ start: from, end: to });
      return months.map(monthStart => {
        const monthEnd = endOfMonth(monthStart);
        const vendasMes = vendas.filter(l => {
          const d = new Date(l.data_ultimo_movimento);
          return isWithinInterval(d, { start: monthStart, end: monthEnd });
        });
        return {
          label: format(monthStart, 'MMM/yy', { locale: ptBR }),
          vendas: vendasMes.length,
          receita: vendasMes.reduce((s, l) => s + (l.valor_venda || 0), 0),
        };
      });
    }
  }, [vendas, dateRange, evolucaoMode]);

  // --- Análise por funil ---
  const porFunil = useMemo(() => {
    const map = new Map<string, { count: number; receita: number }>();
    vendas.forEach(l => {
      const curr = map.get(l.funil) || { count: 0, receita: 0 };
      curr.count++;
      curr.receita += l.valor_venda || 0;
      map.set(l.funil, curr);
    });
    return Array.from(map, ([funil, data]) => ({
      name: FUNNEL_LABELS[funil] || funil,
      funil,
      vendas: data.count,
      receita: data.receita,
    })).sort((a, b) => b.receita - a.receita);
  }, [vendas]);

  // --- Ranking de vendedores ---
  const ranking = useMemo(() => {
    const map = new Map<string, { vendas: number; receita: number; ticketMedio: number }>();
    vendas.forEach(l => {
      const nome = l.vendedor_nome || 'Sem vendedor';
      const curr = map.get(nome) || { vendas: 0, receita: 0, ticketMedio: 0 };
      curr.vendas++;
      curr.receita += l.valor_venda || 0;
      map.set(nome, curr);
    });
    return Array.from(map, ([nome, data]) => ({
      nome,
      ...data,
      ticketMedio: data.vendas > 0 ? data.receita / data.vendas : 0,
    })).sort((a, b) => b.receita - a.receita);
  }, [vendas]);

  // --- Detalhamento ---
  const vendasOrdenadas = useMemo(() =>
    [...vendas].sort((a, b) => new Date(b.data_ultimo_movimento).getTime() - new Date(a.data_ultimo_movimento).getTime()),
    [vendas]
  );

  const formatCurrency = (v: number) =>
    v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : `R$ ${v.toFixed(0)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Análise de Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">Performance detalhada de vendas e receita</p>
        </div>
         <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {([
                { key: 'mes_atual' as QuickFilter, label: 'Mês atual' },
                { key: 'mes_passado' as QuickFilter, label: 'Mês anterior' },
                { key: '90d' as QuickFilter, label: 'Últimos 90 dias' },
              ]).map(f => (
                <Button
                  key={f.key}
                  size="sm"
                  variant={quickFilter === f.key ? 'default' : 'outline'}
                  onClick={() => setQuickFilter(f.key)}
                  className="text-xs h-8 px-3"
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={quickFilter === 'custom' ? 'default' : 'outline'}
                  className="h-8 text-xs gap-2 min-w-[200px] justify-start"
                  onClick={() => setQuickFilter('custom')}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {quickFilter === 'custom' && customRange?.from ? (
                    customRange.to ? (
                      `${format(customRange.from, 'dd/MM/yy')} – ${format(customRange.to, 'dd/MM/yy')}`
                    ) : format(customRange.from, 'dd/MM/yy')
                  ) : 'Selecionar período'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => { setCustomRange(range); setQuickFilter('custom'); }}
                  numberOfMonths={2}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        <KpiCard title="Ticket Médio" value={formatCurrency(ticketMedio)} icon={Target} />
        <KpiCard title="Vlr Entrada" value={formatCurrency(valorEntradaTotal)} icon={DollarSign} variant="warning" />
        <KpiCard title="MRR Total" value={formatCurrency(mrrTotal)} icon={TrendingUp} variant="primary" />
        <KpiCard title="Conv. Geral" value={`${taxaConversao}%`} icon={ArrowRightLeft} variant="warning" />
        <KpiCard title="Lead Time" value={`${leadTimeMedio.toFixed(0)} dias`} icon={Users} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução temporal */}
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-display font-semibold text-card-foreground">Evolução de Vendas</h3>
            <div className="flex gap-1">
              <Button size="sm" variant={evolucaoMode === 'semana' ? 'default' : 'outline'} onClick={() => setEvolucaoMode('semana')} className="text-[10px] h-6 px-2">Semanal</Button>
              <Button size="sm" variant={evolucaoMode === 'mes' ? 'default' : 'outline'} onClick={() => setEvolucaoMode('mes')} className="text-[10px] h-6 px-2">Mensal</Button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolucaoData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
              <XAxis dataKey="label" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number, name: string) => [name === 'receita' ? formatCurrency(value) : value, name === 'receita' ? 'Receita' : 'Vendas']} />
              <Legend formatter={(value) => value === 'receita' ? 'Receita' : 'Vendas'} />
              <Line yAxisId="left" type="monotone" dataKey="vendas" stroke="hsl(18,100%,60%)" strokeWidth={2} dot={{ r: 4 }} />
              <Line yAxisId="right" type="monotone" dataKey="receita" stroke="hsl(199,89%,48%)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Por funil */}
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Vendas por Funil</h3>
          <div className="grid grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={porFunil} dataKey="receita" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {porFunil.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col justify-center space-y-2">
              {porFunil.map((f, i) => (
                <div key={f.funil} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-card-foreground truncate">{f.name}</p>
                    <p className="text-[10px] text-muted-foreground">{f.vendas} vendas · {formatCurrency(f.receita)}</p>
                  </div>
                </div>
              ))}
              {porFunil.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma venda no período</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Ranking de vendedores */}
      <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Ranking de Vendedores</h3>
        {ranking.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhuma venda no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, ranking.length * 50)}>
            <BarChart data={ranking} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
              <YAxis type="category" dataKey="nome" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} width={120} tickFormatter={(v) => v.split(' ')[0]} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [name === 'receita' ? formatCurrency(v) : v, name === 'receita' ? 'Receita' : 'Vendas']} />
              <Bar dataKey="receita" fill="hsl(18,100%,60%)" radius={[0, 6, 6, 0]} name="receita">
                <LabelList dataKey="vendas" position="right" fill="hsl(210,40%,95%)" fontSize={11} fontWeight={600} formatter={(v: number) => `${v} vendas`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Detalhamento das vendas */}
      <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-display font-semibold text-card-foreground">Detalhamento das Vendas</h3>
          <Badge variant="outline" className="text-[10px]">{totalVendas} registros</Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Nome</TableHead>
                <TableHead className="text-xs">Empresa</TableHead>
                <TableHead className="text-xs">Funil</TableHead>
                <TableHead className="text-xs">Vendedor</TableHead>
                <TableHead className="text-xs text-right">VGV</TableHead>
                <TableHead className="text-xs text-right">Valor Venda</TableHead>
                <TableHead className="text-xs text-right">Entrada</TableHead>
                <TableHead className="text-xs text-right">MRR</TableHead>
                <TableHead className="text-xs text-right">Lead Time</TableHead>
                <TableHead className="text-xs">Data Venda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasOrdenadas.slice(0, 100).map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs font-medium">{l.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.empresa || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]" style={{ borderColor: FUNNEL_COLORS[l.funil] || undefined, color: FUNNEL_COLORS[l.funil] || undefined }}>
                      {FUNNEL_LABELS[l.funil] || l.funil}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.vendedor_nome || '—'}</TableCell>
                  <TableCell className="text-xs text-right">{l.valor_proposta ? formatCurrency(l.valor_proposta) : '—'}</TableCell>
                  <TableCell className="text-xs text-right font-medium text-success">{l.valor_venda ? formatCurrency(l.valor_venda) : '—'}</TableCell>
                  <TableCell className="text-xs text-right">{l.valor_entrada ? formatCurrency(l.valor_entrada) : '—'}</TableCell>
                  <TableCell className="text-xs text-right">{l.valor_mrr ? formatCurrency(l.valor_mrr) : '—'}</TableCell>
                  <TableCell className="text-xs text-right">{l.lead_time ? `${l.lead_time}d` : '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(l.data_ultimo_movimento), 'dd/MM/yy')}</TableCell>
                </TableRow>
              ))}
              {vendasOrdenadas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-8">Nenhuma venda encontrada no período</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
