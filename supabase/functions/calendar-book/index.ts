import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
  const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }).toString(),
    }
  );

  if (!res.ok) throw new Error(`Azure token error: ${await res.text()}`);
  return (await res.json()).access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id, slot_start, nome, email, telefone } = await req.json();

    if (!lead_id || !slot_start) {
      return new Response(
        JSON.stringify({ error: "lead_id and slot_start are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate end time (45 min)
    const startDate = new Date(slot_start);
    const endDate = new Date(startDate.getTime() + 45 * 60 * 1000);

    // Get calendar email from config
    const { data: config } = await supabase
      .from("configuracoes")
      .select("email_from_address")
      .limit(1)
      .single();

    const calendarEmail = config?.email_from_address || "contato@mx3.com.br";

    // Create calendar event via Microsoft Graph
    const accessToken = await getAccessToken();

    const eventBody = {
      subject: `Diagnóstico Comercial - ${nome || "Lead"}`,
      body: {
        contentType: "HTML",
        content: `<p>Reunião de diagnóstico comercial agendada.</p>
          <p><strong>Nome:</strong> ${nome || "N/A"}</p>
          <p><strong>Email:</strong> ${email || "N/A"}</p>
          <p><strong>Telefone:</strong> ${telefone || "N/A"}</p>`,
      },
      start: {
        dateTime: startDate.toISOString().replace("Z", ""),
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: endDate.toISOString().replace("Z", ""),
        timeZone: "America/Sao_Paulo",
      },
      attendees: email
        ? [{ emailAddress: { address: email, name: nome || "" }, type: "required" }]
        : [],
      isOnlineMeeting: true,
      onlineMeetingProvider: "teamsForBusiness",
    };

    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${calendarEmail}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(eventBody),
      }
    );

    const graphData = await graphRes.json();

    if (!graphRes.ok) {
      console.error("Graph API error:", graphData);
      return new Response(
        JSON.stringify({ error: "Failed to create calendar event", details: graphData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update original lead: exit cadence, move to reuniao
    const now = new Date().toISOString();

    // Get original lead data for cloning
    const { data: originalLead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    await supabase
      .from("leads")
      .update({
        status_funil: "reuniao",
        cadencia_status: "concluida",
        cadencia_saida_motivo: "agendou_diagnostico",
        data_ultimo_movimento: now,
        score_lead: 30,
        probabilidade_fechamento: 30,
      })
      .eq("id", lead_id);

    // Cancel pending cadence executions
    await supabase
      .from("cadencia_execucoes")
      .update({ status: "cancelado", executado_em: now, resultado: { reason: "lead_agendou" } })
      .eq("lead_id", lead_id)
      .eq("status", "pendente");

    // Log the movement
    await supabase.from("lead_logs").insert({
      lead_id,
      acao: "Agendamento diagnóstico",
      de: "cadencia_ativa",
      para: "reuniao",
    });

    // Create a card in the "diagnostico" funnel (starts at reuniao)
    const meetingLink = graphData.onlineMeeting?.joinUrl || graphData.webLink || null;
    const diagLeadData = {
      nome: originalLead?.nome || nome || "Sem nome",
      telefone: originalLead?.telefone || telefone || "",
      email: originalLead?.email || email || null,
      funil: "diagnostico",
      status_funil: "reuniao",
      cadencia_status: "concluida",
      origem: originalLead?.origem || "agenda",
      empresa: originalLead?.empresa || "",
      setor_empresa: originalLead?.setor_empresa || null,
      faturamento: originalLead?.faturamento || null,
      campanha: originalLead?.campanha || "",
      vendedor_id: originalLead?.vendedor_id || null,
      vendedor_nome: originalLead?.vendedor_nome || "",
      tags: ["Diagnóstico"],
      observacoes: `Agendado via página /agenda. Link: ${meetingLink || "N/A"}. Lead original: ${lead_id}`,
      score_lead: 30,
      probabilidade_fechamento: 30,
      data_entrada: now,
      data_ultimo_movimento: now,
    };

    const { data: diagLead, error: diagError } = await supabase
      .from("leads")
      .insert(diagLeadData)
      .select("id")
      .single();

    if (diagError) {
      console.error("Error creating diagnostico lead:", diagError);
    } else {
      console.log("Diagnostico lead created:", diagLead?.id);
      // Log the creation
      await supabase.from("lead_logs").insert({
        lead_id: diagLead!.id,
        acao: "Lead criado no funil Diagnóstico via agendamento",
        de: null,
        para: "reuniao",
      });
    }

    const meetingLink = graphData.onlineMeeting?.joinUrl || graphData.webLink || null;

    return new Response(
      JSON.stringify({
        success: true,
        event_id: graphData.id,
        meeting_link: meetingLink,
        start: slot_start,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("calendar-book error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
