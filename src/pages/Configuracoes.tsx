import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Save, Webhook, DollarSign, Target } from 'lucide-react';
import { toast } from 'sonner';

export default function Configuracoes() {
  const { settings, setSettings } = useAppContext();

  const handleSave = () => {
    toast.success('Configurações salvas com sucesso!');
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
