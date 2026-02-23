import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF pixel
const TRACKING_PIXEL = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const emailLogId = url.searchParams.get("id");
  const redirectUrl = url.searchParams.get("url");

  if (!emailLogId) {
    return new Response("Missing id", { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (type === "open") {
      await supabase
        .from("email_logs")
        .update({ aberto: true, aberto_em: new Date().toISOString() })
        .eq("id", emailLogId)
        .eq("aberto", false); // Only update first open

      // Add score event for email open
      const { data: emailLog } = await supabase
        .from("email_logs")
        .select("lead_id")
        .eq("id", emailLogId)
        .single();

      if (emailLog) {
        await supabase.from("lead_score_events").insert({
          lead_id: emailLog.lead_id,
          evento: "email_aberto",
          pontos: 5,
          descricao: "Abriu email da cadência",
          referencia_id: emailLogId,
        });

        // Update lead score
        const { data: scoreEvents } = await supabase
          .from("lead_score_events")
          .select("pontos")
          .eq("lead_id", emailLog.lead_id);

        if (scoreEvents) {
          const totalScore = scoreEvents.reduce((sum, e) => sum + e.pontos, 0);
          await supabase
            .from("leads")
            .update({ score_lead: Math.min(totalScore, 100) })
            .eq("id", emailLog.lead_id);
        }
      }

      return new Response(TRACKING_PIXEL, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    if (type === "click" && redirectUrl) {
      await supabase
        .from("email_logs")
        .update({
          clicado: true,
          clicado_em: new Date().toISOString(),
          link_clicado: redirectUrl,
        })
        .eq("id", emailLogId);

      // Add score event for click
      const { data: emailLog } = await supabase
        .from("email_logs")
        .select("lead_id")
        .eq("id", emailLogId)
        .single();

      if (emailLog) {
        await supabase.from("lead_score_events").insert({
          lead_id: emailLog.lead_id,
          evento: "email_clicado",
          pontos: 10,
          descricao: "Clicou em link do email",
          referencia_id: emailLogId,
        });

        // Update lead score
        const { data: scoreEvents } = await supabase
          .from("lead_score_events")
          .select("pontos")
          .eq("lead_id", emailLog.lead_id);

        if (scoreEvents) {
          const totalScore = scoreEvents.reduce((sum, e) => sum + e.pontos, 0);
          await supabase
            .from("leads")
            .update({ score_lead: Math.min(totalScore, 100) })
            .eq("id", emailLog.lead_id);

          // Alert if score >= 91
          if (totalScore >= 91) {
            const existingAlert = await supabase
              .from("alertas_comerciais")
              .select("id")
              .eq("lead_id", emailLog.lead_id)
              .eq("tipo", "score_alto")
              .limit(1);

            if (!existingAlert.data?.length) {
              await supabase.from("alertas_comerciais").insert({
                lead_id: emailLog.lead_id,
                tipo: "score_alto",
                mensagem: `Lead atingiu score ${totalScore} — alta probabilidade de conversão!`,
              });
            }
          }
        }
      }

      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
      });
    }

    return new Response("Invalid request", { status: 400 });
  } catch (error) {
    console.error("email-tracking error:", error);
    // For open tracking, still return pixel even on error
    if (type === "open") {
      return new Response(TRACKING_PIXEL, {
        headers: { "Content-Type": "image/gif" },
      });
    }
    // For click tracking, redirect anyway
    if (type === "click" && redirectUrl) {
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl },
      });
    }
    return new Response("Error", { status: 500 });
  }
});
