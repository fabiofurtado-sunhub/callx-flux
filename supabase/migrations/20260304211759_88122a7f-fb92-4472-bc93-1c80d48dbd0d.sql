
CREATE OR REPLACE FUNCTION public.auto_send_whatsapp_on_new_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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
    
    -- Try to get template for this funnel
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
    ELSE
      SELECT horario_sugerido_texto INTO _config_horario
      FROM public.configuracoes
      LIMIT 1;
      
      _message := 'Olá ' || COALESCE(NEW.nome, '') || ', aqui é o Fábio Furtado, CEO da MX3.' || chr(10) || chr(10) ||
        'Você se inscreveu na campanha da nossa IA comercial, o CallX (em nossa campanha do Meta) e pelo perfil da sua empresa, fiz questão de vir pessoalmente tratar do seu atendimento.' || chr(10) || chr(10) ||
        'Antes de avançarmos, quero entender:' || chr(10) || chr(10) ||
        'Hoje, o seu maior gargalo está em:' || chr(10) || chr(10) ||
        '1. Volume de lead qualificado' || chr(10) ||
        '2. Conversão do time' || chr(10) ||
        '3. Follow-up e perda de oportunidades' || chr(10) ||
        '4. Falta de previsibilidade comercial' || chr(10) || chr(10) ||
        'Se fizer sentido, eu mesmo bloqueio 30 minutos na minha agenda ainda essa semana para analisarmos sua operação e ver se o CallX faz sentido dentro da sua estratégia.' || chr(10) || chr(10) ||
        'Para você fica melhor ' || COALESCE(_config_horario, 'amanhã às 17:00 ou 18:00') || '?';
    END IF;
    
    -- ENQUEUE instead of direct HTTP call - respects 3-min interval via cron
    INSERT INTO public.whatsapp_queue (lead_id, message, status)
    VALUES (NEW.id, _message, 'pending');
    
  END IF;
  
  RETURN NEW;
END;
$function$
