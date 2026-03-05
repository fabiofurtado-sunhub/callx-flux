import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CORE_AI_PIXEL_ID = "598204086654379";
const EVENT_SOURCE_URL = "https://coreai.aceleradoramx3.com";

async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendMetaCapiEvent(lead: any, accessToken: string) {
  const now = Math.floor(Date.now() / 1000);

  const userData: Record<string, any> = {};
  if (lead.email) {
    userData.em = [await hashSHA256(lead.email.toLowerCase().trim())];
  }
  if (lead.telefone) {
    const phone = lead.telefone.replace(/\D/g, "");
    userData.ph = [await hashSHA256(phone)];
  }
  if (lead.nome) {
    const firstName = lead.nome.trim().split(/\s+/)[0].toLowerCase();
    userData.fn = [await hashSHA256(firstName)];
  }

  const eventData = {
    event_name: "Lead",
    event_time: now,
    action_source: "website",
    event_source_url: EVENT_SOURCE_URL,
    event_id: `core_ai_lead_${Date.now()}`,
    user_data: userData,
  };

  const metaUrl = `https://graph.facebook.com/v21.0/${CORE_AI_PIXEL_ID}/events`;
  const metaResponse = await fetch(metaUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [eventData],
      access_token: accessToken,
    }),
  });

  const metaResult = await metaResponse.json();
  console.log("Meta CAPI Core AI response:", JSON.stringify(metaResult));
  return metaResult;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const rawLeads = Array.isArray(body) ? body : [body];

    // Deduplicate: skip leads whose phone already exists in the core_ai funnel
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("telefone")
      .eq("funil", "core_ai");

    const existingPhones = new Set(
      (existingLeads || []).map((l: any) => (l.telefone || "").replace(/\D/g, ""))
    );

    const newLeads = rawLeads.filter((lead: any) => {
      const phone = (lead.telefone || "").replace(/\D/g, "");
      return phone.length >= 10 && !existingPhones.has(phone);
    });

    if (newLeads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, inserted: 0, skipped_duplicates: rawLeads.length, leads: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows = newLeads.map((lead: any) => ({
      nome: lead.nome || "Sem nome",
      telefone: (lead.telefone || "").replace(/\D/g, ""),
      email: lead.email || "",
      campanha: lead.campanha || "",
      adset: lead.adset || "",
      grupo_anuncios: lead.grupo_anuncios || "",
      vendedor_nome: lead.vendedor_nome || "",
      observacoes: lead.observacoes || "",
      faturamento: lead.faturamento != null ? Number(lead.faturamento) : null,
      tomador_decisao: lead.tomador_decisao != null ? Boolean(lead.tomador_decisao) : null,
      maior_gargalo_comercial: lead.maior_gargalo_comercial || null,
      setor_empresa: lead.setor_empresa || null,
      empresa: lead.empresa || "",
      origem: lead.origem || "core_ai_webhook",
      funil: "core_ai",
      status_funil: "lead",
      envio_whatsapp_status: "pendente",
    }));

    const { data, error } = await supabase.from("leads").insert(rows).select("id, nome");

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send Meta CAPI Lead event for each lead
    const accessToken = Deno.env.get("META_CAPI_ACCESS_TOKEN");
    if (accessToken) {
      for (const lead of newLeads) {
        try {
          const metaResult = await sendMetaCapiEvent(lead, accessToken);
          const isSuccess = metaResult?.events_received >= 1;
          const errorMsg = metaResult?.error?.error_user_msg || metaResult?.error?.message || null;
          const insertedLead = data?.find((d: any) => d.nome === (lead.nome || "Sem nome"));

          if (insertedLead) {
            await supabase.from("meta_capi_logs").insert({
              lead_id: insertedLead.id,
              event_name: "Lead",
              stage: "lead",
              status: isSuccess ? "success" : "error",
              meta_response: metaResult,
              error_message: errorMsg,
            });
          }
        } catch (capiErr) {
          console.error("Meta CAPI error for lead:", lead.nome, capiErr);
        }
      }
    } else {
      console.warn("META_CAPI_ACCESS_TOKEN not set, skipping CAPI event");
    }

    return new Response(
      JSON.stringify({ success: true, inserted: data?.length || 0, leads: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
