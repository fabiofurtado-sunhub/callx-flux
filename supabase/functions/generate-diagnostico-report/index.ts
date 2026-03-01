import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "https://esm.sh/pdf-lib@1.17.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://tqzrebkunvezpdeipamf.supabase.co/storage/v1/object/public/email-assets/mx3-logo.png";

// ═══════════════════════════════════════════════════════
// DORES MAPPING — Diagnóstico + Impacto + Solução Revenue OS
// ═══════════════════════════════════════════════════════
const DORES_DETAIL: Record<string, { titulo: string; diagnostico: string; impacto: string; solucao: string }> = {
  "Falta de previsibilidade de receita": {
    titulo: "Sem Previsibilidade de Receita",
    diagnostico: "Não existe um processo de pipeline estruturado. O resultado do mês é descoberto no fim do mês — não há projeção baseada em dados reais do funil.",
    impacto: "Impossibilidade de planejamento financeiro, contratação e expansão. Cada mês começa do zero.",
    solucao: "Revenue OS — Pipeline Management + Dashboard de Previsão",
  },
  "Dependência do gestor no operacional": {
    titulo: "Vendas Dependem do Gestor",
    diagnostico: "A operação comercial não tem autonomia. O time precisa do gestor para tomar decisões, negociar e fechar — o que cria um gargalo operacional e limita escala.",
    impacto: "Crescimento travado. O teto da empresa é a capacidade do gestor.",
    solucao: "Revenue OS — Playbook de Autonomia + Treinamento de Time Comercial",
  },
  "Time sem processo replicável": {
    titulo: "Time Sem Processo Único",
    diagnostico: "Cada vendedor aplica sua própria abordagem. Sem scripts, sem funil definido, sem critério de qualificação padronizado.",
    impacto: "Resultado inconsistente. O time bom vai bem; o time médio vai mal — sem caminho para desenvolvimento.",
    solucao: "Revenue OS — Playbook de Vendas + Scripts por Etapa do Funil",
  },
  "Pipeline invisível / desatualizado": {
    titulo: "Pipeline Invisível",
    diagnostico: "A empresa não tem visibilidade do pipeline em tempo real. Cada oportunidade é rastreada de forma manual ou não é rastreada — gerando perda silenciosa de negócios.",
    impacto: "O gestor não sabe onde agir antes de perder o negócio. Decisões são reativas, não proativas.",
    solucao: "Revenue OS — CRM com Pipeline Visual + Alertas Automáticos",
  },
  "Taxa de conversão desconhecida": {
    titulo: "Falta de Dados e Gestão por Métricas",
    diagnostico: "As decisões comerciais são tomadas por intuição, não por dados. Sem dashboard, sem KPIs definidos por vendedor, sem rastreamento de conversão por etapa.",
    impacto: "Impossível identificar o que está errado sem dados. Gestão às cegas.",
    solucao: "Revenue OS — Dashboard de Gestão + KPIs Individuais por Vendedor",
  },
  "Follow-up inconsistente": {
    titulo: "Atendimento Lento ao Lead",
    diagnostico: "O lead entra e demora para ser contactado. Sem automação de primeiro contato, sem cadência estruturada, sem roteamento inteligente.",
    impacto: "Taxa de conversão até 10x menor para leads contactados após 5 minutos. Leads esfriam antes do primeiro contato.",
    solucao: "Revenue OS — IA de Primeiro Contato + Automação de Follow-up",
  },
  "Perda de leads sem diagnóstico": {
    titulo: "Leads Perdidos Sem Análise",
    diagnostico: "Leads que saem do funil não têm motivo registrado. Não há aprendizado com as perdas — os mesmos erros se repetem mês após mês.",
    impacto: "A empresa repete os mesmos erros sem perceber. Cada lead perdido sem diagnóstico é uma lição desperdiçada.",
    solucao: "Revenue OS — Relatório de Motivo de Perda + Aprendizado Contínuo",
  },
  'Meta atingida no "feeling"': {
    titulo: "Metas Sem Indicadores",
    diagnostico: "A meta de vendas não é construída com base em dados históricos ou capacidade do funil. É definida por expectativa, não por planejamento — e por isso raramente é alcançada de forma consistente.",
    impacto: "Meta sem indicador não é meta — é expectativa. E expectativa não escala.",
    solucao: "Revenue OS — Meta por Indicador + Acompanhamento Semanal por Vendedor",
  },
};

// ═══════════════════════════════════════════════════════
// CÁLCULOS AUTOMÁTICOS
// ═══════════════════════════════════════════════════════

function parseNumeric(val: string | number | null | undefined): number {
  if (val == null) return 0;
  const s = String(val).replace(/[^\d.,]/g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

function parseHorasOperacional(val: string): number {
  if (!val) return 0;
  if (val.includes("Mais de 10")) return 15;
  if (val.includes("5 a 10")) return 7.5;
  if (val.includes("2 a 5")) return 3.5;
  if (val.includes("Menos de 2")) return 1;
  return 0;
}

interface IMCResult {
  score: number;
  faixa: string;
  cor: string;
  corHex: string;
}

function calcularIMC(doresMap: Record<string, any>, resumo: Record<string, any>, impPerguntas: Record<string, any>): IMCResult {
  let score = 85;

  // -10 por dor confirmada
  const doresConfirmadas = Object.values(doresMap).filter((v: any) => v?.checked).length;
  score -= doresConfirmadas * 10;

  // Ciclo > 60 dias: -10
  const ciclo = parseNumeric(resumo.cicloMedio);
  if (ciclo > 60) score -= 10;

  // < 2 vendedores: -5
  const vendedores = parseNumeric(resumo.numVendedores);
  if (vendedores > 0 && vendedores < 2) score -= 5;

  // Sem CRM: -10
  const crm = (resumo.crmAtual || "").toLowerCase().trim();
  if (!crm || crm === "não" || crm === "nenhum" || crm === "nao" || crm === "planilha" || crm === "excel") score -= 10;

  // Sem playbook (follow-up): -10
  if (resumo.temPlaybook === "Não") score -= 10;

  // Gestor no operacional (I5 >= 5h): -15
  const horas = parseHorasOperacional(impPerguntas.I5 || "");
  if (horas >= 5) score -= 15;

  score = Math.max(0, Math.min(100, score));

  let faixa: string, cor: string, corHex: string;
  if (score <= 30) { faixa = "Estrutura Inicial"; cor = "vermelho"; corHex = "#FF4455"; }
  else if (score <= 50) { faixa = "Em Desenvolvimento"; cor = "âmbar"; corHex = "#F59E0B"; }
  else if (score <= 70) { faixa = "Em Transição"; cor = "amarelo"; corHex = "#EAB308"; }
  else if (score <= 85) { faixa = "Operação Estruturada"; cor = "teal"; corHex = "#00D2C8"; }
  else { faixa = "Alta Performance"; cor = "verde"; corHex = "#00FF78"; }

  return { score, faixa, cor, corHex };
}

interface CustoStatusQuo {
  receitaPotencial: number;
  receitaAtual: number;
  perdaMensal: number;
  perdaAnual: number;
  custoTempoGestor: number;
  horasGestor: number;
}

function calcularCustoStatusQuo(resumo: Record<string, any>, impPerguntas: Record<string, any>): CustoStatusQuo {
  const ticketMedio = parseNumeric(resumo.ticketMedio) || 5000;
  const vendedores = parseNumeric(resumo.numVendedores) || 1;
  const taxaConversao = 20; // default

  const receitaPotencial = ticketMedio * vendedores * 4;
  const receitaAtual = receitaPotencial * (taxaConversao / 100);
  const perdaMensal = receitaPotencial - receitaAtual;
  const perdaAnual = perdaMensal * 12;

  const horasGestor = parseHorasOperacional(impPerguntas.I5 || "");
  const custoTempoGestor = horasGestor * 4 * 250; // R$250/h

  return { receitaPotencial, receitaAtual, perdaMensal, perdaAnual, custoTempoGestor, horasGestor };
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

// ═══════════════════════════════════════════════════════
// AI NARRATIVE GENERATION
// ═══════════════════════════════════════════════════════

async function generateNarrative(data: {
  empresa: string; nomeFirst: string; resumo: any; doresConfirmadas: string[];
  impPerguntas: any; necPerguntas: any; imc: IMCResult; custo: CustoStatusQuo;
}): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return buildFallbackNarrative(data);

  const prompt = `Você é um consultor comercial sênior da MX3 Aceleradora Comercial. 
Gere um sumário executivo narrativo profissional (150-200 palavras) para o relatório de diagnóstico comercial.

DADOS DO DIAGNÓSTICO:
- Empresa: ${data.empresa}
- Contato: ${data.nomeFirst}
- Vendedores: ${data.resumo.numVendedores || "não informado"}
- Ticket Médio: ${data.resumo.ticketMedio || "não informado"}  
- Ciclo de Venda: ${data.resumo.cicloMedio || "não informado"} dias
- CRM: ${data.resumo.crmAtual || "não informado"}
- Canal Principal: ${data.resumo.canalPrincipal || "não informado"}
- Playbook: ${data.resumo.temPlaybook || "não informado"}
- Índice de Maturidade Comercial: ${data.imc.score}/100 (${data.imc.faixa})
- Dores confirmadas: ${data.doresConfirmadas.join(", ") || "nenhuma"}
- Perda anual estimada: ${formatBRL(data.custo.perdaAnual)}
- Cenário em 6 meses (palavras do cliente): "${data.impPerguntas.I4 || "não registrado"}"
- Comercial ideal descrito: "${data.necPerguntas.N2 || "não registrado"}"

REGRAS:
- Tom: direto, diagnóstico, profissional, sem julgamento pessoal
- Estrutura: contexto → principal dor → impacto na receita → urgência de agir
- NUNCA use respostas brutas do formulário — transforme em linguagem narrativa
- Use dados reais do diagnóstico
- Fale em 3ª pessoa sobre a empresa
- Retorne APENAS o texto do sumário, sem markdown, sem título`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.trim();
    if (content && content.length > 50) return content;
  } catch (e) {
    console.error("AI narrative error:", e);
  }
  return buildFallbackNarrative(data);
}

function buildFallbackNarrative(data: any): string {
  const { empresa, resumo, doresConfirmadas, imc, custo } = data;
  const numVend = resumo.numVendedores || "equipe não dimensionada";
  const ticket = resumo.ticketMedio ? `ticket médio de ${resumo.ticketMedio}` : "ticket médio não mensurado";
  const ciclo = resumo.cicloMedio ? `ciclo de ${resumo.cicloMedio} dias` : "ciclo de venda não mensurado";
  const topDores = doresConfirmadas.slice(0, 3).map((d: string) => d.toLowerCase()).join(", ");

  return `A ${empresa} opera atualmente com ${numVend} profissional(is) de vendas, ${ticket} e ${ciclo} do primeiro contato ao fechamento. O diagnóstico revelou um Índice de Maturidade Comercial de ${imc.score}/100, classificado como "${imc.faixa}" — indicando ${imc.score <= 50 ? "fragilidade estrutural significativa na operação" : "oportunidades claras de estruturação"}.\n\nForam identificados ${doresConfirmadas.length} ponto(s) crítico(s), com destaque para: ${topDores || "aspectos gerais da operação"}. A estimativa conservadora de receita em risco aponta para ${formatBRL(custo.perdaAnual)} por ano em oportunidades não convertidas.\n\nO cenário atual exige ação imediata. Sem estruturação, a empresa continuará dependente de esforço individual e resultados imprevisíveis — comprometendo crescimento, contratação e planejamento financeiro.`;
}

// ═══════════════════════════════════════════════════════
// PDF GENERATION (for email attachment)
// ═══════════════════════════════════════════════════════

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 50;
const COL_W = A4_W - MARGIN * 2;

const C_BG = rgb(8 / 255, 12 / 255, 22 / 255);
const C_CARD = rgb(13 / 255, 24 / 255, 37 / 255);
const C_GREEN = rgb(0, 255 / 255, 120 / 255);
const C_TEAL = rgb(0, 210 / 255, 200 / 255);
const C_AMBER = rgb(245 / 255, 158 / 255, 11 / 255);
const C_RED = rgb(255 / 255, 68 / 255, 85 / 255);
const C_WHITE = rgb(1, 1, 1);
const C_GRAY = rgb(136 / 255, 153 / 255, 170 / 255);
const C_BORDER = rgb(26 / 255, 42 / 255, 58 / 255);

// Sanitize text for WinAnsi (pdf-lib standard fonts)
function sanitizePdf(text: string): string {
  return text
    .replace(/→/g, ">")
    .replace(/←/g, "<")
    .replace(/✓/g, "+")
    .replace(/✕/g, "x")
    .replace(/•/g, "-")
    .replace(/…/g, "...")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safeText = sanitizePdf(text);
  const words = safeText.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth) {
      if (cur) lines.push(cur);
      cur = w;
    } else { cur = test; }
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawText(page: PDFPage, text: string, font: PDFFont, size: number, x: number, y: number, color = C_WHITE, maxWidth?: number): number {
  const safeText = sanitizePdf(text);
  if (!maxWidth) {
    try { page.drawText(safeText, { x, y, size, font, color }); } catch(_) {}
    return y - size * 1.5;
  }
  const paragraphs = text.split("\n\n");
  let cy = y;
  for (const para of paragraphs) {
    const clean = para.replace(/\n/g, " ").trim();
    if (!clean) continue;
    const lines = wrapText(clean, font, size, maxWidth);
    for (const line of lines) {
      if (cy < 50) return cy;
      try { page.drawText(line, { x, y: cy, size, font, color }); } catch(_) {}
      cy -= size * 1.5;
    }
    cy -= size * 0.3;
  }
  return cy;
}

function drawBar(page: PDFPage, x: number, y: number, w: number, h: number, color: any) {
  page.drawRectangle({ x, y, width: w, height: h, color });
}

function drawPageBg(page: PDFPage) {
  drawBar(page, 0, 0, A4_W, A4_H, C_BG);
  drawBar(page, 0, 0, 6, A4_H, C_GREEN); // left green bar
}

function drawPageHeader(page: PDFPage, num: number, empresa: string, fontBold: PDFFont, fontReg: PDFFont) {
  // Logo text
  page.drawText("MX3", { x: MARGIN, y: A4_H - 30, size: 12, font: fontBold, color: C_GREEN });
  page.drawText("Aceleradora Comercial", { x: MARGIN + 32, y: A4_H - 30, size: 8, font: fontReg, color: C_GRAY });
  // Page number
  const pn = `${num}/6`;
  const pw = fontReg.widthOfTextAtSize(pn, 9);
  page.drawText(pn, { x: A4_W - MARGIN - pw, y: A4_H - 30, size: 9, font: fontReg, color: C_GRAY });
  // Company name center
  const ew = fontReg.widthOfTextAtSize(empresa, 8);
  page.drawText(empresa, { x: (A4_W - ew) / 2, y: A4_H - 30, size: 8, font: fontReg, color: C_GRAY });
  // Separator
  drawBar(page, MARGIN, A4_H - 40, COL_W, 0.5, C_BORDER);
}

function drawSectionTag(page: PDFPage, text: string, y: number, font: PDFFont, color: any): number {
  page.drawText(text, { x: MARGIN, y, size: 10, font, color });
  drawBar(page, MARGIN, y - 6, COL_W, 0.5, C_BORDER);
  return y - 20;
}

async function generatePdfBytes(d: {
  empresa: string; nome: string; nomeFirst: string; closerNome: string; dataFormatada: string;
  sumarioNarrativo: string; doresConfirmadas: string[]; doresMap: Record<string, any>;
  imc: IMCResult; custo: CustoStatusQuo; resumo: any;
  impPerguntas: any; necPerguntas: any; fech: any;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fR = await doc.embedFont(StandardFonts.Helvetica);
  const fB = await doc.embedFont(StandardFonts.HelveticaBold);
  const fI = await doc.embedFont(StandardFonts.HelveticaOblique);

  // ─── PAGE 1: CAPA ─────────────────────────────────
  const p1 = doc.addPage([A4_W, A4_H]);
  drawBar(p1, 0, 0, A4_W, A4_H, C_BG);
  // Radial gradient approximation
  drawBar(p1, A4_W * 0.2, A4_H * 0.3, A4_W * 0.6, A4_H * 0.4, rgb(13/255, 24/255, 37/255));
  drawBar(p1, 0, 0, A4_W, A4_H, rgb(8/255, 12/255, 22/255)); // overlay
  drawBar(p1, 0, 0, 6, A4_H, C_GREEN);

  // Top left
  p1.drawText("MX3", { x: MARGIN, y: A4_H - 40, size: 14, font: fB, color: C_GREEN });
  p1.drawText("Aceleradora Comercial", { x: MARGIN + 38, y: A4_H - 40, size: 9, font: fR, color: C_GRAY });
  // Top right date
  const dw = fR.widthOfTextAtSize(d.dataFormatada, 9);
  p1.drawText(d.dataFormatada, { x: A4_W - MARGIN - dw, y: A4_H - 40, size: 9, font: fR, color: C_GRAY });

  // Center content
  const centerY = A4_H * 0.6;
  const tagText = "DIAGNÓSTICO COMERCIAL CONFIDENCIAL";
  const tagW = fB.widthOfTextAtSize(tagText, 9);
  p1.drawText(tagText, { x: (A4_W - tagW) / 2, y: centerY + 80, size: 9, font: fB, color: C_GREEN });

  const t1 = "Relatório de";
  const t1w = fB.widthOfTextAtSize(t1, 36);
  p1.drawText(t1, { x: (A4_W - t1w) / 2, y: centerY + 40, size: 36, font: fB, color: C_WHITE });
  const t2 = "Diagnóstico Comercial";
  const t2w = fB.widthOfTextAtSize(t2, 36);
  p1.drawText(t2, { x: (A4_W - t2w) / 2, y: centerY, size: 36, font: fB, color: C_GREEN });
  const sub = "Análise estratégica da operação comercial";
  const subW = fR.widthOfTextAtSize(sub, 11);
  p1.drawText(sub, { x: (A4_W - subW) / 2, y: centerY - 30, size: 11, font: fR, color: C_GRAY });

  // Central card
  const cardW = 340;
  const cardH = 100;
  const cardX = (A4_W - cardW) / 2;
  const cardY = centerY - 170;
  drawBar(p1, cardX, cardY, cardW, cardH, C_CARD);
  drawBar(p1, cardX, cardY + cardH, cardW, 1, C_TEAL);
  
  p1.drawText(d.empresa, { x: cardX + 20, y: cardY + 75, size: 16, font: fB, color: C_WHITE });
  p1.drawText(`Responsável: ${d.nome}`, { x: cardX + 20, y: cardY + 52, size: 10, font: fR, color: C_GRAY });
  p1.drawText(`Data do diagnóstico: ${d.dataFormatada}`, { x: cardX + 20, y: cardY + 36, size: 10, font: fR, color: C_GRAY });
  p1.drawText("Prepared by: MX3 Aceleradora Comercial", { x: cardX + 20, y: cardY + 16, size: 9, font: fI, color: C_GRAY });

  // Footer
  const ft1 = `Este documento é confidencial e foi preparado exclusivamente para ${d.empresa}. Metodologia proprietária MX3®.`;
  const ft1Lines = wrapText(ft1, fR, 7, COL_W);
  ft1Lines.forEach((l, i) => {
    const lw = fR.widthOfTextAtSize(l, 7);
    p1.drawText(l, { x: (A4_W - lw) / 2, y: 50 - i * 10, size: 7, font: fR, color: C_GRAY });
  });

  // ─── PAGE 2: SUMÁRIO EXECUTIVO + IMC ──────────────
  const p2 = doc.addPage([A4_W, A4_H]);
  drawPageBg(p2);
  drawPageHeader(p2, 2, d.empresa, fB, fR);

  let y2 = A4_H - 60;
  y2 = drawSectionTag(p2, "SUMÁRIO EXECUTIVO", y2, fB, C_GREEN);

  // 3 KPI cards
  const kW = (COL_W - 20) / 3;
  const kH = 65;
  const kpis = [
    { val: String(d.doresConfirmadas.length), label: "pontos críticos\nidentificados", accent: C_GREEN },
    { val: `${d.imc.score}`, label: `IMC MX3®\n${d.imc.faixa}`, accent: d.imc.score <= 30 ? C_RED : d.imc.score <= 50 ? C_AMBER : d.imc.score <= 70 ? C_AMBER : C_TEAL },
    { val: String(d.resumo.numVendedores || "—"), label: "vendedores\nna operação", accent: C_AMBER },
  ];
  kpis.forEach((k, i) => {
    const kx = MARGIN + i * (kW + 10);
    drawBar(p2, kx, y2 - kH, kW, kH, C_CARD);
    drawBar(p2, kx, y2, kW, 3, k.accent);
    const vw = fB.widthOfTextAtSize(k.val, 28);
    p2.drawText(k.val, { x: kx + (kW - vw) / 2, y: y2 - 30, size: 28, font: fB, color: k.accent });
    const labelLines = k.label.split("\n");
    labelLines.forEach((l, li) => {
      const lw = fR.widthOfTextAtSize(l, 7);
      p2.drawText(l, { x: kx + (kW - lw) / 2, y: y2 - 48 - li * 10, size: 7, font: fR, color: C_GRAY });
    });
  });

  y2 -= kH + 20;
  // IMC gauge bar
  y2 = drawSectionTag(p2, "ÍNDICE DE MATURIDADE COMERCIAL MX3®", y2, fB, C_TEAL);
  
  const gaugeW = COL_W;
  const gaugeH = 12;
  // Background bar
  drawBar(p2, MARGIN, y2 - gaugeH, gaugeW, gaugeH, C_CARD);
  // Filled portion
  const fillW = (d.imc.score / 100) * gaugeW;
  const gaugeColor = d.imc.score <= 30 ? C_RED : d.imc.score <= 50 ? C_AMBER : d.imc.score <= 70 ? C_AMBER : d.imc.score <= 85 ? C_TEAL : C_GREEN;
  drawBar(p2, MARGIN, y2 - gaugeH, fillW, gaugeH, gaugeColor);

  y2 -= gaugeH + 15;
  const scoreText = `${d.imc.score} / 100`;
  const sw = fB.widthOfTextAtSize(scoreText, 24);
  p2.drawText(scoreText, { x: (A4_W - sw) / 2, y: y2, size: 24, font: fB, color: gaugeColor });
  y2 -= 18;
  const faixaW = fB.widthOfTextAtSize(d.imc.faixa.toUpperCase(), 10);
  p2.drawText(d.imc.faixa.toUpperCase(), { x: (A4_W - faixaW) / 2, y: y2, size: 10, font: fB, color: gaugeColor });
  y2 -= 20;
  y2 = drawText(p2, "A maturidade comercial mede o grau de estruturação, previsibilidade e independência da operação de vendas. Um score abaixo de 60 indica dependência direta do gestor para resultados — e risco operacional elevado.", fR, 8, MARGIN, y2, C_GRAY, COL_W);

  y2 -= 15;
  y2 = drawSectionTag(p2, "O QUE O DIAGNÓSTICO REVELOU", y2, fB, C_WHITE);
  y2 = drawText(p2, d.sumarioNarrativo, fR, 9, MARGIN, y2, rgb(200/255, 220/255, 238/255), COL_W);

  // ─── PAGE 3: CONTEXTO + ANÁLISE QUANTITATIVA ──────
  const p3 = doc.addPage([A4_W, A4_H]);
  drawPageBg(p3);
  drawPageHeader(p3, 3, d.empresa, fB, fR);

  let y3 = A4_H - 60;
  y3 = drawSectionTag(p3, "CONTEXTO DA OPERAÇÃO", y3, fB, C_TEAL);

  // Grid 2x2 context cards
  const cW2 = (COL_W - 10) / 2;
  const cH2 = 52;
  const ctxCards = [
    { label: "SEGMENTO / PORTE", value: d.resumo.segmento || "Não informado" },
    { label: "EQUIPE COMERCIAL", value: d.resumo.numVendedores ? `${d.resumo.numVendedores} vendedor(es)` : "Não informado" },
    { label: "TICKET MÉDIO", value: d.resumo.ticketMedio || "Não informado" },
    { label: "CICLO DE VENDA", value: d.resumo.cicloMedio ? `${d.resumo.cicloMedio} dias` : "Não informado" },
  ];
  ctxCards.forEach((c, i) => {
    const cx = MARGIN + (i % 2) * (cW2 + 10);
    const cy = y3 - Math.floor(i / 2) * (cH2 + 8) - cH2;
    drawBar(p3, cx, cy, cW2, cH2, C_CARD);
    p3.drawText(c.label, { x: cx + 12, y: cy + 36, size: 7, font: fR, color: C_GRAY });
    p3.drawText(c.value, { x: cx + 12, y: cy + 16, size: 11, font: fB, color: C_WHITE });
  });
  y3 -= 2 * (cH2 + 8) + 15;

  // Revenue analysis card
  y3 = drawSectionTag(p3, "ESTIMATIVA DE RECEITA EM RISCO — CÁLCULO CONSERVADOR", y3, fB, C_AMBER);
  drawBar(p3, MARGIN, y3 - 90, COL_W, 90, C_CARD);
  drawBar(p3, MARGIN, y3, COL_W, 2, C_AMBER);
  const revLines = [
    { label: "Receita potencial estimada (mensal)", value: formatBRL(d.custo.receitaPotencial) },
    { label: "Perda estimada por baixa conversão", value: formatBRL(d.custo.perdaMensal) },
    { label: "Impacto anual projetado", value: formatBRL(d.custo.perdaAnual) },
  ];
  revLines.forEach((r, i) => {
    const ry = y3 - 22 - i * 22;
    p3.drawText(r.label, { x: MARGIN + 15, y: ry, size: 9, font: fR, color: C_GRAY });
    const rv = fB.widthOfTextAtSize(r.value, 11);
    p3.drawText(r.value, { x: A4_W - MARGIN - 15 - rv, y: ry, size: 11, font: fB, color: i === 2 ? C_RED : C_AMBER });
  });
  y3 -= 100;
  y3 = drawText(p3, "* Estimativa baseada nos dados informados. Cálculo considera taxa de conversão média de mercado. Não representa garantia de resultado.", fR, 7, MARGIN, y3, C_GRAY, COL_W);

  // Tentativas anteriores
  y3 -= 15;
  y3 = drawSectionTag(p3, "O QUE JÁ FOI TENTADO", y3, fB, C_AMBER);
  const tentativas = d.impPerguntas.I2?.trim();
  const tentText = tentativas 
    ? `A empresa já realizou iniciativas anteriores: ${tentativas}. Porém sem resultado sustentável — o que indica que a raiz do problema é estrutural, não de esforço.`
    : "Não foram identificadas iniciativas anteriores estruturadas — a operação ainda opera de forma reativa, sem metodologia definida.";
  y3 = drawText(p3, tentText, fR, 9, MARGIN, y3, rgb(200/255, 220/255, 238/255), COL_W);

  // ─── PAGE 4: PONTOS CRÍTICOS ──────────────────────
  const p4 = doc.addPage([A4_W, A4_H]);
  drawPageBg(p4);
  drawPageHeader(p4, 4, d.empresa, fB, fR);

  let y4 = A4_H - 60;
  const numDores = d.doresConfirmadas.length;
  const severidade = numDores >= 5 ? "CRÍTICA" : numDores >= 3 ? "ALTA" : "MÉDIA";
  const sevColor = numDores >= 5 ? C_RED : numDores >= 3 ? C_AMBER : C_AMBER;
  y4 = drawSectionTag(p4, `DIAGNÓSTICO DE PONTOS CRÍTICOS — PRIORIDADE ${severidade}`, y4, fB, sevColor);

  for (const dor of d.doresConfirmadas) {
    if (y4 < 80) break;
    const detail = DORES_DETAIL[dor];
    if (!detail) continue;
    const intensidade = d.doresMap[dor]?.intensidade || 3;
    const cardHeight = 95;
    
    drawBar(p4, MARGIN, y4 - cardHeight, COL_W, cardHeight, C_CARD);
    drawBar(p4, MARGIN, y4 - cardHeight, 4, cardHeight, intensidade >= 4 ? C_RED : C_AMBER);

    // Title + priority
    p4.drawText(detail.titulo.toUpperCase(), { x: MARGIN + 16, y: y4 - 15, size: 10, font: fB, color: C_WHITE });
    const priText = `${intensidade}/5`;
    const priW = fB.widthOfTextAtSize(priText, 10);
    p4.drawText(priText, { x: A4_W - MARGIN - 15 - priW, y: y4 - 15, size: 10, font: fB, color: intensidade >= 4 ? C_RED : C_AMBER });

    // Diagnostico
    p4.drawText("DIAGNÓSTICO:", { x: MARGIN + 16, y: y4 - 32, size: 7, font: fB, color: C_GRAY });
    const diagLines = wrapText(detail.diagnostico, fR, 8, COL_W - 40);
    diagLines.slice(0, 2).forEach((l, i) => {
      p4.drawText(l, { x: MARGIN + 16, y: y4 - 42 - i * 10, size: 8, font: fR, color: rgb(180/255, 195/255, 210/255) });
    });

    // Impacto
    p4.drawText("IMPACTO:", { x: MARGIN + 16, y: y4 - 65, size: 7, font: fB, color: C_GRAY });
    const impLines = wrapText(detail.impacto, fI, 8, COL_W - 40);
    impLines.slice(0, 1).forEach((l, i) => {
      p4.drawText(l, { x: MARGIN + 16, y: y4 - 75 - i * 10, size: 8, font: fI, color: C_RED });
    });

    // Solução
    p4.drawText("SOLUÇÃO:", { x: MARGIN + 16, y: y4 - 88, size: 7, font: fB, color: C_GREEN });
    const solLines = wrapText(detail.solucao, fR, 8, COL_W * 0.5);
    solLines.slice(0, 1).forEach((l) => {
      p4.drawText(l, { x: MARGIN + 70, y: y4 - 88, size: 8, font: fR, color: C_GREEN });
    });

    y4 -= cardHeight + 8;
  }

  // ─── PAGE 5: CUSTO DO STATUS QUO + VISÃO ─────────
  const p5 = doc.addPage([A4_W, A4_H]);
  drawPageBg(p5);
  drawPageHeader(p5, 5, d.empresa, fB, fR);

  let y5 = A4_H - 60;
  y5 = drawSectionTag(p5, "O CUSTO DE CONTINUAR COMO ESTÁ", y5, fB, C_RED);

  // Big red card
  drawBar(p5, MARGIN, y5 - 100, COL_W, 100, C_CARD);
  drawBar(p5, MARGIN, y5, COL_W, 3, C_RED);
  p5.drawText("ESTIMATIVA DE RECEITA EM RISCO — POR ANO", { x: MARGIN + 15, y: y5 - 18, size: 8, font: fB, color: C_GRAY });
  const perdaText = formatBRL(d.custo.perdaAnual);
  const perdaW = fB.widthOfTextAtSize(perdaText, 32);
  p5.drawText(perdaText, { x: (A4_W - perdaW) / 2, y: y5 - 52, size: 32, font: fB, color: C_RED });
  p5.drawText("Estimativa conservadora baseada nos dados informados", { x: MARGIN + 15, y: y5 - 72, size: 8, font: fI, color: C_GRAY });

  // Detail lines
  y5 -= 110;
  const detailLines = [
    `Perda por baixa conversão: ${formatBRL(d.custo.perdaMensal)}/mês`,
    `Tempo do gestor no operacional: ~${d.custo.horasGestor}h/semana`,
    d.resumo.cicloMedio && parseNumeric(d.resumo.cicloMedio) > 30 ? `Ciclo de venda acima do ideal: +${parseNumeric(d.resumo.cicloMedio) - 30} dias por negócio` : null,
  ].filter(Boolean);
  detailLines.forEach((l, i) => {
    p5.drawText(`> ${l}`, { x: MARGIN, y: y5 - i * 14, size: 9, font: fR, color: rgb(200/255, 220/255, 238/255) });
  });
  y5 -= detailLines.length * 14 + 10;
  y5 = drawText(p5, `Este não é o problema. Este é o sintoma. O problema real é a ausência de um sistema comercial. Cada mês sem estrutura é mais ${formatBRL(d.custo.perdaMensal)} deixado na mesa.`, fI, 9, MARGIN, y5, C_RED, COL_W);

  // Antes vs Depois
  y5 -= 15;
  y5 = drawSectionTag(p5, "ANTES REVENUE OS × DEPOIS REVENUE OS", y5, fB, C_WHITE);
  const halfW = (COL_W - 10) / 2;
  const compH = 130;
  // ANTES
  drawBar(p5, MARGIN, y5 - compH, halfW, compH, rgb(40/255, 15/255, 20/255));
  p5.drawText("ANTES", { x: MARGIN + 15, y: y5 - 18, size: 10, font: fB, color: C_RED });
  d.doresConfirmadas.slice(0, 5).forEach((dor, i) => {
    const detail = DORES_DETAIL[dor];
    const short = detail?.titulo || dor;
    p5.drawText(`x ${short}`, { x: MARGIN + 15, y: y5 - 35 - i * 16, size: 8, font: fR, color: rgb(200/255, 150/255, 150/255) });
  });
  // DEPOIS
  drawBar(p5, MARGIN + halfW + 10, y5 - compH, halfW, compH, rgb(10/255, 40/255, 25/255));
  p5.drawText("DEPOIS", { x: MARGIN + halfW + 25, y: y5 - 18, size: 10, font: fB, color: C_GREEN });
  const depoisItems = [
    "Pipeline previsível e gerenciado no CRM",
    "Time autônomo com scripts e playbook",
    "Leads qualificados com processo de entrada",
    "KPIs por vendedor com reunião semanal",
    "Decisões baseadas em dados",
  ];
  depoisItems.forEach((item, i) => {
    p5.drawText(`+ ${item}`, { x: MARGIN + halfW + 25, y: y5 - 35 - i * 16, size: 8, font: fR, color: rgb(150/255, 230/255, 180/255) });
  });

  y5 -= compH + 15;
  // Visão do cliente
  y5 = drawSectionTag(p5, `O QUE ${d.empresa.toUpperCase()} QUER ALCANÇAR`, y5, fB, C_TEAL);
  if (d.necPerguntas.N2) {
    drawBar(p5, MARGIN, y5 - 4, 3, 18, C_TEAL);
    p5.drawText(`"${d.necPerguntas.N2}"`, { x: MARGIN + 12, y: y5, size: 11, font: fB, color: C_TEAL });
    y5 -= 25;
  }
  if (d.necPerguntas.N1) {
    y5 = drawText(p5, `Com o comercial funcionando de forma autônoma, o tempo seria direcionado para: ${d.necPerguntas.N1}`, fR, 9, MARGIN, y5, rgb(200/255, 220/255, 238/255), COL_W);
  }
  if (d.necPerguntas.N3) {
    y5 = drawText(p5, `A empresa tem horizonte de ${d.necPerguntas.N3} para transformação.`, fR, 9, MARGIN, y5, rgb(200/255, 220/255, 238/255), COL_W);
  }

  // ─── PAGE 6: PLANO DE AÇÃO + CTA ─────────────────
  const p6 = doc.addPage([A4_W, A4_H]);
  drawPageBg(p6);
  drawPageHeader(p6, 6, d.empresa, fB, fR);

  let y6 = A4_H - 60;
  y6 = drawSectionTag(p6, "PLANO DE AÇÃO — REVENUE OS", y6, fB, C_GREEN);

  // 3 phases
  const phaseW = (COL_W - 20) / 3;
  const phaseH = 120;
  const phases = [
    { title: "FASE 1", days: "Dias 1-10", name: "DIAGNÓSTICO & FUNDAÇÃO", color: C_TEAL, items: ["Auditoria completa", "Configuração do CRM", "Definição de ICP", "Mapeamento pipeline"] },
    { title: "FASE 2", days: "Dias 11-20", name: "PROCESSO & PLAYBOOK", color: C_GREEN, items: ["Scripts de vendas", "Playbook de objeções", "KPIs e metas", "Treinamento do time"] },
    { title: "FASE 3", days: "Dias 21-30", name: "GOVERNANÇA & AUTONOMIA", color: C_AMBER, items: ["Pipeline meetings", "Dashboard ativo", "Time independente", "Plano de continuidade"] },
  ];
  phases.forEach((ph, i) => {
    const px = MARGIN + i * (phaseW + 10);
    drawBar(p6, px, y6 - phaseH, phaseW, phaseH, C_CARD);
    drawBar(p6, px, y6, phaseW, 3, ph.color);
    p6.drawText(`${ph.title} | ${ph.days}`, { x: px + 10, y: y6 - 16, size: 7, font: fR, color: C_GRAY });
    p6.drawText(ph.name, { x: px + 10, y: y6 - 30, size: 8, font: fB, color: ph.color });
    ph.items.forEach((item, ii) => {
      p6.drawText(`> ${item}`, { x: px + 10, y: y6 - 48 - ii * 14, size: 7, font: fR, color: rgb(180/255, 195/255, 210/255) });
    });
  });
  y6 -= phaseH + 15;

  // Urgency card
  y6 = drawSectionTag(p6, "POR QUE AGIR AGORA", y6, fB, C_RED);
  y6 = drawText(p6, `Cada mês sem estrutura comercial custa a ${d.empresa} aproximadamente ${formatBRL(d.custo.perdaMensal)} em oportunidades não convertidas. Em 30 dias, o Revenue OS transforma esta operação. A pergunta não é SE vale a pena. É QUANTO CUSTA ESPERAR.`, fB, 9, MARGIN, y6, C_AMBER, COL_W);

  // CTA card
  y6 -= 15;
  y6 = drawSectionTag(p6, "PRÓXIMO PASSO", y6, fB, C_GREEN);
  const ctaItems = [
    { label: "Reunião de proposta — hoje", color: C_GREEN },
    { label: "Contrato assinado e acesso ao onboarding", color: C_TEAL },
    { label: "Diagnóstico técnico na semana 1", color: C_GREEN },
    { label: "Implementação Revenue OS — 30 dias", color: C_AMBER },
  ];
  ctaItems.forEach((item, i) => {
    p6.drawText(`${i + 1}. ${item.label}`, { x: MARGIN + 10, y: y6 - i * 16, size: 9, font: fB, color: item.color });
  });
  y6 -= ctaItems.length * 16 + 15;

  // Contact
  p6.drawText("Fabio Furtado — CEO & Fundador MX3", { x: MARGIN, y: y6, size: 9, font: fB, color: C_WHITE });
  y6 -= 14;
  p6.drawText("aceleradoramx3.com  |  @mx3aceleradora", { x: MARGIN, y: y6, size: 8, font: fR, color: C_GRAY });
  y6 -= 18;

  // Authority chips
  const chips = ["8 anos de mercado", "+6.000 empresários mentorados", "R$600M+ em vendas geradas"];
  let chipX = MARGIN;
  chips.forEach((chip) => {
    const cw = fR.widthOfTextAtSize(chip, 7) + 16;
    drawBar(p6, chipX, y6 - 3, cw, 16, C_CARD);
    p6.drawText(chip, { x: chipX + 8, y: y6, size: 7, font: fR, color: C_GREEN });
    chipX += cw + 8;
  });

  // Footer
  drawBar(p6, 0, 0, A4_W, 35, C_CARD);
  const footerText = "MX3 Aceleradora Comercial® — Diagnóstico Confidencial";
  const ftw = fR.widthOfTextAtSize(footerText, 7);
  p6.drawText(footerText, { x: (A4_W - ftw) / 2, y: 14, size: 7, font: fR, color: C_GRAY });

  return await doc.save();
}

// ═══════════════════════════════════════════════════════
// HTML REPORT — 6 pages, dark theme, all-dark
// ═══════════════════════════════════════════════════════

function buildHtmlReport(d: {
  empresa: string; nome: string; nomeFirst: string; closerNome: string; dataFormatada: string;
  sumarioNarrativo: string; doresConfirmadas: string[]; doresMap: Record<string, any>;
  imc: IMCResult; custo: CustoStatusQuo; resumo: any;
  impPerguntas: any; necPerguntas: any; fech: any; setor: string;
  ds: { bg: string; primary: string; secondary: string; accent: string; alert: string; card: string; text: string; muted: string; logoUrl: string; brand: string; slogan: string };
}): string {
  const c = d.ds; // design settings shorthand
  const borderColor = "#1A2A3A";
  const textBody = "#CCDDEE";
  const textDim = "#556677";
  const logoSrc = c.logoUrl || LOGO_URL;
  const brandShort = c.brand.split(" ")[0] || "MX3";

  const tentativas = d.impPerguntas.I2?.trim();
  const tentText = tentativas
    ? `A empresa já realizou iniciativas anteriores: ${tentativas}. Porém sem resultado sustentável — o que indica que a raiz do problema é estrutural, não de esforço.`
    : "Não foram identificadas iniciativas anteriores estruturadas — a operação ainda opera de forma reativa, sem metodologia definida.";

  const numDores = d.doresConfirmadas.length;
  const severidade = numDores >= 5 ? "CRÍTICA" : numDores >= 3 ? "ALTA" : "MÉDIA";
  const sevHex = numDores >= 5 ? c.alert : c.accent;

  const doresCardsHtml = d.doresConfirmadas.map(dor => {
    const detail = DORES_DETAIL[dor];
    if (!detail) return "";
    const intensidade = d.doresMap[dor]?.intensidade || 3;
    const barColor = intensidade >= 4 ? c.alert : c.accent;
    const bars = Array.from({ length: 5 }, (_, i) =>
      `<div style="width:28px;height:5px;border-radius:3px;background:${i < intensidade ? barColor : borderColor};display:inline-block;margin-right:3px;"></div>`
    ).join("");
    return `
      <div style="background:${c.card};border-left:4px solid ${barColor};border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="font-weight:700;font-size:14px;color:${c.text};text-transform:uppercase;letter-spacing:1px;">${detail.titulo}</span>
          <span style="font-size:12px;font-weight:700;color:${barColor};">${intensidade}/5</span>
        </div>
        <div style="margin-bottom:10px;">${bars}</div>
        <div style="margin-bottom:8px;"><span style="font-size:10px;color:${c.muted};font-weight:700;letter-spacing:1px;">DIAGNÓSTICO:</span><p style="font-size:13px;color:${textBody};line-height:1.6;margin:4px 0 0;">${detail.diagnostico}</p></div>
        <div style="margin-bottom:8px;"><span style="font-size:10px;color:${c.muted};font-weight:700;letter-spacing:1px;">IMPACTO:</span><p style="font-size:13px;color:${c.alert};line-height:1.5;margin:4px 0 0;font-style:italic;">${detail.impacto}</p></div>
        <div><span style="font-size:10px;color:${c.muted};font-weight:700;letter-spacing:1px;">SOLUÇÃO REVENUE OS:</span><p style="font-size:13px;color:${c.primary};line-height:1.5;margin:4px 0 0;">${detail.solucao}</p></div>
      </div>`;
  }).join("");

  const gaugePercent = d.imc.score;
  const gaugeColor = d.imc.score <= 30 ? c.alert : d.imc.score <= 50 ? c.accent : d.imc.score <= 70 ? "#EAB308" : d.imc.score <= 85 ? c.secondary : c.primary;

  const pageStyle = `width:210mm;min-height:297mm;margin:0 auto;position:relative;overflow:hidden;background:${c.bg};`;
  const headerHtml = (num: number) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:20px 50px;border-bottom:1px solid ${borderColor};">
      <div style="display:flex;align-items:center;gap:8px;">
        <img src="${logoSrc}" alt="${brandShort}" style="height:22px;filter:brightness(0) invert(1);" onerror="this.outerHTML='<span style=\\'font-size:14px;font-weight:800;color:${c.primary};\\'>MX3</span>'" />
        <span style="font-size:9px;color:${c.muted};">${c.brand}</span>
      </div>
      <span style="font-size:8px;color:${c.muted};">${d.empresa}</span>
      <span style="font-size:9px;color:${c.muted};">${num}/6</span>
    </div>`;

  const sectionTag = (text: string, color: string) => `
    <div style="margin-bottom:20px;">
      <span style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:3px;">${text}</span>
      <div style="height:1px;background:${borderColor};margin-top:8px;"></div>
    </div>`;

  const depoisItems = [
    "Pipeline previsível e gerenciado no CRM",
    "Time autônomo com scripts e playbook",
    "Leads qualificados com processo de entrada",
    "KPIs por vendedor com reunião semanal",
    "Decisões baseadas em dados, não em intuição",
  ];

  let visaoHtml = "";
  if (d.necPerguntas.N2) {
    visaoHtml += `<div style="border-left:4px solid ${c.secondary};padding:12px 20px;margin-bottom:16px;background:rgba(0,210,200,0.05);border-radius:0 8px 8px 0;">
      <p style="font-size:18px;color:${c.secondary};font-weight:600;font-style:italic;margin:0;">"${d.necPerguntas.N2}"</p>
    </div>`;
  }
  if (d.necPerguntas.N1) {
    visaoHtml += `<p style="font-size:14px;color:${textBody};line-height:1.7;margin-bottom:10px;">Com o comercial funcionando de forma autônoma, o tempo seria direcionado para: ${d.necPerguntas.N1}.</p>`;
  }
  if (d.necPerguntas.N3) {
    visaoHtml += `<p style="font-size:14px;color:${textBody};line-height:1.7;margin-bottom:10px;">A empresa tem horizonte de <strong style="color:${c.secondary};">${d.necPerguntas.N3}</strong> para transformação.</p>`;
  }
  if (d.necPerguntas.N4) {
    visaoHtml += `<p style="font-size:14px;color:${textBody};line-height:1.7;">A liderança demonstrou comprometimento: o principal sinal de controle citado foi "<em>${d.necPerguntas.N4}</em>".</p>`;
  }
  if (!visaoHtml) {
    visaoHtml = `<p style="font-size:14px;color:${textBody};line-height:1.7;">Com base nas dores identificadas, uma operação saudável significaria previsibilidade de receita, time autônomo e decisões baseadas em dados — com o gestor focado em estratégia, não no operacional.</p>`;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',sans-serif;color:${textBody};background:${c.bg};-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
@page{margin:0;size:A4;}
.page{${pageStyle}}
@media screen{.page{box-shadow:0 0 40px rgba(0,255,120,0.05);margin-bottom:20px;}}
@media print{.page{page-break-after:always;}.page:last-child{page-break-after:auto;}}
</style></head><body>

<!-- PAGE 1: CAPA -->
<div class="page" style="display:flex;flex-direction:column;padding:0;border-left:6px solid ${c.primary};">
  <div style="display:flex;justify-content:space-between;padding:24px 50px;">
    <div style="display:flex;align-items:center;gap:8px;">
      <img src="${logoSrc}" alt="${brandShort}" style="height:24px;filter:brightness(0) invert(1);" onerror="this.outerHTML='<span style=\\'font-size:16px;font-weight:800;color:${c.primary};\\'>MX3</span>'" />
      <span style="font-size:10px;color:${c.muted};">${c.brand}</span>
    </div>
    <span style="font-size:10px;color:${c.muted};">${d.dataFormatada}</span>
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 60px;">
    <span style="font-size:10px;font-weight:700;color:${c.primary};letter-spacing:4px;text-transform:uppercase;margin-bottom:40px;">${c.slogan.toUpperCase()}</span>
    <h1 style="font-family:'DM Sans',sans-serif;font-size:52px;font-weight:800;color:${c.text};line-height:1.1;margin-bottom:8px;">Relatório de</h1>
    <h1 style="font-family:'DM Sans',sans-serif;font-size:52px;font-weight:800;color:${c.primary};line-height:1.1;margin-bottom:20px;">Diagnóstico Comercial</h1>
    <p style="font-size:14px;color:${c.muted};margin-bottom:50px;">Análise estratégica da operação comercial</p>
    <div style="background:${c.card};border:1px solid ${c.secondary};border-radius:12px;padding:28px 36px;text-align:left;max-width:420px;width:100%;">
      <p style="font-family:'DM Sans',sans-serif;font-size:20px;font-weight:700;color:${c.text};margin-bottom:12px;">${d.empresa}</p>
      <p style="font-size:13px;color:${c.muted};margin-bottom:4px;">Responsável: <strong style="color:${textBody};">${d.nome}</strong></p>
      <p style="font-size:13px;color:${c.muted};margin-bottom:4px;">Data do diagnóstico: <strong style="color:${textBody};">${d.dataFormatada}</strong></p>
      <p style="font-size:12px;color:${c.muted};margin-top:8px;font-style:italic;">Prepared by: ${c.brand}</p>
    </div>
  </div>
  <div style="padding:20px 50px;text-align:center;">
    <p style="font-size:10px;color:${textDim};">Este documento é confidencial e foi preparado exclusivamente para ${d.empresa}. Metodologia proprietária MX3®.</p>
  </div>
</div>

<!-- PAGE 2: SUMÁRIO EXECUTIVO + IMC -->
<div class="page" style="border-left:6px solid ${c.primary};padding:0;">
  ${headerHtml(2)}
  <div style="padding:30px 50px;">
    ${sectionTag("SUMÁRIO EXECUTIVO", c.primary)}
    <div style="display:flex;gap:16px;margin-bottom:24px;">
      <div style="flex:1;background:${c.card};border-radius:10px;padding:20px;text-align:center;border-top:3px solid ${c.primary};">
        <div style="font-family:'DM Sans',sans-serif;font-size:42px;font-weight:800;color:${c.primary};">${numDores}</div>
        <div style="font-size:11px;color:${c.muted};margin-top:4px;">pontos críticos identificados</div>
      </div>
      <div style="flex:1;background:${c.card};border-radius:10px;padding:20px;text-align:center;border-top:3px solid ${gaugeColor};">
        <div style="font-family:'DM Sans',sans-serif;font-size:42px;font-weight:800;color:${gaugeColor};">${d.imc.score}</div>
        <div style="font-size:11px;color:${c.muted};margin-top:4px;">Índice de Maturidade Comercial MX3®</div>
        <div style="font-size:10px;font-weight:700;color:${gaugeColor};margin-top:2px;">${d.imc.faixa}</div>
      </div>
      <div style="flex:1;background:${c.card};border-radius:10px;padding:20px;text-align:center;border-top:3px solid ${c.accent};">
        <div style="font-family:'DM Sans',sans-serif;font-size:42px;font-weight:800;color:${c.accent};">${d.resumo.numVendedores || "—"}</div>
        <div style="font-size:11px;color:${c.muted};margin-top:4px;">vendedores na operação</div>
      </div>
    </div>
    ${sectionTag("ÍNDICE DE MATURIDADE COMERCIAL MX3®", c.secondary)}
    <div style="background:${c.card};border-radius:10px;padding:24px;margin-bottom:24px;">
      <div style="background:${borderColor};border-radius:6px;height:16px;overflow:hidden;margin-bottom:16px;">
        <div style="width:${gaugePercent}%;height:100%;background:linear-gradient(90deg,${c.alert},${c.accent},${c.secondary},${c.primary});border-radius:6px;"></div>
      </div>
      <div style="text-align:center;margin-bottom:12px;">
        <span style="font-family:'DM Sans',sans-serif;font-size:36px;font-weight:800;color:${gaugeColor};">${d.imc.score} / 100</span><br/>
        <span style="font-size:13px;font-weight:700;color:${gaugeColor};letter-spacing:2px;">${d.imc.faixa.toUpperCase()}</span>
      </div>
      <p style="font-size:12px;color:${c.muted};line-height:1.6;text-align:center;">A maturidade comercial mede o grau de estruturação, previsibilidade e independência da operação de vendas. Um score abaixo de 60 indica dependência direta do gestor para resultados — e risco operacional elevado.</p>
    </div>
    ${sectionTag("O QUE O DIAGNÓSTICO REVELOU", c.text)}
    <div style="background:${c.card};border-radius:10px;padding:24px;">
      ${d.sumarioNarrativo.split("\n\n").map(p => `<p style="font-size:14px;color:${textBody};line-height:1.8;margin-bottom:10px;">${p}</p>`).join("")}
    </div>
  </div>
</div>

<!-- PAGE 3: CONTEXTO + ANÁLISE QUANTITATIVA -->
<div class="page" style="border-left:6px solid ${c.primary};padding:0;">
  ${headerHtml(3)}
  <div style="padding:30px 50px;">
    ${sectionTag("CONTEXTO DA OPERAÇÃO", c.secondary)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:24px;">
      ${[
        { label: "SEGMENTO / PORTE", value: d.setor || "Não informado" },
        { label: "EQUIPE COMERCIAL", value: d.resumo.numVendedores ? `${d.resumo.numVendedores} profissional(is) de vendas` : "Não informado" },
        { label: "TICKET MÉDIO", value: d.resumo.ticketMedio ? `${d.resumo.ticketMedio}` : "Não informado" },
        { label: "CICLO DE VENDA", value: d.resumo.cicloMedio ? `${d.resumo.cicloMedio} dias` : "Não informado" },
      ].map(ci => `
        <div style="background:${c.card};border-radius:8px;padding:18px;">
          <span style="font-size:9px;color:${c.muted};text-transform:uppercase;letter-spacing:2px;">${ci.label}</span>
          <p style="font-size:15px;font-weight:700;color:${c.text};margin-top:6px;">${ci.value}</p>
        </div>`).join("")}
    </div>
    ${sectionTag("ESTIMATIVA DE RECEITA EM RISCO — CÁLCULO CONSERVADOR", c.accent)}
    <div style="background:${c.card};border-radius:10px;padding:24px;border-top:3px solid ${c.accent};margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr style="border-bottom:1px solid ${borderColor};"><td style="padding:10px 0;font-size:13px;color:${c.muted};">Receita potencial estimada (mensal)</td><td style="padding:10px 0;text-align:right;font-size:15px;font-weight:700;color:${c.accent};">${formatBRL(d.custo.receitaPotencial)}</td></tr>
        <tr style="border-bottom:1px solid ${borderColor};"><td style="padding:10px 0;font-size:13px;color:${c.muted};">Perda estimada por baixa conversão</td><td style="padding:10px 0;text-align:right;font-size:15px;font-weight:700;color:${c.accent};">${formatBRL(d.custo.perdaMensal)}</td></tr>
        <tr><td style="padding:10px 0;font-size:13px;color:${c.muted};">Impacto anual projetado</td><td style="padding:10px 0;text-align:right;font-size:18px;font-weight:800;color:${c.alert};">${formatBRL(d.custo.perdaAnual)}</td></tr>
      </table>
      <p style="font-size:10px;color:${textDim};margin-top:12px;font-style:italic;">* Estimativa baseada nos dados informados. Cálculo considera taxa de conversão média de mercado. Não representa garantia de resultado.</p>
    </div>
    ${sectionTag("O QUE JÁ FOI TENTADO", c.accent)}
    <div style="background:${c.card};border:1px solid ${borderColor};border-radius:10px;padding:24px;">
      <p style="font-size:14px;color:${textBody};line-height:1.7;">${tentText}</p>
    </div>
  </div>
</div>

<!-- PAGE 4: PONTOS CRÍTICOS -->
<div class="page" style="border-left:6px solid ${c.primary};padding:0;">
  ${headerHtml(4)}
  <div style="padding:30px 50px;">
    ${sectionTag(`DIAGNÓSTICO DE PONTOS CRÍTICOS — PRIORIDADE ${severidade}`, sevHex)}
    ${doresCardsHtml || `<p style="color:${c.muted};font-size:14px;">Nenhuma dor identificada no diagnóstico.</p>`}
  </div>
</div>

<!-- PAGE 5: CUSTO DO STATUS QUO + VISÃO -->
<div class="page" style="border-left:6px solid ${c.primary};padding:0;">
  ${headerHtml(5)}
  <div style="padding:30px 50px;">
    ${sectionTag("O CUSTO DE CONTINUAR COMO ESTÁ", c.alert)}
    <div style="background:${c.card};border-radius:10px;padding:28px;border-top:3px solid ${c.alert};margin-bottom:24px;text-align:center;">
      <p style="font-size:10px;color:${c.muted};text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Estimativa de Receita em Risco — por Ano</p>
      <p style="font-family:'DM Sans',sans-serif;font-size:44px;font-weight:800;color:${c.alert};margin-bottom:8px;">${formatBRL(d.custo.perdaAnual)}</p>
      <p style="font-size:12px;color:${c.muted};font-style:italic;margin-bottom:16px;">Estimativa conservadora baseada nos dados informados</p>
      <div style="text-align:left;">
        <p style="font-size:13px;color:${textBody};margin-bottom:6px;">> Perda por baixa conversão: <strong>${formatBRL(d.custo.perdaMensal)}/mês</strong></p>
        <p style="font-size:13px;color:${textBody};margin-bottom:6px;">> Tempo do gestor no operacional: <strong>~${d.custo.horasGestor}h/semana</strong> (custo estimado: ${formatBRL(d.custo.custoTempoGestor)}/mês)</p>
        ${d.resumo.cicloMedio && parseNumeric(d.resumo.cicloMedio) > 30 ? `<p style="font-size:13px;color:${textBody};margin-bottom:6px;">> Ciclo de venda acima do ideal: <strong>+${parseNumeric(d.resumo.cicloMedio) - 30} dias por negócio</strong></p>` : ""}
      </div>
      <p style="font-size:13px;color:${c.alert};font-style:italic;margin-top:16px;line-height:1.6;">Este não é o problema. Este é o sintoma. O problema real é a ausência de um sistema comercial. Cada mês sem estrutura é mais ${formatBRL(d.custo.perdaMensal)} deixado na mesa.</p>
    </div>

    ${sectionTag("ANTES REVENUE OS × DEPOIS REVENUE OS", c.text)}
    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:rgba(255,68,85,0.08);border:1px solid rgba(255,68,85,0.2);border-radius:10px;padding:20px;">
        <p style="font-size:12px;font-weight:700;color:${c.alert};margin-bottom:12px;">x ANTES</p>
        ${d.doresConfirmadas.slice(0, 5).map(dor => {
          const detail = DORES_DETAIL[dor];
          return `<p style="font-size:12px;color:rgba(255,150,150,0.9);margin-bottom:6px;">x ${detail?.titulo || dor}</p>`;
        }).join("")}
      </div>
      <div style="flex:1;background:rgba(0,255,120,0.05);border:1px solid rgba(0,255,120,0.15);border-radius:10px;padding:20px;">
        <p style="font-size:12px;font-weight:700;color:${c.primary};margin-bottom:12px;">+ DEPOIS</p>
        ${depoisItems.map(item => `<p style="font-size:12px;color:rgba(150,230,180,0.9);margin-bottom:6px;">+ ${item}</p>`).join("")}
      </div>
    </div>

    ${sectionTag(`O QUE ${d.empresa.toUpperCase()} QUER ALCANÇAR`, c.secondary)}
    <div style="background:${c.card};border-radius:10px;padding:24px;">
      ${visaoHtml}
    </div>
  </div>
</div>

<!-- PAGE 6: PLANO DE AÇÃO + CTA -->
<div class="page" style="border-left:6px solid ${c.primary};padding:0;">
  ${headerHtml(6)}
  <div style="padding:30px 50px;">
    ${sectionTag("PLANO DE AÇÃO — REVENUE OS", c.primary)}
    <p style="font-size:11px;color:${c.muted};margin-bottom:16px;">O que será implementado em 30 dias:</p>
    <div style="display:flex;gap:12px;margin-bottom:24px;">
      ${[
        { title: "FASE 1", days: "Dias 1-10", name: "DIAGNÓSTICO & FUNDAÇÃO", color: c.secondary, items: ["Auditoria completa da operação comercial", "Configuração e customização do CRM", "Definição de ICP, personas e qualificação", "Mapeamento do pipeline atual"] },
        { title: "FASE 2", days: "Dias 11-20", name: "PROCESSO & PLAYBOOK", color: c.primary, items: ["Scripts de vendas por etapa do funil", "Playbook de objeções customizado", "KPIs e metas individuais por vendedor", "Treinamento do time comercial"] },
        { title: "FASE 3", days: "Dias 21-30", name: "GOVERNANÇA & AUTONOMIA", color: c.accent, items: ["Reuniões de pipeline semanais", "Dashboard de gestão ativo", "Time operando de forma independente", "Entrega + plano de continuidade"] },
      ].map(ph => `
        <div style="flex:1;background:${c.card};border-radius:10px;padding:18px;border-top:3px solid ${ph.color};">
          <p style="font-size:9px;color:${c.muted};margin-bottom:4px;">${ph.title} | ${ph.days}</p>
          <p style="font-size:11px;font-weight:700;color:${ph.color};margin-bottom:10px;">${ph.name}</p>
          ${ph.items.map(item => `<p style="font-size:11px;color:${textBody};margin-bottom:5px;">> ${item}</p>`).join("")}
        </div>`).join("")}
    </div>

    ${sectionTag("POR QUE AGIR AGORA", c.alert)}
    <div style="background:${c.card};border:1px solid rgba(255,68,85,0.2);border-radius:10px;padding:24px;margin-bottom:24px;">
      <p style="font-size:14px;color:${c.accent};font-weight:600;line-height:1.7;">Cada mês sem estrutura comercial custa a ${d.empresa} aproximadamente <strong style="color:${c.alert};">${formatBRL(d.custo.perdaMensal)}</strong> em oportunidades não convertidas. Em 30 dias, o Revenue OS transforma esta operação. A pergunta não é SE vale a pena. É QUANTO CUSTA ESPERAR.</p>
    </div>

    ${sectionTag("PRÓXIMO PASSO", c.primary)}
    <div style="background:${c.card};border:1px solid rgba(0,255,120,0.2);border-radius:10px;padding:24px;margin-bottom:24px;">
      <div style="margin-bottom:16px;">
        <p style="font-size:13px;color:${c.primary};font-weight:700;margin-bottom:6px;">1. Reunião de proposta — hoje</p>
        <p style="font-size:13px;color:${c.secondary};font-weight:700;margin-bottom:6px;">2. Contrato assinado e acesso ao onboarding</p>
        <p style="font-size:13px;color:${c.primary};font-weight:700;margin-bottom:6px;">3. Diagnóstico técnico na semana 1</p>
        <p style="font-size:13px;color:${c.accent};font-weight:700;">4. Implementação Revenue OS — 30 dias</p>
      </div>
      <div style="border-top:1px solid ${borderColor};padding-top:16px;">
        <p style="font-size:14px;font-weight:700;color:${c.text};">Fabio Furtado — CEO & Fundador MX3</p>
        <p style="font-size:12px;color:${c.muted};">aceleradoramx3.com  |  @mx3aceleradora</p>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <span style="background:${c.card};border:1px solid ${borderColor};border-radius:20px;padding:5px 14px;font-size:10px;color:${c.primary};">8 anos de mercado</span>
        <span style="background:${c.card};border:1px solid ${borderColor};border-radius:20px;padding:5px 14px;font-size:10px;color:${c.primary};">+6.000 empresários mentorados</span>
        <span style="background:${c.card};border:1px solid ${borderColor};border-radius:20px;padding:5px 14px;font-size:10px;color:${c.primary};">R$600M+ em vendas geradas</span>
      </div>
    </div>
  </div>
  <div style="background:${c.card};padding:16px 50px;position:absolute;bottom:0;left:6px;right:0;display:flex;justify-content:space-between;align-items:center;">
    <img src="${logoSrc}" alt="${brandShort}" style="height:20px;filter:brightness(0) invert(1);" onerror="this.outerHTML='<span style=\\'font-size:14px;font-weight:800;color:${c.primary};\\'>MX3</span>'" />
    <span style="font-size:9px;color:${textDim};">${c.brand}® — ${c.slogan}</span>
  </div>
</div>

</body></html>`;
}

// ═══════════════════════════════════════════════════════
// Azure token helper
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════

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

    // Fetch design settings
    const { data: configDesign } = await supabase.from("configuracoes").select("diag_cor_fundo, diag_cor_primaria, diag_cor_secundaria, diag_cor_destaque, diag_cor_alerta, diag_cor_card, diag_cor_texto, diag_cor_texto_muted, diag_logo_url, diag_nome_marca, diag_slogan").limit(1).single();
    const ds = {
      bg: configDesign?.diag_cor_fundo || "#080C16",
      primary: configDesign?.diag_cor_primaria || "#00FF78",
      secondary: configDesign?.diag_cor_secundaria || "#00D2C8",
      accent: configDesign?.diag_cor_destaque || "#F59E0B",
      alert: configDesign?.diag_cor_alerta || "#FF4455",
      card: configDesign?.diag_cor_card || "#0D1825",
      text: configDesign?.diag_cor_texto || "#FFFFFF",
      muted: configDesign?.diag_cor_texto_muted || "#8899AA",
      logoUrl: configDesign?.diag_logo_url || LOGO_URL,
      brand: configDesign?.diag_nome_marca || "MX3 Aceleradora Comercial",
      slogan: configDesign?.diag_slogan || "Diagnóstico Comercial Confidencial",
    };

    const sit = (diag.spin_situacao as any) || {};
    const prob = (diag.spin_problema as any) || {};
    const imp = (diag.spin_implicacao as any) || {};
    const nec = (diag.spin_necessidade as any) || {};
    const fech = (diag.fechamento as any) || {};
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

    // Confirmed dores (checked = true), sorted by intensity
    const doresConfirmadas = Object.entries(doresMap)
      .filter(([_, v]: any) => v?.checked)
      .sort((a: any, b: any) => b[1].intensidade - a[1].intensidade)
      .map(([k]) => k);

    // Calculate IMC
    const imc = calcularIMC(doresMap, resumo, impPerguntas);

    // Calculate Cost of Status Quo
    const custo = calcularCustoStatusQuo(resumo, impPerguntas);

    // Generate AI narrative
    const sumarioNarrativo = await generateNarrative({
      empresa, nomeFirst, resumo, doresConfirmadas, impPerguntas, necPerguntas, imc, custo,
    });

    const reportData = {
      empresa, nome, nomeFirst, closerNome, dataFormatada,
      sumarioNarrativo, doresConfirmadas, doresMap,
      imc, custo, resumo, impPerguntas, necPerguntas, fech,
      setor: lead.setor_empresa || "",
      ds,
    };

    // Build HTML report
    const reportHtml = buildHtmlReport(reportData);

    // ═══ EMAIL WITH PDF ATTACHMENT ════════════════════════
    if (send_email && lead.email) {
      const pdfBytes = await generatePdfBytes(reportData);
      const pdfBase64 = base64Encode(pdfBytes);

      const dataProxContato = fech.dataProximoContato
        ? new Date(fech.dataProximoContato).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })
        : "em breve";

      const emailBodyText = `${nomeFirst},\n\nFoi uma conversa muito boa.\n\nCumpri o que prometi: preparei o Diagnóstico Comercial da ${empresa} com base em tudo que você me contou hoje.\n\nEstá no PDF anexo. Peço que leia com calma — você vai reconhecer cada ponto.\n\nNos vemos em ${dataProxContato} para apresentar o caminho que eu enxergo para o que você descreveu.\n\nQualquer dúvida antes disso, estou no WhatsApp.\n\n${closerNome}\nMX3 Aceleradora Comercial`;

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

      const { data: config } = await supabase.from("configuracoes").select("email_from_address, email_from_name, email_tracking_enabled").limit(1).single();
      const fromAddress = config?.email_from_address || "contato@mx3.com.br";
      const fromName = config?.email_from_name || "MX3";
      const trackingEnabled = config?.email_tracking_enabled !== false;

      const { data: emailLog, error: logError } = await supabase.from("email_logs").insert({ lead_id: lead.id, assunto: emailSubject, status: "enviando" }).select("id").single();
      if (logError || !emailLog) throw new Error("Failed to create email log: " + logError?.message);

      let trackedHtml = finalEmailHtml;
      if (trackingEnabled) {
        trackedHtml = trackedHtml.replace(
          /href="(https?:\/\/[^"]+)"/g,
          (_, url) => `href="${supabaseUrl}/functions/v1/email-tracking?type=click&id=${emailLog.id}&url=${encodeURIComponent(url)}"`
        );
        trackedHtml += `<img src="${supabaseUrl}/functions/v1/email-tracking?type=open&id=${emailLog.id}" width="1" height="1" style="display:none" />`;
      }

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
              attachments: [{
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: `Diagnostico-Comercial-${sanitizedEmpresa}.pdf`,
                contentType: "application/pdf",
                contentBytes: pdfBase64,
              }],
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
