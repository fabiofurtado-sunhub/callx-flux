import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAccessToken(): Promise<string> {
  const tenantId = Deno.env.get("AZURE_TENANT_ID")!;
  const clientId = Deno.env.get("AZURE_CLIENT_ID")!;
  const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET")!;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }).toString(),
    }
  );

  if (!res.ok) throw new Error(`Azure token error: ${await res.text()}`);
  return (await res.json()).access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { date, calendar_email } = await req.json();
    if (!date) {
      return new Response(JSON.stringify({ error: "date is required (YYYY-MM-DD)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = calendar_email || "contato@mx3.com.br";
    const accessToken = await getAccessToken();

    // Get busy times for the requested date using getSchedule
    const startDate = `${date}T00:00:00`;
    const endDate = `${date}T23:59:59`;

    const scheduleRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${email}/calendar/getSchedule`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schedules: [email],
          startTime: { dateTime: startDate, timeZone: "America/Sao_Paulo" },
          endTime: { dateTime: endDate, timeZone: "America/Sao_Paulo" },
          availabilityViewInterval: 15,
        }),
      }
    );

    if (!scheduleRes.ok) {
      // Fallback: try calendarView if getSchedule fails
      const viewRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${email}/calendarView?startDateTime=${date}T00:00:00&endDateTime=${date}T23:59:59&$select=start,end,subject`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Prefer: 'outlook.timezone="America/Sao_Paulo"',
          },
        }
      );

      const viewData = await viewRes.json();
      const busySlots = (viewData.value || []).map((event: any) => ({
        start: event.start.dateTime,
        end: event.end.dateTime,
      }));

      const available = generateAvailableSlots(date, busySlots, 45);

      return new Response(JSON.stringify({ date, available_slots: available }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scheduleData = await scheduleRes.json();
    const scheduleItems = scheduleData.value?.[0]?.scheduleItems || [];
    const busySlots = scheduleItems
      .filter((item: any) => item.status !== "free")
      .map((item: any) => ({
        start: item.start.dateTime,
        end: item.end.dateTime,
      }));

    const available = generateAvailableSlots(date, busySlots, 45);

    return new Response(JSON.stringify({ date, available_slots: available }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("calendar-availability error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateAvailableSlots(
  date: string,
  busySlots: { start: string; end: string }[],
  durationMinutes: number
): string[] {
  // Working hours: 08:00-12:00 and 14:00-19:00
  const periods = [
    { startHour: 8, startMin: 0, endHour: 12, endMin: 0 },
    { startHour: 14, startMin: 0, endHour: 19, endMin: 0 },
  ];

  const slots: string[] = [];

  for (const period of periods) {
    let currentMin = period.startHour * 60 + period.startMin;
    const periodEndMin = period.endHour * 60 + period.endMin;

    while (currentMin + durationMinutes <= periodEndMin) {
      const slotStartHour = Math.floor(currentMin / 60);
      const slotStartMin = currentMin % 60;
      const slotEndMin = currentMin + durationMinutes;
      const slotEndHour = Math.floor(slotEndMin / 60);
      const slotEndMinute = slotEndMin % 60;

      const slotStart = `${date}T${String(slotStartHour).padStart(2, "0")}:${String(slotStartMin).padStart(2, "0")}:00`;
      const slotEnd = `${date}T${String(slotEndHour).padStart(2, "0")}:${String(slotEndMinute).padStart(2, "0")}:00`;

      // Check if slot overlaps with any busy period
      const isBusy = busySlots.some((busy) => {
        const busyStart = busy.start.substring(0, 19);
        const busyEnd = busy.end.substring(0, 19);
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      if (!isBusy) {
        slots.push(slotStart);
      }

      currentMin += 30; // 30-min increments
    }
  }

  return slots;
}
