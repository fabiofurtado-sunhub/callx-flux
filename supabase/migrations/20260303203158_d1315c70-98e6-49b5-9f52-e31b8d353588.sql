UPDATE public.leads
SET funil = 'reaquecimento',
    status_funil = 'lead',
    data_ultimo_movimento = now()
WHERE status_funil IN ('ia_call', 'ia_call_2');