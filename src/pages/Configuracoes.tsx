import { useState, useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, Save, Target, FileSpreadsheet, CheckCircle, BarChart3, Loader2, Palette, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DiagDesign {
  diag_cor_fundo: string;
  diag_cor_primaria: string;
  diag_cor_secundaria: string;
  diag_cor_destaque: string;
  diag_cor_alerta: string;
  diag_cor_card: string;
  diag_cor_texto: string;
  diag_cor_texto_muted: string;
  diag_logo_url: string;
  diag_nome_marca: string;
  diag_slogan: string;
}

const defaultDesign: DiagDesign = {
  diag_cor_fundo: '#080C16',
  diag_cor_primaria: '#00FF78',
  diag_cor_secundaria: '#00D2C8',
  diag_cor_destaque: '#F59E0B',
  diag_cor_alerta: '#FF4455',
  diag_cor_card: '#0D1825',
  diag_cor_texto: '#FFFFFF',
  diag_cor_texto_muted: '#8899AA',
  diag_logo_url: '',
  diag_nome_marca: 'MX3 Aceleradora Comercial',
  diag_slogan: 'Diagnóstico Comercial Confidencial',
};

export default function Configuracoes() {
  const { settings, setSettings } = useAppContext();
  const [backfilling, setBackfilling] = useState(false);
  const [designOpen, setDesignOpen] = useState(false);
  const [design, setDesign] = useState<DiagDesign>(defaultDesign);
  const [designLoading, setDesignLoading] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);

  useEffect(() => {
    (async () => {
      setDesignLoading(true);
      const { data } = await supabase.from('configuracoes').select('diag_cor_fundo, diag_cor_primaria, diag_cor_secundaria, diag_cor_destaque, diag_cor_alerta, diag_cor_card, diag_cor_texto, diag_cor_texto_muted, diag_logo_url, diag_nome_marca, diag_slogan').limit(1).single();
      if (data) {
        setDesign({
          diag_cor_fundo: data.diag_cor_fundo || defaultDesign.diag_cor_fundo,
          diag_cor_primaria: data.diag_cor_primaria || defaultDesign.diag_cor_primaria,
          diag_cor_secundaria: data.diag_cor_secundaria || defaultDesign.diag_cor_secundaria,
          diag_cor_destaque: data.diag_cor_destaque || defaultDesign.diag_cor_destaque,
          diag_cor_alerta: data.diag_cor_alerta || defaultDesign.diag_cor_alerta,
          diag_cor_card: data.diag_cor_card || defaultDesign.diag_cor_card,
          diag_cor_texto: data.diag_cor_texto || defaultDesign.diag_cor_texto,
          diag_cor_texto_muted: data.diag_cor_texto_muted || defaultDesign.diag_cor_texto_muted,
          diag_logo_url: data.diag_logo_url || '',
          diag_nome_marca: data.diag_nome_marca || defaultDesign.diag_nome_marca,
          diag_slogan: data.diag_slogan || defaultDesign.diag_slogan,
        });
      }
      setDesignLoading(false);
    })();
  }, []);

  const handleSaveDesign = async () => {
    setSavingDesign(true);
    try {
      const { data: existing } = await supabase.from('configuracoes').select('id').limit(1).single();
      if (existing) {
        await supabase.from('configuracoes').update({ ...design }).eq('id', existing.id);
      }
      toast.success('Design do diagnóstico salvo!');
    } catch {
      toast.error('Erro ao salvar design');
    } finally {
      setSavingDesign(false);
    }
  };

  const handleBackfillGA4 = async () => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-analytics-backfill');
      if (error) throw error;
      toast.success(`Backfill concluído: ${data?.sent || 0} eventos enviados ao Google Analytics`);
    } catch (err: any) {
      toast.error('Erro no backfill: ' + (err.message || 'erro desconhecido'));
    } finally {
      setBackfilling(false);
    }
  };

  const handleSave = async () => {
    try {
      const { data: existing } = await supabase.from('configuracoes').select('id').limit(1).single();
      if (existing) {
        await supabase.from('configuracoes').update({
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
          <p className="text-sm text-muted-foreground mt-0.5">Google Sheets e metas comerciais</p>
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

      {/* ZAPI Status */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-2" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-success" />
          <h3 className="text-sm font-display font-semibold text-card-foreground">Integração ZAPI (WhatsApp)</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          As credenciais ZAPI estão configuradas de forma segura no backend. O envio automático de mensagens via WhatsApp está ativo.
        </p>
      </div>

      {/* Google Analytics */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3" style={{ boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-display font-semibold text-card-foreground">Google Analytics 4</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Eventos de conversão são enviados automaticamente ao GA4 a cada mudança de etapa no funil.
        </p>
        <Button variant="outline" size="sm" onClick={handleBackfillGA4} disabled={backfilling} className="gap-2">
          {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          {backfilling ? 'Enviando...' : 'Enviar eventos históricos ao Google'}
        </Button>
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

      {/* Design do Diagnóstico */}
      <Collapsible open={designOpen} onOpenChange={setDesignOpen}>
        <div className="rounded-xl border border-border bg-card" style={{ boxShadow: 'var(--shadow-card)' }}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-6 text-left hover:bg-accent/30 transition-colors rounded-xl">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-display font-semibold text-card-foreground">Design do Diagnóstico</h3>
              </div>
              {designOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-6 pb-6 space-y-5 border-t border-border pt-4">
              {designLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <>
                  {/* Preview */}
                  <div className="rounded-lg p-4 border" style={{ backgroundColor: design.diag_cor_fundo, borderColor: design.diag_cor_card }}>
                    <div className="flex items-center gap-2 mb-2">
                      {design.diag_logo_url && <img src={design.diag_logo_url} alt="Logo" className="h-5 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />}
                      <span className="text-xs font-bold" style={{ color: design.diag_cor_primaria }}>{design.diag_nome_marca || 'MX3'}</span>
                    </div>
                    <p className="text-xs font-semibold tracking-widest uppercase" style={{ color: design.diag_cor_primaria }}>{design.diag_slogan}</p>
                    <div className="mt-3 rounded-md p-3" style={{ backgroundColor: design.diag_cor_card }}>
                      <p className="text-sm font-bold" style={{ color: design.diag_cor_texto }}>Título de exemplo</p>
                      <p className="text-xs mt-1" style={{ color: design.diag_cor_texto_muted }}>Texto secundário de exemplo</p>
                      <div className="flex gap-2 mt-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: design.diag_cor_primaria }} />
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: design.diag_cor_secundaria }} />
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: design.diag_cor_destaque }} />
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: design.diag_cor_alerta }} />
                      </div>
                    </div>
                  </div>

                  {/* Brand */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Nome da Marca</Label>
                      <Input value={design.diag_nome_marca} onChange={e => setDesign(d => ({ ...d, diag_nome_marca: e.target.value }))} className="mt-1 bg-background border-border" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Slogan / Tagline</Label>
                      <Input value={design.diag_slogan} onChange={e => setDesign(d => ({ ...d, diag_slogan: e.target.value }))} className="mt-1 bg-background border-border" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">URL do Logo (PNG transparente)</Label>
                    <Input value={design.diag_logo_url} onChange={e => setDesign(d => ({ ...d, diag_logo_url: e.target.value }))} placeholder="https://..." className="mt-1 bg-background border-border" />
                  </div>

                  {/* Colors */}
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Paleta de Cores</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {([
                      { key: 'diag_cor_fundo', label: 'Fundo' },
                      { key: 'diag_cor_card', label: 'Cards' },
                      { key: 'diag_cor_primaria', label: 'Primária (verde)' },
                      { key: 'diag_cor_secundaria', label: 'Secundária (teal)' },
                      { key: 'diag_cor_destaque', label: 'Destaque (âmbar)' },
                      { key: 'diag_cor_alerta', label: 'Alerta (vermelho)' },
                      { key: 'diag_cor_texto', label: 'Texto Principal' },
                      { key: 'diag_cor_texto_muted', label: 'Texto Secundário' },
                    ] as { key: keyof DiagDesign; label: string }[]).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2">
                        <input
                          type="color"
                          value={design[key]}
                          onChange={e => setDesign(d => ({ ...d, [key]: e.target.value }))}
                          className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                        />
                        <div>
                          <p className="text-xs text-card-foreground">{label}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{design[key]}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button onClick={handleSaveDesign} disabled={savingDesign} size="sm" className="gap-2">
                    {savingDesign ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Design
                  </Button>
                </>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <Button onClick={handleSave} className="w-full sm:w-auto gap-2">
        <Save className="w-4 h-4" />
        Salvar Configurações
      </Button>
    </div>
  );
}
