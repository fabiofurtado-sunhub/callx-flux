import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildScheduleText(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  if (dayOfWeek === 5) {
    // Friday → suggest Monday
    return "segunda-feira na parte da manhã ou na parte da tarde";
  } else if (dayOfWeek === 6) {
    // Saturday → suggest Monday
    return "segunda-feira na parte da manhã ou na parte da tarde";
  } else if (dayOfWeek === 0) {
    // Sunday → suggest Monday
    return "amanhã (segunda) na parte da manhã ou na parte da tarde";
  } else {
    // Mon-Thu → suggest tomorrow
    return "amanhã na parte da manhã ou na parte da tarde";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
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

    const scheduleText = buildScheduleText();
    const leadName = nome || "";

    const message =
      `Olá ${leadName}, aqui é o Fábio Furtado, CEO da MX3.\n\n` +
      `Você se inscreveu na campanha da nossa IA comercial, o CallX (em nossa campanha do Meta) e pelo perfil da sua empresa, fiz questão de vir pessoalmente tratar do seu atendimento.\n\n` +
      `Antes de avançarmos, quero entender:\n\n` +
      `Hoje, o seu maior gargalo está em:\n\n` +
      `1. Volume de lead qualificado\n` +
      `2. Conversão do time\n` +
      `3. Follow-up e perda de oportunidades\n` +
      `4. Falta de previsibilidade comercial\n\n` +
      `Se fizer sentido, eu mesmo bloqueio 30 minutos na minha agenda ainda essa semana para analisarmos sua operação e ver se o CallX faz sentido dentro da sua estratégia.\n\n` +
      `Para você fica melhor ${scheduleText}?`;

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ZAPI_CLIENT_TOKEN) headers["Client-Token"] = ZAPI_CLIENT_TOKEN;

    const zapiResponse = await fetch(zapiUrl, {
      method: "POST",
      headers,
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

    const whatsappStatus = zapiResponse.ok ? "enviado" : "erro_envio";

    // Update WhatsApp status and move to 'mensagem_enviada' stage
    await supabase
      .from("leads")
      .update({
        envio_whatsapp_status: whatsappStatus,
        envio_whatsapp_data: new Date().toISOString(),
        ...(zapiResponse.ok ? { status_funil: "mensagem_enviada" } : {}),
      })
      .eq("id", lead_id);

    // Log the interaction
    await supabase.from("interacoes_whatsapp").insert({
      lead_id,
      conteudo: message,
      tipo: "envio",
      status: whatsappStatus,
      response_data: zapiData,
    });

    return new Response(
      JSON.stringify({ success: zapiResponse.ok, status: whatsappStatus, data: zapiData }),
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
