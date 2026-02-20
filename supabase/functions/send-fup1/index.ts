import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getRandomMessage(nome: string): string {
  const messages = [
    // OPÇÃO 1
    `Boa tarde ${nome}\n\nTe chamei sobre o CallX, mas pode ser que tenha passado batido.\n\nMe diz só uma coisa rápida:\n\nHoje sua maior dor está em gerar demanda ou em converter melhor o que já chega?`,

    // OPÇÃO 2
    `Vou ser direto.\n\nNos últimos 10 dias, fechamos 4 operações que estavam exatamente no mesmo cenário: lead entrando e dinheiro ficando na mesa por falta de processo.\n\nSe não for prioridade agora, sem problema.\n\nMas se você quiser entender como estamos organizando isso, eu te explico em 20 minutos.\n\nPrefere amanhã ou segunda pela manhã?`,

    // OPÇÃO 3
    `Boa tarde ${nome}\n\nEu te chamei esses dias sobre o CallX e fiquei na dúvida se a mensagem fez sentido para você.\n\nNão gosto de insistir quando não é prioridade.\n\nMas como tenho visto muita empresa deixando dinheiro na mesa por falta de timing e follow-up, preferi confirmar antes de encerrar por aqui.\n\nSe hoje não é o momento, me fala com tranquilidade.\n\nSe fizer sentido entender como estamos organizando outras operações, eu separo 20 minutos para te mostrar.\n\nPrefere amanhã ou segunda pela manhã?`,
  ];

  return messages[Math.floor(Math.random() * messages.length)];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ZAPI_INSTANCE_ID = Deno.env.get("ZAPI_INSTANCE_ID");
    const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN");
    const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN) {
      throw new Error("ZAPI credentials not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch leads in 'mensagem_enviada' for at least 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: leads, error: fetchError } = await supabase
      .from("leads")
      .select("id, nome, telefone, envio_whatsapp_data")
      .eq("status_funil", "mensagem_enviada")
      .lt("envio_whatsapp_data", cutoff);

    if (fetchError) throw fetchError;
    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ message: "No leads in mensagem_enviada", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapiUrl = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (ZAPI_CLIENT_TOKEN) headers["Client-Token"] = ZAPI_CLIENT_TOKEN;

    let processed = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        // Format phone
        let phone = lead.telefone.replace(/\D/g, "");
        if (phone.startsWith("0")) phone = "55" + phone.substring(1);
        if (!phone.startsWith("55")) phone = "55" + phone;

        const message = getRandomMessage(lead.nome || "");

        const zapiResponse = await fetch(zapiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ phone, message }),
        });

        const zapiData = await zapiResponse.json();
        const whatsappStatus = zapiResponse.ok ? "enviado" : "erro_envio";

        // Move to fup_1 and update WhatsApp status
        if (zapiResponse.ok) {
          await supabase
            .from("leads")
            .update({
              status_funil: "fup_1",
              envio_whatsapp_status: whatsappStatus,
              envio_whatsapp_data: new Date().toISOString(),
              data_ultimo_movimento: new Date().toISOString(),
              score_lead: 20,
              probabilidade_fechamento: 20,
            })
            .eq("id", lead.id);
        }

        // Log the interaction
        await supabase.from("interacoes_whatsapp").insert({
          lead_id: lead.id,
          conteudo: message,
          tipo: "fup_1",
          status: whatsappStatus,
          response_data: zapiData,
        });

        // Log movement
        if (zapiResponse.ok) {
          await supabase.from("lead_logs").insert({
            lead_id: lead.id,
            acao: "FUP 1 automático",
            de: "mensagem_enviada",
            para: "fup_1",
          });
        }

        processed++;
      } catch (leadError) {
        errors.push(`Lead ${lead.id}: ${leadError.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, total: leads.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-fup1 error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
