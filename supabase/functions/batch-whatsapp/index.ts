import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    // Get config
    const { data: config } = await supabase
      .from("configuracoes")
      .select("link_agendamento, horario_sugerido_texto")
      .limit(1)
      .single();

    // Fetch leads
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

    // Build personalized messages and insert into queue
    const queueItems = leads.map((lead: any) => {
      let message = templateContent!;
      message = message.replace(/\{\{nome\}\}/gi, lead.nome || "");
      message = message.replace(/\{\{telefone\}\}/gi, lead.telefone || "");
      message = message.replace(/\{\{email\}\}/gi, lead.email || "");
      message = message.replace(/\{\{LINK_AGENDAMENTO\}\}/gi, config?.link_agendamento || "");
      message = message.replace(/\{\{horario_sugerido\}\}/gi, config?.horario_sugerido_texto || "");

      return {
        lead_id: lead.id,
        message,
        status: "pending",
      };
    });

    const { error: insertError } = await supabase
      .from("whatsapp_queue")
      .insert(queueItems);

    if (insertError) {
      throw new Error(`Failed to enqueue: ${insertError.message}`);
    }

    console.log(`Enqueued ${queueItems.length} messages for dispatch`);

    return new Response(
      JSON.stringify({
        queued: queueItems.length,
        message: `${queueItems.length} mensagens na fila. Serão enviadas 1 a cada 3 minutos.`,
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
