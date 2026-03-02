import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, Building2, Users, Briefcase, FileText, BarChart3,
  Clock, Plus, Trash2, Save, X, Pencil, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

/* ── Types ── */
interface Account {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  nicho: string;
  faturamento_estimado: number;
  numero_funcionarios: number;
  status: string;
  hub_status: string;
  hub_engagement_medio: number;
  hub_usuarios_ativos: number;
  hub_score_empresa: number;
  created_at: string;
}

interface Contact {
  id: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  decisor: boolean;
  influencia: string;
  lead_score: number;
  status: string;
}

interface Opportunity {
  id: string;
  nome_oportunidade: string;
  valor: number;
  etapa_pipeline: string;
  probabilidade: number;
  temperatura: string;
  origem: string;
  created_at: string;
}

interface Document {
  id: string;
  tipo: string;
  nome_arquivo: string;
  url_documento: string;
  status: string;
  created_at: string;
}

interface ActivityLog {
  id: string;
  tipo_evento: string;
  origem: string;
  descricao: string;
  created_at: string;
}

type Tab = 'timeline' | 'pessoas' | 'negocios' | 'documentos' | 'hub';

const PIPELINE_LABELS: Record<string, string> = {
  lead: 'Lead', mensagem_enviada: 'Msg Enviada', fup_1: 'FUP 1',
  ia_call: 'IA Call', ia_call_2: 'IA Call 2', ultima_mensagem: 'Última Msg',
  reuniao: 'Reunião', no_show: 'No-Show', reuniao_realizada: 'Reunião Realizada',
  proposta: 'Proposta', venda: 'Venda', perdido: 'Perdido',
};

export default function AccountDetail() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('timeline');

  // Inline editing account
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<Partial<Account>>({});

  // New contact form
  const [addingContact, setAddingContact] = useState(false);
  const [newContact, setNewContact] = useState({ nome: '', cargo: '', email: '', telefone: '', decisor: false });

  // New opportunity form
  const [addingOpp, setAddingOpp] = useState(false);
  const [newOpp, setNewOpp] = useState({ nome_oportunidade: '', valor: 0, etapa_pipeline: 'lead', temperatura: 'morna', origem: '' });

  const fetchAll = useCallback(async () => {
    if (!accountId) return;

    const [accRes, contactsRes, oppsRes, docsRes, actRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('id', accountId).single(),
      supabase.from('contacts').select('*').eq('account_id', accountId).order('created_at'),
      supabase.from('opportunities').select('*').eq('account_id', accountId).order('created_at', { ascending: false }),
      supabase.from('documents').select('*').eq('account_id', accountId).order('created_at', { ascending: false }),
      supabase.from('account_activity_log').select('*').eq('account_id', accountId).order('created_at', { ascending: false }).limit(50),
    ]);

    setAccount(accRes.data as Account | null);
    setContacts((contactsRes.data || []) as Contact[]);
    setOpportunities((oppsRes.data || []) as Opportunity[]);
    setDocuments((docsRes.data || []) as Document[]);
    setActivities((actRes.data || []) as ActivityLog[]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Account CRUD ── */
  const startEditing = () => {
    if (!account) return;
    setEditFields({
      nome_fantasia: account.nome_fantasia,
      razao_social: account.razao_social,
      cnpj: account.cnpj,
      nicho: account.nicho,
      faturamento_estimado: account.faturamento_estimado,
      numero_funcionarios: account.numero_funcionarios,
      status: account.status,
    });
    setEditing(true);
  };

  const saveAccount = async () => {
    if (!accountId) return;
    const { error } = await supabase.from('accounts').update(editFields).eq('id', accountId);
    if (error) { toast.error(error.message); return; }
    toast.success('Empresa atualizada');
    setEditing(false);
    fetchAll();
  };

  /* ── Contact CRUD ── */
  const addContact = async () => {
    if (!newContact.nome.trim() || !accountId) return;
    const { error } = await supabase.from('contacts').insert({ ...newContact, account_id: accountId });
    if (error) { toast.error(error.message); return; }
    toast.success('Contato adicionado');
    setAddingContact(false);
    setNewContact({ nome: '', cargo: '', email: '', telefone: '', decisor: false });
    fetchAll();
  };

  const deleteContact = async (id: string) => {
    if (!confirm('Excluir este contato?')) return;
    await supabase.from('contacts').delete().eq('id', id);
    toast.success('Contato excluído');
    fetchAll();
  };

  /* ── Opportunity CRUD ── */
  const addOpportunity = async () => {
    if (!newOpp.nome_oportunidade.trim() || !accountId) return;
    const { error } = await supabase.from('opportunities').insert({ ...newOpp, account_id: accountId });
    if (error) { toast.error(error.message); return; }
    toast.success('Negócio criado');
    setAddingOpp(false);
    setNewOpp({ nome_oportunidade: '', valor: 0, etapa_pipeline: 'lead', temperatura: 'morna', origem: '' });
    fetchAll();
  };

  const fmt = (v: number) =>
    v > 0 ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Empresa não encontrada.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/leads')}>Voltar</Button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'timeline', label: 'Linha do Tempo', icon: <Clock className="w-3.5 h-3.5" /> },
    { key: 'pessoas', label: 'Pessoas', icon: <Users className="w-3.5 h-3.5" />, count: contacts.length },
    { key: 'negocios', label: 'Negócios', icon: <Briefcase className="w-3.5 h-3.5" />, count: opportunities.length },
    { key: 'documentos', label: 'Documentos', icon: <FileText className="w-3.5 h-3.5" />, count: documents.length },
    { key: 'hub', label: 'Hub', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  ];

  const statusColor = (s: string) => {
    if (s === 'ativo') return 'text-success';
    if (s === 'churn') return 'text-destructive';
    return 'text-warning';
  };

  const tempColor = (t: string) => {
    if (t === 'quente') return 'text-destructive';
    if (t === 'morna') return 'text-warning';
    return 'text-info';
  };

  return (
    <div className="space-y-0">
      {/* Back button */}
      <Button variant="ghost" size="sm" className="mb-4 gap-2 text-muted-foreground" onClick={() => navigate('/leads')}>
        <ArrowLeft className="w-4 h-4" /> Clientes
      </Button>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ═══ LEFT: Company info sidebar ═══ */}
        <div className="lg:w-80 flex-shrink-0 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            {/* Avatar + name */}
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center mb-3">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              {editing ? (
                <Input
                  value={editFields.nome_fantasia || ''}
                  onChange={(e) => setEditFields({ ...editFields, nome_fantasia: e.target.value })}
                  className="text-center font-bold bg-card border-border"
                />
              ) : (
                <h2 className="text-lg font-bold text-foreground">{account.nome_fantasia || account.razao_social}</h2>
              )}
              {account.cnpj && !editing && (
                <p className="text-xs text-muted-foreground mt-1">{account.cnpj}</p>
              )}
              <span className={`text-[10px] font-semibold uppercase mt-2 ${statusColor(account.status)}`}>
                {account.status}
              </span>
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-2 mb-5">
              {editing ? (
                <>
                  <Button size="sm" onClick={saveAccount} className="gap-1"><Save className="w-3 h-3" /> Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}><X className="w-3 h-3" /></Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={startEditing} className="gap-1">
                  <Pencil className="w-3 h-3" /> Editar
                </Button>
              )}
            </div>

            {/* Data fields */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Razão Social</span>
                {editing ? (
                  <Input value={editFields.razao_social || ''} onChange={(e) => setEditFields({ ...editFields, razao_social: e.target.value })} className="h-7 w-40 text-xs bg-card border-border" />
                ) : (
                  <span className="text-foreground text-xs font-medium">{account.razao_social || '—'}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">CNPJ</span>
                {editing ? (
                  <Input value={editFields.cnpj || ''} onChange={(e) => setEditFields({ ...editFields, cnpj: e.target.value })} className="h-7 w-40 text-xs bg-card border-border" />
                ) : (
                  <span className="text-foreground text-xs">{account.cnpj || '—'}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Nicho</span>
                {editing ? (
                  <Input value={editFields.nicho || ''} onChange={(e) => setEditFields({ ...editFields, nicho: e.target.value })} className="h-7 w-40 text-xs bg-card border-border" />
                ) : (
                  <span className="text-foreground text-xs">{account.nicho || '—'}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Faturamento</span>
                {editing ? (
                  <Input type="number" value={editFields.faturamento_estimado || 0} onChange={(e) => setEditFields({ ...editFields, faturamento_estimado: Number(e.target.value) })} className="h-7 w-40 text-xs bg-card border-border" />
                ) : (
                  <span className="text-foreground text-xs font-medium">{fmt(account.faturamento_estimado)}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Funcionários</span>
                {editing ? (
                  <Input type="number" value={editFields.numero_funcionarios || 0} onChange={(e) => setEditFields({ ...editFields, numero_funcionarios: Number(e.target.value) })} className="h-7 w-40 text-xs bg-card border-border" />
                ) : (
                  <span className="text-foreground text-xs">{account.numero_funcionarios || '—'}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Status</span>
                {editing ? (
                  <Select value={editFields.status || 'prospect'} onValueChange={(v) => setEditFields({ ...editFields, status: v })}>
                    <SelectTrigger className="h-7 w-40 text-xs bg-card border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="churn">Churn</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={`text-xs font-semibold uppercase ${statusColor(account.status)}`}>{account.status}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground text-xs">Desde</span>
                <span className="text-foreground text-xs">{new Date(account.created_at).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>

          {/* Hub Score mini card */}
          <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Hub Engagement</p>
            <div className="flex items-end gap-3">
              <span className="text-2xl font-bold text-primary">{account.hub_score_empresa}</span>
              <span className="text-xs text-muted-foreground mb-1">/ 100</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {account.hub_usuarios_ativos} usuários ativos · Status: {account.hub_status}
            </p>
          </div>
        </div>

        {/* ═══ RIGHT: Tabs content ═══ */}
        <div className="flex-1 min-w-0">
          {/* Tab bar */}
          <div className="flex items-center gap-1 border-b border-border mb-4 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium tracking-wide transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.icon}
                {t.label}
                {t.count != null && t.count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-muted">{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: 'var(--shadow-card)' }}>
            {tab === 'timeline' && <TimelineContent activities={activities} />}
            {tab === 'pessoas' && (
              <PessoasContent
                contacts={contacts}
                adding={addingContact}
                setAdding={setAddingContact}
                newContact={newContact}
                setNewContact={setNewContact}
                onAdd={addContact}
                onDelete={deleteContact}
              />
            )}
            {tab === 'negocios' && (
              <NegociosContent
                opportunities={opportunities}
                adding={addingOpp}
                setAdding={setAddingOpp}
                newOpp={newOpp}
                setNewOpp={setNewOpp}
                onAdd={addOpportunity}
                fmt={fmt}
                tempColor={tempColor}
              />
            )}
            {tab === 'documentos' && <DocumentosContent documents={documents} />}
            {tab === 'hub' && <HubContent account={account} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Tab: Timeline ── */
function TimelineContent({ activities }: { activities: ActivityLog[] }) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhuma atividade registrada.</p>;
  }

  const originIcon = (o: string) => {
    if (o === 'CRM') return '📋';
    if (o === 'HUB') return '🎓';
    if (o === 'automacao') return '⚡';
    return '📝';
  };

  return (
    <div className="space-y-3">
      {activities.map((a) => (
        <div key={a.id} className="flex gap-3 items-start">
          <span className="text-lg mt-0.5">{originIcon(a.origem)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground">{a.descricao || a.tipo_evento}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {new Date(a.created_at).toLocaleDateString('pt-BR')} às{' '}
              {new Date(a.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {' · '}{a.origem}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Tab: Pessoas ── */
function PessoasContent({
  contacts, adding, setAdding, newContact, setNewContact, onAdd, onDelete,
}: {
  contacts: Contact[];
  adding: boolean;
  setAdding: (v: boolean) => void;
  newContact: any;
  setNewContact: (v: any) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{contacts.length} contatos</p>
        <Button size="sm" variant="outline" onClick={() => setAdding(!adding)} className="gap-1 text-xs">
          <Plus className="w-3 h-3" /> Contato
        </Button>
      </div>

      {adding && (
        <div className="grid grid-cols-2 gap-2 p-3 border border-border rounded-lg bg-muted/30">
          <Input placeholder="Nome" value={newContact.nome} onChange={(e) => setNewContact({ ...newContact, nome: e.target.value })} className="bg-card border-border text-sm" />
          <Input placeholder="Cargo" value={newContact.cargo} onChange={(e) => setNewContact({ ...newContact, cargo: e.target.value })} className="bg-card border-border text-sm" />
          <Input placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className="bg-card border-border text-sm" />
          <Input placeholder="Telefone" value={newContact.telefone} onChange={(e) => setNewContact({ ...newContact, telefone: e.target.value })} className="bg-card border-border text-sm" />
          <div className="col-span-2 flex justify-end gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="checkbox" checked={newContact.decisor} onChange={(e) => setNewContact({ ...newContact, decisor: e.target.checked })} />
              Decisor
            </label>
            <Button size="sm" onClick={onAdd}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {contacts.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum contato vinculado.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/20 transition-colors">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                {c.nome.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                  {c.decisor && <span className="text-[9px] px-1.5 py-0.5 bg-primary/15 text-primary rounded font-semibold">DECISOR</span>}
                </div>
                <p className="text-[10px] text-muted-foreground">{c.cargo || '—'} · {c.email || c.telefone}</p>
              </div>
              <span className="text-xs text-muted-foreground">Score: {c.lead_score}</span>
              <button onClick={() => onDelete(c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab: Negócios ── */
function NegociosContent({
  opportunities, adding, setAdding, newOpp, setNewOpp, onAdd, fmt, tempColor,
}: {
  opportunities: Opportunity[];
  adding: boolean;
  setAdding: (v: boolean) => void;
  newOpp: any;
  setNewOpp: (v: any) => void;
  onAdd: () => void;
  fmt: (v: number) => string;
  tempColor: (t: string) => string;
}) {
  const totalPipeline = opportunities
    .filter((o) => o.etapa_pipeline !== 'perdido' && o.etapa_pipeline !== 'venda')
    .reduce((a, o) => a + (Number(o.valor) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{opportunities.length} negócios</p>
          <p className="text-sm font-bold text-foreground mt-0.5">Pipeline: {fmt(totalPipeline)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAdding(!adding)} className="gap-1 text-xs">
          <Plus className="w-3 h-3" /> Negócio
        </Button>
      </div>

      {adding && (
        <div className="grid grid-cols-2 gap-2 p-3 border border-border rounded-lg bg-muted/30">
          <Input placeholder="Nome do negócio" value={newOpp.nome_oportunidade} onChange={(e) => setNewOpp({ ...newOpp, nome_oportunidade: e.target.value })} className="bg-card border-border text-sm col-span-2" />
          <Input type="number" placeholder="Valor" value={newOpp.valor || ''} onChange={(e) => setNewOpp({ ...newOpp, valor: Number(e.target.value) })} className="bg-card border-border text-sm" />
          <Select value={newOpp.temperatura} onValueChange={(v) => setNewOpp({ ...newOpp, temperatura: v })}>
            <SelectTrigger className="bg-card border-border text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="quente">Quente</SelectItem>
              <SelectItem value="morna">Morna</SelectItem>
              <SelectItem value="fria">Fria</SelectItem>
            </SelectContent>
          </Select>
          <div className="col-span-2 flex justify-end gap-2">
            <Button size="sm" onClick={onAdd}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {opportunities.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum negócio vinculado.</p>
      ) : (
        <div className="space-y-2">
          {opportunities.map((o) => (
            <div key={o.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/20 transition-colors">
              <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{o.nome_oportunidade}</p>
                <p className="text-[10px] text-muted-foreground">
                  {PIPELINE_LABELS[o.etapa_pipeline] || o.etapa_pipeline} · {o.origem || 'Sem origem'}
                </p>
              </div>
              <span className={`text-xs font-semibold ${tempColor(o.temperatura)}`}>{o.temperatura}</span>
              <span className="text-sm font-bold text-foreground">{fmt(Number(o.valor))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tab: Documentos ── */
function DocumentosContent({ documents }: { documents: Document[] }) {
  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento vinculado.</p>;
  }

  return (
    <div className="space-y-2">
      {documents.map((d) => (
        <a
          key={d.id}
          href={d.url_documento}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/20 transition-colors"
        >
          <FileText className="w-4 h-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{d.nome_arquivo || 'Documento'}</p>
            <p className="text-[10px] text-muted-foreground">{d.tipo} · {new Date(d.created_at).toLocaleDateString('pt-BR')}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

/* ── Tab: Hub ── */
function HubContent({ account }: { account: Account }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Score Empresa</p>
          <p className="text-2xl font-bold text-primary mt-1">{account.hub_score_empresa}</p>
        </div>
        <div className="p-4 rounded-lg border border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Engajamento Médio</p>
          <p className="text-2xl font-bold text-foreground mt-1">{account.hub_engagement_medio}</p>
        </div>
        <div className="p-4 rounded-lg border border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Usuários Ativos</p>
          <p className="text-2xl font-bold text-foreground mt-1">{account.hub_usuarios_ativos}</p>
        </div>
        <div className="p-4 rounded-lg border border-border/50">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Status Hub</p>
          <p className={`text-sm font-semibold uppercase mt-2 ${account.hub_status === 'ativo' ? 'text-success' : 'text-muted-foreground'}`}>{account.hub_status}</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O Hub Score é calculado pela média de engajamento dos usuários vinculados a esta empresa.
      </p>
    </div>
  );
}
