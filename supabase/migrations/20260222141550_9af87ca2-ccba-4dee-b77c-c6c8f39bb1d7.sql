
CREATE OR REPLACE FUNCTION public.auto_send_whatsapp_on_new_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _request_id bigint;
BEGIN
  IF NEW.status_funil = 'lead' AND NEW.envio_whatsapp_status = 'pendente' AND NEW.funil = 'callx' THEN
    SELECT net.http_post(
      url := 'https://tqzrebkunvezpdeipamf.supabase.co/functions/v1/send-whatsapp',
      body := json_build_object(
        'lead_id', NEW.id,
        'telefone', NEW.telefone,
        'nome', NEW.nome
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
