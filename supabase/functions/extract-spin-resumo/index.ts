import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { respostas } = await req.json();

    const prompt = `Você é um assistente que extrai dados estruturados de respostas de diagnóstico comercial SPIN.

Com base nas respostas abaixo, extraia os seguintes campos em JSON:
- numVendedores (número de vendedores/SDRs mencionados, string)
- ticketMedio (ticket médio mencionado, string com R$ se aplicável)
- cicloMedio (ciclo médio em dias, string)
- crmAtual (nome do CRM/ferramenta mencionada, string)
- canalPrincipal (principal canal de geração de leads, string)
- volumeLeads (volume mensal aproximado de leads, string)
- temPlaybook ("Sim", "Não" ou "Parcial")

Se algum campo não puder ser extraído das respostas, retorne string vazia "".
Retorne APENAS o JSON, sem markdown, sem explicações.

Respostas SPIN - Situação:
S1: ${respostas.S1 || ""}
S2: ${respostas.S2 || ""}
S3: ${respostas.S3 || ""}
S4: ${respostas.S4 || ""}
S5: ${respostas.S5 || ""}
S6: ${respostas.S6 || ""}`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";
    
    // Parse JSON from response, handling possible markdown wrapping
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {};
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
