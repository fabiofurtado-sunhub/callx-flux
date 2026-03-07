import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Building2, ChevronLeft, ChevronRight, RefreshCw, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface AccountRow {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  faturamento_estimado: number;
  status: string;
  owner_id: string | null;
  hub_score_empresa: number;
  hub_status: string;
  created_at: string;
  updated_at: string;
  // computed
  totalOpps: number;
  pipelineValor: number;
  contactsCount: number;
  lastActivity: string | null;
}

export default function Clientes() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [sortKey, setSortKey] = useState<string>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const perPage = 25;

  const fetchAccounts = async () => {
    setLoading(true);

    const [accsRes, oppsRes, contactsRes, activityRes] = await Promise.all([
      supabase.from('accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('opportunities').select('id, account_id, valor, etapa_pipeline'),
      supabase.from('contacts').select('id, account_id'),
      supabase.from('account_activity_log').select('account_id, created_at').order('created_at', { ascending: false }),
    ]);

    const opps = oppsRes.data || [];
    const contacts = contactsRes.data || [];
    const activities = activityRes.data || [];

    // Pre-compute per account
    const oppsByAccount = new Map<string, { count: number; valor: number }>();
    opps.forEach((o) => {
      const cur = oppsByAccount.get(o.account_id) || { count: 0, valor: 0 };
      cur.count++;
      if (o.etapa_pipeline !== 'perdido' && o.etapa_pipeline !== 'venda') {
        cur.valor += Number(o.valor) || 0;
      }
      oppsByAccount.set(o.account_id, cur);
    });

    const contactsByAccount = new Map<string, number>();
    contacts.forEach((c) => {
      contactsByAccount.set(c.account_id, (contactsByAccount.get(c.account_id) || 0) + 1);
    });

    const lastActivityByAccount = new Map<string, string>();
    activities.forEach((a) => {
      if (!lastActivityByAccount.has(a.account_id)) {
        lastActivityByAccount.set(a.account_id, a.created_at);
      }
    });

    setAccounts(
      (accsRes.data || []).map((a: any) => ({
        ...a,
        totalOpps: oppsByAccount.get(a.id)?.count || 0,
        pipelineValor: oppsByAccount.get(a.id)?.valor || 0,
        contactsCount: contactsByAccount.get(a.id) || 0,
        lastActivity: lastActivityByAccount.get(a.id) || a.updated_at,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchAccounts(); }, []);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const s = search.toLowerCase();
      const matchSearch =
        a.nome_fantasia.toLowerCase().includes(s) ||
        a.razao_social.toLowerCase().includes(s) ||
        a.cnpj.includes(s);
      const matchStatus = statusFilter === 'todos' || a.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [accounts, search, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let vA: any, vB: any;
      switch (sortKey) {
        case 'nome': vA = a.nome_fantasia.toLowerCase(); vB = b.nome_fantasia.toLowerCase(); break;
        case 'faturamento': vA = a.faturamento_estimado; vB = b.faturamento_estimado; break;
        case 'pipeline': vA = a.pipelineValor; vB = b.pipelineValor; break;
        case 'hub': vA = a.hub_score_empresa; vB = b.hub_score_empresa; break;
        case 'contacts': vA = a.contactsCount; vB = b.contactsCount; break;
        default: return 0;
      }
      if (vA < vB) return sortDir === 'asc' ? -1 : 1;
      if (vA > vB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const paged = sorted.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(sorted.length / perPage);

  const statusColor = (s: string) => {
    if (s === 'ativo') return 'text-success';
    if (s === 'churn') return 'text-destructive';
    return 'text-warning';
  };

  const fmt = (v: number) =>
    v > 0
      ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
      : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{sorted.length} empresas</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa, CNPJ..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 bg-card border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-40 bg-card border-border">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="churn">Churn</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchAccounts} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground animate-pulse">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th onClick={() => toggleSort('nome')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                    <span className="inline-flex items-center">Empresa <SortIcon column="nome" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</th>
                  <th onClick={() => toggleSort('contacts')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                    <span className="inline-flex items-center">Pessoas <SortIcon column="contacts" /></span>
                  </th>
                  <th onClick={() => toggleSort('faturamento')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                    <span className="inline-flex items-center">Faturamento <SortIcon column="faturamento" /></span>
                  </th>
                  <th onClick={() => toggleSort('pipeline')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                    <span className="inline-flex items-center">Pipeline Ativo <SortIcon column="pipeline" /></span>
                  </th>
                  <th onClick={() => toggleSort('hub')} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                    <span className="inline-flex items-center">Hub Score <SortIcon column="hub" /></span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Última Atividade</th>
                </tr>
              </thead>
              <tbody>
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhuma empresa encontrada.
                    </td>
                  </tr>
                ) : (
                  paged.map((acc) => (
                    <tr
                      key={acc.id}
                      onClick={() => navigate(`/leads/${acc.id}`)}
                      className="border-b border-border/50 hover:bg-accent/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">{acc.nome_fantasia || acc.razao_social}</p>
                            {acc.cnpj && <p className="text-[10px] text-muted-foreground">{acc.cnpj}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold uppercase ${statusColor(acc.status)}`}>
                          {acc.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{acc.contactsCount}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(acc.faturamento_estimado)}</td>
                      <td className="px-4 py-3 font-medium text-foreground text-xs">{fmt(acc.pipelineValor)}</td>
                      <td className="px-4 py-3">
                        {acc.hub_score_empresa > 0 ? (
                          <span className="text-xs font-bold text-primary">{acc.hub_score_empresa}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {acc.lastActivity
                          ? new Date(acc.lastActivity).toLocaleDateString('pt-BR')
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {page * perPage + 1}–{Math.min((page + 1) * perPage, sorted.length)} de {sorted.length}
            </p>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
