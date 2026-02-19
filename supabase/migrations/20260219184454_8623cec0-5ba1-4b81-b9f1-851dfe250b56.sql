CREATE OR REPLACE FUNCTION public.auto_send_whatsapp_on_new_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _anon_key text;
  _request_id bigint;
BEGIN
  IF NEW.status_funil = 'lead' AND NEW.envio_whatsapp_status = 'pendente' THEN
    SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
    SELECT decrypted_secret INTO _anon_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_ANON_KEY' LIMIT 1;
    
    SELECT net.http_post(
      url := _supabase_url || '/functions/v1/send-whatsapp',
      body := json_build_object(
        'lead_id', NEW.id,
        'telefone', NEW.telefone,
        'nome', NEW.nome
      )::jsonb,
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _anon_key
      )::jsonb
    ) INTO _request_id;
  END IF;
  
  RETURN NEW;
END;
$$;