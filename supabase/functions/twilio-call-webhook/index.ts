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

    // If call completed, try to fetch transcription from ElevenLabs (with delay for processing)
    if (callStatus === "completed") {
      // Wait a few seconds for ElevenLabs to finalize the conversation
      await new Promise(resolve => setTimeout(resolve, 5000));
      
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
    .select("id, metadata")
    .eq("call_sid", callSid)
    .single();

  if (!callLog) return;

  const conversationId = callLog.metadata?.conversation_id;

  if (!conversationId) {
    console.log(`No conversation_id stored for call ${callSid}, trying recent conversations`);
    // Fallback: try to find by timing (legacy calls without conversation_id)
    await fetchTranscriptionByRecent(supabase, callLog, callSid, elevenlabsApiKey);
    return;
  }

  console.log(`Fetching transcription for conversation ${conversationId}`);

  // Fetch full conversation details with transcript using stored conversation_id
  const detailRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
    {
      headers: { "xi-api-key": elevenlabsApiKey },
    }
  );

  if (!detailRes.ok) {
    const errText = await detailRes.text();
    console.error(`ElevenLabs conversation detail error [${detailRes.status}]: ${errText}`);
    // Retry after 10 more seconds (conversation might not be ready yet)
    await new Promise(resolve => setTimeout(resolve, 10000));
    const retryRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`,
      { headers: { "xi-api-key": elevenlabsApiKey } }
    );
    if (!retryRes.ok) {
      console.error(`Retry also failed for conversation ${conversationId}`);
      return;
    }
    const retryDetail = await retryRes.json();
    await storeTranscription(supabase, callLog.id, conversationId, retryDetail);
    return;
  }

  const detail = await detailRes.json();
  await storeTranscription(supabase, callLog.id, conversationId, detail);
}

async function fetchTranscriptionByRecent(supabase: any, callLog: any, callSid: string, apiKey: string) {
  const agentId = "agent_5301kjfk4npye2ttq6k12d4jk6d0";
  
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${agentId}&page_size=5`,
    { headers: { "xi-api-key": apiKey } }
  );

  if (!res.ok) return;

  const { conversations } = await res.json();
  if (!conversations?.length) return;

  // Use the most recent (fallback only for old calls)
  const conv = conversations[0];
  
  const detailRes = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversations/${conv.conversation_id}`,
    { headers: { "xi-api-key": apiKey } }
  );

  if (!detailRes.ok) return;

  const detail = await detailRes.json();
  await storeTranscription(supabase, callLog.id, conv.conversation_id, detail);
}

async function storeTranscription(supabase: any, callLogId: string, conversationId: string, detail: any) {
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
        conversation_id: conversationId,
        elevenlabs_status: detail.status,
        call_duration_secs: detail.metadata?.call_duration_secs,
      },
    })
    .eq("id", callLogId);

  console.log(`Transcription stored for call_log ${callLogId} (conversation: ${conversationId})`);
}
