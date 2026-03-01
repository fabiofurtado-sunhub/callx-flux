import { useState, useEffect, useCallback } from 'react';
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
import { Save, CheckCircle2, FileText, CalendarIcon, X, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Lead } from '@/contexts/AppContext';
import { VENDEDORES } from '@/data/mockData';

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

export default function DiagnosticoModal({ lead, open, onOpenChange, onSaved }: DiagnosticoModalProps) {
  const [activeTab, setActiveTab] = useState('dados');
  const [saving, setSaving] = useState(false);
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

  const handleSave = async (finalizar = false) => {
    setSaving(true);
    try {
      const payload = { ...buildPayload(), status: finalizar ? 'finalizado' : 'rascunho' };

      if (diagnosticoId) {
        const { error } = await supabase.from('diagnosticos').update(payload as any).eq('id', diagnosticoId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('diagnosticos').insert(payload as any).select('id').single();
        if (error) throw error;
        setDiagnosticoId(data.id);
      }

      if (finalizar) setStatus('finalizado');
      toast.success(finalizar ? 'Diagnóstico finalizado!' : 'Rascunho salvo!');
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar diagnóstico');
    } finally {
      setSaving(false);
    }
  };

  const SpinQuestion = ({ id, text, value, onChange }: { id: string; text: string; value: string; onChange: (v: string) => void }) => (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-foreground">{id} — {text}</Label>
      <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className="bg-background border-border resize-none" placeholder="Resposta do cliente..." />
    </div>
  );

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
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Resumo da Situação</h4>
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
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">Mapa de Dores</h4>
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
                {[
                  { id: 'I1', text: 'Esse problema existe há quanto tempo? O que já tentou fazer para resolver?' },
                  { id: 'I2', text: 'Se a previsibilidade melhorasse, como isso mudaria o modo como você toma decisões?' },
                  { id: 'I3', text: 'Quais oportunidades você pode estar perdendo por não ter esse controle comercial?' },
                  { id: 'I4', text: 'O que acontece se daqui a 6 meses a operação continuar como está?' },
                  { id: 'I5', text: 'Como isso afeta o seu posicionamento frente à concorrência?' },
                ].map(q => (
                  <SpinQuestion key={q.id} {...q} value={implicacao[q.id] || ''} onChange={v => setImplicacao(prev => ({ ...prev, [q.id]: v }))} />
                ))}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3 grid grid-cols-2 gap-3">
                  <div><Label className="text-xs text-muted-foreground">Custo estimado pelo cliente (R$/mês)</Label><Input type="number" value={implicacaoExtras.custoEstimado || ''} onChange={e => setImplicacaoExtras(p => ({ ...p, custoEstimado: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                  <div><Label className="text-xs text-muted-foreground">Tempo do problema sem solução</Label><Input value={implicacaoExtras.tempoProblema || ''} onChange={e => setImplicacaoExtras(p => ({ ...p, tempoProblema: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                  <div className="col-span-2"><Label className="text-xs text-muted-foreground">Principais consequências citadas</Label><Textarea value={implicacaoExtras.consequencias || ''} onChange={e => setImplicacaoExtras(p => ({ ...p, consequencias: e.target.value }))} rows={2} className="mt-1 bg-background border-border resize-none" /></div>
                  <div className="col-span-2"><Label className="text-xs text-muted-foreground">Reações emocionais / momentos de tensão</Label><Textarea value={implicacaoExtras.reacoesEmocionais || ''} onChange={e => setImplicacaoExtras(p => ({ ...p, reacoesEmocionais: e.target.value }))} rows={2} className="mt-1 bg-background border-border resize-none" /></div>
                </div>
              </div>

              {/* NECESSIDADE */}
              <div className="space-y-4 rounded-lg border-l-4 border-green-500 pl-4">
                <h3 className="text-base font-bold text-green-600 uppercase tracking-wider">Necessidade</h3>
                {[
                  { id: 'N1', text: 'Se você tivesse visibilidade total do seu pipeline hoje, o que faria diferente?' },
                  { id: 'N2', text: 'Como seria o comercial ideal para você — sem depender de uma pessoa-chave?' },
                  { id: 'N3', text: 'Se sua taxa de conversão aumentasse 10%, o que representaria em receita nos próximos 3 meses?' },
                  { id: 'N4', text: 'O que seria necessário para você dizer: agora tenho controle do meu comercial?' },
                ].map(q => (
                  <SpinQuestion key={q.id} {...q} value={necessidade[q.id] || ''} onChange={v => setNecessidade(prev => ({ ...prev, [q.id]: v }))} />
                ))}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div><Label className="text-xs text-muted-foreground">"Para mim, o ideal seria..." (palavras exatas do cliente)</Label><Textarea value={necessidadeExtras.idealCliente || ''} onChange={e => setNecessidadeExtras(p => ({ ...p, idealCliente: e.target.value }))} rows={2} className="mt-1 bg-background border-border resize-none" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-muted-foreground">Prioridade 1 para o cliente</Label><Input value={necessidadeExtras.prioridade1 || ''} onChange={e => setNecessidadeExtras(p => ({ ...p, prioridade1: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                    <div><Label className="text-xs text-muted-foreground">Prioridade 2 para o cliente</Label><Input value={necessidadeExtras.prioridade2 || ''} onChange={e => setNecessidadeExtras(p => ({ ...p, prioridade2: e.target.value }))} className="mt-1 bg-background border-border" /></div>
                  </div>
                  <div><Label className="text-xs text-muted-foreground">Resultado esperado pelo cliente</Label><Input value={necessidadeExtras.resultadoEsperado || ''} onChange={e => setNecessidadeExtras(p => ({ ...p, resultadoEsperado: e.target.value }))} className="mt-1 bg-background border-border" /></div>
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
              <div><Label className="text-xs text-muted-foreground">Próximo passo acordado</Label><Input value={fechamento.proximoPasso || ''} onChange={e => setFechamento(p => ({ ...p, proximoPasso: e.target.value }))} className="mt-1 bg-background border-border" /></div>
              <div>
                <Label className="text-xs text-muted-foreground">Data do próximo contato</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full mt-1 justify-start text-left", !dataProximoContato && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataProximoContato ? format(dataProximoContato, 'dd/MM/yyyy') : 'Selecionar data'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dataProximoContato} onSelect={setDataProximoContato} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
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
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase">Tabela de Âncoras</h4>
                <div className="space-y-3">
                  {ancoras.map((a, i) => (
                    <div key={i} className="grid grid-cols-3 gap-2 bg-muted/30 rounded-lg p-3">
                      <div><Label className="text-[10px] text-muted-foreground">Dor do cliente</Label><Input value={a.dor} onChange={e => { const n = [...ancoras]; n[i].dor = e.target.value; setAncoras(n); }} className="mt-1 bg-background border-border text-sm" /></div>
                      <div><Label className="text-[10px] text-muted-foreground">Solução no Revenue OS</Label><Input value={a.solucao} onChange={e => { const n = [...ancoras]; n[i].solucao = e.target.value; setAncoras(n); }} className="mt-1 bg-background border-border text-sm" /></div>
                      <div><Label className="text-[10px] text-muted-foreground">Frase de âncora</Label><Textarea value={a.frase} onChange={e => { const n = [...ancoras]; n[i].frase = e.target.value; setAncoras(n); }} rows={1} className="mt-1 bg-background border-border resize-none text-sm" /></div>
                    </div>
                  ))}
                </div>
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
              <div>
                <Label className="text-xs text-muted-foreground">Probabilidade de fechamento ({negociacao.probabilidadeFechamento || 50}%)</Label>
                <Slider min={0} max={100} step={5} value={[negociacao.probabilidadeFechamento || 50]} onValueChange={([v]) => setNegociacao(p => ({ ...p, probabilidadeFechamento: v }))} className="mt-2" />
              </div>
              <div><Label className="text-xs text-muted-foreground">Notas estratégicas do closer</Label><Textarea value={negociacao.notasEstrategicas || ''} onChange={e => setNegociacao(p => ({ ...p, notasEstrategicas: e.target.value }))} rows={4} className="mt-1 bg-background border-border resize-none" /></div>
            </TabsContent>
          </div>

          {/* Footer com ações */}
          <div className="border-t border-border px-6 py-3 flex items-center justify-between bg-card">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Rascunho'}
            </Button>
            <div className="flex items-center gap-2">
              {status === 'finalizado' && (
                <Button variant="secondary" className="gap-2" onClick={() => toast.info('Funcionalidade de relatório em breve!')}>
                  <FileText className="w-4 h-4" />
                  Gerar Relatório
                </Button>
              )}
              {activeTab === 'negociacao' && status !== 'finalizado' && (
                <Button onClick={() => handleSave(true)} disabled={saving} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="w-4 h-4" />
                  Finalizar Diagnóstico
                </Button>
              )}
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
