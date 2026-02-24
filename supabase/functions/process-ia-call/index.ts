import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CALLX_BULK_URL =
  "https://callx.aceleradoramx3.com/api/v2/voice-campaigns/Vm9pY2VDYW1wYWlnblR5cGU6ajNwOE9nMw==/leads/bulk";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const callxApiKey = Deno.env.get("CALLX_API_KEY");

    if (!callxApiKey) {
      throw new Error("CALLX_API_KEY is not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* empty body is fine */ }
    const isRetry = body?.retry === true;

    let leads: any[] = [];

    if (isRetry) {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("status_funil", "ia_call")
        .eq("funil", "callx");

      if (error) throw new Error(`Error fetching retry leads: ${error.message}`);
      leads = data || [];
      console.log(`[RETRY] Found ${leads.length} leads in ia_call to resend to CallX`);
    } else {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("status_funil", "fup_1")
        .eq("funil", "callx")
        .lte("data_ultimo_movimento", fourHoursAgo);

      if (error) throw new Error(`Error fetching leads: ${error.message}`);
      leads = data || [];
      console.log(`Found ${leads.length} leads stuck in FUP 1 for 4+ hours`);
    }

    if (leads.length === 0) {
      return new Response(
        JSON.stringify({ message: "No leads to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Move leads to ia_call (skip if retry)
    if (!isRetry) {
      const now = new Date().toISOString();
      for (const lead of leads) {
        await supabase
          .from("leads")
          .update({
            status_funil: "ia_call",
            data_ultimo_movimento: now,
            score_lead: 25,
            probabilidade_fechamento: 25,
          })
          .eq("id", lead.id);

        await supabase.from("lead_logs").insert({
          lead_id: lead.id,
          acao: "Mudança de etapa (automático 4h)",
          de: "fup_1",
          para: "ia_call",
        });
      }
    }

    // Build bulk payload
    const bulkPayload = leads.map((lead) => {
      const nameParts = (lead.nome || "").trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      return {
        first_name: firstName,
        last_name: lastName,
        email: lead.email || "",
        custom_fields: {
          lead_id: lead.id,
          campanha: lead.campanha || "",
          vendedor: lead.vendedor_nome || "",
          funil: lead.funil,
        },
        phone_number: lead.telefone,
      };
    });

    console.log(`Sending ${bulkPayload.length} leads to CallX bulk endpoint`);

    const callxRes = await fetch(CALLX_BULK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${callxApiKey}`,
      },
      body: JSON.stringify(bulkPayload),
    });

    const callxData = await callxRes.text();
    console.log(`CallX bulk response: ${callxRes.status} - ${callxData}`);

    return new Response(
      JSON.stringify({
        processed: leads.length,
        callx_status: callxRes.status,
        callx_response: callxData,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-ia-call error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
