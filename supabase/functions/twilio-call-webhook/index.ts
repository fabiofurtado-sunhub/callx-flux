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

    // Twilio sends form-encoded data
    const contentType = req.headers.get("content-type") || "";
    let callSid = "";
    let callStatus = "";
    let callDuration = "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      callSid = formData.get("CallSid")?.toString() || "";
      callStatus = formData.get("CallStatus")?.toString() || "";
      // Twilio sends Duration or CallDuration depending on context
      callDuration = formData.get("CallDuration")?.toString() || formData.get("Duration")?.toString() || "";
    } else {
      const body = await req.json();
      callSid = body.CallSid || body.call_sid || "";
      callStatus = body.CallStatus || body.status || "";
      callDuration = body.CallDuration || body.Duration || body.duration || "";
    }

    if (!callSid) {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    console.log(`Webhook: ${callSid} -> ${callStatus} (duration: ${callDuration}s)`);

    const updates: Record<string, unknown> = {
      status: callStatus,
    };

    if (callDuration && parseInt(callDuration, 10) > 0) {
      updates.duration_seconds = parseInt(callDuration, 10);
    }

    const { error } = await supabase
      .from("call_logs")
      .update(updates)
      .eq("call_sid", callSid);

    if (error) {
      console.error("Error updating call_log:", error);
    }

    // If call completed, fetch transcription from ElevenLabs
    if (callStatus === "completed") {
      // Wait for ElevenLabs to finalize the conversation
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      fetchAndStoreTranscription(supabase, callSid).catch(err => {
        console.error("Transcription fetch error:", err);
      });
    }

    return new Response("OK", { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("twilio-call-webhook error:", error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});

async function fetchAndStoreTranscription(supabase: any, callSid: string) {
  const elevenlabsApiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!elevenlabsApiKey) return;

  // Get call_log to find stored conversation_id
  const { data: callLog } = await supabase
    .from("call_logs")
    .select("id, metadata, lead_id")
    .eq("call_sid", callSid)
    .single();

  if (!callLog) return;

  const conversationId = callLog.metadata?.conversation_id;

  if (!conversationId) {
    console.log(`No conversation_id stored for call ${callSid}, skipping transcription`);
    return;
  }

  console.log(`Fetching transcription for conversation ${conversationId}`);

  // Fetch conversation details with transcript
  let detail: any = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const detailRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      { headers: { "xi-api-key": elevenlabsApiKey } }
    );

    if (detailRes.ok) {
      detail = await detailRes.json();
      // Check if transcript is available
      if (detail.transcript && detail.transcript.length > 0) {
        break;
      }
      console.log(`Attempt ${attempt + 1}: transcript not ready yet`);
    } else {
      console.log(`Attempt ${attempt + 1}: ElevenLabs returned ${detailRes.status}`);
    }

    // Wait before retry
    if (attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  if (!detail) {
    console.error(`Failed to fetch conversation ${conversationId} after 3 attempts`);
    return;
  }

  await storeTranscription(supabase, callLog.id, callSid, conversationId, detail, callLog.metadata);
}

const VOICEMAIL_PATTERNS = [
  "vamos entregar o seu recado",
  "caixa postal",
  "deixe sua mensagem",
  "após o sinal",
  "leave a message",
  "voicemail",
  "não está disponível no momento",
  "celular estiver disponível",
];

function isVoicemail(transcricao: string): boolean {
  const lower = transcricao.toLowerCase();
  return VOICEMAIL_PATTERNS.some((p) => lower.includes(p));
}

async function storeTranscription(
  supabase: any,
  callLogId: string,
  callSid: string,
  conversationId: string,
  detail: any,
  existingMetadata: any
) {
  let transcricao = "";
  if (detail.transcript && detail.transcript.length > 0) {
    transcricao = detail.transcript
      .map((msg: any) => `${msg.role === "agent" ? "🤖 Agente" : "👤 Lead"}: ${msg.message}`)
      .join("\n\n");
  }

  const resumo = detail.analysis?.summary || null;
  const sentimento = detail.analysis?.evaluation_criteria_results
    ? JSON.stringify(detail.analysis.evaluation_criteria_results)
    : null;

  const elDurationSecs = detail.metadata?.call_duration_secs;

  // Detect voicemail from transcript content
  const detectedVoicemail = transcricao ? isVoicemail(transcricao) : false;

  const mergedMetadata = {
    ...(existingMetadata || {}),
    conversation_id: conversationId,
    elevenlabs_status: detail.status,
    call_duration_secs: elDurationSecs,
    ...(detectedVoicemail ? { voicemail: true } : {}),
  };

  const updates: Record<string, unknown> = {
    transcricao: transcricao || null,
    resumo,
    sentimento,
    metadata: mergedMetadata,
    ...(detectedVoicemail ? { status: "caixa_postal" } : {}),
  };

  if (elDurationSecs && elDurationSecs > 0) {
    updates.duration_seconds = Math.round(elDurationSecs);
  }

  await supabase
    .from("call_logs")
    .update(updates)
    .eq("id", callLogId);

  console.log(`Transcription stored for call_log ${callLogId} (conversation: ${conversationId}, duration: ${elDurationSecs}s, voicemail: ${detectedVoicemail})`);

  // If not voicemail and there's a real conversation, analyze for interest/meeting signals
  if (!detectedVoicemail && transcricao && transcricao.length > 200) {
    // Get lead info
    const { data: callLog } = await supabase
      .from("call_logs")
      .select("lead_id")
      .eq("id", callLogId)
      .single();

    if (callLog?.lead_id) {
      analyzeTranscriptForInterest(supabase, callLog.lead_id, callLogId, transcricao).catch(err => {
        console.error("Interest analysis error:", err);
      });
    }
  }
}

async function analyzeTranscriptForInterest(
  supabase: any,
  leadId: string,
  callLogId: string,
  transcricao: string
) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    console.log("LOVABLE_API_KEY not set, skipping interest analysis");
    return;
  }

  const { data: lead } = await supabase
    .from("leads")
    .select("nome")
    .eq("id", leadId)
    .single();

  const leadNome = lead?.nome || "Lead";

  const prompt = `Analise esta transcrição de uma ligação comercial e determine se o lead demonstrou INTERESSE REAL ou AGENDOU/CONFIRMOU uma reunião.

REGRAS:
- Respostas de caixa postal, secretária eletrônica ou "entrego seu recado" NÃO contam como interesse
- O lead precisa ter FALADO e demonstrado interesse genuíno (ex: "me conta mais", "quero agendar", "pode sim", "vamos marcar")
- Apenas confirmar que está na linha ou pedir para esperar NÃO conta como interesse
- Se a conversa foi apenas com caixa postal/secretária, responda "nenhum"

Responda APENAS com um JSON:
{"sinal": "interesse" | "agendamento" | "nenhum", "resumo": "frase curta explicando"}

TRANSCRIÇÃO:
${transcricao.substring(0, 3000)}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      }),
    });

    if (!res.ok) {
      console.error(`AI analysis failed: ${res.status}`);
      return;
    }

    const aiData = await res.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Extract JSON from response
    const jsonMatch = content.match(/\{[^}]+\}/);
    if (!jsonMatch) return;

    const analysis = JSON.parse(jsonMatch[0]);
    console.log(`Interest analysis for ${leadNome}: ${analysis.sinal} - ${analysis.resumo}`);

    if (analysis.sinal === "interesse" || analysis.sinal === "agendamento") {
      const tipo = analysis.sinal === "agendamento" ? "agendamento" : "oportunidade";
      const mensagem = analysis.sinal === "agendamento"
        ? `🗓️ ${leadNome} confirmou interesse em agendar reunião durante ligação IA: "${analysis.resumo}"`
        : `🔥 ${leadNome} demonstrou interesse durante ligação IA: "${analysis.resumo}"`;

      await supabase.from("alertas_comerciais").insert({
        lead_id: leadId,
        tipo,
        mensagem,
      });

      console.log(`Alert created for lead ${leadNome}: ${tipo}`);
    }
  } catch (err) {
    console.error("AI analysis parse error:", err);
  }
}
