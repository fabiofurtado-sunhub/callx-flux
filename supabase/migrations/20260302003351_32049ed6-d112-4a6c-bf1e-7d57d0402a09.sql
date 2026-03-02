
-- Trigger: when hub_profiles engagement changes, sync to linked contact and account
CREATE OR REPLACE FUNCTION public.sync_hub_to_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _account_id uuid;
  _avg_engagement integer;
  _active_users integer;
BEGIN
  -- Update linked contact's lead_score
  IF NEW.crm_contact_id IS NOT NULL AND (
    OLD.engagement_score IS DISTINCT FROM NEW.engagement_score OR
    OLD.status IS DISTINCT FROM NEW.status
  ) THEN
    UPDATE public.contacts
    SET lead_score = NEW.engagement_score,
        status = CASE WHEN NEW.status = 'inativo' THEN 'inativo' ELSE 'ativo' END,
        updated_at = now()
    WHERE id = NEW.crm_contact_id;

    -- Get account_id from contact
    SELECT account_id INTO _account_id
    FROM public.contacts WHERE id = NEW.crm_contact_id;

    -- Recalculate account-level hub metrics
    IF _account_id IS NOT NULL THEN
      SELECT
        COALESCE(AVG(hp.engagement_score), 0)::integer,
        COUNT(*) FILTER (WHERE hp.status = 'ativo')::integer
      INTO _avg_engagement, _active_users
      FROM public.contacts c
      JOIN public.hub_profiles hp ON hp.crm_contact_id = c.id
      WHERE c.account_id = _account_id;

      UPDATE public.accounts
      SET hub_engagement_medio = _avg_engagement,
          hub_usuarios_ativos = _active_users,
          hub_score_empresa = LEAST(100, _avg_engagement + (_active_users * 5)),
          hub_status = CASE
            WHEN _active_users = 0 THEN 'inativo'
            WHEN _avg_engagement >= 70 THEN 'engajado'
            WHEN _avg_engagement >= 40 THEN 'moderado'
            ELSE 'baixo'
          END,
          updated_at = now()
      WHERE id = _account_id;

      -- Log activity
      INSERT INTO public.account_activity_log (account_id, tipo_evento, descricao, origem, metadata)
      VALUES (
        _account_id,
        'hub_sync',
        'Hub engagement atualizado: score ' || NEW.engagement_score || ', status ' || NEW.status,
        'automacao',
        jsonb_build_object(
          'hub_profile_id', NEW.id,
          'engagement_score', NEW.engagement_score,
          'dias_consecutivos', NEW.dias_consecutivos,
          'total_logins', NEW.total_login_count
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_hub_to_crm
AFTER UPDATE ON public.hub_profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_hub_to_crm();

-- Trigger: on hub_activity_events insert, log to account if linked
CREATE OR REPLACE FUNCTION public.log_hub_activity_to_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _contact_id uuid;
  _account_id uuid;
  _nome text;
BEGIN
  -- Find linked contact via hub_profiles
  SELECT hp.crm_contact_id, hp.nome INTO _contact_id, _nome
  FROM public.hub_profiles hp
  WHERE hp.user_id = NEW.user_id;

  IF _contact_id IS NOT NULL THEN
    SELECT account_id INTO _account_id
    FROM public.contacts WHERE id = _contact_id;

    IF _account_id IS NOT NULL THEN
      INSERT INTO public.account_activity_log (account_id, tipo_evento, descricao, origem, metadata)
      VALUES (
        _account_id,
        'hub_evento',
        COALESCE(_nome, '') || ': ' || NEW.tipo_evento,
        'hub',
        jsonb_build_object('user_id', NEW.user_id, 'tipo_evento', NEW.tipo_evento, 'metadata', NEW.metadata)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_hub_activity_to_account
AFTER INSERT ON public.hub_activity_events
FOR EACH ROW
EXECUTE FUNCTION public.log_hub_activity_to_account();
