import { useAppContext } from '@/contexts/AppContext';
import { getScoreLabel, getScoreColor } from '@/data/mockData';
import { Brain, TrendingUp, AlertTriangle, Target, Zap, BarChart3 } from 'lucide-react';

export default function Intelligence() {
  const { leads } = useAppContext();

  const vendas = leads.filter(l => l.status_funil === 'venda');
  const receitaTotal = vendas.reduce((s, l) => s + (l.valor_venda || 0), 0);
  const ticketMedio = vendas.length > 0 ? receitaTotal / vendas.length : 0;

  // Gargalo
  const stageCounts = {
    lead: leads.filter(l => l.status_funil === 'lead').length,
    reuniao: leads.filter(l => l.status_funil === 'reuniao').length,
    proposta: leads.filter(l => l.status_funil === 'proposta').length,
  };
  const gargalo = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0];
  const gargaloLabels: Record<string, string> = { lead: 'Lead', reuniao: 'Reunião', proposta: 'Proposta' };

  // Melhor campanha
  const campanhaConversao = new Map<string, { leads: number; vendas: number }>();
  leads.forEach(l => {
    const curr = campanhaConversao.get(l.campanha) || { leads: 0, vendas: 0 };
    curr.leads++;
    if (l.status_funil === 'venda') curr.vendas++;
    campanhaConversao.set(l.campanha, curr);
  });
  const melhorCampanha = Array.from(campanhaConversao).sort((a, b) => (b[1].vendas / b[1].leads) - (a[1].vendas / a[1].leads))[0];

  // Melhor vendedor
  const vendedorReceita = new Map<string, number>();
  vendas.forEach(v => vendedorReceita.set(v.vendedor, (vendedorReceita.get(v.vendedor) || 0) + (v.valor_venda || 0)));
  const melhorVendedor = Array.from(vendedorReceita).sort((a, b) => b[1] - a[1])[0];

  // Forecast
  const propostasAbertas = leads.filter(l => l.status_funil === 'proposta');
  const forecast = propostasAbertas.reduce((s, l) => s + ((l.valor_proposta || 0) * (l.probabilidade_fechamento / 100)), 0);

  // Lead scoring distribution
  const scoreDistribution = {
    frio: leads.filter(l => getScoreLabel(l.score_lead) === 'frio').length,
    morno: leads.filter(l => getScoreLabel(l.score_lead) === 'morno').length,
    quente: leads.filter(l => getScoreLabel(l.score_lead) === 'quente').length,
    oportunidade: leads.filter(l => getScoreLabel(l.score_lead) === 'oportunidade').length,
  };

  const cards = [
    {
      icon: AlertTriangle,
      title: 'Gargalo do Funil',
      value: gargaloLabels[gargalo?.[0]] || '-',
      subtitle: `${gargalo?.[1] || 0} leads parados nesta etapa`,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      icon: Target,
      title: 'Melhor Campanha',
      value: melhorCampanha?.[0]?.substring(0, 20) || '-',
      subtitle: `${melhorCampanha ? ((melhorCampanha[1].vendas / melhorCampanha[1].leads) * 100).toFixed(0) : 0}% conversão`,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      icon: TrendingUp,
      title: 'Melhor Vendedor',
      value: melhorVendedor?.[0] || '-',
      subtitle: `R$ ${(melhorVendedor?.[1] || 0).toLocaleString()} em receita`,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      icon: BarChart3,
      title: 'Forecast (Receita Projetada)',
      value: `R$ ${(forecast / 1000).toFixed(0)}k`,
      subtitle: `Baseado em ${propostasAbertas.length} propostas abertas`,
      color: 'text-info',
      bg: 'bg-info/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/15">
          <Brain className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Inteligência Comercial MX3</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análise automatizada do seu funil</p>
        </div>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 animate-fade-in" style={{ boxShadow: 'var(--shadow-card)', animationDelay: `${i * 100}ms` }}>
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${card.bg}`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{card.title}</p>
                <p className={`text-xl font-display font-bold mt-1 ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lead Score Distribution */}
      <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Distribuição de Score dos Leads</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(scoreDistribution).map(([label, count]) => {
            const colorClass = label === 'frio' ? 'text-info' : label === 'morno' ? 'text-warning' : label === 'quente' ? 'text-primary' : 'text-success';
            const bgClass = label === 'frio' ? 'bg-info/10' : label === 'morno' ? 'bg-warning/10' : label === 'quente' ? 'bg-primary/10' : 'bg-success/10';
            return (
              <div key={label} className={`rounded-lg p-4 ${bgClass} text-center`}>
                <p className={`text-2xl font-display font-bold ${colorClass}`}>{count}</p>
                <p className={`text-xs font-semibold uppercase mt-1 ${colorClass}`}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
        <h3 className="text-sm font-display font-semibold text-card-foreground mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Alertas Comerciais
        </h3>
        <div className="space-y-2">
          {stageCounts.proposta > 3 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">{stageCounts.proposta} propostas</span> abertas — considere follow-up prioritário
              </p>
            </div>
          )}
          {stageCounts.lead > 5 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-info/10 border border-info/20">
              <AlertTriangle className="w-4 h-4 text-info flex-shrink-0" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">{stageCounts.lead} leads</span> aguardando primeiro contato
              </p>
            </div>
          )}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <TrendingUp className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm text-foreground">
              Receita projetada: <span className="font-semibold">R$ {(forecast / 1000).toFixed(0)}k</span> baseada nas propostas ativas
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
