import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STAGE_EVENT_MAP: Record<string, string> = {
  lead: "Lead",
  reuniao: "Schedule",
  reuniao_realizada: "Schedule",
  proposta: "InitiateCheckout",
  venda: "Purchase",
  perdido: "Other",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PIXEL_ID = Deno.env.get("META_PIXEL_ID");
    const ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN");

    if (!PIXEL_ID || !ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Missing Meta credentials" }),
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

    const eventName = STAGE_EVENT_MAP[new_stage] || "Other";
    const now = Math.floor(Date.now() / 1000);

    const userData: Record<string, any> = {};
    if (lead_data?.email) {
      userData.em = [await hashSHA256(lead_data.email.toLowerCase().trim())];
    }
    if (lead_data?.telefone) {
      const phone = lead_data.telefone.replace(/\D/g, "");
      userData.ph = [await hashSHA256(phone)];
    }

    const eventData: Record<string, any> = {
      event_name: eventName,
      event_time: now,
      action_source: "system_generated",
      event_id: `${lead_id}_${new_stage}_${now}`,
      user_data: userData,
    };

    if (new_stage === "venda" && lead_data?.valor_venda) {
      eventData.custom_data = {
        currency: "BRL",
        value: Number(lead_data.valor_venda),
      };
    }

    if (new_stage === "proposta" && lead_data?.valor_proposta) {
      eventData.custom_data = {
        currency: "BRL",
        value: Number(lead_data.valor_proposta),
      };
    }

    const metaUrl = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events`;
    const metaResponse = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [eventData],
        access_token: ACCESS_TOKEN,
      }),
    });

    const metaResult = await metaResponse.json();
    console.log("Meta CAPI response:", JSON.stringify(metaResult));

    // Log the event to meta_capi_logs table
    const isSuccess = metaResult?.events_received >= 1;
    const errorMsg = metaResult?.error?.error_user_msg || metaResult?.error?.message || null;

    await supabase.from("meta_capi_logs").insert({
      lead_id,
      event_name: eventName,
      stage: new_stage,
      status: isSuccess ? "success" : "error",
      meta_response: metaResult,
      error_message: errorMsg,
    });

    return new Response(
      JSON.stringify({
        success: true,
        event_name: eventName,
        meta_response: metaResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Meta CAPI error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
