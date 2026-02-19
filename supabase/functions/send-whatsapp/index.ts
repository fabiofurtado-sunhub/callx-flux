import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error("ZAPI credentials not configured");
    }

    const { lead_id, telefone, nome } = await req.json();

    if (!telefone || !lead_id) {
      return new Response(
        JSON.stringify({ error: "telefone and lead_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Format phone: remove non-digits, ensure country code
    let phone = telefone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "55" + phone.substring(1);
    if (!phone.startsWith("55")) phone = "55" + phone;

    const message =
      `Olá ${nome || ""}! Aqui é o Fábio Furtado, CEO da CallX. ` +
      `Vi que você demonstrou interesse em nossos serviços. ` +
      `Gostaria de agendar uma conversa rápida para entender melhor suas necessidades? ` +
      `Pode me contar um pouco sobre o que está buscando?`;

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

    const zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": ZAPI_CLIENT_TOKEN,
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });

    const zapiData = await zapiResponse.json();

    // Update lead status in DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const status = zapiResponse.ok ? "enviado" : "erro_envio";

    await supabase
      .from("leads")
      .update({
        envio_whatsapp_status: status,
        envio_whatsapp_data: new Date().toISOString(),
      })
      .eq("id", lead_id);

    // Log the interaction
    await supabase.from("interacoes_whatsapp").insert({
      lead_id,
      conteudo: message,
      tipo: "envio",
      status: status,
      response_data: zapiData,
    });

    return new Response(
      JSON.stringify({ success: zapiResponse.ok, status, data: zapiData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
