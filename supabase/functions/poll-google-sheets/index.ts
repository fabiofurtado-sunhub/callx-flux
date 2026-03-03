import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get Google Sheets URLs from configuracoes
    const { data: config, error: cfgError } = await supabase
      .from("configuracoes")
      .select("google_sheets_url, google_sheets_url_core_ai, google_sheets_url_revenue_os")
      .limit(1)
      .single();

    if (cfgError) {
      return new Response(
        JSON.stringify({ ok: false, message: "Erro ao buscar configurações" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Get existing phones GLOBALLY to deduplicate (prevent re-imports when leads move between funnels)
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("telefone, funil");

    // Global phone set (across all funnels) to prevent reimporting leads that moved
    const existingPhonesGlobal = new Set<string>();
    const existingPhonesByFunnel = new Map<string, Set<string>>();
    for (const l of (existingLeads || []) as { telefone: string; funil: string }[]) {
      const phone = normalizePhone(l.telefone);
      existingPhonesGlobal.add(phone);
      if (!existingPhonesByFunnel.has(l.funil)) {
        existingPhonesByFunnel.set(l.funil, new Set());
      }
      existingPhonesByFunnel.get(l.funil)!.add(phone);
    }

    const results: Record<string, any> = {};

    // Process CallX sheet
    if (config?.google_sheets_url) {
      results.callx = await processSheet(config.google_sheets_url, "callx", supabase, existingPhonesByFunnel);
    }

    // Process Core AI sheet
    if (config?.google_sheets_url_core_ai) {
      results.core_ai = await processSheet(config.google_sheets_url_core_ai, "core_ai", supabase, existingPhonesByFunnel);
    }

    // Process Revenue OS sheet
    if (config?.google_sheets_url_revenue_os) {
      results.revenue_os = await processSheet(config.google_sheets_url_revenue_os, "revenue_os", supabase, existingPhonesByFunnel);
    }

    if (!config?.google_sheets_url && !config?.google_sheets_url_core_ai && !config?.google_sheets_url_revenue_os) {
      return new Response(
        JSON.stringify({ ok: false, message: "Nenhuma URL de planilha configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("poll-google-sheets error:", err);
    return new Response(
      JSON.stringify({ ok: false, message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---- Process a single sheet ----

async function processSheet(
  sheetUrl: string,
  funil: string,
  supabase: any,
  existingPhonesByFunnel: Map<string, Set<string>>
): Promise<Record<string, any>> {
  // Build CSV URL
  let csvUrl: string;
  const pubMatch = sheetUrl.match(/\/d\/e\/(2PACX[a-zA-Z0-9_-]+)/);
  const regularMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);

  if (pubMatch) {
    csvUrl = `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?output=csv`;
  } else if (regularMatch) {
    csvUrl = `https://docs.google.com/spreadsheets/d/${regularMatch[1]}/export?format=csv`;
  } else {
    return { ok: false, message: "URL de planilha inválida" };
  }

  const csvResp = await fetch(csvUrl);
  if (!csvResp.ok) {
    const body = await csvResp.text();
    return { ok: false, message: "Erro ao buscar planilha", detail: body };
  }
  const csvText = await csvResp.text();

  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    return { ok: true, inserted: 0, message: "Planilha vazia ou sem dados" };
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));

  // Map column indices (flexible header matching)
  const colMap = {
    nome: findCol(headers, ["nome", "name", "cliente", "first_name"]),
    telefone: findCol(headers, ["telefone", "phone", "tel", "whatsapp", "celular", "whatsapp_(dd+número)", "whatsapp_(dd+numero)", "número_do_whatsapp", "numero_do_whatsapp"]),
    email: findCol(headers, ["email", "e-mail"]),
    campanha: findCol(headers, ["campanha", "campaign", "utm_campaign", "campaign_name"]),
    adset: findCol(headers, ["adset", "ad_set", "conjunto", "anuncio", "anúncio", "ad_name", "adset_name"]),
    grupo_anuncios: findCol(headers, ["grupo_anuncios", "grupo", "ad_group", "grupo de anuncio", "grupo de anúncio", "grupo_de_anuncio"]),
    faturamento: findCol(headers, ["faturamento", "receita", "revenue", "faturamento mensal", "qual_seu_faturamento_mensal?", "qual seu faturamento mensal?"]),
    tomador_decisao: findCol(headers, ["tomador_decisao", "tomador de decisao", "decisor", "você_é_o_tomador_de_decisão?", "voce e o tomador de decisao", "qual_é_o_seu_papel_na_tomada_de_decisões_da_sua_empresa?"]),
    gargalo: findCol(headers, ["maior_gargalo_comercial", "gargalo", "qual_seu_maior_gargalo_comercial?", "maior gargalo comercial"]),
    setor: findCol(headers, ["setor_empresa", "setor", "segmento", "qual_o_setor_da_sua_empresa?", "setor da empresa"]),
    empresa: findCol(headers, ["empresa", "qual_o_nome_da_sua_empresa?", "nome_empresa", "company"]),
    porte_empresa: findCol(headers, ["qual_o_porte_da_sua_empresa?", "porte_empresa", "porte"]),
    situacao_profissional: findCol(headers, ["qual_é_a_sua_situação_profissional?", "situacao_profissional"]),
    funcionarios: findCol(headers, ["quantos_funcionários_tem_a_empresa_em_que_você_trabalha_ou_que_você_possui?", "funcionarios"]),
    lead_status_sheet: findCol(headers, ["lead_status"]),
    lead_id_sheet: findCol(headers, ["id"]),
  };

  if (colMap.nome === -1 || colMap.telefone === -1) {
    return { ok: false, message: "Colunas 'nome' e 'telefone' são obrigatórias na planilha" };
  }

  // Get or create the set for this funnel
  if (!existingPhonesByFunnel.has(funil)) {
    existingPhonesByFunnel.set(funil, new Set());
  }
  const existingPhonesForFunnel = existingPhonesByFunnel.get(funil)!;

  const newLeads: Record<string, unknown>[] = [];
  for (const row of dataRows) {
    const phone = normalizePhone(row[colMap.telefone] || "");
    if (!phone || existingPhonesForFunnel.has(phone)) continue;

    const nome = (row[colMap.nome] || "").trim();
    if (!nome) continue;

    existingPhonesForFunnel.add(phone);

    const lead: Record<string, unknown> = {
      nome,
      telefone: phone,
      email: colMap.email !== -1 ? (row[colMap.email] || "").trim() : "",
      campanha: colMap.campanha !== -1 ? (row[colMap.campanha] || "").trim() : "",
      adset: colMap.adset !== -1 ? (row[colMap.adset] || "").trim() : "",
      grupo_anuncios: colMap.grupo_anuncios !== -1 ? (row[colMap.grupo_anuncios] || "").trim() : "",
      faturamento: colMap.faturamento !== -1 ? parseNumber(row[colMap.faturamento] || "") : null,
      empresa: colMap.empresa !== -1 ? (row[colMap.empresa] || "").trim() : "",
      origem: funil === "revenue_os" ? "Tráfego Pago - Meta" : "google_sheets",
      funil,
      status_funil: "lead",
      envio_whatsapp_status: "pendente",
    };

    // Core AI & Revenue OS specific fields
    if (funil === "core_ai" || funil === "revenue_os") {
      if (colMap.tomador_decisao !== -1) {
        const val = (row[colMap.tomador_decisao] || "").trim().toLowerCase();
        lead.tomador_decisao = val === "sim" || val === "yes" || val === "true" || val === "1";
      }
      if (colMap.gargalo !== -1) {
        lead.maior_gargalo_comercial = (row[colMap.gargalo] || "").trim() || null;
      }
      if (colMap.setor !== -1) {
        lead.setor_empresa = (row[colMap.setor] || "").trim() || null;
      }
      if (colMap.porte_empresa !== -1) {
        lead.porte_empresa = (row[colMap.porte_empresa] || "").trim() || null;
      }
    }

    newLeads.push(lead);
  }

  // Insert new leads
  let inserted = 0;
  if (newLeads.length > 0) {
    for (let i = 0; i < newLeads.length; i += 50) {
      const batch = newLeads.slice(i, i + 50);
      const { error: insertError } = await supabase.from("leads").insert(batch);
      if (!insertError) {
        inserted += batch.length;
      } else {
        console.error(`Insert error (${funil}):`, insertError);
      }
    }
  }

  return { ok: true, inserted, total_rows: dataRows.length };
}

// ---- Helpers ----

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").trim();
}

function parseNumber(val: string): number | null {
  if (!val || !val.trim()) return null;

  if (/acima.*milh/i.test(val)) return 1500000;
  if (/acima/i.test(val)) {
    const m = val.match(/[\d.]+/);
    if (m) {
      const n = parseFloat(m[0].replace(/\./g, "").replace(",", "."));
      return isNaN(n) ? null : n * 1.5;
    }
    return 1500000;
  }
  if (/abaixo/i.test(val)) {
    const m = val.match(/[\d.]+/);
    if (m) {
      const n = parseFloat(m[0].replace(/\./g, "").replace(",", "."));
      return isNaN(n) ? null : n * 0.5;
    }
    return 25000;
  }
  if (/de_r|de r/i.test(val) && /a_r|a r/i.test(val)) {
    const matches = val.match(/[\d.]+/g);
    if (matches && matches.length >= 2) {
      const n1 = parseFloat(matches[0].replace(/\./g, "").replace(",", "."));
      const n2 = parseFloat(matches[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(n1) && !isNaN(n2)) return (n1 + n2) / 2;
    }
  }

  const rangeMatch = val.match(/[\d.,]+/);
  if (!rangeMatch) return null;
  let cleaned = rangeMatch[0];
  cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function findCol(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(cell);
        cell = "";
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        current.push(cell);
        cell = "";
        rows.push(current);
        current = [];
        if (ch === "\r") i++;
      } else {
        cell += ch;
      }
    }
  }
  if (cell || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }
  return rows;
}
