import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MetaCapiLogs from '@/components/MetaCapiLogs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X, Trash2 } from 'lucide-react';
import { Lead, LeadStatus } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FUNNEL_STAGES, VENDEDORES } from '@/data/mockData';

interface LeadEditModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export default function LeadEditModal({ lead, open, onOpenChange, onSaved }: LeadEditModalProps) {
  const [form, setForm] = useState<Partial<Lead>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (lead) setForm({ ...lead });
  }, [lead]);

  if (!lead) return null;

  const set = (field: string, value: unknown) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('leads').update({
        nome: form.nome,
        telefone: form.telefone,
        email: form.email,
        campanha: form.campanha,
        adset: form.adset,
        grupo_anuncios: form.grupo_anuncios,
        vendedor_nome: form.vendedor_nome,
        status_funil: form.status_funil,
        valor_proposta: form.valor_proposta,
        valor_venda: form.valor_venda,
        motivo_perda: form.motivo_perda,
        observacoes: form.observacoes,
        faturamento: form.faturamento,
        data_ultimo_movimento: new Date().toISOString(),
      }).eq('id', lead.id);

      if (error) throw error;
      toast.success('Lead atualizado com sucesso!');
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error('Erro ao salvar lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-card-foreground">Editar Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Dados Pessoais */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados de Contato</h4>
            <div>
              <Label className="text-xs text-muted-foreground">Nome</Label>
              <Input value={form.nome || ''} onChange={e => set('nome', e.target.value)} className="mt-1 bg-background border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input value={form.telefone || ''} onChange={e => set('telefone', e.target.value)} className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={form.email || ''} onChange={e => set('email', e.target.value)} className="mt-1 bg-background border-border" />
              </div>
            </div>
          </div>

          {/* Campanha */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da Campanha</h4>
            <div>
              <Label className="text-xs text-muted-foreground">Campanha</Label>
              <Input value={form.campanha || ''} onChange={e => set('campanha', e.target.value)} className="mt-1 bg-background border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Adset</Label>
                <Input value={form.adset || ''} onChange={e => set('adset', e.target.value)} className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Grupo de Anúncios</Label>
                <Input value={form.grupo_anuncios || ''} onChange={e => set('grupo_anuncios', e.target.value)} className="mt-1 bg-background border-border" />
              </div>
            </div>
          </div>

          {/* Funil */}
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funil Comercial</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Etapa do Funil</Label>
                <Select value={form.status_funil} onValueChange={v => set('status_funil', v as LeadStatus)}>
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUNNEL_STAGES.map(s => (
                      <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Vendedor</Label>
                <Select value={form.vendedor_nome || ''} onValueChange={v => set('vendedor_nome', v)}>
                  <SelectTrigger className="mt-1 bg-background border-border">
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDEDORES.map(v => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Valor Proposta (R$)</Label>
                <Input type="number" value={form.valor_proposta ?? ''} onChange={e => set('valor_proposta', e.target.value ? Number(e.target.value) : null)} className="mt-1 bg-background border-border" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Valor Venda (R$)</Label>
                <Input type="number" value={form.valor_venda ?? ''} onChange={e => set('valor_venda', e.target.value ? Number(e.target.value) : null)} className="mt-1 bg-background border-border" />
              </div>
            </div>
            {form.status_funil === 'perdido' && (
              <div>
                <Label className="text-xs text-muted-foreground">Motivo da Perda</Label>
                <Input value={form.motivo_perda || ''} onChange={e => set('motivo_perda', e.target.value)} className="mt-1 bg-background border-border" />
              </div>
            )}
          </div>

          {/* Faturamento + Observações */}
          <div className="space-y-3 border-t border-border pt-4">
            <div>
              <Label className="text-xs text-muted-foreground">Faturamento Mensal (R$)</Label>
              <Input type="number" value={form.faturamento ?? ''} onChange={e => set('faturamento', e.target.value ? Number(e.target.value) : null)} className="mt-1 bg-background border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea value={form.observacoes || ''} onChange={e => set('observacoes', e.target.value)} rows={3} className="mt-1 bg-background border-border resize-none" />
            </div>
          </div>

          {/* Info somente leitura */}
          <div className="border-t border-border pt-4 grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase">Entrada</Label>
              <p className="text-xs text-muted-foreground">{form.data_entrada ? new Date(form.data_entrada).toLocaleDateString('pt-BR') : '-'}</p>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase">Lead Time</Label>
              <p className="text-xs text-muted-foreground">{form.lead_time != null ? `${form.lead_time} dias` : '-'}</p>
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground/60 uppercase">WhatsApp</Label>
              <p className="text-xs text-muted-foreground">{form.envio_whatsapp_status || '-'}</p>
            </div>
          </div>

          {/* Meta CAPI Events */}
          <div className="border-t border-border pt-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Eventos Meta CAPI</h4>
            <MetaCapiLogs leadId={lead.id} limit={5} />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving || deleting} className="flex-1 gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
            <Button
              variant="destructive"
              disabled={saving || deleting}
              className="gap-2"
              onClick={async () => {
                if (!confirm('Tem certeza que deseja excluir este lead?')) return;
                setDeleting(true);
                try {
                  const { error } = await supabase.from('leads').delete().eq('id', lead.id);
                  if (error) throw error;
                  toast.success('Lead excluído com sucesso!');
                  onSaved?.();
                  onOpenChange(false);
                } catch {
                  toast.error('Erro ao excluir lead');
                } finally {
                  setDeleting(false);
                }
              }}
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
