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
  const dias = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

  // Get tomorrow and day after tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);

  const tomorrowName = dias[tomorrow.getDay()];
  const dayAfterName = dias[dayAfter.getDay()];

  return `amanhã (${tomorrowName}) às 17:00 ou 18:00, ou na ${dayAfterName}-feira pela manhã`;
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

    const { lead_id, telefone, nome, message_override, skip_dedup_check } = await req.json();

    if (!telefone || !lead_id) {
      return new Response(
        JSON.stringify({ error: "telefone and lead_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DEDUP GUARD: Refuse to send if lead already received initial WhatsApp (unless cadencia override)
    if (!skip_dedup_check && !message_override) {
      const { data: existingLead } = await supabaseClient
        .from("leads")
        .select("envio_whatsapp_status")
        .eq("id", lead_id)
        .single();

      if (existingLead && existingLead.envio_whatsapp_status !== "pendente") {
        console.log(`⏭️ Skipping ${nome} - already has status: ${existingLead.envio_whatsapp_status}`);
        return new Response(
          JSON.stringify({ success: false, skipped: true, reason: "already_sent" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Format phone: remove non-digits, ensure country code
    let phone = telefone.replace(/\D/g, "");
    if (phone.startsWith("0")) phone = "55" + phone.substring(1);
    if (!phone.startsWith("55")) phone = "55" + phone;

    // Fetch horario_sugerido from configuracoes
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    let message: string;

    if (message_override) {
      // Use the message provided by the cadencia system
      message = message_override;
    } else {
      // Fetch lead's funnel to determine which template to use
      const { data: leadData } = await supabaseClient
        .from("leads")
        .select("funil")
        .eq("id", lead_id)
        .single();

      const leadFunil = leadData?.funil || "callx";

      // Try to fetch active template for this funnel's lead stage
      const { data: templateData } = await supabaseClient
        .from("message_templates")
        .select("conteudo")
        .eq("funil", leadFunil)
        .eq("etapa", "lead")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(1)
        .single();

      if (templateData?.conteudo) {
        // Fetch config variables for template replacement
        const { data: configData } = await supabaseClient
          .from("configuracoes")
          .select("horario_sugerido_texto, link_agendamento")
          .limit(1)
          .single();

        message = templateData.conteudo;
        message = message.replace(/\{\{nome\}\}/gi, nome || "");
        message = message.replace(/\{\{telefone\}\}/gi, telefone || "");
        message = message.replace(/\{\{horario_sugerido\}\}/gi, configData?.horario_sugerido_texto || buildScheduleText());
        message = message.replace(/\{\{LINK_AGENDAMENTO\}\}/gi, configData?.link_agendamento || "");
      } else {
        // Ultimate fallback: hardcoded CallX message
        const { data: configData } = await supabaseClient
          .from("configuracoes")
          .select("horario_sugerido_texto")
          .limit(1)
          .single();

        const scheduleText = configData?.horario_sugerido_texto || buildScheduleText();
        const leadName = nome || "";

        message =
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
      }
    }

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
    const supabase = supabaseClient;

    const whatsappStatus = zapiResponse.ok ? "enviado" : "erro_envio";

    // Fetch lead's current status to decide stage advancement
    const { data: currentLead } = await supabase
      .from("leads")
      .select("status_funil, funil")
      .eq("id", lead_id)
      .single();

    const currentStatus = currentLead?.status_funil || "lead";

    // Update WhatsApp status and conditionally advance stage
    const updatePayload: Record<string, any> = {
      envio_whatsapp_status: whatsappStatus,
      envio_whatsapp_data: new Date().toISOString(),
    };

    // Advance to mensagem_enviada if lead is at 'lead' stage (works for both callx and core_ai initial sends)
    if (zapiResponse.ok && currentStatus === "lead") {
      updatePayload.status_funil = "mensagem_enviada";
      updatePayload.data_ultimo_movimento = new Date().toISOString();
      updatePayload.score_lead = 15;
      updatePayload.probabilidade_fechamento = 15;
    }

    await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", lead_id);

    // Log stage change if it happened
    if (zapiResponse.ok && currentStatus === "lead") {
      await supabase.from("lead_logs").insert({
        lead_id,
        acao: "WhatsApp inicial enviado",
        de: "lead",
        para: "mensagem_enviada",
      });
    }

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
