import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AGENT_ID = "agent_5301kjfk4npye2ttq6k12d4jk6d0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!elevenlabsApiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
    }

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!twilioSid || !twilioAuth || !twilioPhone) {
      throw new Error("Twilio credentials are not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id } = await req.json();
    if (!lead_id) {
      throw new Error("lead_id is required");
    }

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead not found: ${leadError?.message}`);
    }

    // Format phone number for Twilio (E.164)
    let phone = (lead.telefone || "").replace(/\D/g, "");
    if (!phone.startsWith("55")) {
      phone = "55" + phone;
    }
    phone = "+" + phone;

    // Extract first name for the agent greeting
    const nameParts = (lead.nome || "").trim().split(/\s+/);
    const firstName = nameParts[0] || "";

    // Format current date in Brazilian format
    const now = new Date();
    const brDate = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

    // Step 1: Register the call with ElevenLabs to get TwiML with dynamic variables
    const registerRes = await fetch(
      "https://api.elevenlabs.io/v1/convai/twilio/register-call",
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenlabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent_id: AGENT_ID,
          from_number: twilioPhone,
          to_number: phone,
          direction: "outbound",
          conversation_initiation_client_data: {
            dynamic_variables: {
              first_name: firstName,
              now: brDate,
              date: brDate,
              lead_id: lead_id,
              lead_nome: lead.nome || "",
              lead_email: lead.email || "",
              lead_telefone: lead.telefone || "",
              lead_campanha: lead.campanha || "",
              lead_vendedor: lead.vendedor_nome || "",
              lead_faturamento: lead.faturamento != null ? String(lead.faturamento) : "",
              lead_setor: lead.setor_empresa || "",
              lead_gargalo: lead.maior_gargalo_comercial || "",
              lead_funil: lead.funil || "",
            },
          },
        }),
      }
    );

    if (!registerRes.ok) {
      const errText = await registerRes.text();
      throw new Error(`ElevenLabs register-call error [${registerRes.status}]: ${errText}`);
    }

    const registerData = await registerRes.json();
    const twiml = registerData.twiml;

    if (!twiml) {
      throw new Error("No TwiML returned from ElevenLabs register-call");
    }

    console.log("ElevenLabs register-call success, got TwiML");

    // Step 2: Initiate outbound call via Twilio with ElevenLabs TwiML
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`;

    const statusCallbackUrl = `${supabaseUrl}/functions/v1/twilio-call-webhook`;

    const formData = new URLSearchParams();
    formData.append("To", phone);
    formData.append("From", twilioPhone);
    formData.append("Twiml", twiml);
    formData.append("StatusCallback", statusCallbackUrl);
    formData.append("StatusCallbackEvent", "initiated");
    formData.append("StatusCallbackEvent", "ringing");
    formData.append("StatusCallbackEvent", "answered");
    formData.append("StatusCallbackEvent", "completed");

    const twilioRes = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + btoa(`${twilioSid}:${twilioAuth}`),
      },
      body: formData.toString(),
    });

    const twilioData = await twilioRes.json();
    console.log(`Twilio call response [${twilioRes.status}]:`, JSON.stringify(twilioData));

    if (!twilioRes.ok) {
      throw new Error(`Twilio call failed [${twilioRes.status}]: ${JSON.stringify(twilioData)}`);
    }

    // Save call log
    await supabase.from("call_logs").insert({
      lead_id,
      call_sid: twilioData.sid,
      agent_type: "ia_call_2",
      status: "initiated",
      telefone: phone,
    });

    // Log the call attempt
    await supabase.from("lead_logs").insert({
      lead_id,
      acao: "Ligação IA Call 2 disparada (ElevenLabs + Twilio)",
      de: "ia_call_2",
      para: "ia_call_2",
    });

    return new Response(
      JSON.stringify({
        success: true,
        call_sid: twilioData.sid,
        phone,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("trigger-ia-call-2 error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
