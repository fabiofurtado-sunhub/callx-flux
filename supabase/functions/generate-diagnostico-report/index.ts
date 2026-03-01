import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

function buildDoresHtml(doresMap: Record<string, { checked: boolean; intensidade: number }>): string {
  return DORES.map(dor => {
    const d = doresMap?.[dor];
    if (!d?.checked) return '';
    const bars = Array.from({ length: 5 }, (_, i) =>
      `<span style="display:inline-block;width:24px;height:8px;border-radius:4px;margin-right:2px;background:${i < d.intensidade ? '#ff5337' : '#e0e0e0'}"></span>`
    ).join('');
    return `<tr><td style="padding:6px 12px;font-size:14px;color:#333;">${dor}</td><td style="padding:6px 12px;">${bars} <span style="font-weight:700;font-size:13px;color:#333;">${d.intensidade}/5</span></td></tr>`;
  }).filter(Boolean).join('');
}

function buildSpinSection(title: string, color: string, perguntas: Record<string, string>, questions: { id: string; text: string }[]): string {
  const rows = questions.map(q => {
    const answer = perguntas?.[q.id];
    if (!answer) return '';
    return `<tr><td style="padding:8px 12px;font-size:13px;color:#666;width:40%;vertical-align:top;border-bottom:1px solid #f0f0f0;"><strong>${q.id}</strong> — ${q.text}</td><td style="padding:8px 12px;font-size:14px;color:#333;border-bottom:1px solid #f0f0f0;">${answer}</td></tr>`;
  }).filter(Boolean).join('');
  
  if (!rows) return '';
  return `
    <div style="margin-bottom:24px;">
      <h3 style="font-size:16px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding-bottom:6px;border-bottom:3px solid ${color};">${title}</h3>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
    </div>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    const { diagnostico_id, send_email } = await req.json();

    // Fetch diagnostico + lead
    const { data: diag, error: diagErr } = await supabase
      .from("diagnosticos")
      .select("*")
      .eq("id", diagnostico_id)
      .single();
    if (diagErr || !diag) throw new Error("Diagnóstico não encontrado");

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", diag.lead_id)
      .single();
    if (leadErr || !lead) throw new Error("Lead não encontrado");

    const sit = (diag.spin_situacao as any) || {};
    const prob = (diag.spin_problema as any) || {};
    const imp = (diag.spin_implicacao as any) || {};
    const nec = (diag.spin_necessidade as any) || {};
    const fech = (diag.fechamento as any) || {};
    const neg = (diag.negociacao as any) || {};

    // Generate CEO letter via AI
    const ceoPrompt = `Você é Fabio Furtado, CEO da MX3 Aceleradora. Escreva uma carta executiva de 3-4 parágrafos para o cliente "${lead.nome}" da empresa "${lead.empresa || 'sua empresa'}".

A carta deve:
- Agradecer pela reunião de diagnóstico comercial
- Mencionar brevemente os principais desafios identificados (baseados nas dores abaixo)
- Demonstrar que a MX3 entendeu profundamente a situação
- Transmitir confiança de que há um caminho claro para resolver
- Tom: profissional, empático, executivo
- NÃO mencionar preços ou pacotes
- Usar "você" e não "Sr./Sra."

Dores identificadas: ${Object.entries(prob.doresMap || {}).filter(([_, v]: any) => v.checked).map(([k]) => k).join(', ') || 'não especificadas'}

Resumo da situação: ${JSON.stringify(sit.resumo || {})}

Retorne APENAS o texto da carta, sem saudação inicial (não coloque "Prezado..." pois já será adicionado), sem assinatura (já será adicionada). Comece direto com o conteúdo.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: ceoPrompt }],
        temperature: 0.7,
      }),
    });
    const aiData = await aiRes.json();
    const ceoLetter = aiData.choices?.[0]?.message?.content || "";

    const dataFormatada = diag.data_reuniao
      ? new Date(diag.data_reuniao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    // Build HTML report
    const reportHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap');
  body { font-family: 'Inter', sans-serif; color: #333; margin: 0; padding: 0; background: #ffffff; }
  .container { max-width: 700px; margin: 0 auto; padding: 40px 32px; }
  h1, h2, h3 { font-family: 'Space Grotesk', sans-serif; }
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>
<div class="container">
  <!-- HEADER -->
  <div style="text-align:center;padding:32px 0;border-bottom:4px solid #ff5337;">
    <div style="font-family:'Space Grotesk',sans-serif;font-size:36px;font-weight:700;color:#ff5337;letter-spacing:-1px;">MX3</div>
    <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:3px;margin-top:4px;">ACELERADORA COMERCIAL</div>
  </div>

  <!-- TITLE -->
  <div style="text-align:center;padding:32px 0;">
    <h1 style="font-size:28px;color:#111;margin:0;">Diagnóstico Comercial</h1>
    <p style="font-size:15px;color:#666;margin:8px 0 0;">
      ${lead.nome}${lead.empresa ? ` — ${lead.empresa}` : ''}<br/>
      <span style="font-size:13px;">${dataFormatada}</span>
    </p>
  </div>

  <!-- CEO LETTER -->
  <div style="background:#fafafa;border-left:4px solid #ff5337;padding:24px;margin-bottom:32px;border-radius:0 8px 8px 0;">
    <h2 style="font-size:16px;color:#111;margin:0 0 16px;">Carta do CEO</h2>
    <p style="font-size:14px;color:#555;margin:0 0 12px;">Olá, ${lead.nome.split(' ')[0]}!</p>
    ${ceoLetter.split('\n').filter((p: string) => p.trim()).map((p: string) => `<p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 12px;">${p}</p>`).join('')}
    <div style="margin-top:20px;">
      <p style="font-size:14px;color:#333;font-weight:600;margin:0;">Fabio Furtado</p>
      <p style="font-size:13px;color:#666;margin:2px 0 0;">CEO — MX3 Aceleradora</p>
    </div>
  </div>

  <!-- RESUMO DA SITUAÇÃO -->
  ${sit.resumo ? `
  <div style="margin-bottom:24px;">
    <h2 style="font-size:18px;color:#111;border-bottom:2px solid #111;padding-bottom:8px;">Resumo da Situação</h2>
    <table style="width:100%;border-collapse:collapse;">
      ${sit.resumo.numVendedores ? `<tr><td style="padding:6px 12px;font-size:13px;color:#666;width:40%;">Nº de vendedores</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#333;">${sit.resumo.numVendedores}</td></tr>` : ''}
      ${sit.resumo.ticketMedio ? `<tr><td style="padding:6px 12px;font-size:13px;color:#666;">Ticket médio</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#333;">${sit.resumo.ticketMedio}</td></tr>` : ''}
      ${sit.resumo.cicloMedio ? `<tr><td style="padding:6px 12px;font-size:13px;color:#666;">Ciclo médio</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#333;">${sit.resumo.cicloMedio} dias</td></tr>` : ''}
      ${sit.resumo.crmAtual ? `<tr><td style="padding:6px 12px;font-size:13px;color:#666;">CRM atual</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#333;">${sit.resumo.crmAtual}</td></tr>` : ''}
      ${sit.resumo.canalPrincipal ? `<tr><td style="padding:6px 12px;font-size:13px;color:#666;">Canal principal</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#333;">${sit.resumo.canalPrincipal}</td></tr>` : ''}
      ${sit.resumo.volumeLeads ? `<tr><td style="padding:6px 12px;font-size:13px;color:#666;">Volume de leads/mês</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#333;">${sit.resumo.volumeLeads}</td></tr>` : ''}
      ${sit.resumo.temPlaybook ? `<tr><td style="padding:6px 12px;font-size:13px;color:#666;">Tem playbook?</td><td style="padding:6px 12px;font-size:14px;font-weight:600;color:#333;">${sit.resumo.temPlaybook}</td></tr>` : ''}
    </table>
  </div>` : ''}

  <!-- MAPA DE DORES -->
  ${prob.doresMap ? `
  <div style="margin-bottom:24px;">
    <h2 style="font-size:18px;color:#111;border-bottom:2px solid #ff5337;padding-bottom:8px;">Mapa de Dores</h2>
    <table style="width:100%;border-collapse:collapse;">
      ${buildDoresHtml(prob.doresMap)}
    </table>
    ${prob.doresExatas ? `<div style="margin-top:12px;padding:12px;background:#fff5f3;border-radius:6px;"><p style="font-size:12px;color:#999;margin:0 0 4px;text-transform:uppercase;">Nas palavras do cliente:</p><p style="font-size:14px;color:#333;margin:0;font-style:italic;">"${prob.doresExatas}"</p></div>` : ''}
  </div>` : ''}

  <!-- SPIN SECTIONS -->
  <div class="page-break"></div>
  <h2 style="font-size:18px;color:#111;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:16px;">Diagnóstico SPIN Detalhado</h2>
  
  ${buildSpinSection('Situação', '#0d9488', sit.perguntas || {}, [
    { id: 'S1', text: 'Equipe comercial' },
    { id: 'S2', text: 'Ticket médio e ciclo' },
    { id: 'S3', text: 'Processo documentado' },
    { id: 'S4', text: 'Ferramenta de pipeline' },
    { id: 'S5', text: 'Geração de leads' },
    { id: 'S6', text: 'Tempo do gestor no operacional' },
  ])}
  
  ${buildSpinSection('Problema', '#f97316', prob.perguntas || {}, [
    { id: 'P1', text: 'Maior dificuldade comercial' },
    { id: 'P2', text: 'Meta de vendas' },
    { id: 'P3', text: 'Previsibilidade de receita' },
    { id: 'P4', text: 'Dependência de pessoas' },
    { id: 'P5', text: 'Taxa de conversão' },
    { id: 'P6', text: 'Gargalos no funil' },
  ])}
  
  ${buildSpinSection('Implicação', '#ef4444', imp.perguntas || {}, [
    { id: 'I1', text: 'Tempo do problema' },
    { id: 'I2', text: 'Impacto de previsibilidade' },
    { id: 'I3', text: 'Oportunidades perdidas' },
    { id: 'I4', text: 'Cenário em 6 meses' },
    { id: 'I5', text: 'Posicionamento competitivo' },
  ])}
  
  ${buildSpinSection('Necessidade', '#22c55e', nec.perguntas || {}, [
    { id: 'N1', text: 'Visibilidade do pipeline' },
    { id: 'N2', text: 'Comercial ideal' },
    { id: 'N3', text: 'Impacto de +10% conversão' },
    { id: 'N4', text: 'Definição de controle' },
  ])}

  <!-- FOOTER -->
  <div style="text-align:center;padding:24px 0;border-top:2px solid #f0f0f0;margin-top:32px;">
    <div style="font-family:'Space Grotesk',sans-serif;font-size:20px;font-weight:700;color:#ff5337;">MX3</div>
    <p style="font-size:12px;color:#999;margin:4px 0 0;">Aceleradora Comercial — aceleradoramx3.com</p>
    <p style="font-size:11px;color:#ccc;margin:4px 0 0;">Este relatório é confidencial e foi gerado automaticamente.</p>
  </div>
</div>
</body>
</html>`;

    // If send_email, call the send-email function
    if (send_email && lead.email) {
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: lead.id,
          to_email: lead.email,
          subject: `Diagnóstico Comercial — ${lead.empresa || lead.nome} | MX3 Aceleradora`,
          html_body: reportHtml,
        }),
      });
      const emailData = await emailRes.json();
      console.log("Email sent:", emailData);
    }

    return new Response(JSON.stringify({ success: true, html: reportHtml }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-diagnostico-report error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
