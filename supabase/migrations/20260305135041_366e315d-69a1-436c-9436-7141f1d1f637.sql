-- 1. Reactivate the D+0 email etapa for playbook_mx3
UPDATE public.cadencia_etapas
SET ativo = true, updated_at = now()
WHERE funil = 'playbook_mx3' AND canal = 'email' AND dia = 0;

-- 2. Create missing cadencia_execucoes for all playbook_mx3 leads that don't have one for this etapa
INSERT INTO public.cadencia_execucoes (lead_id, cadencia_etapa_id, agendado_para, status)
SELECT l.id, '4a7b4d07-f324-4ce2-b90b-7671a09c6e47', now(), 'pendente'
FROM public.leads l
WHERE l.funil = 'playbook_mx3'
  AND l.cadencia_status = 'ativa'
  AND l.email IS NOT NULL
  AND l.id NOT IN (
    SELECT ce.lead_id FROM public.cadencia_execucoes ce
    WHERE ce.cadencia_etapa_id = '4a7b4d07-f324-4ce2-b90b-7671a09c6e47'
  );