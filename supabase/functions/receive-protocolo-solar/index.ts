import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function parseFaturamento(val: any): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
  const s = String(val).toLowerCase();
  if (s.includes("acima") || s.includes("1 milh") || s.includes("1m")) return 1500000;
  if (s.includes("500 mil") || s.includes("500k")) return 750000;
  if (s.includes("100 mil") || s.includes("100k")) return 300000;
  if (s.includes("50 mil") || s.includes("50k")) return 75000;
  if (s.includes("até 50") || s.includes("ate 50")) return 25000;
  const num = parseFloat(s.replace(/[^\d.]/g, ""));
  return isNaN(num) ? null : num;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const rawLeads = Array.isArray(body) ? body : body.leads ? body.leads : [body];

    if (!rawLeads?.length) {
      return new Response(JSON.stringify({ error: "No leads provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    let insertedCount = 0;
    let skippedCount = 0;
    const insertedLeads: any[] = [];

    for (const lead of rawLeads) {
      const phone = cleanPhone(lead.telefone || lead.whatsapp || "");
      if (phone.length < 10) {
        skippedCount++;
        continue;
      }

      // Dedup within protocolo_solar funnel
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("funil", "protocolo_solar")
        .eq("telefone", phone)
        .limit(1);

      if (existing && existing.length > 0) {
        skippedCount++;
        continue;
      }

      const obsItems = [
        lead.observacoes || "",
        lead.empresa ? `Empresa: ${lead.empresa}` : "",
        lead.cargo ? `Cargo: ${lead.cargo}` : "",
      ].filter(Boolean);

      const { data, error } = await supabase
        .from("leads")
        .insert({
          nome: lead.nome || "Sem nome",
          telefone: phone,
          email: lead.email || null,
          funil: "protocolo_solar",
          status_funil: "lead",
          cadencia_status: "concluida",
          origem: lead.origem || "protocolo_solar",
          empresa: lead.empresa || "",
          faturamento: parseFaturamento(lead.faturamento),
          campanha: lead.campanha || "Protocolo Solar",
          vendedor_nome: lead.vendedor_nome || "",
          tags: ["Protocolo Solar"],
          observacoes: obsItems.join(" | "),
          score_lead: 10,
          probabilidade_fechamento: 0,
          data_entrada: now,
          data_ultimo_movimento: now,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Insert error:", error);
        continue;
      }

      insertedCount++;
      insertedLeads.push(data);

      await supabase.from("lead_logs").insert({
        lead_id: data.id,
        acao: "Lead criado no funil Protocolo Solar",
        de: null,
        para: "lead",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedCount,
        skipped: skippedCount,
        lead_ids: insertedLeads.map((l) => l.id),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("receive-protocolo-solar error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
