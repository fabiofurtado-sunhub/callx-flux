import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
  const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure token error: ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

function buildTrackingPixel(supabaseUrl: string, emailLogId: string): string {
  return `<img src="${supabaseUrl}/functions/v1/email-tracking?type=open&id=${emailLogId}" width="1" height="1" style="display:none" />`;
}

function wrapLinksWithTracking(html: string, supabaseUrl: string, emailLogId: string): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_, url) => `href="${supabaseUrl}/functions/v1/email-tracking?type=click&id=${emailLogId}&url=${encodeURIComponent(url)}"`
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id, to_email, subject, html_body, cadencia_etapa_id } = await req.json();

    if (!to_email || !lead_id) {
      return new Response(
        JSON.stringify({ error: "to_email and lead_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get email config
    const { data: config } = await supabase
      .from("configuracoes")
      .select("email_from_address, email_from_name, email_tracking_enabled")
      .limit(1)
      .single();

    const fromAddress = config?.email_from_address || "contato@mx3.com.br";
    const fromName = config?.email_from_name || "MX3";
    const trackingEnabled = config?.email_tracking_enabled !== false;

    // Create email log entry first to get the ID for tracking
    const { data: emailLog, error: logError } = await supabase
      .from("email_logs")
      .insert({
        lead_id,
        assunto: subject,
        cadencia_etapa_id: cadencia_etapa_id || null,
        status: "enviando",
      })
      .select("id")
      .single();

    if (logError || !emailLog) {
      throw new Error("Failed to create email log: " + logError?.message);
    }

    // Add tracking to HTML
    let finalHtml = html_body;
    if (trackingEnabled) {
      finalHtml = wrapLinksWithTracking(finalHtml, supabaseUrl, emailLog.id);
      finalHtml += buildTrackingPixel(supabaseUrl, emailLog.id);
    }

    // Send via Microsoft Graph API
    const accessToken = await getAccessToken();

    const graphResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${fromAddress}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject,
            body: {
              contentType: "HTML",
              content: finalHtml,
            },
            toRecipients: [
              {
                emailAddress: { address: to_email },
              },
            ],
            from: {
              emailAddress: {
                address: fromAddress,
                name: fromName,
              },
            },
          },
          saveToSentItems: false,
        }),
      }
    );

    const status = graphResponse.ok ? "enviado" : "erro";
    let errorMessage = null;

    if (!graphResponse.ok) {
      const errBody = await graphResponse.text();
      errorMessage = errBody.substring(0, 500);
      console.error("Graph API error:", errBody);
    }

    // Update email log
    await supabase
      .from("email_logs")
      .update({
        status,
        error_message: errorMessage,
        provider_response: { status: graphResponse.status },
      })
      .eq("id", emailLog.id);

    return new Response(
      JSON.stringify({ success: graphResponse.ok, email_log_id: emailLog.id, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
