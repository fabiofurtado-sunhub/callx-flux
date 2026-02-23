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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check business hours (08:00-18:00 BRT)
    const nowBRT = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const hour = nowBRT.getHours();
    const dayOfWeek = nowBRT.getDay(); // 0=Sun, 6=Sat

    if (hour < 8 || hour >= 18 || dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(
        JSON.stringify({ processed: 0, message: "Outside business hours (08-18h BRT, Mon-Fri). Skipping." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find all pending executions that are due
    const now = new Date().toISOString();
    const { data: pendingExecs, error: fetchError } = await supabase
      .from("cadencia_execucoes")
      .select("*, cadencia_etapas(*)")
      .eq("status", "pendente")
      .lte("agendado_para", now)
      .order("agendado_para", { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;
    if (!pendingExecs?.length) {
      return new Response(
        JSON.stringify({ processed: 0, message: "No pending executions" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;
    let skipped = 0;
    let whatsappThrottled = 0;

    // Check last WhatsApp send time from this cadence to enforce 3-min spacing
    const { data: lastWhatsapp } = await supabase
      .from("cadencia_execucoes")
      .select("executado_em")
      .eq("status", "executado")
      .in("cadencia_etapa_id", pendingExecs.filter(e => e.cadencia_etapas?.canal === "whatsapp").map(e => e.cadencia_etapa_id))
      .not("executado_em", "is", null)
      .order("executado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastWhatsappTime = lastWhatsapp?.executado_em ? new Date(lastWhatsapp.executado_em).getTime() : 0;
    let whatsappSentInThisRun = false;

    for (const exec of pendingExecs) {
      const etapa = exec.cadencia_etapas;
      if (!etapa || !etapa.ativo) {
        await supabase
          .from("cadencia_execucoes")
          .update({ status: "pulado", executado_em: now, resultado: { reason: "etapa_inativa" } })
          .eq("id", exec.id);
        skipped++;
        continue;
      }

      // Check if lead is still in active cadence
      const { data: lead } = await supabase
        .from("leads")
        .select("id, nome, email, telefone, cadencia_status, status_funil, funil")
        .eq("id", exec.lead_id)
        .single();

      if (!lead || lead.cadencia_status !== "ativa" || lead.status_funil === "venda" || lead.status_funil === "perdido") {
        await supabase
          .from("cadencia_execucoes")
          .update({ status: "pulado", executado_em: now, resultado: { reason: "lead_saiu_cadencia" } })
          .eq("id", exec.id);
        skipped++;
        continue;
      }

      // Check conditional logic
      if (etapa.condicional && etapa.condicao_tipo) {
        const shouldExecute = await checkCondition(supabase, exec.lead_id, etapa.condicao_tipo, etapa.condicao_referencia_id);
        if (!shouldExecute) {
          await supabase
            .from("cadencia_execucoes")
            .update({ status: "condicao_nao_atendida", executado_em: now, resultado: { reason: etapa.condicao_tipo } })
            .eq("id", exec.id);
          skipped++;
          continue;
        }
      }

      // Execute based on channel
      let result: any = {};
      try {
        if (etapa.canal === "email" && lead.email) {
          // Replace variables in content
          const html = await replaceVariables(etapa.conteudo, lead, supabase);

          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              lead_id: lead.id,
              to_email: lead.email,
              subject: etapa.titulo,
              html_body: html,
              cadencia_etapa_id: etapa.id,
            }),
          });
          result = await emailRes.json();
        } else if (etapa.canal === "whatsapp" && lead.telefone) {
          // Throttle: max 1 WhatsApp per run, and at least 3 min since last send
          const timeSinceLastWA = Date.now() - lastWhatsappTime;
          if (whatsappSentInThisRun || timeSinceLastWA < 3 * 60 * 1000) {
            // Leave as pending for next run
            whatsappThrottled++;
            continue;
          }

          const message = await replaceVariables(etapa.conteudo, lead, supabase);

          const whatsappRes = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
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
          });
          result = await whatsappRes.json();
          whatsappSentInThisRun = true;
        }

        await supabase
          .from("cadencia_execucoes")
          .update({ status: "executado", executado_em: now, resultado: result })
          .eq("id", exec.id);
        processed++;
      } catch (execError) {
        await supabase
          .from("cadencia_execucoes")
          .update({ status: "erro", executado_em: now, resultado: { error: execError.message } })
          .eq("id", exec.id);
      }
    }

    return new Response(
      JSON.stringify({ processed, skipped, whatsappThrottled, total: pendingExecs.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-cadencia error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkCondition(
  supabase: any,
  leadId: string,
  conditionType: string,
  referenceEtapaId: string | null
): Promise<boolean> {
  switch (conditionType) {
    case "nao_abriu_email": {
      // Check if lead opened any email from the reference step
      if (!referenceEtapaId) return true;
      const { data } = await supabase
        .from("email_logs")
        .select("aberto")
        .eq("lead_id", leadId)
        .eq("cadencia_etapa_id", referenceEtapaId)
        .limit(1)
        .single();
      return data ? !data.aberto : true;
    }
    case "nao_clicou_cta": {
      if (!referenceEtapaId) return true;
      const { data } = await supabase
        .from("email_logs")
        .select("clicado")
        .eq("lead_id", leadId)
        .eq("cadencia_etapa_id", referenceEtapaId)
        .limit(1)
        .single();
      return data ? !data.clicado : true;
    }
    case "nao_converteu": {
      const { data } = await supabase
        .from("leads")
        .select("status_funil")
        .eq("id", leadId)
        .single();
      return data ? !["reuniao", "reuniao_realizada", "proposta", "venda"].includes(data.status_funil) : true;
    }
    default:
      return true;
  }
}

async function replaceVariables(content: string, lead: any, supabase: any): Promise<string> {
  let result = content
    .replace(/\{\{nome\}\}/g, lead.nome || "")
    .replace(/\{\{Nome\}\}/g, lead.nome || "")
    .replace(/\{\{email\}\}/g, lead.email || "")
    .replace(/\{\{telefone\}\}/g, lead.telefone || "");

  // Replace {{LINK_AGENDAMENTO}} from config
  if (result.includes("{{LINK_AGENDAMENTO}}")) {
    const { data: config } = await supabase
      .from("configuracoes")
      .select("link_agendamento")
      .limit(1)
      .single();
    result = result.replace(/\{\{LINK_AGENDAMENTO\}\}/g, config?.link_agendamento || "#");
  }

  return result;
}
