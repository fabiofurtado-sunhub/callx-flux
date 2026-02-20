import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GA4_MEASUREMENT_ID = "G-9PEK391R58";

const META_TO_GA4_EVENT: Record<string, string> = {
  Lead: "generate_lead",
  Schedule: "schedule_meeting",
  InitiateCheckout: "begin_checkout",
  Purchase: "purchase",
  Other: "lead_lost",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const API_SECRET = Deno.env.get("GA4_API_SECRET");
    if (!API_SECRET) {
      return new Response(
        JSON.stringify({ error: "Missing GA4_API_SECRET" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all successful Meta CAPI logs
    const { data: logs, error: logsError } = await supabase
      .from("meta_capi_logs")
      .select("*")
      .eq("status", "success")
      .order("created_at", { ascending: true });

    if (logsError) {
      return new Response(
        JSON.stringify({ error: logsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!logs || logs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No historical events to send" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${API_SECRET}`;

    let sent = 0;
    let errors = 0;

    // GA4 Measurement Protocol supports max 25 events per request
    const batchSize = 25;

    for (let i = 0; i < logs.length; i += batchSize) {
      const batch = logs.slice(i, i + batchSize);

      // Group by client_id (lead_id) - send separate requests per lead
      const byLead: Record<string, typeof batch> = {};
      for (const log of batch) {
        if (!byLead[log.lead_id]) byLead[log.lead_id] = [];
        byLead[log.lead_id].push(log);
      }

      for (const [leadId, leadLogs] of Object.entries(byLead)) {
        const clientId = leadId.replace(/-/g, "").substring(0, 20) + ".0000000000";
        
        const events = leadLogs.map((log) => {
          const ga4EventName = META_TO_GA4_EVENT[log.event_name] || "other_conversion";
          const createdAt = new Date(log.created_at);
          
          const params: Record<string, any> = {
            lead_id: log.lead_id,
            stage: log.stage,
            engagement_time_msec: "1",
            backfill: "true",
          };

          // Extract value from meta_response if available
          const metaResp = log.meta_response as any;
          if (metaResp?.custom_data?.value) {
            params.currency = "BRL";
            params.value = metaResp.custom_data.value;
          }

          return {
            name: ga4EventName,
            params,
          };
        });

        const ga4Payload = {
          client_id: clientId,
          non_personalized_ads: false,
          events,
        };

        try {
          const resp = await fetch(ga4Url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ga4Payload),
          });

          if (resp.status === 204 || resp.ok) {
            sent += events.length;
          } else {
            errors += events.length;
            console.error("GA4 backfill error:", resp.status, await resp.text());
          }
        } catch (e) {
          errors += events.length;
          console.error("GA4 backfill fetch error:", e);
        }
      }
    }

    console.log(`GA4 backfill complete: ${sent} sent, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        total: logs.length,
        sent,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("GA4 backfill error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
