import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_CONCURRENT_CALLS = 5;
const RETRY_DELAY_MINUTES = 30;
const MAX_RETRIES = 2;

// Statuses that count as "active" (call in progress)
const ACTIVE_STATUSES = ["initiated", "ringing", "in-progress", "queued"];

// Statuses that should trigger a retry
const RETRY_STATUSES = ["no-answer", "busy", "failed", "caixa_postal"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Count active calls
    const { count: activeCalls } = await supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .in("status", ACTIVE_STATUSES)
      .eq("agent_type", "ia_call_2");

    const currentActive = activeCalls || 0;
    console.log(`Active calls: ${currentActive}/${MAX_CONCURRENT_CALLS}`);

    if (currentActive >= MAX_CONCURRENT_CALLS) {
      return new Response(
        JSON.stringify({ message: "Max concurrent calls reached", active: currentActive, triggered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const slotsAvailable = MAX_CONCURRENT_CALLS - currentActive;

    // 2. Schedule retries: update call_logs that failed/voicemail and are past retry delay
    const retryThreshold = new Date(Date.now() - RETRY_DELAY_MINUTES * 60 * 1000).toISOString();

    // Find leads that need a retry (failed/voicemail calls older than 30min, with < MAX_RETRIES attempts)
    const { data: retryableCalls } = await supabase
      .from("call_logs")
      .select("lead_id, metadata")
      .eq("agent_type", "ia_call_2")
      .in("status", RETRY_STATUSES)
      .lt("updated_at", retryThreshold)
      .order("updated_at", { ascending: true })
      .limit(50);

    // Get retry counts per lead
    const retryLeadIds: string[] = [];
    if (retryableCalls) {
      for (const call of retryableCalls) {
        const retryCount = (call.metadata as any)?.retry_count || 0;
        if (retryCount < MAX_RETRIES && !retryLeadIds.includes(call.lead_id)) {
          retryLeadIds.push(call.lead_id);
        }
      }
    }

    // 3. Find leads in ia_call_2 that have NO call_log yet (new leads)
    const { data: leadsWithoutCalls } = await supabase
      .from("leads")
      .select("id")
      .eq("status_funil", "ia_call_2")
      .eq("funil", "callx");

    // Filter to only leads without any active/recent call
    let newLeadIds: string[] = [];
    if (leadsWithoutCalls && leadsWithoutCalls.length > 0) {
      const allLeadIds = leadsWithoutCalls.map((l: any) => l.id);
      
      // Get leads that already have a non-retry-eligible call
      const { data: existingCalls } = await supabase
        .from("call_logs")
        .select("lead_id, status")
        .eq("agent_type", "ia_call_2")
        .in("lead_id", allLeadIds);

      const leadsWithCalls = new Set(
        (existingCalls || []).map((c: any) => c.lead_id)
      );

      newLeadIds = allLeadIds.filter((id: string) => !leadsWithCalls.has(id));
    }

    console.log(`New leads to call: ${newLeadIds.length}, Retry leads: ${retryLeadIds.length}, Slots: ${slotsAvailable}`);

    // 4. Combine: retries first (they waited), then new leads
    const leadsToCall = [...retryLeadIds, ...newLeadIds].slice(0, slotsAvailable);

    if (leadsToCall.length === 0) {
      return new Response(
        JSON.stringify({ message: "No leads to call", active: currentActive, triggered: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Trigger calls sequentially (small delay between each to avoid rate limits)
    const results: any[] = [];
    for (const leadId of leadsToCall) {
      try {
        const isRetry = retryLeadIds.includes(leadId);
        
        // If retry, get the retry count from the last call
        let retryCount = 0;
        if (isRetry) {
          const { data: lastCall } = await supabase
            .from("call_logs")
            .select("metadata")
            .eq("lead_id", leadId)
            .eq("agent_type", "ia_call_2")
            .in("status", RETRY_STATUSES)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();
          
          retryCount = ((lastCall?.metadata as any)?.retry_count || 0) + 1;
        }

        // Call trigger-ia-call-2
        const triggerRes = await fetch(
          `${supabaseUrl}/functions/v1/trigger-ia-call-2`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ lead_id: leadId }),
          }
        );

        const triggerData = await triggerRes.json();

        if (triggerRes.ok && triggerData.call_sid) {
          // If retry, update the new call_log metadata with retry count
          if (isRetry && retryCount > 0) {
            await supabase
              .from("call_logs")
              .update({
                metadata: {
                  ...(triggerData.conversation_id ? { conversation_id: triggerData.conversation_id } : {}),
                  retry_count: retryCount,
                  is_retry: true,
                },
              })
              .eq("call_sid", triggerData.call_sid);
          }

          results.push({ lead_id: leadId, status: "triggered", retry: isRetry, retry_count: retryCount });
          console.log(`✅ Call triggered for lead ${leadId} (retry: ${isRetry}, attempt: ${retryCount + 1})`);
        } else {
          results.push({ lead_id: leadId, status: "error", error: triggerData.error });
          console.error(`❌ Failed to trigger call for lead ${leadId}:`, triggerData.error);
        }

        // Small delay between calls to avoid overwhelming Twilio
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (err) {
        results.push({ lead_id: leadId, status: "error", error: (err as Error).message });
        console.error(`❌ Exception triggering call for lead ${leadId}:`, err);
      }
    }

    return new Response(
      JSON.stringify({
        active: currentActive,
        triggered: results.filter((r) => r.status === "triggered").length,
        errors: results.filter((r) => r.status === "error").length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-ia-call-2 error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
