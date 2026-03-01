import { useState, useEffect, useCallback } from 'react';
import { supabase as sbClient } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Save, CheckCircle2, FileText, CalendarIcon, X, ClipboardList, Sparkles, Loader2, Send, Copy, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Lead } from '@/contexts/AppContext';
import { VENDEDORES } from '@/data/mockData';

function SpinQuestion({ id, text, value, onChange }: { id: string; text: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-foreground">{id} — {text}</Label>
      <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className="bg-background border-border resize-none" placeholder="Resposta do cliente..." />
    </div>
  );
}

interface DiagnosticoModalProps {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const DORES = [
  'Falta de previsibilidade de receita',
  'Dependência do gestor no operacional',
  'Time sem processo replicável',
  'Pipeline invisível / desatualizado',
  'Taxa de conversão desconhecida',
  'Follow-up inconsistente',
  'Perda de leads sem diagnóstico',
  'Meta atingida no "feeling"',
];

const ANCORAS_MAP: Record<string, { solucao: string; frase: string }> = {
  'Falta de previsibilidade de receita': {
    solucao: 'Dashboard de forecast + pipeline por etapa',
    frase: 'Você me disse que projeta no feeling — aqui a previsão vem do histórico real do seu funil.',
  },
  'Dependência do gestor no operacional': {
    solucao: 'Playbook + processo que funciona sem o dono',
    frase: 'Você falou que o comercial para quando você sai — com o playbook, o processo guia sem precisar de você.',
  },
  'Time sem processo replicável': {
    solucao: 'Playbook documentado + onboarding de vendedor',
    frase: 'Cada vendedor vende do seu jeito hoje — no Revenue OS o processo é o mesmo, independente de quem vende.',
  },
  'Pipeline invisível / desatualizado': {
    solucao: 'CRM com atualização obrigatória por etapa',
    frase: 'Você não sabe onde está cada deal sem perguntar — aqui o pipeline é atualizado em tempo real por cada vendedor.',
  },
  'Taxa de conversão desconhecida': {
    solucao: 'Dashboards de KPIs por etapa do funil',
    frase: 'Você me disse que não sabe sua taxa de conversão — aqui ela aparece automaticamente, por etapa e por vendedor.',
  },
  'Follow-up inconsistente': {
    solucao: 'Cadência estruturada + alertas no CRM',
    frase: 'Lead sem follow-up é oportunidade esquecida — o sistema avisa quando e como retomar cada contato.',
  },
  'Perda de leads sem diagnóstico': {
    solucao: 'Relatório de motivo de perda + aprendizado',
    frase: 'Você não sabe por que está perdendo — no Revenue OS cada perda tem motivo registrado e vira melhoria de processo.',
  },
  'Meta atingida no "feeling"': {
    solucao: 'Meta por indicador + acompanhamento semanal',
    frase: 'Meta no feeling é aposta, não gestão — com o Revenue OS você acompanha pelo número, não pela sensação.',
  },
};

export default function DiagnosticoModal({ lead, open, onOpenChange, onSaved }: DiagnosticoModalProps) {
  const [activeTab, setActiveTab] = useState('dados');
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractingDores, setExtractingDores] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [diagnosticoId, setDiagnosticoId] = useState<string | null>(null);
  const [status, setStatus] = useState('rascunho');

  // Aba 1
  const [dataReuniao, setDataReuniao] = useState<Date | undefined>();
  const [closerNome, setCloserNome] = useState('');

  // Aba 2 - Situação
  const [situacao, setSituacao] = useState<Record<string, string>>({});
  const [situacaoResumo, setSituacaoResumo] = useState<Record<string, any>>({});

  // Aba 2 - Problema
  const [problema, setProblema] = useState<Record<string, string>>({});
  const [doresMap, setDoresMap] = useState<Record<string, { checked: boolean; intensidade: number }>>({});
  const [doresExatas, setDoresExatas] = useState('');

  // Aba 2 - Implicação
  const [implicacao, setImplicacao] = useState<Record<string, string>>({});
  const [implicacaoExtras, setImplicacaoExtras] = useState<Record<string, any>>({});

  // Aba 2 - Necessidade
  const [necessidade, setNecessidade] = useState<Record<string, string>>({});
  const [necessidadeExtras, setNecessidadeExtras] = useState<Record<string, any>>({});

  // Aba 3 - Fechamento
  const [fechamento, setFechamento] = useState<Record<string, any>>({});
  const [dataProximoContato, setDataProximoContato] = useState<Date | undefined>();

  // Aba 4 - Negociação
  const [negociacao, setNegociacao] = useState<Record<string, any>>({});
  const [ancoras, setAncoras] = useState<{ dor: string; solucao: string; frase: string }[]>([
    { dor: '', solucao: '', frase: '' },
    { dor: '', solucao: '', frase: '' },
    { dor: '', solucao: '', frase: '' },
  ]);

  // Init dores map
  useEffect(() => {
    if (Object.keys(doresMap).length === 0) {
      const init: Record<string, { checked: boolean; intensidade: number }> = {};
      DORES.forEach(d => { init[d] = { checked: false, intensidade: 3 }; });
      setDoresMap(init);
    }
  }, []);

  // Load existing diagnostico
  useEffect(() => {
    if (!lead?.id || !open) return;
    (async () => {
      const { data } = await supabase
        .from('diagnosticos')
        .select('*')
        .eq('lead_id', lead.id)
        .maybeSingle();

      if (data) {
        setDiagnosticoId(data.id);
        setStatus(data.status);
        if (data.data_reuniao) setDataReuniao(new Date(data.data_reuniao));
        setCloserNome(data.closer_nome || '');

        const sit = (data.spin_situacao as any) || {};
        setSituacao(sit.perguntas || {});
        setSituacaoResumo(sit.resumo || {});

        const prob = (data.spin_problema as any) || {};
        setProblema(prob.perguntas || {});
        if (prob.doresMap) setDoresMap(prob.doresMap);
        setDoresExatas(prob.doresExatas || '');

        const imp = (data.spin_implicacao as any) || {};
        setImplicacao(imp.perguntas || {});
        setImplicacaoExtras(imp.extras || {});

        const nec = (data.spin_necessidade as any) || {};
        setNecessidade(nec.perguntas || {});
        setNecessidadeExtras(nec.extras || {});

        const fech = (data.fechamento as any) || {};
        setFechamento(fech);
        if (fech.dataProximoContato) setDataProximoContato(new Date(fech.dataProximoContato));

        const neg = (data.negociacao as any) || {};
        setNegociacao(neg);
        if (neg.ancoras) setAncoras(neg.ancoras);
      }
    })();
  }, [lead?.id, open]);

  const handleAutoFillResumo = async () => {
    const hasContent = Object.values(situacao).some(v => v && v.trim().length > 0);
    if (!hasContent) { toast.error('Preencha pelo menos uma resposta de Situação primeiro'); return; }
    setExtracting(true);
    try {
      const { data, error } = await sbClient.functions.invoke('extract-spin-resumo', {
        body: { respostas: situacao },
      });
      if (error) throw error;
      if (data) {
        setSituacaoResumo(prev => ({
          ...prev,
          ...Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== '' && v != null)),
        }));
        toast.success('Resumo preenchido com IA!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao extrair resumo');
    } finally {
      setExtracting(false);
    }
  };

  const handleAutoFillDores = async () => {
    const hasContent = Object.values(problema).some(v => v && v.trim().length > 0);
    if (!hasContent) { toast.error('Preencha pelo menos uma resposta de Problema primeiro'); return; }
    setExtractingDores(true);
    try {
      const { data, error } = await sbClient.functions.invoke('extract-spin-resumo', {
        body: { respostas: problema, type: 'dores' },
      });
      if (error) throw error;
      if (data) {
        setDoresMap(prev => {
          const updated = { ...prev };
          Object.entries(data).forEach(([dor, val]: [string, any]) => {
            if (updated[dor] && val) {
              updated[dor] = { checked: val.checked ?? false, intensidade: val.intensidade ?? 3 };
            }
          });
          return updated;
        });
        toast.success('Mapa de dores preenchido com IA!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao extrair dores');
    } finally {
      setExtractingDores(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!diagnosticoId) { toast.error('Salve o diagnóstico primeiro'); return; }
    // Validate required fields
    if (!implicacao.I4?.trim()) { toast.error('Preencha "I4 — Cenário em 6 meses" (campo obrigatório) para gerar o relatório.'); setActiveTab('spin'); return; }
    if (!necessidade.N2?.trim()) { toast.error('Preencha "N2 — Comercial ideal em 1 frase" (campo obrigatório) para gerar o relatório.'); setActiveTab('spin'); return; }
    
    setGeneratingReport(true);
    try {
      await handleSave(false);
      const { data, error } = await sbClient.functions.invoke('generate-diagnostico-report', {
        body: { diagnostico_id: diagnosticoId, send_email: false },
      });
      if (error) throw error;
      if (data?.html) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(data.html);
          win.document.close();
        }
      }
      toast.success('Relatório gerado! Aberto em nova aba para impressão como PDF.');
      
      // Ask to send email if lead has one
      if (lead.email) {
        toast('Deseja enviar por e-mail?', {
          action: {
            label: 'Enviar',
            onClick: async () => {
              const { error: emailErr } = await sbClient.functions.invoke('generate-diagnostico-report', {
                body: { diagnostico_id: diagnosticoId, send_email: true },
              });
              if (emailErr) { toast.error('Erro ao enviar e-mail'); return; }
              toast.success('E-mail enviado com sucesso!');
            },
          },
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório');
    } finally {
      setGeneratingReport(false);
    }
  };

  const buildPayload = useCallback(() => ({
    lead_id: lead.id,
    data_reuniao: dataReuniao?.toISOString() || null,
    closer_nome: closerNome,
    spin_situacao: { perguntas: situacao, resumo: situacaoResumo },
    spin_problema: { perguntas: problema, doresMap, doresExatas },
    spin_implicacao: { perguntas: implicacao, extras: implicacaoExtras },
    spin_necessidade: { perguntas: necessidade, extras: necessidadeExtras },
    fechamento: { ...fechamento, dataProximoContato: dataProximoContato?.toISOString() || null },
    negociacao: { ...negociacao, ancoras },
  }), [lead.id, dataReuniao, closerNome, situacao, situacaoResumo, problema, doresMap, doresExatas, implicacao, implicacaoExtras, necessidade, necessidadeExtras, fechamento, dataProximoContato, negociacao, ancoras]);

  const generateAncorasFromDores = useCallback(() => {
    const checkedDores = Object.entries(doresMap)
      .filter(([_, v]) => v.checked)
      .sort((a, b) => b[1].intensidade - a[1].intensidade)
      .slice(0, 3);

    if (checkedDores.length === 0) return [];

    return checkedDores.map(([dor]) => ({
      dor,
      solucao: ANCORAS_MAP[dor]?.solucao || '',
      frase: ANCORAS_MAP[dor]?.frase || '',
    }));
  }, [doresMap]);

  const handleCopyAncoras = () => {
    const text = ancoras
      .filter(a => a.frase)
      .map((a, i) => `${i + 1}. ${a.frase}`)
      .join('\n\n');
    if (!text) { toast.error('Nenhuma âncora para copiar'); return; }
    navigator.clipboard.writeText(text);
    toast.success('Âncoras copiadas!');
  };

  const handleSave = async (finalizar = false) => {
    setSaving(true);
    try {
      let currentAncoras = ancoras;
      if (finalizar) {
        const generated = generateAncorasFromDores();
        if (generated.length > 0) {
          currentAncoras = generated;
          setAncoras(generated);
        }
      }

      const payload = {
        ...buildPayload(),
        negociacao: { ...negociacao, ancoras: currentAncoras },
        status: finalizar ? 'finalizado' : 'rascunho',
      };

      if (diagnosticoId) {
        const { error } = await supabase.from('diagnosticos').update(payload as any).eq('id', diagnosticoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('diagnosticos').insert(payload as any).select('id').single();
        if (error) throw error;
        setDiagnosticoId(data.id);
      }

      if (finalizar) {
        setStatus('finalizado');
        setActiveTab('negociacao');
      }
      toast.success(finalizar ? 'Diagnóstico finalizado!' : 'Rascunho salvo!');
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar diagnóstico');
    } finally {
      setSaving(false);
    }
  };

  // SpinQuestion moved outside the component to avoid focus loss

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0 bg-card border-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">Diagnóstico Comercial</h2>
              <p className="text-sm text-muted-foreground">{lead.nome} — {lead.empresa || 'Sem empresa'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status === 'finalizado' ? 'default' : 'secondary'} className={status === 'finalizado' ? 'bg-green-600 text-white' : ''}>
              {status === 'finalizado' ? '✓ Finalizado' : 'Rascunho'}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs + Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3 border-b border-border">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="dados">📋 Dados do Lead</TabsTrigger>
              <TabsTrigger value="spin">🔍 Diagnóstico SPIN</TabsTrigger>
              <TabsTrigger value="fechamento">🤝 Fechamento</TabsTrigger>
              <TabsTrigger value="negociacao">🎯 Guia Negociação</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* ABA 1: DADOS DO LEAD */}
            <TabsContent value="dados" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Nome completo</Label>
                  <Input value={lead.nome} readOnly className="mt-1 bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Empresa</Label>
                  <Input value={lead.empresa || ''} readOnly className="mt-1 bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">WhatsApp</Label>
                  <Input value={lead.telefone} readOnly className="mt-1 bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">E-mail</Label>
                  <Input value={lead.email || ''} readOnly className="mt-1 bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Faturamento declarado</Label>
                  <Input value={lead.faturamento ? `R$ ${Number(lead.faturamento).toLocaleString()}` : 'Não informado'} readOnly className="mt-1 bg-muted border-border" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Data da reunião</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full mt-1 justify-start text-left", !dataReuniao && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dataReuniao ? format(dataReuniao, 'dd/MM/yyyy') : 'Selecionar data'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dataReuniao} onSelect={setDataReuniao} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Closer responsável</Label>
                  <Select value={closerNome} onValueChange={setCloserNome}>
                    <SelectTrigger className="mt-1 bg-background border-border">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {VENDEDORES.map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* ABA 2: SPIN */}
            <TabsContent value="spin" className="mt-0 space-y-6">
              {/* SITUAÇÃO */}
              <div className="space-y-4 rounded-lg border-l-4 border-teal-500 pl-4">
                <h3 className="text-base font-bold text-teal-600 uppercase tracking-wider">Situação</h3>
                {[
                  { id: 'S1', text: 'Quantas pessoas trabalham na sua operação comercial? (vendedores, SDRs, pré-vendas)' },
                  { id: 'S2', text: 'Qual é o ticket médio de venda e o ciclo médio (do contato ao fechamento)?' },
                  { id: 'S3', text: 'Hoje vocês têm um processo comercial documentado — um playbook, roteiro de abordagem?' },
                  { id: 'S4', text: 'Qual ferramenta usam para acompanhar o pipeline de vendas hoje?' },
                  { id: 'S5', text: 'Como a empresa gera leads hoje — quais canais e qual o volume mensal aproximado?' },
                  { id: 'S6', text: 'Você como gestor — quanto do seu tempo semanal vai para o operacional comercial?' },
                ].map(q => (
                  <SpinQuestion key={q.id} {...q} value={situacao[q.id] || ''} onChange={v => setSituacao(prev => ({ ...prev, [q.id]: v }))} />
                ))}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">Resumo da Situação</h4>
                    <Button type="button" size="sm" variant="outline" onClick={handleAutoFillResumo} disabled={extracting} className="text-xs gap-1.5">
                      {extracting ? '⏳ Extraindo...' : '✨ Preencher com IA'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Nº de vendedores</Label><Input type="number" value={situacaoResumo.numVendedores || ''} onChange={e => setSituacaoResumo(p => ({ ...p, numVendedores: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Ticket médio</Label><Input value={situacaoResumo.ticketMedio || ''} onChange={e => setSituacaoResumo(p => ({ ...p, ticketMedio: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Ciclo médio (dias)</Label><Input type="number" value={situacaoResumo.cicloMedio || ''} onChange={e => setSituacaoResumo(p => ({ ...p, cicloMedio: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">CRM atual</Label><Input value={situacaoResumo.crmAtual || ''} onChange={e => setSituacaoResumo(p => ({ ...p, crmAtual: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Canal principal de leads</Label><Input value={situacaoResumo.canalPrincipal || ''} onChange={e => setSituacaoResumo(p => ({ ...p, canalPrincipal: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Volume de leads/mês</Label><Input type="number" value={situacaoResumo.volumeLeads || ''} onChange={e => setSituacaoResumo(p => ({ ...p, volumeLeads: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Tem playbook?</Label>
                      <Select value={situacaoResumo.temPlaybook || ''} onValueChange={v => setSituacaoResumo(p => ({ ...p, temPlaybook: v }))}>
                        <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Sim">Sim</SelectItem>
                          <SelectItem value="Não">Não</SelectItem>
                          <SelectItem value="Parcial">Parcial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Observações livres</Label><Textarea value={situacaoResumo.observacoes || ''} onChange={e => setSituacaoResumo(p => ({ ...p, observacoes: e.target.value }))} rows={2} className="mt-1 bg-background border-border resize-none" /></div>
                </div>
              </div>

              {/* PROBLEMA */}
              <div className="space-y-4 rounded-lg border-l-4 border-orange-500 pl-4">
                <h3 className="text-base font-bold text-orange-600 uppercase tracking-wider">Problema</h3>
                {[
                  { id: 'P1', text: 'Qual é a maior dificuldade que você enfrenta no seu comercial hoje?' },
                  { id: 'P2', text: 'A sua meta de vendas é atingida todo mês? O que faz um mês ser bom ou ruim?' },
                  { id: 'P3', text: 'Você consegue prever sua receita para o próximo mês com segurança?' },
                  { id: 'P4', text: 'Se um vendedor sair amanhã, o processo continua ou trava?' },
                  { id: 'P5', text: 'Você sabe hoje, sem consultar ninguém, qual é sua taxa de conversão do funil?' },
                  { id: 'P6', text: 'Existe algum gargalo claro no funil — onde os leads travam mais?' },
                ].map(q => (
                  <SpinQuestion key={q.id} {...q} value={problema[q.id] || ''} onChange={v => setProblema(prev => ({ ...prev, [q.id]: v }))} />
                ))}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase">Mapa de Dores</h4>
                    <Button type="button" size="sm" variant="outline" onClick={handleAutoFillDores} disabled={extractingDores} className="text-xs gap-1.5">
                      {extractingDores ? <><Loader2 className="w-3 h-3 animate-spin" /> Analisando...</> : <><Sparkles className="w-3 h-3" /> Preencher com IA</>}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {DORES.map(dor => (
                      <div key={dor} className="flex items-center gap-3">
                        <Checkbox
                          checked={doresMap[dor]?.checked || false}
                          onCheckedChange={(checked) => setDoresMap(p => ({ ...p, [dor]: { ...p[dor], checked: !!checked } }))}
                        />
                        <span className="text-sm flex-1 min-w-0 truncate">{dor}</span>
                        <div className="w-32 flex items-center gap-2">
                          <Slider
                            min={1} max={5} step={1}
                            value={[doresMap[dor]?.intensidade || 3]}
                            onValueChange={([v]) => setDoresMap(p => ({ ...p, [dor]: { ...p[dor], intensidade: v } }))}
                          />
                          <span className="text-xs font-bold w-4 text-center">{doresMap[dor]?.intensidade || 3}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Dores nas palavras exatas do cliente</Label><Textarea value={doresExatas} onChange={e => setDoresExatas(e.target.value)} rows={3} className="mt-1 bg-background border-border resize-none" /></div>
                </div>
              </div>

              {/* IMPLICAÇÃO */}
              <div className="space-y-4 rounded-lg border-l-4 border-red-500 pl-4">
                <h3 className="text-base font-bold text-red-600 uppercase tracking-wider">Implicação</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold text-foreground">I1 — Há quanto tempo esse problema existe?</Label>
                    <Select value={implicacao.I1 || ''} onValueChange={v => setImplicacao(prev => ({ ...prev, I1: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Menos de 6 meses">Menos de 6 meses</SelectItem>
                        <SelectItem value="6 a 12 meses">6 a 12 meses</SelectItem>
                        <SelectItem value="1 a 2 anos">1 a 2 anos</SelectItem>
                        <SelectItem value="Mais de 2 anos">Mais de 2 anos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <SpinQuestion id="I2" text="O que já tentou para resolver? (ferramentas, consultoria, treinamento)" value={implicacao.I2 || ''} onChange={v => setImplicacao(prev => ({ ...prev, I2: v }))} />
                  <SpinQuestion id="I3" text="Se o pipeline ficasse visível hoje, qual decisão você tomaria que está travada agora?" value={implicacao.I3 || ''} onChange={v => setImplicacao(prev => ({ ...prev, I3: v }))} />
                  <div>
                    <Label className="text-sm font-semibold text-foreground">I4 — Se daqui a 6 meses a operação continuar como está, o que acontece com o seu negócio? <span className="text-destructive">*</span></Label>
                    <Textarea value={implicacao.I4 || ''} onChange={e => setImplicacao(prev => ({ ...prev, I4: e.target.value }))} rows={3} className="mt-1 bg-background border-border resize-none" placeholder="Resposta do cliente... (obrigatório)" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-foreground">I5 — Quanto tempo por semana você gasta resolvendo problemas que deveriam ser do processo, não seus?</Label>
                    <Select value={implicacao.I5 || ''} onValueChange={v => setImplicacao(prev => ({ ...prev, I5: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Menos de 2h">Menos de 2h</SelectItem>
                        <SelectItem value="2 a 5h">2 a 5h</SelectItem>
                        <SelectItem value="5 a 10h">5 a 10h</SelectItem>
                        <SelectItem value="Mais de 10h">Mais de 10h</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* NECESSIDADE */}
              <div className="space-y-4 rounded-lg border-l-4 border-green-500 pl-4">
                <h3 className="text-base font-bold text-green-600 uppercase tracking-wider">Necessidade</h3>
                <div className="space-y-3">
                  <SpinQuestion id="N1" text="Se o comercial funcionasse sem você, o que você faria com esse tempo?" value={necessidade.N1 || ''} onChange={v => setNecessidade(prev => ({ ...prev, N1: v }))} />
                  <div>
                    <Label className="text-sm font-semibold text-foreground">N2 — Descreva em 1 frase como seria seu comercial ideal: <span className="text-destructive">*</span></Label>
                    <Input value={necessidade.N2 || ''} onChange={e => setNecessidade(prev => ({ ...prev, N2: e.target.value }))} className="mt-1 bg-background border-border" placeholder="Resposta do cliente... (obrigatório)" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-foreground">N3 — Em quanto tempo você quer ter esse controle implantado?</Label>
                    <Select value={necessidade.N3 || ''} onValueChange={v => setNecessidade(prev => ({ ...prev, N3: v }))}>
                      <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30 dias">30 dias</SelectItem>
                        <SelectItem value="60 dias">60 dias</SelectItem>
                        <SelectItem value="90 dias">90 dias</SelectItem>
                        <SelectItem value="Sem prazo definido">Sem prazo definido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <SpinQuestion id="N4" text="Qual seria o principal sinal de que você tem controle do seu comercial?" value={necessidade.N4 || ''} onChange={v => setNecessidade(prev => ({ ...prev, N4: v }))} />
                </div>
              </div>
            </TabsContent>

            {/* ABA 3: FECHAMENTO */}
            <TabsContent value="fechamento" className="mt-0 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Validação do diagnóstico pelo cliente</Label>
                <Select value={fechamento.validacao || ''} onValueChange={v => setFechamento(p => ({ ...p, validacao: v }))}>
                  <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Confirmado">Confirmado</SelectItem>
                    <SelectItem value="Parcialmente">Parcialmente</SelectItem>
                    <SelectItem value="Requer ajuste">Requer ajuste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs text-muted-foreground">Observação sobre a validação</Label><Textarea value={fechamento.observacaoValidacao || ''} onChange={e => setFechamento(p => ({ ...p, observacaoValidacao: e.target.value }))} rows={3} className="mt-1 bg-background border-border resize-none" /></div>
              <div>
                <Label className="text-xs text-muted-foreground">Nível de urgência percebido (1=Baixa, 5=Urgente)</Label>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">Baixa</span>
                  <Slider min={1} max={5} step={1} value={[fechamento.urgencia || 3]} onValueChange={([v]) => setFechamento(p => ({ ...p, urgencia: v }))} className="flex-1" />
                  <span className="text-xs text-muted-foreground">Urgente</span>
                  <span className="text-sm font-bold w-6 text-center">{fechamento.urgencia || 3}</span>
                </div>
              </div>
              <div><Label className="text-xs text-muted-foreground">Objeções levantadas</Label><Textarea value={fechamento.objecoes || ''} onChange={e => setFechamento(p => ({ ...p, objecoes: e.target.value }))} rows={3} className="mt-1 bg-background border-border resize-none" /></div>
              <div><Label className="text-xs text-muted-foreground">Observações finais do closer</Label><Textarea value={fechamento.observacoesFinais || ''} onChange={e => setFechamento(p => ({ ...p, observacoesFinais: e.target.value }))} rows={3} className="mt-1 bg-background border-border resize-none" /></div>
            </TabsContent>

            {/* ABA 4: GUIA DE NEGOCIAÇÃO */}
            <TabsContent value="negociacao" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Perfil de decisão</Label>
                  <Select value={negociacao.perfilDecisao || ''} onValueChange={v => setNegociacao(p => ({ ...p, perfilDecisao: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Racional">Racional</SelectItem>
                      <SelectItem value="Emocional">Emocional</SelectItem>
                      <SelectItem value="Misto">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Velocidade de decisão</Label>
                  <Select value={negociacao.velocidadeDecisao || ''} onValueChange={v => setNegociacao(p => ({ ...p, velocidadeDecisao: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Rápido">Rápido</SelectItem>
                      <SelectItem value="Cauteloso">Cauteloso</SelectItem>
                      <SelectItem value="Precisa aprovação de terceiros">Precisa aprovação de terceiros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Principal motivador</Label>
                  <Select value={negociacao.principalMotivador || ''} onValueChange={v => setNegociacao(p => ({ ...p, principalMotivador: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Crescimento">Crescimento</SelectItem>
                      <SelectItem value="Controle">Controle</SelectItem>
                      <SelectItem value="Segurança">Segurança</SelectItem>
                      <SelectItem value="Status">Status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nível de dor percebida (1-5)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Slider min={1} max={5} step={1} value={[negociacao.nivelDor || 3]} onValueChange={([v]) => setNegociacao(p => ({ ...p, nivelDor: v }))} className="flex-1" />
                    <span className="text-sm font-bold w-6">{negociacao.nivelDor || 3}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Avaliou concorrentes?</Label>
                  <Select value={negociacao.avaliouConcorrentes || ''} onValueChange={v => setNegociacao(p => ({ ...p, avaliouConcorrentes: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                  {negociacao.avaliouConcorrentes === 'Sim' && (
                    <Input value={negociacao.quaisConcorrentes || ''} onChange={e => setNegociacao(p => ({ ...p, quaisConcorrentes: e.target.value }))} placeholder="Quais?" className="mt-2 bg-background border-border" />
                  )}
                </div>
                <div><Label className="text-xs text-muted-foreground">Quem mais participa da decisão?</Label><Input value={negociacao.participantesDecisao || ''} onChange={e => setNegociacao(p => ({ ...p, participantesDecisao: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                <div>
                  <Label className="text-xs text-muted-foreground">Orçamento sinalizou?</Label>
                  <Select value={negociacao.orcamentoSinalizado || ''} onValueChange={v => setNegociacao(p => ({ ...p, orcamentoSinalizado: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sim">Sim</SelectItem>
                      <SelectItem value="Não">Não</SelectItem>
                    </SelectContent>
                  </Select>
                  {negociacao.orcamentoSinalizado === 'Sim' && (
                    <Input value={negociacao.faixaOrcamento || ''} onChange={e => setNegociacao(p => ({ ...p, faixaOrcamento: e.target.value }))} placeholder="Faixa: R$" className="mt-2 bg-background border-border" />
                  )}
                </div>
              </div>

              {/* Tabela de Âncoras */}
              <div className="space-y-3 border border-primary/20 rounded-lg p-4 bg-primary/5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-foreground uppercase tracking-wide">🎯 Tabela de Âncoras</h4>
                  <Button type="button" size="sm" variant="outline" onClick={handleCopyAncoras} className="text-xs gap-1.5">
                    <Copy className="w-3 h-3" /> Copiar âncoras
                  </Button>
                </div>
                {ancoras.every(a => !a.dor && !a.frase) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                    <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                    Marque as dores identificadas no Diagnóstico para gerar as âncoras automaticamente.
                  </div>
                )}
                <div className="space-y-3">
                  {ancoras.map((a, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 bg-muted/30 rounded-lg p-3">
                      <div><Label className="text-[10px] text-muted-foreground">Dor do cliente</Label><Input value={a.dor} onChange={e => { const n = [...ancoras]; n[i].dor = e.target.value; setAncoras(n); }} className="mt-1 bg-background border-border text-sm" /></div>
                      <div><Label className="text-[10px] text-muted-foreground">Solução no Revenue OS</Label><Input value={a.solucao} onChange={e => { const n = [...ancoras]; n[i].solucao = e.target.value; setAncoras(n); }} className="mt-1 bg-background border-border text-sm" /></div>
                      <div><Label className="text-[10px] text-muted-foreground">Frase de âncora</Label><Textarea value={a.frase} onChange={e => { const n = [...ancoras]; n[i].frase = e.target.value; setAncoras(n); }} rows={2} className="mt-1 bg-background border-border resize-none text-sm" /></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Probabilidade de fechamento - logo abaixo das âncoras */}
              <div className="border border-border rounded-lg p-4 bg-muted/20">
                <Label className="text-xs text-muted-foreground">Probabilidade de fechamento ({negociacao.probabilidadeFechamento || 50}%)</Label>
                <Slider min={0} max={100} step={5} value={[negociacao.probabilidadeFechamento || 50]} onValueChange={([v]) => setNegociacao(p => ({ ...p, probabilidadeFechamento: v }))} className="mt-2" />
              </div>

              {/* Campos Finais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Pacote recomendado</Label>
                  <Select value={negociacao.pacoteRecomendado || ''} onValueChange={v => setNegociacao(p => ({ ...p, pacoteRecomendado: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Revenue OS Starter">Revenue OS Starter</SelectItem>
                      <SelectItem value="Revenue OS Scale">Revenue OS Scale</SelectItem>
                      <SelectItem value="Revenue OS Full">Revenue OS Full</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Urgência real percebida</Label>
                  <Select value={negociacao.urgenciaReal || ''} onValueChange={v => setNegociacao(p => ({ ...p, urgenciaReal: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alta">Alta</SelectItem>
                      <SelectItem value="Média">Média</SelectItem>
                      <SelectItem value="Baixa">Baixa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-xs text-muted-foreground">Argumento principal de valor</Label><Textarea value={negociacao.argumentoValor || ''} onChange={e => setNegociacao(p => ({ ...p, argumentoValor: e.target.value }))} rows={2} className="mt-1 bg-background border-border resize-none" /></div>
              <div><Label className="text-xs text-muted-foreground">Maior risco de perda do deal</Label><Input value={negociacao.maiorRisco || ''} onChange={e => setNegociacao(p => ({ ...p, maiorRisco: e.target.value }))} className="mt-1 bg-background border-border" /></div>
              <div><Label className="text-xs text-muted-foreground">Notas estratégicas do closer</Label><Textarea value={negociacao.notasEstrategicas || ''} onChange={e => setNegociacao(p => ({ ...p, notasEstrategicas: e.target.value }))} rows={4} className="mt-1 bg-background border-border resize-none" /></div>
            </TabsContent>
          </div>

          {/* Footer com ações */}
          <div className="border-t border-border px-6 py-3 space-y-3 bg-card">
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="gap-2">
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar Rascunho'}
              </Button>
              <div className="flex items-center gap-2">
                {status === 'finalizado' && (
                  <Button variant="secondary" className="gap-2" onClick={handleGenerateReport} disabled={generatingReport}>
                    {generatingReport ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {generatingReport ? 'Gerando...' : 'Gerar Relatório'}
                    {lead.email && <Send className="w-3 h-3 ml-1" />}
                  </Button>
                )}
                {(activeTab === 'fechamento' || activeTab === 'negociacao') && status !== 'finalizado' && (
                  <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle2 className="w-4 h-4" />
                    Finalizar Diagnóstico
                  </Button>
                )}
              </div>
            </div>

            {status === 'finalizado' && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs font-medium tracking-wide" style={{ color: '#8899AA' }}>Próximo passo:</span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <button
                  type="button"
                  onClick={() => window.open('https://pitchcomercial.aceleradoramx3.com/revos', '_blank')}
                  className="w-full flex items-center justify-center gap-2 font-bold text-base rounded-lg transition-transform duration-200 hover:scale-[1.02]"
                  style={{
                    height: '56px',
                    backgroundColor: '#00FF78',
                    color: '#080C16',
                    fontSize: '16px',
                    borderRadius: '8px',
                  }}
                >
                  <ArrowUpRight className="w-5 h-5" />
                  INICIAR APRESENTAÇÃO COMERCIAL →
                </button>
              </div>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
