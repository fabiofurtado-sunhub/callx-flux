
CREATE OR REPLACE FUNCTION public.auto_send_whatsapp_on_new_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _request_id bigint;
  _template_content text;
  _config_horario text;
  _config_link text;
  _message text;
BEGIN
  -- Skip if this is an UPDATE where only the funil changed (lead switching funnels)
  IF TG_OP = 'UPDATE' AND OLD.funil IS DISTINCT FROM NEW.funil THEN
    RETURN NEW;
  END IF;

  IF NEW.status_funil = 'lead' AND NEW.envio_whatsapp_status = 'pendente' AND NEW.funil IN ('callx', 'core_ai', 'revenue_os') THEN
    
    IF NEW.funil IN ('core_ai', 'revenue_os') THEN
      SELECT conteudo INTO _template_content
      FROM public.message_templates
      WHERE funil = NEW.funil AND etapa = 'lead' AND ativo = true
      ORDER BY ordem ASC
      LIMIT 1;
      
      IF _template_content IS NOT NULL THEN
        SELECT horario_sugerido_texto, link_agendamento INTO _config_horario, _config_link
        FROM public.configuracoes
        LIMIT 1;
        
        _message := _template_content;
        _message := regexp_replace(_message, '\{\{nome\}\}', COALESCE(NEW.nome, ''), 'gi');
        _message := regexp_replace(_message, '\{\{telefone\}\}', COALESCE(NEW.telefone, ''), 'gi');
        _message := regexp_replace(_message, '\{\{email\}\}', COALESCE(NEW.email, ''), 'gi');
        _message := regexp_replace(_message, '\{\{horario_sugerido\}\}', COALESCE(_config_horario, ''), 'gi');
        _message := regexp_replace(_message, '\{\{LINK_AGENDAMENTO\}\}', COALESCE(_config_link, ''), 'gi');
        
        SELECT net.http_post(
          url := 'https://tqzrebkunvezpdeipamf.supabase.co/functions/v1/send-whatsapp',
          body := json_build_object(
            'lead_id', NEW.id,
            'telefone', NEW.telefone,
            'nome', NEW.nome,
            'message_override', _message
          )::jsonb,
          headers := json_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxenJlYmt1bnZlenBkZWlwYW1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDM3MDgsImV4cCI6MjA4NzAxOTcwOH0.ChDO3si-nbD9WTxS1lP3VvTM0a8vrWohDwCOYqB3h0Y'
          )::jsonb
        ) INTO _request_id;
      END IF;
      
    ELSE
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
    
  END IF;
  
  RETURN NEW;
END;
$function$;
