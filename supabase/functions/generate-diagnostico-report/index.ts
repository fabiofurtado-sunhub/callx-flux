import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DORES_IMPACTO: Record<string, string> = {
  "Falta de previsibilidade de receita": "Sem previsão baseada em dados, cada mês começa do zero — decisões de contratação, investimento e expansão ficam travadas.",
  "Dependência do gestor no operacional": "Quando o dono resolve o operacional, a empresa para de crescer — o teto de escala é você mesmo.",
  "Time sem processo replicável": "Sem processo único, cada vendedor reinventa a roda. Um novo contratado leva meses para performar — se performar.",
  "Pipeline invisível / desatualizado": "Sem visibilidade do funil, o gestor não sabe onde agir antes de perder o negócio.",
  "Taxa de conversão desconhecida": "Sem taxa de conversão, não há meta real — apenas sensação de bom ou ruim mês.",
  "Follow-up inconsistente": "A maioria das vendas acontece após o 5º contato. Sem cadência, esse potencial fica na mesa.",
  "Perda de leads sem diagnóstico": "Leads que saem sem motivo registrado repetem o mesmo erro indefinidamente.",
  'Meta atingida no "feeling"': "Meta sem indicador não é meta — é expectativa. E expectativa não escala.",
};

const LOGO_URL = "https://tqzrebkunvezpdeipamf.supabase.co/storage/v1/object/public/email-assets/mx3-logo.png";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { diagnostico_id, send_email } = await req.json();

    const { data: diag, error: diagErr } = await supabase.from("diagnosticos").select("*").eq("id", diagnostico_id).single();
    if (diagErr || !diag) throw new Error("Diagnóstico não encontrado");

    const { data: lead, error: leadErr } = await supabase.from("leads").select("*").eq("id", diag.lead_id).single();
    if (leadErr || !lead) throw new Error("Lead não encontrado");

    const sit = (diag.spin_situacao as any) || {};
    const prob = (diag.spin_problema as any) || {};
    const imp = (diag.spin_implicacao as any) || {};
    const nec = (diag.spin_necessidade as any) || {};
    const fech = (diag.fechamento as any) || {};
    const neg = (diag.negociacao as any) || {};
    const resumo = sit.resumo || {};
    const doresMap = prob.doresMap || {};
    const impPerguntas = imp.perguntas || {};
    const necPerguntas = nec.perguntas || {};

    const empresa = lead.empresa || lead.nome;
    const nome = lead.nome;
    const nomeFirst = nome.split(" ")[0];
    const closerNome = diag.closer_nome || "Equipe MX3";
    const dataFormatada = diag.data_reuniao
      ? new Date(diag.data_reuniao).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

    // Get critical dores (intensity >= 3), sorted desc
    const doresCriticas = Object.entries(doresMap)
      .filter(([_, v]: any) => v.checked && v.intensidade >= 3)
      .sort((a: any, b: any) => b[1].intensidade - a[1].intensidade);
    
    // Fallback: if none >= 3, show all checked
    const doresParaMostrar = doresCriticas.length > 0 ? doresCriticas : 
      Object.entries(doresMap).filter(([_, v]: any) => v.checked).sort((a: any, b: any) => b[1].intensidade - a[1].intensidade);

    const numDoresCriticas = doresCriticas.length;
    const top2Dores = doresParaMostrar.slice(0, 2).map(([k]) => k).join(" e ");

    // Build narrative blocks
    const playbookText = resumo.temPlaybook === "Não" 
      ? "o processo comercial ainda não está documentado — cada vendedor opera com seu próprio método."
      : resumo.temPlaybook === "Sim" 
      ? "existe um processo documentado, com oportunidade de padronização e escala."
      : "existe um processo parcialmente documentado, com espaço significativo para estruturação.";

    const contextoTexto = `A ${empresa} opera com ${resumo.numVendedores || "—"} vendedor(es) no time comercial, com ticket médio de ${resumo.ticketMedio || "não informado"} e ciclo médio de ${resumo.cicloMedio || "—"} dias do primeiro contato ao fechamento. O principal canal de aquisição atual é ${resumo.canalPrincipal || "não informado"}, com volume aproximado de ${resumo.volumeLeads || "—"} leads por mês.\n\nEm relação à estrutura: ${playbookText} A ferramenta de gestão atual é ${resumo.crmAtual || "não informada"}.`;

    // Sumário executivo
    const sumarioTexto = `A ${empresa}${lead.setor_empresa ? `, empresa do segmento de ${lead.setor_empresa},` : ""} opera com ${resumo.numVendedores || "—"} vendedor(es) e ticket médio de ${resumo.ticketMedio || "não informado"}. Durante o diagnóstico realizado em ${dataFormatada}, identificamos ${numDoresCriticas || doresParaMostrar.length} ponto(s) crítico(s) no processo comercial${top2Dores ? `, sendo os mais relevantes: ${top2Dores}` : ""}.\n\nO principal impacto identificado foi: "${impPerguntas.I4 || "não registrado"}". O comercial ideal descrito pelo gestor é: "${necPerguntas.N2 || "não registrado"}".\n\nEste relatório detalha os achados e aponta o caminho para transformar esse cenário em até ${necPerguntas.N3 || "prazo a definir"}.`;

    // Implicação narrative
    const implicacaoTexto = (() => {
      let t = `O cenário atual se mantém há ${impPerguntas.I1 || "tempo não especificado"}.`;
      if (impPerguntas.I2) t += ` Até o momento, já foram tentadas as seguintes iniciativas: ${impPerguntas.I2}.`;
      if (impPerguntas.I4) t += `\n\nNas palavras do próprio ${nomeFirst}: "${impPerguntas.I4}"`;
      t += `\n\nO tempo gasto pelo gestor no operacional comercial é de ${impPerguntas.I5 || resumo.observacoes || "não especificado"} semanais — tempo que poderia estar em estratégia, produto ou novos mercados.`;
      return t;
    })();

    // Necessidade narrative
    const necessidadeTexto = (() => {
      let t = `Ao longo da conversa, ${nomeFirst} descreveu o comercial ideal com clareza.`;
      if (necPerguntas.N1) t += `\n\nCom o comercial funcionando de forma autônoma, o tempo seria direcionado para: ${necPerguntas.N1}.`;
      if (necPerguntas.N4) t += `\n\nO principal sinal de controle citado: "${necPerguntas.N4}".`;
      t += `\n\nO prazo definido: ${necPerguntas.N3 || "a definir"}.`;
      return t;
    })();

    // DORES CARDS HTML
    const doresCardsHtml = doresParaMostrar.map(([dor, val]: any) => {
      const bars = Array.from({ length: 5 }, (_, i) =>
        `<div style="width:32px;height:6px;border-radius:3px;background:${i < val.intensidade ? "#F97316" : "#E5E7EB"};display:inline-block;margin-right:3px;"></div>`
      ).join("");
      return `
        <div style="background:#FFFFFF;border-left:4px solid #F97316;border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-family:'Inter',sans-serif;font-weight:700;font-size:15px;color:#1a1a2e;">${dor}</span>
            <span style="font-size:13px;font-weight:600;color:#F97316;">${val.intensidade}/5</span>
          </div>
          <div style="margin-bottom:12px;">${bars}</div>
          <p style="font-size:13px;color:#4a5568;line-height:1.6;margin:0;">${DORES_IMPACTO[dor] || ""}</p>
          ${prob.doresExatas ? `<p style="font-size:13px;color:#666;font-style:italic;margin:10px 0 0;border-top:1px solid #f0f0f0;padding-top:8px;">"${prob.doresExatas}"</p>` : ""}
        </div>`;
    }).join("");

    // CONTEXT TABLE HTML
    const contextTableData = [
      { icon: "👥", label: "Vendedores", value: resumo.numVendedores },
      { icon: "💰", label: "Ticket Médio", value: resumo.ticketMedio },
      { icon: "⏱", label: "Ciclo Médio", value: resumo.cicloMedio ? `${resumo.cicloMedio} dias` : null },
      { icon: "🔧", label: "CRM", value: resumo.crmAtual },
      { icon: "📡", label: "Canal Principal", value: resumo.canalPrincipal },
      { icon: "📋", label: "Playbook", value: resumo.temPlaybook },
    ].filter(d => d.value);

    const contextTableHtml = contextTableData.map(d => `
      <td style="padding:16px;text-align:center;border:1px solid #E5E7EB;width:${100/contextTableData.length}%;">
        <div style="font-size:24px;margin-bottom:6px;">${d.icon}</div>
        <div style="font-size:11px;color:#8899AA;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">${d.label}</div>
        <div style="font-size:16px;font-weight:700;color:#080C16;">${d.value}</div>
      </td>`).join("");

    // FULL REPORT HTML
    const reportHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Inter',sans-serif; color:#333; background:#ffffff; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
  @page { margin: 0; size: A4; }
  .page { width:210mm; min-height:297mm; margin:0 auto; position:relative; overflow:hidden; }
  @media screen { .page { box-shadow:0 0 30px rgba(0,0,0,0.1); margin-bottom:20px; } }
  @media print { .page { page-break-after:always; } .page:last-child { page-break-after:auto; } }
</style>
</head>
<body>

<!-- PAGE 1: CAPA -->
<div class="page" style="background:#080C16;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:60px 50px;">
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;">
    <img src="${LOGO_URL}" alt="MX3" style="width:180px;margin-bottom:60px;filter:brightness(0) invert(1);" onerror="this.outerHTML='<div style=\\'font-family:DM Sans,sans-serif;font-size:48px;font-weight:800;color:#00FF78;margin-bottom:60px;\\'>MX3</div>'" />
    <div style="width:60px;height:3px;background:#00FF78;margin-bottom:40px;"></div>
    <h1 style="font-family:'DM Sans',sans-serif;font-size:42px;font-weight:800;color:#FFFFFF;letter-spacing:-1px;line-height:1.1;margin-bottom:20px;">DIAGNÓSTICO<br/>COMERCIAL</h1>
    <p style="font-family:'DM Sans',sans-serif;font-size:28px;font-weight:600;color:#00FF78;margin-bottom:40px;">${empresa}</p>
    <div style="width:120px;height:2px;background:rgba(255,255,255,0.15);margin-bottom:40px;"></div>
    <p style="font-size:14px;color:#8899AA;">${dataFormatada}</p>
    <p style="font-size:14px;color:#8899AA;">Closer: ${closerNome}</p>
  </div>
  <p style="font-size:11px;color:#556677;letter-spacing:2px;text-transform:uppercase;">Documento confidencial — MX3 Aceleradora Comercial</p>
</div>

<!-- PAGE 2: SUMÁRIO EXECUTIVO -->
<div class="page" style="background:#F4F7FA;padding:0;">
  <div style="background:#080C16;padding:40px 50px 30px;">
    <p style="font-size:11px;color:#8899AA;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">Página 02</p>
    <h2 style="font-family:'DM Sans',sans-serif;font-size:32px;font-weight:700;color:#00FF78;">SUMÁRIO EXECUTIVO</h2>
  </div>
  <div style="padding:40px 50px;">
    <div style="background:linear-gradient(135deg,#080C16 0%,#0f1729 100%);border-radius:12px;padding:32px;margin-bottom:32px;">
      ${sumarioTexto.split("\n\n").map(p => `<p style="font-size:15px;color:#CCDDEE;line-height:1.8;margin-bottom:12px;">${p}</p>`).join("")}
    </div>
    <div style="display:flex;gap:20px;">
      <div style="flex:1;background:#FFFFFF;border-radius:12px;padding:28px;text-align:center;border-top:4px solid #F97316;">
        <div style="font-family:'DM Sans',sans-serif;font-size:48px;font-weight:800;color:#F97316;">${numDoresCriticas || doresParaMostrar.length}</div>
        <div style="font-size:12px;color:#8899AA;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Dores Críticas</div>
      </div>
      <div style="flex:1;background:#FFFFFF;border-radius:12px;padding:28px;text-align:center;border-top:4px solid #00D2C8;">
        <div style="font-family:'DM Sans',sans-serif;font-size:48px;font-weight:800;color:#00D2C8;">${impPerguntas.I5 || "—"}</div>
        <div style="font-size:12px;color:#8899AA;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">No Operacional/Semana</div>
      </div>
      <div style="flex:1;background:#FFFFFF;border-radius:12px;padding:28px;text-align:center;border-top:4px solid #00FF78;">
        <div style="font-family:'DM Sans',sans-serif;font-size:48px;font-weight:800;color:#00FF78;">${necPerguntas.N3 || "—"}</div>
        <div style="font-size:12px;color:#8899AA;text-transform:uppercase;letter-spacing:1px;margin-top:4px;">Prazo Desejado</div>
      </div>
    </div>
  </div>
</div>

<!-- PAGE 3: CONTEXTO DA OPERAÇÃO -->
<div class="page" style="background:#F4F7FA;padding:0;">
  <div style="background:#080C16;padding:40px 50px 30px;">
    <p style="font-size:11px;color:#8899AA;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">Página 03</p>
    <h2 style="font-family:'DM Sans',sans-serif;font-size:32px;font-weight:700;color:#00D2C8;">CONTEXTO DA OPERAÇÃO</h2>
  </div>
  <div style="padding:40px 50px;">
    <div style="background:#FFFFFF;border-radius:12px;padding:32px;margin-bottom:32px;">
      ${contextoTexto.split("\n\n").map(p => `<p style="font-size:15px;color:#333;line-height:1.8;margin-bottom:12px;">${p}</p>`).join("")}
    </div>
    <table style="width:100%;border-collapse:collapse;background:#FFFFFF;border-radius:12px;overflow:hidden;">
      <tr>${contextTableHtml}</tr>
    </table>
  </div>
</div>

<!-- PAGE 4: PONTOS CRÍTICOS -->
<div class="page" style="background:#F4F7FA;padding:0;">
  <div style="background:#080C16;padding:40px 50px 30px;">
    <p style="font-size:11px;color:#8899AA;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">Página 04</p>
    <h2 style="font-family:'DM Sans',sans-serif;font-size:32px;font-weight:700;color:#F97316;">PONTOS CRÍTICOS IDENTIFICADOS</h2>
    <p style="font-size:13px;color:#8899AA;margin-top:8px;">Ordenados por intensidade — baseado no que você relatou</p>
  </div>
  <div style="padding:40px 50px;">
    ${doresCardsHtml || '<p style="color:#8899AA;font-size:14px;">Nenhuma dor identificada no diagnóstico.</p>'}
  </div>
</div>

<!-- PAGE 5: CUSTO + VISÃO -->
<div class="page" style="background:#F4F7FA;padding:0;">
  <div style="background:#080C16;padding:40px 50px 30px;">
    <p style="font-size:11px;color:#8899AA;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">Página 05</p>
    <h2 style="font-family:'DM Sans',sans-serif;font-size:32px;font-weight:700;color:#FFFFFF;">IMPACTO <span style="color:#F97316;">&</span> VISÃO</h2>
  </div>
  <div style="padding:40px 50px;">
    <!-- O CUSTO DE NÃO RESOLVER -->
    <div style="background:#FFF5F5;border-radius:12px;padding:32px;margin-bottom:24px;">
      <h3 style="font-family:'DM Sans',sans-serif;font-size:20px;font-weight:700;color:#DC2626;margin-bottom:16px;">O CUSTO DE NÃO RESOLVER</h3>
      ${implicacaoTexto.split("\n\n").map(p => {
        if (p.startsWith("Nas palavras")) {
          return `<div style="border-left:4px solid #DC2626;padding:16px 20px;margin:16px 0;background:#FFF0F0;border-radius:0 8px 8px 0;">
            <p style="font-size:16px;color:#333;font-style:italic;line-height:1.7;margin:0;">${p}</p>
          </div>`;
        }
        return `<p style="font-size:14px;color:#4a5568;line-height:1.7;margin-bottom:10px;">${p}</p>`;
      }).join("")}
    </div>

    <!-- O COMERCIAL QUE VOCÊ DESCREVEU -->
    <div style="background:#F0FFF4;border-radius:12px;padding:32px;">
      <h3 style="font-family:'DM Sans',sans-serif;font-size:20px;font-weight:700;color:#059669;margin-bottom:16px;">O COMERCIAL QUE VOCÊ DESCREVEU</h3>
      ${necPerguntas.N2 ? `<div style="border-left:4px solid #059669;padding:16px 20px;margin:0 0 16px;background:#ECFDF5;border-radius:0 8px 8px 0;">
        <p style="font-size:18px;color:#065F46;font-style:italic;line-height:1.6;margin:0;font-weight:500;">"${necPerguntas.N2}"</p>
      </div>` : ""}
      ${necessidadeTexto.split("\n\n").map(p => `<p style="font-size:14px;color:#4a5568;line-height:1.7;margin-bottom:10px;">${p}</p>`).join("")}
    </div>
  </div>
</div>

<!-- PAGE 6: PRÓXIMOS PASSOS -->
<div class="page" style="background:#F4F7FA;padding:0;">
  <div style="background:#080C16;padding:40px 50px 30px;">
    <p style="font-size:11px;color:#8899AA;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">Página 06</p>
    <h2 style="font-family:'DM Sans',sans-serif;font-size:32px;font-weight:700;color:#00FF78;">PRÓXIMO PASSO</h2>
  </div>
  <div style="padding:40px 50px;">
    <div style="background:#FFFFFF;border-radius:12px;padding:32px;margin-bottom:32px;">
      <p style="font-size:15px;color:#333;line-height:1.8;margin-bottom:20px;">Com base no diagnóstico realizado, o <strong>Revenue OS da MX3</strong> endereça diretamente os pontos críticos identificados — com implantação estruturada e resultado mensurável.</p>
      <div style="background:linear-gradient(135deg,#080C16 0%,#0f1729 100%);border-radius:12px;padding:24px;text-align:center;">
        <p style="font-size:13px;color:#8899AA;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Próximo contato</p>
        <p style="font-size:20px;font-weight:700;color:#00FF78;">${fech.dataProximoContato ? new Date(fech.dataProximoContato).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "A definir"}</p>
        <p style="font-size:14px;color:#CCDDEE;margin-top:4px;">Com ${closerNome}</p>
      </div>
    </div>

    <div style="display:flex;gap:20px;margin-bottom:40px;">
      <div style="flex:1;background:#FFFFFF;border-radius:12px;padding:24px;text-align:center;border-top:4px solid #00FF78;">
        <div style="font-size:32px;margin-bottom:8px;">📊</div>
        <h4 style="font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;color:#080C16;margin-bottom:4px;">Pipeline Visível</h4>
        <p style="font-size:12px;color:#8899AA;">Cada deal rastreado em tempo real, sem perguntar</p>
      </div>
      <div style="flex:1;background:#FFFFFF;border-radius:12px;padding:24px;text-align:center;border-top:4px solid #00D2C8;">
        <div style="font-size:32px;margin-bottom:8px;">🔄</div>
        <h4 style="font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;color:#080C16;margin-bottom:4px;">Processo Replicável</h4>
        <p style="font-size:12px;color:#8899AA;">Playbook que funciona com qualquer vendedor</p>
      </div>
      <div style="flex:1;background:#FFFFFF;border-radius:12px;padding:24px;text-align:center;border-top:4px solid #F97316;">
        <div style="font-size:32px;margin-bottom:8px;">📈</div>
        <h4 style="font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;color:#080C16;margin-bottom:4px;">Previsibilidade</h4>
        <p style="font-size:12px;color:#8899AA;">Receita projetada com base no funil real</p>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="background:#080C16;padding:24px 50px;position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;">
    <img src="${LOGO_URL}" alt="MX3" style="height:28px;filter:brightness(0) invert(1);" onerror="this.outerHTML='<span style=\\'font-family:DM Sans,sans-serif;font-size:18px;font-weight:800;color:#00FF78;\\'>MX3</span>'" />
    <span style="font-size:11px;color:#556677;">aceleradoramx3.com — Documento confidencial</span>
  </div>
</div>

</body>
</html>`;

    // EMAIL: simple letter, not the report
    if (send_email && lead.email) {
      const dataProxContato = fech.dataProximoContato 
        ? new Date(fech.dataProximoContato).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
        : "em breve";

      const emailBody = `${nomeFirst},\n\nFoi uma conversa muito boa.\n\nCumpri o que prometi: preparei o Diagnóstico Comercial da ${empresa} com base em tudo que você me contou hoje.\n\nEstá no PDF anexo. Peço que leia com calma — você vai reconhecer cada ponto.\n\nNos vemos em ${dataProxContato} para apresentar o caminho que eu enxergo para o que você descreveu.\n\nQualquer dúvida antes disso, estou no WhatsApp.\n\n${closerNome}\nMX3 Aceleradora Comercial`;

      const emailSubject = `Diagnóstico Comercial — ${empresa} | MX3`;

      await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lead_id: lead.id,
          to_email: lead.email,
          subject: emailSubject,
          html_body: emailBody,
        }),
      });
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
