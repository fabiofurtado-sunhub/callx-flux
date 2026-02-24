import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CALLX_CAMPAIGN_URL =
  "https://callx.aceleradoramx3.com/api/v2/voice-campaigns/Vm9pY2VDYW1wYWlnblR5cGU6ajNwOE9nMw==/leads";

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

    // Check if this is a retry request for leads already in ia_call
    let body: any = {};
    try { body = await req.json(); } catch (_) { /* empty body is fine */ }
    const isRetry = body?.retry === true;

    let leads: any[] = [];

    if (isRetry) {
      // Retry: fetch leads already moved to ia_call that need to be re-sent to CallX
      const { data, error: fetchError } = await supabase
        .from("leads")
        .select("*")
        .eq("status_funil", "ia_call")
        .eq("funil", "callx");

      if (fetchError) throw new Error(`Error fetching retry leads: ${fetchError.message}`);
      leads = data || [];
      console.log(`[RETRY] Found ${leads.length} leads in ia_call to resend to CallX`);
    } else {
      // Normal: find leads stuck in fup_1 for more than 4 hours
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
      const { data, error: fetchError } = await supabase
        .from("leads")
        .select("*")
        .eq("status_funil", "fup_1")
        .eq("funil", "callx")
        .lte("data_ultimo_movimento", fourHoursAgo);

      if (fetchError) throw new Error(`Error fetching leads: ${fetchError.message}`);
      leads = data || [];
      console.log(`Found ${leads.length} leads stuck in FUP 1 for 4+ hours`);
    }

    if (leads.length === 0) {
      return new Response(
        JSON.stringify({ message: "No leads to process", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];

      // Wait 10 seconds between requests to avoid rate limiting
      if (i > 0) await delay(10000);
      try {
        // 1. Move lead to ia_call stage (skip if retry — already moved)
        if (!isRetry) {
          const now = new Date().toISOString();
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

        // 3. Parse name into first/last
        const nameParts = (lead.nome || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // 4. Send to CallX voice campaign
        const callxPayload = {
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

        console.log(`Sending lead ${lead.id} to CallX:`, JSON.stringify(callxPayload));

        const callxRes = await fetch(CALLX_CAMPAIGN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${callxApiKey}`,
          },
          body: JSON.stringify(callxPayload),
        });

        const callxData = await callxRes.text();
        console.log(`CallX response for ${lead.id}: ${callxRes.status} - ${callxData}`);

        results.push({
          lead_id: lead.id,
          nome: lead.nome,
          callx_status: callxRes.status,
          success: callxRes.ok,
        });
      } catch (leadError) {
        console.error(`Error processing lead ${lead.id}:`, leadError);
        results.push({
          lead_id: lead.id,
          nome: lead.nome,
          success: false,
          error: leadError.message,
        });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
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
