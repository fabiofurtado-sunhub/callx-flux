export type LeadStatus = 'lead' | 'reuniao' | 'reuniao_realizada' | 'proposta' | 'venda' | 'perdido';
export type LeadScore = 'frio' | 'morno' | 'quente' | 'oportunidade';
export type WhatsAppStatus = 'enviado' | 'entregue' | 'falha' | 'erro_envio' | 'pendente';
export type UserRole = 'admin' | 'gestor' | 'vendedor';

export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  campanha: string;
  adset: string;
  grupo_anuncios: string;
  vendedor: string;
  status_funil: LeadStatus;
  data_entrada: string;
  data_ultimo_movimento: string;
  valor_proposta: number | null;
  valor_venda: number | null;
  motivo_perda: string | null;
  score_lead: number;
  probabilidade_fechamento: number;
  envio_whatsapp_status: WhatsAppStatus;
  envio_whatsapp_data: string | null;
  lead_time: number | null;
  observacoes: string;
}

export const FUNNEL_STAGES: { key: LeadStatus; label: string; color: string }[] = [
  { key: 'lead', label: 'Lead', color: 'hsl(var(--info))' },
  { key: 'reuniao', label: 'Reunião Agendada', color: 'hsl(var(--warning))' },
  { key: 'reuniao_realizada', label: 'Reunião Realizada', color: 'hsl(var(--warning))' },
  { key: 'proposta', label: 'Proposta Emitida', color: 'hsl(var(--primary))' },
  { key: 'venda', label: 'Venda', color: 'hsl(var(--success))' },
  { key: 'perdido', label: 'Perdido', color: 'hsl(var(--destructive))' },
];

export function getScoreLabel(score: number): LeadScore {
  if (score <= 20) return 'frio';
  if (score <= 50) return 'morno';
  if (score <= 80) return 'quente';
  return 'oportunidade';
}

export function getScoreColor(score: number): string {
  const label = getScoreLabel(score);
  switch (label) {
    case 'frio': return 'text-info';
    case 'morno': return 'text-warning';
    case 'quente': return 'text-primary';
    case 'oportunidade': return 'text-success';
  }
}

export const VENDEDORES = ['Arthur', 'Fernando', 'Paula'];
const vendedores = VENDEDORES;
const campanhas = ['CallX IA Comercial', 'Meta Lead Gen Q1', 'Remarketing Funil'];
const adsets = ['Lookalike 1%', 'Interesse B2B', 'Custom Audience'];
const grupos = ['Grupo A - CEO', 'Grupo B - Diretores', 'Grupo C - Gestores'];

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString();
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateMockLeads(count = 45): Lead[] {
  const statuses: LeadStatus[] = ['lead', 'reuniao', 'proposta', 'venda', 'perdido'];
  const leads: Lead[] = [];
  const motivos = ['Sem orçamento', 'Concorrente', 'Timing errado', 'Sem resposta', 'Não qualificado', 'No-Show'];

  for (let i = 0; i < count; i++) {
    const status = randomItem(statuses);
    const score = status === 'lead' ? 10 : status === 'reuniao' ? 30 : status === 'proposta' ? 60 : status === 'venda' ? 100 : 5;
    const dataEntrada = randomDate(30);
    const leadTime = status === 'venda' || status === 'perdido' ? Math.floor(Math.random() * 15) + 1 : null;

    leads.push({
      id: `lead-${i + 1}`,
      nome: `Lead ${i + 1}`,
      telefone: `+55119${String(Math.floor(Math.random() * 90000000) + 10000000)}`,
      email: `lead${i + 1}@empresa.com`,
      campanha: randomItem(campanhas),
      adset: randomItem(adsets),
      grupo_anuncios: randomItem(grupos),
      vendedor: randomItem(vendedores),
      status_funil: status,
      data_entrada: dataEntrada,
      data_ultimo_movimento: randomDate(10),
      valor_proposta: status === 'proposta' || status === 'venda' ? Math.floor(Math.random() * 50000) + 5000 : null,
      valor_venda: status === 'venda' ? Math.floor(Math.random() * 40000) + 5000 : null,
      motivo_perda: status === 'perdido' ? randomItem(motivos) : null,
      score_lead: score + Math.floor(Math.random() * 10),
      probabilidade_fechamento: status === 'proposta' ? Math.floor(Math.random() * 40) + 40 : status === 'venda' ? 100 : Math.floor(Math.random() * 30),
      envio_whatsapp_status: Math.random() > 0.1 ? 'entregue' : 'falha',
      envio_whatsapp_data: dataEntrada,
      lead_time: leadTime,
      observacoes: '',
    });
  }
  return leads;
}
