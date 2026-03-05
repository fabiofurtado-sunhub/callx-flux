
-- Trigger function: fires MQL event when lead has faturamento >= 50000
CREATE OR REPLACE FUNCTION public.trigger_meta_capi_mql()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- (was NULL or < 50000 before, now >= 50000)
  IF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.faturamento, 0) < 50000 AND faturamento_val >= 50000 THEN
      should_fire := true;
    END IF;
  END IF;

  IF should_fire THEN
    PERFORM net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/meta-capi-mql',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key')
      ),
      body := jsonb_build_object('lead_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_mql_on_lead_faturamento ON public.leads;

-- Create trigger on INSERT and UPDATE
CREATE TRIGGER trigger_mql_on_lead_faturamento
  AFTER INSERT OR UPDATE OF faturamento ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_meta_capi_mql();
