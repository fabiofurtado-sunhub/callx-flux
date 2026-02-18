import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Save, Webhook, DollarSign, Target, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Configuracoes() {
  const { settings, setSettings } = useAppContext();

  const handleSave = async () => {
    try {
      const { data: existing } = await supabase.from('configuracoes').select('id').limit(1).single();
      if (existing) {
        await supabase.from('configuracoes').update({
          zapi_webhook: settings.zapiWebhook,
          zapi_token: settings.zapiToken,
          zapi_instance_id: settings.zapiInstanceId,
          google_sheets_url: settings.googleSheetsUrl,
        }).eq('id', existing.id);
      }

      const { data: existingMeta } = await supabase.from('metas').select('id').limit(1).single();
      if (existingMeta) {
        await supabase.from('metas').update({
          custo_por_lead: settings.custoPorLead,
          meta_vendas_mensal: settings.metaVendasMensal,
          meta_receita_mensal: settings.metaReceitaMensal,
        }).eq('id', existingMeta.id);
      } else {
        await supabase.from('metas').insert({
          custo_por_lead: settings.custoPorLead,
          meta_vendas_mensal: settings.metaVendasMensal,
          meta_receita_mensal: settings.metaReceitaMensal,
        });
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar configurações');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/15">
          <SettingsIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Integração ZAPI e metas comerciais</p>
        </div>
      </div>

      {/* Google Sheets */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold text-card-foreground">Google Sheets (Captação de Leads)</h3>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">URL da Planilha</Label>
          <Input
            value={settings.googleSheetsUrl}
            onChange={e => setSettings(s => ({ ...s, googleSheetsUrl: e.target.value }))}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="mt-1 bg-background border-border"
          />
          <p className="text-xs text-muted-foreground mt-1.5">Cole o link da planilha pública do Google Sheets com os leads.</p>
        </div>
      </div>

      {/* ZAPI */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Webhook className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold text-card-foreground">Integração ZAPI (WhatsApp)</h3>
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Webhook URL</Label>
            <Input
              value={settings.zapiWebhook}
              onChange={e => setSettings(s => ({ ...s, zapiWebhook: e.target.value }))}
              placeholder="https://api.z-api.io/instances/..."
              className="mt-1 bg-background border-border"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Instance ID</Label>
              <Input
                value={settings.zapiInstanceId}
                onChange={e => setSettings(s => ({ ...s, zapiInstanceId: e.target.value }))}
                placeholder="Instance ID"
                className="mt-1 bg-background border-border"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Token</Label>
              <Input
                type="password"
                value={settings.zapiToken}
                onChange={e => setSettings(s => ({ ...s, zapiToken: e.target.value }))}
                placeholder="Token"
                className="mt-1 bg-background border-border"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Metas */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold text-card-foreground">Metas Comerciais</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Custo por Lead (R$)</Label>
            <Input
              type="number"
              value={settings.custoPorLead}
              onChange={e => setSettings(s => ({ ...s, custoPorLead: Number(e.target.value) }))}
              className="mt-1 bg-background border-border"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Meta Vendas/Mês</Label>
            <Input
              type="number"
              value={settings.metaVendasMensal}
              onChange={e => setSettings(s => ({ ...s, metaVendasMensal: Number(e.target.value) }))}
              className="mt-1 bg-background border-border"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Meta Receita/Mês (R$)</Label>
            <Input
              type="number"
              value={settings.metaReceitaMensal}
              onChange={e => setSettings(s => ({ ...s, metaReceitaMensal: Number(e.target.value) }))}
              className="mt-1 bg-background border-border"
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSave} className="w-full sm:w-auto gap-2">
        <Save className="w-4 h-4" />
        Salvar Configurações
      </Button>
    </div>
  );
}
