import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function cleanPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function parseFaturamento(val: string): number | null {
  if (!val) return null;
  if (val.includes("Acima de R$ 5")) return 5000000;
  if (val.includes("1 milhão - R$ 5")) return 3000000;
  if (val.includes("500 mil - R$ 1")) return 750000;
  if (val.includes("100 mil - R$ 500")) return 300000;
  if (val.includes("50 mil - R$ 100")) return 75000;
  if (val.includes("0 mil - R$ 50") || val.includes("0 - R$ 100")) return 25000;
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { leads: rawLeads } = await req.json();
    if (!rawLeads?.length) {
      return new Response(JSON.stringify({ error: "No leads provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate within the same batch only (by phone)
    const seenPhones = new Set<string>();
    const uniqueLeads: any[] = [];
    for (const lead of rawLeads) {
      const phone = cleanPhone(lead.telefone);
      if (phone.length < 10 || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      uniqueLeads.push({ ...lead, telefone_limpo: phone });
    }

    // No database dedup for playbook — accepts leads even if they exist in other funnels
    const newLeads = uniqueLeads;

    // Insert new leads
    const now = new Date().toISOString();
    const leadsToInsert = newLeads.map((l) => ({
      nome: l.nome,
      telefone: l.telefone_limpo,
      email: l.email || null,
      funil: "playbook_mx3",
      status_funil: "lead",
      cadencia_status: "ativa",
      cadencia_inicio: now,
      setor_empresa: l.segmento || null,
      faturamento: parseFaturamento(l.faturamento),
      campanha: l.campanha || "",
      adset: l.grupo_anuncio || "",
      grupo_anuncios: l.grupo_anuncio || "",
      origem: l.utm_source || "planilha_importacao",
      observacoes: l.empresa ? `Empresa: ${l.empresa}` : "",
      data_entrada: now,
      data_ultimo_movimento: now,
    }));

    let insertedLeads: any[] = [];
    // Insert in batches of 50
    for (let i = 0; i < leadsToInsert.length; i += 50) {
      const batch = leadsToInsert.slice(i, i + 50);
      const { data, error } = await supabase
        .from("leads")
        .insert(batch)
        .select("id");
      if (error) {
        console.error("Insert error batch", i, error);
        continue;
      }
      if (data) insertedLeads = insertedLeads.concat(data);
    }

    // Get all active cadencia etapas for playbook_mx3
    const { data: etapas } = await supabase
      .from("cadencia_etapas")
      .select("id, dia, canal, ordem")
      .eq("funil", "playbook_mx3")
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (!etapas?.length || !insertedLeads.length) {
      return new Response(
        JSON.stringify({
          inserted: insertedLeads.length,
          skipped_duplicates: uniqueLeads.length - newLeads.length,
          skipped_from_file: rawLeads.length - uniqueLeads.length,
          executions_created: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create cadencia_execucoes for each lead x etapa
    // WhatsApp steps are staggered by 3 min per lead
    let whatsappLeadIndex = 0;
    const execucoes: any[] = [];
    const cadenciaInicio = new Date(now);

    for (const lead of insertedLeads) {
      for (const etapa of etapas) {
        const baseTime = new Date(cadenciaInicio);
        baseTime.setDate(baseTime.getDate() + etapa.dia);

        // Stagger WhatsApp by 3 min per lead
        if (etapa.canal === "whatsapp") {
          baseTime.setMinutes(
            baseTime.getMinutes() + whatsappLeadIndex * 3
          );
        }

        execucoes.push({
          lead_id: lead.id,
          cadencia_etapa_id: etapa.id,
          agendado_para: baseTime.toISOString(),
          status: "pendente",
        });
      }
      whatsappLeadIndex++;
    }

    // Insert executions in batches of 100
    let totalExecs = 0;
    for (let i = 0; i < execucoes.length; i += 100) {
      const batch = execucoes.slice(i, i + 100);
      const { error } = await supabase
        .from("cadencia_execucoes")
        .insert(batch);
      if (error) {
        console.error("Exec insert error batch", i, error);
      } else {
        totalExecs += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        inserted: insertedLeads.length,
        skipped_duplicates: uniqueLeads.length - newLeads.length,
        skipped_from_file: rawLeads.length - uniqueLeads.length,
        executions_created: totalExecs,
        message: `WhatsApp staggered by 3 min per lead. First D+0 WhatsApp messages will be sent one every 3 min by the cron.`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("import-playbook-leads error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
