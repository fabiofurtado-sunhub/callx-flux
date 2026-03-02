
-- Trigger: log stage changes to account_activity_log
CREATE OR REPLACE FUNCTION public.log_account_activity_on_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status_funil IS DISTINCT FROM NEW.status_funil AND NEW.account_id IS NOT NULL THEN
    INSERT INTO public.account_activity_log (account_id, tipo_evento, descricao, origem, metadata)
    VALUES (
      NEW.account_id,
      'mudanca_estagio',
      'Lead ' || COALESCE(NEW.nome, '') || ': ' || OLD.status_funil || ' → ' || NEW.status_funil,
      'automacao',
      jsonb_build_object('lead_id', NEW.id, 'de', OLD.status_funil, 'para', NEW.status_funil, 'funil', NEW.funil)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_account_activity_stage_change
AFTER UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.log_account_activity_on_stage_change();

-- Trigger: log WhatsApp interactions
CREATE OR REPLACE FUNCTION public.log_account_activity_on_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _account_id uuid;
  _lead_nome text;
BEGIN
  SELECT account_id, nome INTO _account_id, _lead_nome
  FROM public.leads WHERE id = NEW.lead_id;

  IF _account_id IS NOT NULL THEN
    INSERT INTO public.account_activity_log (account_id, tipo_evento, descricao, origem, metadata)
    VALUES (
      _account_id,
      'whatsapp',
      'WhatsApp ' || NEW.tipo || ' para ' || COALESCE(_lead_nome, ''),
      'automacao',
      jsonb_build_object('lead_id', NEW.lead_id, 'tipo', NEW.tipo, 'status', NEW.status::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_account_activity_whatsapp
AFTER INSERT ON public.interacoes_whatsapp
FOR EACH ROW
EXECUTE FUNCTION public.log_account_activity_on_whatsapp();

-- Trigger: log email events
CREATE OR REPLACE FUNCTION public.log_account_activity_on_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _account_id uuid;
  _lead_nome text;
BEGIN
  SELECT account_id, nome INTO _account_id, _lead_nome
  FROM public.leads WHERE id = NEW.lead_id;

  IF _account_id IS NOT NULL THEN
    INSERT INTO public.account_activity_log (account_id, tipo_evento, descricao, origem, metadata)
    VALUES (
      _account_id,
      'email',
      'Email enviado para ' || COALESCE(_lead_nome, '') || ': ' || COALESCE(NEW.assunto, ''),
      'automacao',
      jsonb_build_object('lead_id', NEW.lead_id, 'assunto', NEW.assunto, 'status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_account_activity_email
AFTER INSERT ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.log_account_activity_on_email();
