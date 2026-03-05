
CREATE OR REPLACE FUNCTION public.prevent_lead_stage_regression()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _stage_order jsonb := '{
    "lead": 1,
    "mensagem_enviada": 2,
    "fup_1": 3,
    "ia_call": 4,
    "ia_call_2": 5,
    "ultima_mensagem": 6,
    "reuniao": 7,
    "no_show": 8,
    "reuniao_realizada": 9,
    "proposta": 10,
    "venda": 11,
    "perdido": 99
  }'::jsonb;
  _old_order int;
  _new_order int;
BEGIN
  -- Only check when status_funil actually changes within the same funnel
  IF OLD.status_funil IS NOT DISTINCT FROM NEW.status_funil THEN
    RETURN NEW;
  END IF;
  
  -- Allow moving TO perdido from any stage
  IF NEW.status_funil = 'perdido' THEN
    RETURN NEW;
  END IF;
  
  -- Allow moving FROM perdido to any stage (reactivation)
  IF OLD.status_funil = 'perdido' THEN
    RETURN NEW;
  END IF;

  _old_order := COALESCE((_stage_order->>OLD.status_funil::text)::int, 0);
  _new_order := COALESCE((_stage_order->>NEW.status_funil::text)::int, 0);

  -- Block regression (going to a lower stage)
  IF _new_order < _old_order THEN
    -- Keep the current (higher) stage, don't block the entire update
    NEW.status_funil := OLD.status_funil;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER prevent_stage_regression
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_lead_stage_regression();
