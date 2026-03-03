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

function parseFaturamento(val: string | number | null | undefined): number | null {
  if (val == null) return null;
  if (typeof val === "number") return val;
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

    const body = await req.json();
    const rawLeads = Array.isArray(body) ? body : body.leads ? body.leads : [body];

    if (!rawLeads?.length) {
      return new Response(JSON.stringify({ error: "No leads provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate by phone
    const seenPhones = new Set<string>();
    const uniqueLeads: any[] = [];
    for (const lead of rawLeads) {
      const phone = cleanPhone(lead.telefone || "");
      if (phone.length < 10 || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      uniqueLeads.push({ ...lead, telefone_limpo: phone });
    }

    // Check existing leads by phone
    const phones = uniqueLeads.map((l) => l.telefone_limpo);
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("telefone")
      .in("telefone", phones);

    const existingPhones = new Set(
      (existingLeads || []).map((l: any) => cleanPhone(l.telefone))
    );

    const newLeads = uniqueLeads.filter(
      (l) => !existingPhones.has(l.telefone_limpo)
    );

    // Insert new leads
    const now = new Date().toISOString();
    const leadsToInsert = newLeads.map((l) => ({
      nome: l.nome || "Sem nome",
      telefone: l.telefone_limpo,
      email: l.email || null,
      funil: "playbook_mx3",
      status_funil: "lead",
      cadencia_status: "ativa",
      cadencia_inicio: now,
      setor_empresa: l.setor_empresa || l.segmento || null,
      faturamento: parseFaturamento(l.faturamento),
      campanha: l.campanha || "",
      adset: l.adset || "",
      grupo_anuncios: l.grupo_anuncios || l.grupo_anuncio || "",
      origem: l.origem || l.utm_source || "playbook_webhook",
      tags: ["Playbook"],
      observacoes: l.observacoes || (l.empresa ? `Empresa: ${l.empresa}` : ""),
      maior_gargalo_comercial: l.maior_gargalo_comercial || null,
      tomador_decisao: l.tomador_decisao != null ? Boolean(l.tomador_decisao) : null,
      vendedor_nome: l.vendedor_nome || "",
      data_entrada: now,
      data_ultimo_movimento: now,
      envio_whatsapp_status: "pendente",
    }));

    let insertedLeads: any[] = [];
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

    // Create cadencia_execucoes for each lead
    const { data: etapas } = await supabase
      .from("cadencia_etapas")
      .select("id, dia, canal, ordem")
      .eq("funil", "playbook_mx3")
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    let totalExecs = 0;
    if (etapas?.length && insertedLeads.length) {
      let whatsappLeadIndex = 0;
      const execucoes: any[] = [];
      const cadenciaInicio = new Date(now);

      for (const lead of insertedLeads) {
        for (const etapa of etapas) {
          const baseTime = new Date(cadenciaInicio);
          baseTime.setDate(baseTime.getDate() + etapa.dia);
          if (etapa.canal === "whatsapp") {
            baseTime.setMinutes(baseTime.getMinutes() + whatsappLeadIndex * 3);
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

      for (let i = 0; i < execucoes.length; i += 100) {
        const batch = execucoes.slice(i, i + 100);
        const { error } = await supabase.from("cadencia_execucoes").insert(batch);
        if (error) {
          console.error("Exec insert error batch", i, error);
        } else {
          totalExecs += batch.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertedLeads.length,
        skipped_duplicates: uniqueLeads.length - newLeads.length,
        skipped_invalid: rawLeads.length - uniqueLeads.length,
        executions_created: totalExecs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("receive-playbook-lead error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
