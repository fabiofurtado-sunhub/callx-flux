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

    // 1. Get Google Sheets URL from configuracoes
    const { data: config, error: cfgError } = await supabase
      .from("configuracoes")
      .select("google_sheets_url")
      .limit(1)
      .single();

    if (cfgError || !config?.google_sheets_url) {
      return new Response(
        JSON.stringify({ ok: false, message: "Google Sheets URL não configurada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Build CSV URL - support both regular and published URLs
    const sheetUrl: string = config.google_sheets_url;
    let csvUrl: string;
    const pubMatch = sheetUrl.match(/\/d\/e\/(2PACX[a-zA-Z0-9_-]+)/);
    const regularMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);

    if (pubMatch) {
      csvUrl = `https://docs.google.com/spreadsheets/d/e/${pubMatch[1]}/pub?output=csv`;
    } else if (regularMatch) {
      csvUrl = `https://docs.google.com/spreadsheets/d/${regularMatch[1]}/export?format=csv`;
    } else {
      return new Response(
        JSON.stringify({ ok: false, message: "URL de planilha inválida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch CSV from public Google Sheet
    const csvResp = await fetch(csvUrl);
    if (!csvResp.ok) {
      const body = await csvResp.text();
      return new Response(
        JSON.stringify({ ok: false, message: "Erro ao buscar planilha", detail: body }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const csvText = await csvResp.text();

    // 4. Parse CSV rows
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ ok: true, inserted: 0, message: "Planilha vazia ou sem dados" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));

    // Map column indices (flexible header matching)
    const colMap = {
      nome: findCol(headers, ["nome", "name", "cliente"]),
      telefone: findCol(headers, ["telefone", "phone", "tel", "whatsapp", "celular"]),
      email: findCol(headers, ["email", "e-mail"]),
      campanha: findCol(headers, ["campanha", "campaign", "utm_campaign"]),
      adset: findCol(headers, ["adset", "ad_set", "conjunto", "anuncio", "anúncio", "ad_name"]),
      grupo_anuncios: findCol(headers, ["grupo_anuncios", "grupo", "ad_group", "grupo de anuncio", "grupo de anúncio", "grupo_de_anuncio"]),
    };

    if (colMap.nome === -1 || colMap.telefone === -1) {
      return new Response(
        JSON.stringify({ ok: false, message: "Colunas 'nome' e 'telefone' são obrigatórias na planilha" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Get existing phone numbers to deduplicate
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("telefone");

    const existingPhones = new Set(
      (existingLeads || []).map((l: { telefone: string }) => normalizePhone(l.telefone))
    );

    // 6. Build new leads
    const newLeads: Record<string, unknown>[] = [];
    for (const row of dataRows) {
      const phone = normalizePhone(row[colMap.telefone] || "");
      if (!phone || existingPhones.has(phone)) continue;

      const nome = (row[colMap.nome] || "").trim();
      if (!nome) continue;

      existingPhones.add(phone); // prevent dupes within same batch

      newLeads.push({
        nome,
        telefone: phone,
        email: colMap.email !== -1 ? (row[colMap.email] || "").trim() : "",
        campanha: colMap.campanha !== -1 ? (row[colMap.campanha] || "").trim() : "",
        adset: colMap.adset !== -1 ? (row[colMap.adset] || "").trim() : "",
        grupo_anuncios: colMap.grupo_anuncios !== -1 ? (row[colMap.grupo_anuncios] || "").trim() : "",
        origem: "google_sheets",
        status_funil: "lead",
      });
    }

    // 7. Insert new leads
    let inserted = 0;
    if (newLeads.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < newLeads.length; i += 50) {
        const batch = newLeads.slice(i, i + 50);
        const { error: insertError } = await supabase.from("leads").insert(batch);
        if (!insertError) {
          inserted += batch.length;
        } else {
          console.error("Insert error:", insertError);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, inserted, total_rows: dataRows.length }),
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

// ---- Helpers ----

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").trim();
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
