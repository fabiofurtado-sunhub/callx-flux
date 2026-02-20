import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GA4_MEASUREMENT_ID = "G-9PEK391R58";

const STAGE_EVENT_MAP: Record<string, string> = {
  lead: "generate_lead",
  reuniao: "schedule_meeting",
  reuniao_realizada: "meeting_completed",
  proposta: "begin_checkout",
  venda: "purchase",
  perdido: "lead_lost",
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

    const body = await req.json();
    const { lead_id, new_stage, lead_data } = body;

    if (!lead_id || !new_stage) {
      return new Response(
        JSON.stringify({ error: "lead_id and new_stage are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventName = STAGE_EVENT_MAP[new_stage] || "other_conversion";
    const now = Math.floor(Date.now() / 1000);
    const clientId = lead_id.replace(/-/g, "").substring(0, 20) + ".0000000000";

    const eventParams: Record<string, any> = {
      lead_id,
      stage: new_stage,
      engagement_time_msec: "1",
    };

    if (new_stage === "venda" && lead_data?.valor_venda) {
      eventParams.currency = "BRL";
      eventParams.value = Number(lead_data.valor_venda);
    }

    if (new_stage === "proposta" && lead_data?.valor_proposta) {
      eventParams.currency = "BRL";
      eventParams.value = Number(lead_data.valor_proposta);
    }

    const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${API_SECRET}`;

    const ga4Payload = {
      client_id: clientId,
      timestamp_micros: String(now * 1000000),
      non_personalized_ads: false,
      events: [
        {
          name: eventName,
          params: eventParams,
        },
      ],
    };

    const ga4Response = await fetch(ga4Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ga4Payload),
    });

    // GA4 Measurement Protocol returns 204 on success with no body
    const isSuccess = ga4Response.status === 204 || ga4Response.ok;
    let responseBody = null;
    try {
      responseBody = await ga4Response.text();
    } catch (_) {
      // no body expected
    }

    console.log("GA4 response:", ga4Response.status, responseBody);

    // Log the event to ga4_logs table
    const errorMsg = !isSuccess ? (responseBody || "Unknown error") : null;
    await supabase.from("ga4_logs").insert({
      lead_id,
      event_name: eventName,
      stage: new_stage,
      status: isSuccess ? "success" : "error",
      ga_response: responseBody,
      error_message: errorMsg,
    });

    return new Response(
      JSON.stringify({
        success: isSuccess,
        event_name: eventName,
        status: ga4Response.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Google Analytics error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
