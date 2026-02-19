import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTcOOZuXYILATKQpX9f_qeV21Ks0JE-FidEx17vxdWVUAoQFkY33Bej2GEa7fBF6bcpyG7TZEfc_ev2/pub?output=csv";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch CSV
    const csvResp = await fetch(SHEET_CSV_URL);
    if (!csvResp.ok) {
      const body = await csvResp.text();
      return new Response(
        JSON.stringify({ ok: false, message: "Erro ao buscar planilha de investimentos", detail: body }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const csvText = await csvResp.text();

    // Parse CSV
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ ok: true, upserted: 0, message: "Planilha vazia" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim() !== ""));

    // Map columns
    const colMap = {
      day: findCol(headers, ["day", "dia", "date", "data"]),
      campaign: findCol(headers, ["campaign name", "campanha", "campaign"]),
      adset: findCol(headers, ["ad set name", "adset", "ad_set", "conjunto"]),
      ad_name: findCol(headers, ["ad name", "ad_name", "criativo", "anuncio"]),
      amount: findCol(headers, ["amount spent", "valor_gasto", "spend", "amount", "custo", "cost"]),
    };

    if (colMap.day === -1 || colMap.campaign === -1 || colMap.amount === -1) {
      return new Response(
        JSON.stringify({ ok: false, message: "Colunas obrigatórias não encontradas (Day, Campaign Name, Amount Spent)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build records
    const records: Record<string, unknown>[] = [];
    for (const row of dataRows) {
      const dia = (row[colMap.day] || "").trim();
      const campanha = (row[colMap.campaign] || "").trim();
      const adset = colMap.adset !== -1 ? (row[colMap.adset] || "").trim() : "";
      const ad_name = colMap.ad_name !== -1 ? (row[colMap.ad_name] || "").trim() : "";
      const valor_gasto = parseNumber(row[colMap.amount] || "");

      if (!dia || !campanha || valor_gasto === null) continue;

      records.push({ dia, campanha, adset, ad_name, valor_gasto });
    }

    // Upsert in batches of 100
    let upserted = 0;
    for (let i = 0; i < records.length; i += 100) {
      const batch = records.slice(i, i + 100);
      const { error } = await supabase
        .from("ad_spend")
        .upsert(batch, { onConflict: "dia,campanha,adset,ad_name" });
      if (!error) {
        upserted += batch.length;
      } else {
        console.error("Upsert error:", error);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, upserted, total_rows: dataRows.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("poll-ad-spend error:", err);
    return new Response(
      JSON.stringify({ ok: false, message: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---- Helpers ----

function parseNumber(val: string): number | null {
  if (!val || !val.trim()) return null;
  const rangeMatch = val.match(/[\d.,]+/);
  if (!rangeMatch) return null;
  let cleaned = rangeMatch[0];
  // Brazilian format: dots are thousands, comma is decimal
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
