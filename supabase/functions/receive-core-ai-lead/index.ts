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

    const body = await req.json();

    // Accept single lead or array of leads
    const leadsToInsert = Array.isArray(body) ? body : [body];

    const rows = leadsToInsert.map((lead: any) => ({
      nome: lead.nome || "Sem nome",
      telefone: lead.telefone || "",
      email: lead.email || "",
      campanha: lead.campanha || "",
      adset: lead.adset || "",
      grupo_anuncios: lead.grupo_anuncios || "",
      vendedor_nome: lead.vendedor_nome || "",
      observacoes: lead.observacoes || "",
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
