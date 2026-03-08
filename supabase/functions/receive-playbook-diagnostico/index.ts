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
      const phone = cleanPhone(lead.telefone || "");
      if (phone.length < 10) {
        skippedCount++;
        continue;
      }

      // Dedup within diagnostico funnel
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("funil", "diagnostico")
        .eq("telefone", phone)
        .limit(1);

      if (existing && existing.length > 0) {
        skippedCount++;
        continue;
      }

      const meetingLink = lead.meeting_link || lead.link_reuniao || "";
      const obsItems = [
        lead.observacoes || "",
        lead.empresa ? `Empresa: ${lead.empresa}` : "",
        meetingLink ? `Link reunião: ${meetingLink}` : "",
        lead.playbook_lead_id ? `Lead Playbook: ${lead.playbook_lead_id}` : "",
      ].filter(Boolean);

      const { data, error } = await supabase
        .from("leads")
        .insert({
          nome: lead.nome || "Sem nome",
          telefone: phone,
          email: lead.email || null,
          funil: "diagnostico",
          status_funil: "reuniao",
          cadencia_status: "concluida",
          origem: lead.origem || "playbook_agendamento",
          empresa: lead.empresa || "",
          setor_empresa: lead.setor_empresa || null,
          faturamento: lead.faturamento || null,
          campanha: lead.campanha || "",
          vendedor_nome: lead.vendedor_nome || "",
          tags: ["Diagnóstico", "Playbook"],
          observacoes: obsItems.join(" | "),
          score_lead: 30,
          probabilidade_fechamento: 30,
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

      // Log
      await supabase.from("lead_logs").insert({
        lead_id: data.id,
        acao: "Lead criado no funil Diagnóstico via Playbook",
        de: null,
        para: "reuniao",
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
    console.error("receive-playbook-diagnostico error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
