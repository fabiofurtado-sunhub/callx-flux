
-- Trigger function to fire Meta CAPI on any lead stage change (all funnels)
CREATE OR REPLACE FUNCTION public.fire_meta_capi_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _request_id bigint;
BEGIN
  -- Only fire when status_funil actually changes
  IF OLD.status_funil IS DISTINCT FROM NEW.status_funil THEN
    SELECT net.http_post(
      url := 'https://tqzrebkunvezpdeipamf.supabase.co/functions/v1/meta-capi',
      body := json_build_object(
        'lead_id', NEW.id,
        'new_stage', NEW.status_funil,
        'lead_data', json_build_object(
          'email', COALESCE(NEW.email, ''),
          'telefone', COALESCE(NEW.telefone, ''),
          'nome', COALESCE(NEW.nome, ''),
          'valor_proposta', COALESCE(NEW.valor_proposta, 0),
          'valor_venda', COALESCE(NEW.valor_venda, 0),
          'funil', NEW.funil
        )
      )::jsonb,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxenJlYmt1bnZlenBkZWlwYW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDM3MDgsImV4cCI6MjA4NzAxOTcwOH0.ChDO3si-nbD9WTxS1lP3VvTM0a8vrWohDwCOYqB3h0Y'
      )::jsonb
    ) INTO _request_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on leads table
CREATE TRIGGER trigger_meta_capi_on_stage_change
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.fire_meta_capi_on_stage_change();
