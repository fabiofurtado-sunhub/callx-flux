import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useMemo } from 'react';
import { DollarSign, TrendingUp, BarChart3, Target, RotateCw, Users, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import KpiCard from '@/components/KpiCard';

interface AdSpend {
  id: string;
  dia: string;
  campanha: string;
  adset: string;
  ad_name: string;
  valor_gasto: number;
}

type ViewMode = 'geral' | 'campanha' | 'adset' | 'criativo' | 'vendedor';

export default function Investimentos() {
  const { leads } = useAppContext();
  const [adSpend, setAdSpend] = useState<AdSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('geral');

  const fetchAdSpend = async () => {
    const { data, error } = await supabase
      .from('ad_spend')
      .select('*')
      .order('dia', { ascending: false });
    if (!error && data) {
      setAdSpend(data.map(d => ({ ...d, valor_gasto: Number(d.valor_gasto) })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAdSpend(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('poll-ad-spend');
      if (error) throw error;
      await fetchAdSpend();
      toast.success('Dados de investimento atualizados!');
    } catch {
      toast.error('Erro ao sincronizar investimentos');
    } finally {
      setSyncing(false);
    }
  };

  const investimentoTotal = useMemo(() => adSpend.reduce((s, a) => s + a.valor_gasto, 0), [adSpend]);

  // Lead counts by status
  const totalLeads = leads.length;
  const reuniaoAgendada = leads.filter(l => ['reuniao', 'reuniao_realizada', 'proposta', 'venda'].includes(l.status_funil)).length;
  const reuniaoRealizada = leads.filter(l => ['reuniao_realizada', 'proposta', 'venda'].includes(l.status_funil)).length;
  const propostas = leads.filter(l => ['proposta', 'venda'].includes(l.status_funil)).length;
  const vendas = leads.filter(l => l.status_funil === 'venda');
  const receitaTotal = vendas.reduce((s, l) => s + (l.valor_venda || 0), 0);

  // Global metrics
  const cpl = totalLeads > 0 ? investimentoTotal / totalLeads : 0;
  const cpra = reuniaoAgendada > 0 ? investimentoTotal / reuniaoAgendada : 0;
  const cprl = reuniaoRealizada > 0 ? investimentoTotal / reuniaoRealizada : 0;
  const cpp = propostas > 0 ? investimentoTotal / propostas : 0;
  const cac = vendas.length > 0 ? investimentoTotal / vendas.length : 0;
  const roi = investimentoTotal > 0 ? ((receitaTotal - investimentoTotal) / investimentoTotal) * 100 : 0;
  const roiReais = receitaTotal - investimentoTotal;
  const valorPropostas = leads.filter(l => ['proposta', 'venda'].includes(l.status_funil)).reduce((s, l) => s + (l.valor_proposta || 0), 0);

  // Grouped data
  const groupedData = useMemo(() => {
    if (viewMode === 'geral') return null;

    type Row = { label: string; investido: number; leads: number; reuniaoAg: number; reuniaoRl: number; propostas: number; vendas: number; receita: number };
    const map = new Map<string, Row>();

    const getKey = (lead: typeof leads[0]) => {
      switch (viewMode) {
        case 'campanha': return lead.campanha || '(sem campanha)';
        case 'adset': return lead.adset || '(sem adset)';
        case 'criativo': return lead.grupo_anuncios || '(sem criativo)';
        case 'vendedor': return lead.vendedor_nome || '(sem vendedor)';
        default: return '';
      }
    };

    // Count leads per group
    leads.forEach(l => {
      const key = getKey(l);
      const row = map.get(key) || { label: key, investido: 0, leads: 0, reuniaoAg: 0, reuniaoRl: 0, propostas: 0, vendas: 0, receita: 0 };
      row.leads++;
      if (['reuniao', 'reuniao_realizada', 'proposta', 'venda'].includes(l.status_funil)) row.reuniaoAg++;
      if (['reuniao_realizada', 'proposta', 'venda'].includes(l.status_funil)) row.reuniaoRl++;
      if (['proposta', 'venda'].includes(l.status_funil)) row.propostas++;
      if (l.status_funil === 'venda') { row.vendas++; row.receita += (l.valor_venda || 0); }
      map.set(key, row);
    });

    // Sum spend per group
    const getSpendKey = (a: AdSpend) => {
      switch (viewMode) {
        case 'campanha': return a.campanha || '(sem campanha)';
        case 'adset': return a.adset || '(sem adset)';
        case 'criativo': return a.ad_name || '(sem criativo)';
        default: return '';
      }
    };

    if (viewMode !== 'vendedor') {
      adSpend.forEach(a => {
        const key = getSpendKey(a);
        const row = map.get(key) || { label: key, investido: 0, leads: 0, reuniaoAg: 0, reuniaoRl: 0, propostas: 0, vendas: 0, receita: 0 };
        row.investido += a.valor_gasto;
        map.set(key, row);
      });
    } else {
      // For vendedor, distribute total spend proportionally
      const totalLeadsCount = leads.length || 1;
      map.forEach(row => {
        row.investido = investimentoTotal * (row.leads / totalLeadsCount);
      });
    }

    return Array.from(map.values()).sort((a, b) => b.investido - a.investido);
  }, [viewMode, leads, adSpend, investimentoTotal]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtShort = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : fmt(v);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/15">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Investimentos & ROI</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Análise de custos e retorno por nível</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-44 bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="geral">Visão Geral</SelectItem>
              <SelectItem value="campanha">Por Campanha</SelectItem>
              <SelectItem value="adset">Por Ad Set</SelectItem>
              <SelectItem value="criativo">Por Criativo</SelectItem>
              <SelectItem value="vendedor">Por Vendedor</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-2">
            <RotateCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </div>
      </div>

      {/* Global KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Investimento Total" value={fmtShort(investimentoTotal)} icon={DollarSign} variant="default" />
        <KpiCard title="Receita Total" value={fmtShort(receitaTotal)} icon={TrendingUp} variant="success" />
        <KpiCard title="ROI" value={`${roi.toFixed(1)}%`} icon={BarChart3} variant={roi > 0 ? 'success' : 'warning'} />
        <KpiCard title="ROI (R$)" value={fmtShort(roiReais)} icon={TrendingUp} variant={roiReais > 0 ? 'success' : 'warning'} />
        <KpiCard title="Propostas Emitidas" value={fmtShort(valorPropostas)} subtitle={`${propostas} propostas`} icon={FileText} variant="primary" />
        <KpiCard title="CAC" value={fmt(cac)} icon={Target} variant="primary" />
      </div>

      {/* Cost Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'CPL', value: cpl, desc: 'Custo por Lead' },
          { label: 'CPRA', value: cpra, desc: 'Custo por Reunião Agendada' },
          { label: 'CPRL', value: cprl, desc: 'Custo por Reunião Realizada' },
          { label: 'CPR', value: (cpra + cprl) / 2, desc: 'Custo por Reunião (média)' },
          { label: 'CPP', value: cpp, desc: 'Custo por Proposta' },
          { label: 'CAC', value: cac, desc: 'Custo de Aquisição' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-border bg-card p-4 text-center" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{m.label}</p>
            <p className="text-lg font-display font-bold text-card-foreground mt-1">{fmt(m.value)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* Grouped Table */}
      {groupedData && groupedData.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {viewMode === 'campanha' ? 'Campanha' : viewMode === 'adset' ? 'Ad Set' : viewMode === 'criativo' ? 'Criativo' : 'Vendedor'}
                  </th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Investido</th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Leads</th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">CPL</th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">CPRA</th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">CPRL</th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">CPP</th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">CAC</th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Vendas</th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Receita</th>
                  <th className="text-right px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">ROI</th>
                </tr>
              </thead>
              <tbody>
                {groupedData.map((row, i) => {
                  const rowCpl = row.leads > 0 ? row.investido / row.leads : 0;
                  const rowCpra = row.reuniaoAg > 0 ? row.investido / row.reuniaoAg : 0;
                  const rowCprl = row.reuniaoRl > 0 ? row.investido / row.reuniaoRl : 0;
                  const rowCpp = row.propostas > 0 ? row.investido / row.propostas : 0;
                  const rowCac = row.vendas > 0 ? row.investido / row.vendas : 0;
                  const rowRoi = row.investido > 0 ? ((row.receita - row.investido) / row.investido) * 100 : 0;
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground max-w-[200px] truncate" title={row.label}>{row.label}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{fmt(row.investido)}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{row.leads}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{fmt(rowCpl)}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{rowCpra > 0 ? fmt(rowCpra) : '—'}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{rowCprl > 0 ? fmt(rowCprl) : '—'}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{rowCpp > 0 ? fmt(rowCpp) : '—'}</td>
                      <td className="text-right px-3 py-3 text-muted-foreground">{rowCac > 0 ? fmt(rowCac) : '—'}</td>
                      <td className="text-right px-3 py-3 font-semibold text-foreground">{row.vendas}</td>
                      <td className="text-right px-3 py-3 text-foreground">{fmtShort(row.receita)}</td>
                      <td className={`text-right px-3 py-3 font-semibold ${rowRoi > 0 ? 'text-success' : rowRoi < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {row.investido > 0 ? `${rowRoi.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewMode === 'geral' && (
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-display font-semibold text-card-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Resumo do Funil
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Leads', count: totalLeads, color: 'text-info', bg: 'bg-info/10' },
              { label: 'Reunião Ag.', count: reuniaoAgendada, color: 'text-warning', bg: 'bg-warning/10' },
              { label: 'Reunião Rl.', count: reuniaoRealizada, color: 'text-warning', bg: 'bg-warning/10' },
              { label: 'Propostas', count: propostas, color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Vendas', count: vendas.length, color: 'text-success', bg: 'bg-success/10' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg p-4 ${s.bg} text-center`}>
                <p className={`text-2xl font-display font-bold ${s.color}`}>{s.count}</p>
                <p className={`text-xs font-semibold uppercase mt-1 ${s.color}`}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
