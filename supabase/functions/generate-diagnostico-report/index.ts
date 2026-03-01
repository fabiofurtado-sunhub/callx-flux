import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

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

// ─── PDF helpers ───────────────────────────────────────────────────
const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 50;
const COL_W = A4_W - MARGIN * 2;

const COLOR_DARK = rgb(8 / 255, 12 / 255, 22 / 255);
const COLOR_GREEN = rgb(0, 1, 120 / 255);
const COLOR_ORANGE = rgb(249 / 255, 115 / 255, 22 / 255);
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_GRAY = rgb(0.55, 0.6, 0.67);
const COLOR_TEXT = rgb(0.2, 0.2, 0.2);
const COLOR_LIGHT_BG = rgb(0.96, 0.97, 0.98);
const COLOR_RED = rgb(0.86, 0.15, 0.15);
const COLOR_TEAL = rgb(0, 0.82, 0.78);

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawWrappedText(page: PDFPage, text: string, font: PDFFont, size: number, x: number, startY: number, maxWidth: number, color = COLOR_TEXT, lineHeight = 1.5): number {
  const paragraphs = text.split("\n\n");
  let y = startY;
  for (const para of paragraphs) {
    const cleanPara = para.replace(/\n/g, " ").trim();
    if (!cleanPara) continue;
    const lines = wrapText(cleanPara, font, size, maxWidth);
    for (const line of lines) {
      if (y < 60) return y;
      page.drawText(line, { x, y, size, font, color });
      y -= size * lineHeight;
    }
    y -= size * 0.5; // paragraph spacing
  }
  return y;
}

function drawPageHeader(page: PDFPage, pageNum: number, title: string, fontBold: PDFFont, titleColor = COLOR_GREEN) {
  // Dark header bar
  page.drawRectangle({ x: 0, y: A4_H - 100, width: A4_W, height: 100, color: COLOR_DARK });
  page.drawText(`Página 0${pageNum}`, { x: MARGIN, y: A4_H - 40, size: 9, font: fontBold, color: COLOR_GRAY });
  page.drawText(title, { x: MARGIN, y: A4_H - 72, size: 24, font: fontBold, color: titleColor });
}

async function generatePdfBytes(data: {
  empresa: string; nome: string; nomeFirst: string; closerNome: string; dataFormatada: string;
  sumarioTexto: string; contextoTexto: string; doresParaMostrar: [string, any][];
  numDoresCriticas: number; implicacaoTexto: string; necessidadeTexto: string;
  necPerguntas: any; impPerguntas: any; fech: any; resumo: any;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const fontBoldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  // ─── PAGE 1: COVER ─────────────────────────────────────────────
  const p1 = doc.addPage([A4_W, A4_H]);
  p1.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: COLOR_DARK });

  const logoTxt = "MX3";
  const logoW = fontBold.widthOfTextAtSize(logoTxt, 48);
  p1.drawText(logoTxt, { x: (A4_W - logoW) / 2, y: A4_H - 240, size: 48, font: fontBold, color: COLOR_GREEN });

  // Accent line
  p1.drawRectangle({ x: (A4_W - 60) / 2, y: A4_H - 280, width: 60, height: 3, color: COLOR_GREEN });

  const title1 = "DIAGNÓSTICO";
  const title2 = "COMERCIAL";
  const t1w = fontBold.widthOfTextAtSize(title1, 36);
  const t2w = fontBold.widthOfTextAtSize(title2, 36);
  p1.drawText(title1, { x: (A4_W - t1w) / 2, y: A4_H - 340, size: 36, font: fontBold, color: COLOR_WHITE });
  p1.drawText(title2, { x: (A4_W - t2w) / 2, y: A4_H - 382, size: 36, font: fontBold, color: COLOR_WHITE });

  const empW = fontBold.widthOfTextAtSize(data.empresa, 24);
  p1.drawText(data.empresa, { x: (A4_W - empW) / 2, y: A4_H - 440, size: 24, font: fontBold, color: COLOR_GREEN });

  p1.drawRectangle({ x: (A4_W - 120) / 2, y: A4_H - 480, width: 120, height: 1.5, color: rgb(1, 1, 1, 0.15 as any) });

  const dateW = fontRegular.widthOfTextAtSize(data.dataFormatada, 11);
  p1.drawText(data.dataFormatada, { x: (A4_W - dateW) / 2, y: A4_H - 510, size: 11, font: fontRegular, color: COLOR_GRAY });
  const closerTxt = `Closer: ${data.closerNome}`;
  const closerW = fontRegular.widthOfTextAtSize(closerTxt, 11);
  p1.drawText(closerTxt, { x: (A4_W - closerW) / 2, y: A4_H - 528, size: 11, font: fontRegular, color: COLOR_GRAY });

  const footerTxt = "Documento confidencial — MX3 Aceleradora Comercial";
  const footerW = fontRegular.widthOfTextAtSize(footerTxt, 8);
  p1.drawText(footerTxt, { x: (A4_W - footerW) / 2, y: 40, size: 8, font: fontRegular, color: COLOR_GRAY });

  // ─── PAGE 2: SUMÁRIO EXECUTIVO ──────────────────────────────────
  const p2 = doc.addPage([A4_W, A4_H]);
  p2.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: COLOR_LIGHT_BG });
  drawPageHeader(p2, 2, "SUMÁRIO EXECUTIVO", fontBold, COLOR_GREEN);

  // Summary box
  const sumBoxY = A4_H - 130;
  p2.drawRectangle({ x: MARGIN, y: sumBoxY - 220, width: COL_W, height: 220, color: COLOR_DARK, borderColor: undefined });
  let sy = drawWrappedText(p2, data.sumarioTexto, fontRegular, 10, MARGIN + 20, sumBoxY - 20, COL_W - 40, rgb(0.8, 0.87, 0.93), 1.6);

  // KPI cards row
  const cardW = (COL_W - 30) / 3;
  const cardY = sumBoxY - 260;
  const kpis = [
    { value: `${data.numDoresCriticas || data.doresParaMostrar.length}`, label: "Dores Críticas", accent: COLOR_ORANGE },
    { value: data.impPerguntas.I5 || "—", label: "No Operacional/Sem", accent: COLOR_TEAL },
    { value: data.necPerguntas.N3 || "—", label: "Prazo Desejado", accent: COLOR_GREEN },
  ];
  kpis.forEach((k, i) => {
    const cx = MARGIN + i * (cardW + 15);
    p2.drawRectangle({ x: cx, y: cardY, width: cardW, height: 90, color: COLOR_WHITE });
    p2.drawRectangle({ x: cx, y: cardY + 86, width: cardW, height: 4, color: k.accent });
    const vW = fontBold.widthOfTextAtSize(k.value, 28);
    p2.drawText(k.value, { x: cx + (cardW - vW) / 2, y: cardY + 48, size: 28, font: fontBold, color: k.accent });
    const lW = fontRegular.widthOfTextAtSize(k.label, 8);
    p2.drawText(k.label, { x: cx + (cardW - lW) / 2, y: cardY + 18, size: 8, font: fontRegular, color: COLOR_GRAY });
  });

  // ─── PAGE 3: CONTEXTO DA OPERAÇÃO ──────────────────────────────
  const p3 = doc.addPage([A4_W, A4_H]);
  p3.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: COLOR_LIGHT_BG });
  drawPageHeader(p3, 3, "CONTEXTO DA OPERAÇÃO", fontBold, COLOR_TEAL);

  let cy = A4_H - 130;
  p3.drawRectangle({ x: MARGIN, y: cy - 180, width: COL_W, height: 180, color: COLOR_WHITE });
  cy = drawWrappedText(p3, data.contextoTexto, fontRegular, 10, MARGIN + 20, cy - 20, COL_W - 40, COLOR_TEXT, 1.6);

  // Context table
  const ctxData = [
    { label: "Vendedores", value: data.resumo.numVendedores },
    { label: "Ticket Médio", value: data.resumo.ticketMedio },
    { label: "Ciclo Médio", value: data.resumo.cicloMedio ? `${data.resumo.cicloMedio} dias` : null },
    { label: "CRM", value: data.resumo.crmAtual },
    { label: "Canal Principal", value: data.resumo.canalPrincipal },
    { label: "Playbook", value: data.resumo.temPlaybook },
  ].filter(d => d.value);

  if (ctxData.length > 0) {
    const tableY = cy - 40;
    const cellW = COL_W / ctxData.length;
    ctxData.forEach((d, i) => {
      const cx2 = MARGIN + i * cellW;
      p3.drawRectangle({ x: cx2, y: tableY, width: cellW, height: 60, color: COLOR_WHITE, borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5 });
      const lW = fontRegular.widthOfTextAtSize(d.label, 8);
      p3.drawText(d.label, { x: cx2 + (cellW - lW) / 2, y: tableY + 40, size: 8, font: fontRegular, color: COLOR_GRAY });
      const vW = fontBold.widthOfTextAtSize(String(d.value), 13);
      p3.drawText(String(d.value), { x: cx2 + (cellW - vW) / 2, y: tableY + 16, size: 13, font: fontBold, color: COLOR_DARK });
    });
  }

  // ─── PAGE 4: PONTOS CRÍTICOS ───────────────────────────────────
  const p4 = doc.addPage([A4_W, A4_H]);
  p4.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: COLOR_LIGHT_BG });
  drawPageHeader(p4, 4, "PONTOS CRÍTICOS IDENTIFICADOS", fontBold, COLOR_ORANGE);

  let dy = A4_H - 130;
  for (const [dor, val] of data.doresParaMostrar) {
    if (dy < 100) break;
    const cardH = 60;
    p4.drawRectangle({ x: MARGIN, y: dy - cardH, width: COL_W, height: cardH, color: COLOR_WHITE });
    p4.drawRectangle({ x: MARGIN, y: dy - cardH, width: 4, height: cardH, color: COLOR_ORANGE });

    // Dor name + intensity
    p4.drawText(dor, { x: MARGIN + 16, y: dy - 20, size: 11, font: fontBold, color: COLOR_DARK });
    const intTxt = `${val.intensidade}/5`;
    p4.drawText(intTxt, { x: A4_W - MARGIN - 40, y: dy - 20, size: 11, font: fontBold, color: COLOR_ORANGE });

    // Intensity bars
    for (let b = 0; b < 5; b++) {
      const bColor = b < val.intensidade ? COLOR_ORANGE : rgb(0.9, 0.9, 0.9);
      p4.drawRectangle({ x: MARGIN + 16 + b * 22, y: dy - 38, width: 18, height: 5, color: bColor });
    }

    // Impact text
    const impactText = DORES_IMPACTO[dor] || "";
    if (impactText) {
      const impLines = wrapText(impactText, fontRegular, 8, COL_W - 40);
      p4.drawText(impLines[0] || "", { x: MARGIN + 16, y: dy - 52, size: 8, font: fontItalic, color: COLOR_GRAY });
    }

    dy -= cardH + 12;
  }

  // ─── PAGE 5: IMPACTO & VISÃO ──────────────────────────────────
  const p5 = doc.addPage([A4_W, A4_H]);
  p5.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: COLOR_LIGHT_BG });
  drawPageHeader(p5, 5, "IMPACTO & VISÃO", fontBold, COLOR_WHITE);

  // "O custo de não resolver" section
  let ey = A4_H - 130;
  p5.drawText("O CUSTO DE NÃO RESOLVER", { x: MARGIN, y: ey, size: 14, font: fontBold, color: COLOR_RED });
  ey -= 24;
  ey = drawWrappedText(p5, data.implicacaoTexto, fontRegular, 10, MARGIN, ey, COL_W, COLOR_TEXT, 1.5);

  ey -= 30;
  // "O comercial que você descreveu" section
  p5.drawText("O COMERCIAL QUE VOCÊ DESCREVEU", { x: MARGIN, y: ey, size: 14, font: fontBold, color: rgb(0.02, 0.37, 0.29) });
  ey -= 24;
  if (data.necPerguntas.N2) {
    p5.drawRectangle({ x: MARGIN, y: ey - 6, width: 3, height: 18, color: rgb(0.02, 0.37, 0.29) });
    p5.drawText(`"${data.necPerguntas.N2}"`, { x: MARGIN + 12, y: ey, size: 11, font: fontBoldItalic, color: rgb(0.02, 0.37, 0.29) });
    ey -= 30;
  }
  ey = drawWrappedText(p5, data.necessidadeTexto, fontRegular, 10, MARGIN, ey, COL_W, COLOR_TEXT, 1.5);

  // ─── PAGE 6: PRÓXIMO PASSO ─────────────────────────────────────
  const p6 = doc.addPage([A4_W, A4_H]);
  p6.drawRectangle({ x: 0, y: 0, width: A4_W, height: A4_H, color: COLOR_LIGHT_BG });
  drawPageHeader(p6, 6, "PRÓXIMO PASSO", fontBold, COLOR_GREEN);

  let fy = A4_H - 150;
  p6.drawRectangle({ x: MARGIN, y: fy - 100, width: COL_W, height: 100, color: COLOR_WHITE });
  fy = drawWrappedText(p6, "Com base no diagnóstico realizado, o Revenue OS da MX3 endereça diretamente os pontos críticos identificados — com implantação estruturada e resultado mensurável.", fontRegular, 11, MARGIN + 20, fy - 20, COL_W - 40, COLOR_TEXT, 1.6);

  // Próximo contato card
  fy -= 40;
  p6.drawRectangle({ x: MARGIN, y: fy - 80, width: COL_W, height: 80, color: COLOR_DARK });
  p6.drawText("PRÓXIMO CONTATO", { x: MARGIN + 20, y: fy - 25, size: 9, font: fontRegular, color: COLOR_GRAY });
  const proxData = data.fech.dataProximoContato
    ? new Date(data.fech.dataProximoContato).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "A definir";
  p6.drawText(proxData, { x: MARGIN + 20, y: fy - 50, size: 18, font: fontBold, color: COLOR_GREEN });
  p6.drawText(`Com ${data.closerNome}`, { x: MARGIN + 20, y: fy - 70, size: 10, font: fontRegular, color: rgb(0.8, 0.87, 0.93) });

  // 3 pillars
  fy -= 140;
  const pillarW = (COL_W - 30) / 3;
  const pillars = [
    { title: "Pipeline Visível", sub: "Cada deal rastreado em tempo real", accent: COLOR_GREEN },
    { title: "Processo Replicável", sub: "Playbook que funciona com qualquer vendedor", accent: COLOR_TEAL },
    { title: "Previsibilidade", sub: "Receita projetada com base no funil real", accent: COLOR_ORANGE },
  ];
  pillars.forEach((pl, i) => {
    const px = MARGIN + i * (pillarW + 15);
    p6.drawRectangle({ x: px, y: fy, width: pillarW, height: 70, color: COLOR_WHITE });
    p6.drawRectangle({ x: px, y: fy + 66, width: pillarW, height: 4, color: pl.accent });
    p6.drawText(pl.title, { x: px + 10, y: fy + 42, size: 10, font: fontBold, color: COLOR_DARK });
    const subLines = wrapText(pl.sub, fontRegular, 8, pillarW - 20);
    subLines.forEach((l, li) => {
      p6.drawText(l, { x: px + 10, y: fy + 26 - li * 12, size: 8, font: fontRegular, color: COLOR_GRAY });
    });
  });

  // Footer
  p6.drawRectangle({ x: 0, y: 0, width: A4_W, height: 40, color: COLOR_DARK });
  const ft = "aceleradoramx3.com — Documento confidencial";
  const ftW = fontRegular.widthOfTextAtSize(ft, 8);
  p6.drawText(ft, { x: (A4_W - ftW) / 2, y: 15, size: 8, font: fontRegular, color: COLOR_GRAY });

  return await doc.save();
}

// ─── Azure token helper ─────────────────────────────────────────
async function getAzureAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
  const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" });
  const res = await fetch(tokenUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  if (!res.ok) throw new Error(`Azure token error: ${await res.text()}`);
  return (await res.json()).access_token;
}

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

    const doresCriticas = Object.entries(doresMap)
      .filter(([_, v]: any) => v.checked && v.intensidade >= 3)
      .sort((a: any, b: any) => b[1].intensidade - a[1].intensidade);
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

    const sumarioTexto = `A ${empresa}${lead.setor_empresa ? `, empresa do segmento de ${lead.setor_empresa},` : ""} opera com ${resumo.numVendedores || "—"} vendedor(es) e ticket médio de ${resumo.ticketMedio || "não informado"}. Durante o diagnóstico realizado em ${dataFormatada}, identificamos ${numDoresCriticas || doresParaMostrar.length} ponto(s) crítico(s) no processo comercial${top2Dores ? `, sendo os mais relevantes: ${top2Dores}` : ""}.\n\nO principal impacto identificado foi: "${impPerguntas.I4 || "não registrado"}". O comercial ideal descrito pelo gestor é: "${necPerguntas.N2 || "não registrado"}".\n\nEste relatório detalha os achados e aponta o caminho para transformar esse cenário em até ${necPerguntas.N3 || "prazo a definir"}.`;

    const implicacaoTexto = (() => {
      let t = `O cenário atual se mantém há ${impPerguntas.I1 || "tempo não especificado"}.`;
      if (impPerguntas.I2) t += ` Até o momento, já foram tentadas as seguintes iniciativas: ${impPerguntas.I2}.`;
      if (impPerguntas.I4) t += `\n\nNas palavras do próprio ${nomeFirst}: "${impPerguntas.I4}"`;
      t += `\n\nO tempo gasto pelo gestor no operacional comercial é de ${impPerguntas.I5 || resumo.observacoes || "não especificado"} semanais — tempo que poderia estar em estratégia, produto ou novos mercados.`;
      return t;
    })();

    const necessidadeTexto = (() => {
      let t = `Ao longo da conversa, ${nomeFirst} descreveu o comercial ideal com clareza.`;
      if (necPerguntas.N1) t += `\n\nCom o comercial funcionando de forma autônoma, o tempo seria direcionado para: ${necPerguntas.N1}.`;
      if (necPerguntas.N4) t += `\n\nO principal sinal de controle citado: "${necPerguntas.N4}".`;
      t += `\n\nO prazo definido: ${necPerguntas.N3 || "a definir"}.`;
      return t;
    })();

    // ═══ HTML REPORT (for browser preview) ═══════════════════════
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
        </div>`;
    }).join("");

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
  <div style="background:#080C16;padding:24px 50px;position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:space-between;align-items:center;">
    <img src="${LOGO_URL}" alt="MX3" style="height:28px;filter:brightness(0) invert(1);" onerror="this.outerHTML='<span style=\\'font-family:DM Sans,sans-serif;font-size:18px;font-weight:800;color:#00FF78;\\'>MX3</span>'" />
    <span style="font-size:11px;color:#556677;">aceleradoramx3.com — Documento confidencial</span>
  </div>
</div>

</body>
</html>`;

    // ═══ EMAIL WITH PDF ATTACHMENT ════════════════════════════════
    if (send_email && lead.email) {
      // Generate real PDF
      const pdfBytes = await generatePdfBytes({
        empresa, nome, nomeFirst, closerNome, dataFormatada,
        sumarioTexto, contextoTexto, doresParaMostrar: doresParaMostrar as [string, any][],
        numDoresCriticas, implicacaoTexto, necessidadeTexto,
        necPerguntas, impPerguntas, fech, resumo,
      });

      const pdfBase64 = base64Encode(pdfBytes);

      const dataProxContato = fech.dataProximoContato
        ? new Date(fech.dataProximoContato).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
        : "em breve";

      const emailBodyText = `${nomeFirst},\n\nFoi uma conversa muito boa.\n\nCumpri o que prometi: preparei o Diagnóstico Comercial da ${empresa} com base em tudo que você me contou hoje.\n\nEstá no PDF anexo. Peço que leia com calma — você vai reconhecer cada ponto.\n\nNos vemos em ${dataProxContato} para apresentar o caminho que eu enxergo para o que você descreveu.\n\nQualquer dúvida antes disso, estou no WhatsApp.\n\n${closerNome}\nMX3 Aceleradora Comercial`;

      // Format into HTML paragraphs
      const emailHtmlBody = emailBodyText
        .split(/\n{2,}/)
        .map((p: string) => `<p style="margin:0 0 16px 0;line-height:1.6;color:#333333;font-size:15px;">${p.trim()}</p>`)
        .join("")
        .replace(/\n/g, "<br/>");

      const signatureUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/assinatura-email.png`;
      const finalEmailHtml = `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333333;font-size:15px;line-height:1.6;">
          ${emailHtmlBody}
        </div>
        <div style="max-width:600px;margin:0 auto;padding:0 20px;">
          <table cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:1px solid #e0e0e0;padding-top:16px;">
            <tr><td><a href="https://aceleradoramx3.com" target="_blank"><img src="${signatureUrl}" alt="Assinatura MX3" width="600" style="max-width:100%;height:auto;display:block;" /></a></td></tr>
          </table>
        </div>`;

      const emailSubject = `Diagnóstico Comercial — ${empresa} | MX3`;

      // Get email config
      const { data: config } = await supabase.from("configuracoes").select("email_from_address, email_from_name, email_tracking_enabled").limit(1).single();
      const fromAddress = config?.email_from_address || "contato@mx3.com.br";
      const fromName = config?.email_from_name || "MX3";
      const trackingEnabled = config?.email_tracking_enabled !== false;

      // Create email log
      const { data: emailLog, error: logError } = await supabase.from("email_logs").insert({ lead_id: lead.id, assunto: emailSubject, status: "enviando" }).select("id").single();
      if (logError || !emailLog) throw new Error("Failed to create email log: " + logError?.message);

      // Add tracking pixel if enabled
      let trackedHtml = finalEmailHtml;
      if (trackingEnabled) {
        // Wrap links
        trackedHtml = trackedHtml.replace(
          /href="(https?:\/\/[^"]+)"/g,
          (_, url) => `href="${supabaseUrl}/functions/v1/email-tracking?type=click&id=${emailLog.id}&url=${encodeURIComponent(url)}"`
        );
        trackedHtml += `<img src="${supabaseUrl}/functions/v1/email-tracking?type=open&id=${emailLog.id}" width="1" height="1" style="display:none" />`;
      }

      // Send via Graph API with PDF attachment
      const accessToken = await getAzureAccessToken();
      const sanitizedEmpresa = empresa.replace(/[^a-zA-Z0-9À-ú\s-]/g, "").trim().replace(/\s+/g, "-");
      
      const graphResponse = await fetch(
        `https://graph.microsoft.com/v1.0/users/${fromAddress}/sendMail`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              subject: emailSubject,
              body: { contentType: "HTML", content: trackedHtml },
              toRecipients: [{ emailAddress: { address: lead.email } }],
              from: { emailAddress: { address: fromAddress, name: fromName } },
              attachments: [
                {
                  "@odata.type": "#microsoft.graph.fileAttachment",
                  name: `Diagnostico-Comercial-${sanitizedEmpresa}.pdf`,
                  contentType: "application/pdf",
                  contentBytes: pdfBase64,
                },
              ],
            },
            saveToSentItems: true,
          }),
        }
      );

      const status = graphResponse.ok ? "enviado" : "erro";
      let errorMessage = null;
      let responseBody: any = null;

      if (!graphResponse.ok) {
        const errBody = await graphResponse.text();
        errorMessage = errBody.substring(0, 500);
        console.error("Graph API error:", errBody);
        responseBody = { status: graphResponse.status, error: errorMessage };
      } else {
        responseBody = { status: graphResponse.status, to: lead.email, subject: emailSubject, has_attachment: true };
        console.log(`Email with PDF sent to ${lead.email} | subject: ${emailSubject}`);
      }

      await supabase.from("email_logs").update({ status, error_message: errorMessage, provider_response: responseBody }).eq("id", emailLog.id);
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
