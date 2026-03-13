import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function ExportCsv() {
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .in('funil', ['playbook_mx3', 'reaquecimento'])
      .gte('faturamento', 500000)
      .then(({ count }) => setCount(count));
  }, []);

  const handleExport = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .in('funil', ['playbook_mx3', 'reaquecimento'])
      .gte('faturamento', 500000)
      .order('faturamento', { ascending: false });

    if (error || !data) {
      alert('Erro: ' + (error?.message || 'sem dados'));
      setLoading(false);
      return;
    }

    const headers = [
      'Nome', 'Telefone', 'Email', 'Empresa', 'Funil', 'Status Funil',
      'Faturamento', 'Setor Empresa', 'Porte Empresa', 'Origem',
      'Campanha', 'Adset', 'Grupo Anúncios', 'Vendedor',
      'Score', 'Probabilidade Fechamento',
      'VGV (Valor Proposta)', 'Valor Venda', 'Valor Entrada', 'Valor MRR',
      'Tomador Decisão', 'Maior Gargalo Comercial', 'Observações',
      'Tags', 'Data Entrada', 'Data Último Movimento',
      'Status WhatsApp', 'Cadência Status', 'Motivo Perda', 'Lead Time (dias)'
    ];

    const escape = (val: any) => {
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = data.map((l: any) => [
      escape(l.nome),
      escape(l.telefone),
      escape(l.email),
      escape(l.empresa),
      escape(l.funil),
      escape(l.status_funil),
      escape(l.faturamento),
      escape(l.setor_empresa),
      escape(l.porte_empresa),
      escape(l.origem),
      escape(l.campanha),
      escape(l.adset),
      escape(l.grupo_anuncios),
      escape(l.vendedor_nome),
      escape(l.score_lead),
      escape(l.probabilidade_fechamento),
      escape(l.valor_proposta),
      escape(l.valor_venda),
      escape(l.valor_entrada),
      escape(l.valor_mrr),
      escape(l.tomador_decisao),
      escape(l.maior_gargalo_comercial),
      escape(l.observacoes),
      escape(Array.isArray(l.tags) ? l.tags.join(', ') : l.tags),
      escape(l.data_entrada),
      escape(l.data_ultimo_movimento),
      escape(l.envio_whatsapp_status),
      escape(l.cadencia_status),
      escape(l.motivo_perda),
      escape(l.lead_time),
    ].join(';'));

    const bom = '\uFEFF';
    const csv = bom + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_playbook_reaquecimento_500k+_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Exportar Leads</h1>
        <p className="text-muted-foreground">
          Playbook MX3 + Reaquecimento | Faturamento ≥ R$ 500k
        </p>
        {count !== null && (
          <p className="text-lg font-semibold text-primary">{count} leads encontrados</p>
        )}
        <Button onClick={handleExport} disabled={loading} size="lg">
          <Download className="mr-2 h-5 w-5" />
          {loading ? 'Gerando...' : 'Baixar CSV'}
        </Button>
      </div>
    </div>
  );
}
