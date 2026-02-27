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
      callDuration = formData.get("CallDuration")?.toString() || "";
    } else {
      const body = await req.json();
      callSid = body.CallSid || body.call_sid || "";
      callStatus = body.CallStatus || body.status || "";
      callDuration = body.CallDuration || body.duration || "";
    }

    if (!callSid) {
      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    console.log(`Webhook: ${callSid} -> ${callStatus} (${callDuration}s)`);

    const updates: Record<string, unknown> = {
      status: callStatus,
    };

    if (callDuration) {
      updates.duration_seconds = parseInt(callDuration, 10);
    }

    const { error } = await supabase
      .from("call_logs")
      .update(updates)
      .eq("call_sid", callSid);

    if (error) {
      console.error("Error updating call_log:", error);
    }

    // If call completed, try to fetch transcription from ElevenLabs
    if (callStatus === "completed") {
      // Fetch conversation data from ElevenLabs (fire-and-forget)
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

  // Get call_log to find metadata with conversation info
  const { data: callLog } = await supabase
    .from("call_logs")
    .select("id, metadata")
    .eq("call_sid", callSid)
    .single();

  if (!callLog) return;

  // Try to get recent conversations from ElevenLabs
  const agentId = "agent_5301kjfk4npye2ttq6k12d4jk6d0";
  
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${agentId}&page_size=20`,
    {
      headers: { "xi-api-key": elevenlabsApiKey },
    }
  );

  if (!res.ok) {
    console.error("ElevenLabs conversations list error:", res.status);
    return;
  }

  const { conversations } = await res.json();
  if (!conversations?.length) return;

  // Try to match by timing — get the most recent conversation
  const conv = conversations[0];
  
  // Fetch full conversation details with transcript
  const detailRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conv.conversation_id}`,
    {
      headers: { "xi-api-key": elevenlabsApiKey },
    }
  );

  if (!detailRes.ok) return;

  const detail = await detailRes.json();
  
  // Build transcription from messages
  let transcricao = "";
  if (detail.transcript) {
    transcricao = detail.transcript
      .map((msg: any) => `${msg.role === "agent" ? "🤖 Agente" : "👤 Lead"}: ${msg.message}`)
      .join("\n\n");
  }

  const resumo = detail.analysis?.summary || null;
  const sentimento = detail.analysis?.evaluation_criteria_results
    ? JSON.stringify(detail.analysis.evaluation_criteria_results)
    : null;

  await supabase
    .from("call_logs")
    .update({
      transcricao,
      resumo,
      sentimento,
      metadata: {
        ...(callLog.metadata || {}),
        conversation_id: conv.conversation_id,
        elevenlabs_status: detail.status,
        call_duration_secs: detail.metadata?.call_duration_secs,
      },
    })
    .eq("id", callLog.id);

  console.log(`Transcription stored for call ${callSid}`);
}
