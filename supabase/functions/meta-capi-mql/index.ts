import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MQL_PIXEL_ID = "598204086654379";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN");
    if (!ACCESS_TOKEN) {
      console.error("Missing META_CAPI_ACCESS_TOKEN");
      return new Response(
        JSON.stringify({ error: "Missing Meta credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { lead_id } = body;

    if (!lead_id) {
      return new Response(
        JSON.stringify({ error: "lead_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      return new Response(
        JSON.stringify({ error: "Lead not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if MQL event was already sent for this lead (avoid duplicates)
    const { data: existingLog } = await supabase
      .from("meta_capi_logs")
      .select("id")
      .eq("lead_id", lead_id)
      .eq("event_name", "MQL")
      .eq("status", "success")
      .limit(1);

    if (existingLog && existingLog.length > 0) {
      console.log(`MQL already sent for lead ${lead_id}, skipping.`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "MQL already sent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    const userData: Record<string, any> = {
      lead_id: lead_id,
    };
    if (lead.email) {
      userData.em = [await hashSHA256(lead.email.toLowerCase().trim())];
    }
    if (lead.telefone) {
      const phone = lead.telefone.replace(/\D/g, "");
      userData.ph = [await hashSHA256(phone)];
    }
    if (lead.nome) {
      const firstName = lead.nome.split(" ")[0];
      userData.fn = [await hashSHA256(firstName.toLowerCase().trim())];
    }

    const customData: Record<string, any> = {
      event_source: "crm",
      lead_event_source: "CallX CRM",
      faturamento: lead.faturamento,
      funil: lead.funil,
    };

    const eventData = {
      event_name: "MQL",
      event_time: now,
      action_source: "system_generated",
      event_id: `${lead_id}_mql_${now}`,
      user_data: userData,
      custom_data: customData,
    };

    const metaUrl = `https://graph.facebook.com/v25.0/${MQL_PIXEL_ID}/events`;
    const metaResponse = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [eventData],
        access_token: ACCESS_TOKEN,
      }),
    });

    const metaResult = await metaResponse.json();
    console.log("Meta CAPI MQL response:", JSON.stringify(metaResult));

    const isSuccess = metaResult?.events_received >= 1;
    const errorMsg = metaResult?.error?.error_user_msg || metaResult?.error?.message || null;

    // Log the MQL event
    await supabase.from("meta_capi_logs").insert({
      lead_id,
      event_name: "MQL",
      stage: lead.status_funil || "lead",
      status: isSuccess ? "success" : "error",
      meta_response: metaResult,
      error_message: errorMsg,
    });

    return new Response(
      JSON.stringify({
        success: isSuccess,
        event_name: "MQL",
        pixel_id: MQL_PIXEL_ID,
        meta_response: metaResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Meta CAPI MQL error:", error);
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
