import { useAppContext } from '@/contexts/AppContext';
import KpiCard from '@/components/KpiCard';
import {
  Users, CalendarCheck, FileText, Trophy, DollarSign, Target,
  TrendingUp, Clock, ArrowRightLeft
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area,
} from 'recharts';

export default function Dashboard() {
  const { leads, settings } = useAppContext();

  const totalLeads = leads.length;
  const reunioes = leads.filter(l => l.status_funil === 'reuniao' || l.status_funil === 'proposta' || l.status_funil === 'venda').length;
  const propostas = leads.filter(l => l.status_funil === 'proposta' || l.status_funil === 'venda').length;
  const vendas = leads.filter(l => l.status_funil === 'venda');
  const vendasCount = vendas.length;
  const receitaTotal = vendas.reduce((sum, l) => sum + (l.valor_venda || 0), 0);
  const ticketMedio = vendasCount > 0 ? receitaTotal / vendasCount : 0;
  const taxaConversao = totalLeads > 0 ? ((vendasCount / totalLeads) * 100).toFixed(1) : '0';
  const taxaReuniaoVenda = reunioes > 0 ? ((vendasCount / reunioes) * 100).toFixed(1) : '0';
  const leadTimeMedio = vendas.filter(v => v.lead_time).reduce((sum, v) => sum + (v.lead_time || 0), 0) / (vendas.filter(v => v.lead_time).length || 1);

  // Leads por campanha
  const campanhaMap = new Map<string, number>();
  leads.forEach(l => campanhaMap.set(l.campanha, (campanhaMap.get(l.campanha) || 0) + 1));
  const leadsPorCampanha = Array.from(campanhaMap, ([name, value]) => ({ name: name.substring(0, 15), value }));

  // Receita por vendedor
  const vendedorReceitaMap = new Map<string, number>();
  vendas.forEach(v => vendedorReceitaMap.set(v.vendedor, (vendedorReceitaMap.get(v.vendedor) || 0) + (v.valor_venda || 0)));
  const receitaPorVendedor = Array.from(vendedorReceitaMap, ([name, value]) => ({ name: name.split(' ')[0], value }));

  // Motivos de perda
  const perdidos = leads.filter(l => l.status_funil === 'perdido');
  const motivoMap = new Map<string, number>();
  perdidos.forEach(l => { if (l.motivo_perda) motivoMap.set(l.motivo_perda, (motivoMap.get(l.motivo_perda) || 0) + 1); });
  const motivosPerda = Array.from(motivoMap, ([name, value]) => ({ name, value }));

  // Funil data
  const funnelData = [
    { name: 'Lead', value: leads.filter(l => l.status_funil === 'lead').length },
    { name: 'Reunião', value: leads.filter(l => l.status_funil === 'reuniao').length },
    { name: 'Proposta', value: leads.filter(l => l.status_funil === 'proposta').length },
    { name: 'Venda', value: vendasCount },
    { name: 'Perdido', value: perdidos.length },
  ];

  const PIE_COLORS = ['hsl(199,89%,48%)', 'hsl(38,92%,50%)', 'hsl(18,100%,60%)', 'hsl(0,72%,51%)', 'hsl(215,20%,55%)'];
  const CHART_COLORS = ['hsl(18,100%,60%)'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard Executivo</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da operação comercial</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard title="Total Leads" value={totalLeads} icon={Users} variant="primary" />
        <KpiCard title="Reuniões" value={reunioes} icon={CalendarCheck} variant="warning" />
        <KpiCard title="Propostas" value={propostas} icon={FileText} />
        <KpiCard title="Vendas" value={vendasCount} icon={Trophy} variant="success" />
        <KpiCard title="Receita Total" value={`R$ ${(receitaTotal / 1000).toFixed(0)}k`} icon={DollarSign} variant="primary" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Ticket Médio" value={`R$ ${ticketMedio.toFixed(0)}`} icon={Target} />
        <KpiCard title="Conv. Lead→Venda" value={`${taxaConversao}%`} icon={TrendingUp} variant="success" />
        <KpiCard title="Conv. Reunião→Venda" value={`${taxaReuniaoVenda}%`} icon={ArrowRightLeft} />
        <KpiCard title="Lead Time Médio" value={`${leadTimeMedio.toFixed(0)} dias`} icon={Clock} variant="warning" />
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
              <Bar dataKey="value" fill="hsl(18,100%,60%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Leads por Campanha</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={leadsPorCampanha} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
              <XAxis type="number" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} width={100} />
              <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} />
              <Bar dataKey="value" fill="hsl(199,89%,48%)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
          <h3 className="text-sm font-display font-semibold text-card-foreground mb-4">Receita por Vendedor</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={receitaPorVendedor}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,18%)" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: 'hsl(216,50%,10%)', border: '1px solid hsl(216,30%,18%)', borderRadius: 8, color: 'hsl(210,40%,95%)' }} formatter={(v: number) => [`R$ ${v.toLocaleString()}`, 'Receita']} />
              <Bar dataKey="value" fill="hsl(142,71%,45%)" radius={[6, 6, 0, 0]} />
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
      </div>
    </div>
  );
}
