import { useAppContext } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { getScoreLabel, getScoreColor } from '@/data/mockData';

export default function Leads() {
  const { leads } = useAppContext();
  const [search, setSearch] = useState('');

  const filtered = leads.filter(l =>
    l.nome.toLowerCase().includes(search.toLowerCase()) ||
    l.email.toLowerCase().includes(search.toLowerCase()) ||
    l.campanha.toLowerCase().includes(search.toLowerCase())
  );

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      lead: 'bg-info/15 text-info border-info/30',
      reuniao: 'bg-warning/15 text-warning border-warning/30',
      proposta: 'bg-primary/15 text-primary border-primary/30',
      venda: 'bg-success/15 text-success border-success/30',
      perdido: 'bg-destructive/15 text-destructive border-destructive/30',
    };
    const labels: Record<string, string> = {
      lead: 'Lead', reuniao: 'Reunião', proposta: 'Proposta', venda: 'Venda', perdido: 'Perdido',
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${map[status]}`}>{labels[status]}</span>;
  };

  const whatsappBadge = (status: string) => {
    if (status === 'entregue') return <span className="text-xs text-success">✓ Entregue</span>;
    if (status === 'enviado') return <span className="text-xs text-info">● Enviado</span>;
    if (status === 'falha' || status === 'erro_envio') return <span className="text-xs text-destructive">✗ Falha</span>;
    return <span className="text-xs text-muted-foreground">— Pendente</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} leads encontrados</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Telefone</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Campanha</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Funil</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Score</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">WhatsApp</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 25).map(lead => (
                <tr key={lead.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{lead.nome}</p>
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.telefone}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{lead.campanha}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs"><td className="px-4 py-3 text-muted-foreground text-xs">{lead.vendedor_nome}</td></td>
                  <td className="px-4 py-3">{statusBadge(lead.status_funil)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold uppercase ${getScoreColor(lead.score_lead)}`}>
                      {getScoreLabel(lead.score_lead)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{whatsappBadge(lead.envio_whatsapp_status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
