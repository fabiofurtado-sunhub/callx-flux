import { useAppContext, LeadStatus } from '@/contexts/AppContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, RefreshCw, Search, RotateCw, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo } from 'react';
import { getScoreLabel, getScoreColor, FUNNEL_STAGES, VENDEDORES } from '@/data/mockData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import LossReasonDialog from '@/components/LossReasonDialog';

export default function Leads() {
  const { leads, moveLeadToStage, refreshLeads } = useAppContext();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [vendedorFilter, setVendedorFilter] = useState<string>('todos');
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [pendingLossLeadId, setPendingLossLeadId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(0);
  const perPage = 25;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const handleSyncSheets = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('poll-google-sheets');
      if (error) throw error;
      await refreshLeads();
      toast.success('Base de leads atualizada!');
    } catch {
      toast.error('Erro ao sincronizar com Google Sheets');
    } finally {
      setSyncing(false);
    }
  };

  const handleStageChange = (leadId: string, newStage: string) => {
    if (newStage === 'perdido') {
      setPendingLossLeadId(leadId);
      setLossDialogOpen(true);
    } else {
      moveLeadToStage(leadId, newStage as LeadStatus);
    }
  };

  const handleLossConfirm = async (motivo: string) => {
    if (pendingLossLeadId) {
      await moveLeadToStage(pendingLossLeadId, 'perdido');
      await supabase.from('leads').update({ motivo_perda: motivo }).eq('id', pendingLossLeadId);
      setPendingLossLeadId(null);
      setLossDialogOpen(false);
    }
  };

  const handleVendedorChange = async (leadId: string, vendedor: string) => {
    const { error } = await supabase.from('leads').update({
      vendedor_nome: vendedor,
      data_ultimo_movimento: new Date().toISOString(),
    }).eq('id', leadId);
    if (error) {
      toast.error('Erro ao atualizar vendedor');
    } else {
      toast.success('Vendedor atualizado');
    }
  };

  const filtered = leads.filter(l => {
    const matchesSearch = l.nome.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase()) ||
      l.campanha.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || l.status_funil === statusFilter;
    const matchesVendedor = vendedorFilter === 'todos' || l.vendedor_nome === vendedorFilter;
    return matchesSearch && matchesStatus && matchesVendedor;
  });

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortKey) {
        case 'nome': valA = a.nome.toLowerCase(); valB = b.nome.toLowerCase(); break;
        case 'telefone': valA = a.telefone; valB = b.telefone; break;
        case 'campanha': valA = (a.campanha || '').toLowerCase(); valB = (b.campanha || '').toLowerCase(); break;
        case 'vendedor': valA = (a.vendedor_nome || '').toLowerCase(); valB = (b.vendedor_nome || '').toLowerCase(); break;
        case 'funil': valA = a.status_funil; valB = b.status_funil; break;
        case 'score': valA = a.score_lead; valB = b.score_lead; break;
        case 'whatsapp': valA = a.envio_whatsapp_status; valB = b.envio_whatsapp_status; break;
        default: return 0;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      lead: 'bg-info/15 text-info border-info/30',
      reuniao: 'bg-warning/15 text-warning border-warning/30',
      reuniao_realizada: 'bg-warning/15 text-warning border-warning/30',
      proposta: 'bg-primary/15 text-primary border-primary/30',
      venda: 'bg-success/15 text-success border-success/30',
      perdido: 'bg-destructive/15 text-destructive border-destructive/30',
    };
    const labels: Record<string, string> = {
      lead: 'Lead', reuniao: 'Reunião', reuniao_realizada: 'Reunião Realizada', proposta: 'Proposta', venda: 'Venda', perdido: 'Perdido',
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
    <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Leads</h1>
              <p className="text-sm text-muted-foreground mt-1">{sorted.length} leads encontrados</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSyncSheets} disabled={syncing} className="gap-2">
              <RotateCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Atualizando...' : 'Atualizar Base'}
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar leads..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="pl-9 bg-card border-border"
              />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-44 bg-card border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                {FUNNEL_STAGES.map(s => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={vendedorFilter} onValueChange={v => { setVendedorFilter(v); setPage(0); }}>
              <SelectTrigger className="w-full sm:w-44 bg-card border-border">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Vendedores</SelectItem>
                {VENDEDORES.map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th onClick={() => toggleSort('nome')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"><span className="inline-flex items-center">Nome<SortIcon column="nome" /></span></th>
                  <th onClick={() => toggleSort('telefone')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"><span className="inline-flex items-center">Telefone<SortIcon column="telefone" /></span></th>
                  <th onClick={() => toggleSort('campanha')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"><span className="inline-flex items-center">Campanha<SortIcon column="campanha" /></span></th>
                  <th onClick={() => toggleSort('vendedor')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"><span className="inline-flex items-center">Vendedor<SortIcon column="vendedor" /></span></th>
                  <th onClick={() => toggleSort('funil')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"><span className="inline-flex items-center">Funil<SortIcon column="funil" /></span></th>
                  <th onClick={() => toggleSort('score')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"><span className="inline-flex items-center">Score<SortIcon column="score" /></span></th>
                  <th onClick={() => toggleSort('whatsapp')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"><span className="inline-flex items-center">WhatsApp<SortIcon column="whatsapp" /></span></th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {sorted.slice(page * perPage, (page + 1) * perPage).map(lead => (
                  <tr key={lead.id} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{lead.nome}</p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.telefone}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{lead.campanha}</td>
                    <td className="px-4 py-3">
                      <Select value={lead.vendedor_nome || ''} onValueChange={v => handleVendedorChange(lead.id, v)}>
                        <SelectTrigger className="h-7 w-28 text-xs bg-card border-border">
                          <SelectValue placeholder="Vendedor" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-50">
                          {VENDEDORES.map(v => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3">
                      <Select value={lead.status_funil} onValueChange={v => handleStageChange(lead.id, v)}>
                        <SelectTrigger className="h-7 w-32 text-xs bg-card border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border z-50">
                          {FUNNEL_STAGES.map(s => (
                            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
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
          {/* Pagination */}
          {sorted.length > perPage && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Mostrando {page * perPage + 1}–{Math.min((page + 1) * perPage, sorted.length)} de {sorted.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {page + 1} / {Math.ceil(sorted.length / perPage)}
                </span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={(page + 1) * perPage >= sorted.length} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <LossReasonDialog
        open={lossDialogOpen}
        onOpenChange={(open) => {
          setLossDialogOpen(open);
          if (!open) setPendingLossLeadId(null);
        }}
        onConfirm={handleLossConfirm}
      />
    </>
  );
}
