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

    // Get the oldest pending message
    const { data: item, error: fetchError } = await supabase
      .from("whatsapp_queue")
      .select("id, lead_id, message")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (fetchError || !item) {
      return new Response(
        JSON.stringify({ message: "No pending messages in queue" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as processing
    await supabase
      .from("whatsapp_queue")
      .update({ status: "processing" })
      .eq("id", item.id);

    // Get lead info
    const { data: lead } = await supabase
      .from("leads")
      .select("nome, telefone")
      .eq("id", item.lead_id)
      .single();

    if (!lead) {
      await supabase
        .from("whatsapp_queue")
        .update({ status: "error", error_message: "Lead not found" })
        .eq("id", item.id);

      return new Response(
        JSON.stringify({ message: "Lead not found", queue_id: item.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send via send-whatsapp with message_override
    try {
      const sendRes = await fetch(
        `${supabaseUrl}/functions/v1/send-whatsapp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            lead_id: item.lead_id,
            telefone: lead.telefone,
            nome: lead.nome,
            message_override: item.message,
          }),
        }
      );

      const sendData = await sendRes.json().catch(() => ({}));

      if (sendRes.ok) {
        await supabase
          .from("whatsapp_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.id);

        console.log(`✅ Sent to ${lead.nome} (${lead.telefone})`);
      } else {
        await supabase
          .from("whatsapp_queue")
          .update({ status: "error", error_message: sendData.error || "Send failed" })
          .eq("id", item.id);

        console.error(`❌ Failed for ${lead.nome}: ${sendData.error}`);
      }
    } catch (err) {
      await supabase
        .from("whatsapp_queue")
        .update({ status: "error", error_message: (err as Error).message })
        .eq("id", item.id);

      console.error(`❌ Exception for ${lead.nome}: ${(err as Error).message}`);
    }

    // Count remaining
    const { count: remaining } = await supabase
      .from("whatsapp_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");

    return new Response(
      JSON.stringify({
        sent_to: lead.nome,
        remaining: remaining || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-whatsapp-queue error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
