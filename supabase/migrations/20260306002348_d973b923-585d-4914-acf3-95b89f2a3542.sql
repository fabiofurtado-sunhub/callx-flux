CREATE OR REPLACE FUNCTION public.trigger_meta_capi_mql()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  faturamento_val numeric;
  should_fire boolean := false;
BEGIN
  faturamento_val := COALESCE(NEW.faturamento, 0);
  
  -- Only fire if faturamento >= 50000
  IF faturamento_val < 50000 THEN
    RETURN NEW;
  END IF;

  -- On INSERT: always fire if qualifies
  IF TG_OP = 'INSERT' THEN
    should_fire := true;
  END IF;

  -- On UPDATE: fire only if faturamento just crossed the threshold
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.faturamento, 0) < 50000 AND faturamento_val >= 50000 THEN
      should_fire := true;
    END IF;
  END IF;

  IF should_fire THEN
    PERFORM net.http_post(
      url := 'https://tqzrebkunvezpdeipamf.supabase.co/functions/v1/meta-capi-mql',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxenJlYmt1bnZlenBkZWlwYW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDM3MDgsImV4cCI6MjA4NzAxOTcwOH0.ChDO3si-nbD9WTxS1lP3VvTM0a8vrWohDwCOYqB3h0Y'
      )::jsonb,
      body := jsonb_build_object('lead_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$function$;