import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DELAY_MS = 3 * 60 * 1000; // 3 minutes between sends

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const leadIds: string[] = body.lead_ids || [];
    const messageOverride: string | undefined = body.message_override;
    const etapa: string = body.etapa || "no_show";

    if (leadIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "lead_ids array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get template if no override
    let templateContent = messageOverride;
    if (!templateContent) {
      const { data: template } = await supabase
        .from("message_templates")
        .select("conteudo")
        .eq("funil", "callx")
        .eq("etapa", etapa)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .limit(1)
        .single();

      if (!template) {
        return new Response(
          JSON.stringify({ error: `No active template found for etapa: ${etapa}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      templateContent = template.conteudo;
    }

    // Get config for link_agendamento
    const { data: config } = await supabase
      .from("configuracoes")
      .select("link_agendamento, horario_sugerido_texto")
      .limit(1)
      .single();

    // Fetch all leads
    const { data: leads } = await supabase
      .from("leads")
      .select("id, nome, telefone, email")
      .in("id", leadIds);

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No leads found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Starting queued dispatch: ${leads.length} leads, 3min interval`);

    const results: any[] = [];

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];

      // Wait 3 minutes between sends (skip first)
      if (i > 0) {
        console.log(`Waiting 3 minutes before sending to ${lead.nome} (${i + 1}/${leads.length})...`);
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }

      // Replace template variables
      let message = templateContent!;
      message = message.replace(/\{\{nome\}\}/gi, lead.nome || "");
      message = message.replace(/\{\{telefone\}\}/gi, lead.telefone || "");
      message = message.replace(/\{\{email\}\}/gi, lead.email || "");
      message = message.replace(/\{\{LINK_AGENDAMENTO\}\}/gi, config?.link_agendamento || "");
      message = message.replace(/\{\{horario_sugerido\}\}/gi, config?.horario_sugerido_texto || "");

      try {
        // Call send-whatsapp with message_override to avoid status changes
        const sendRes = await fetch(
          `${supabaseUrl}/functions/v1/send-whatsapp`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              lead_id: lead.id,
              telefone: lead.telefone,
              nome: lead.nome,
              message_override: message,
            }),
          }
        );

        const sendData = await sendRes.json().catch(() => ({}));
        const success = sendRes.ok;

        results.push({
          lead_id: lead.id,
          nome: lead.nome,
          status: success ? "sent" : "error",
          error: success ? undefined : sendData.error,
        });

        console.log(`${success ? "✅" : "❌"} ${lead.nome} (${i + 1}/${leads.length})`);
      } catch (err) {
        results.push({
          lead_id: lead.id,
          nome: lead.nome,
          status: "error",
          error: (err as Error).message,
        });
        console.error(`❌ ${lead.nome}: ${(err as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        total: leads.length,
        sent: results.filter((r) => r.status === "sent").length,
        errors: results.filter((r) => r.status === "error").length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("batch-whatsapp error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
