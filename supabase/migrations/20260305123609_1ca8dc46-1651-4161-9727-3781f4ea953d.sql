-- 1. Disable the WhatsApp auto-send trigger to stop messages
ALTER TABLE public.leads DISABLE TRIGGER trigger_auto_send_whatsapp;

-- 2. Create a blacklist table to track deleted phones so they never get re-imported
CREATE TABLE IF NOT EXISTS public.leads_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone text NOT NULL,
  funil text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(telefone, funil)
);

-- 3. Blacklist all current callx/lead phones before deleting
INSERT INTO public.leads_blacklist (telefone, funil)
SELECT telefone, funil FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead'
ON CONFLICT (telefone, funil) DO NOTHING;

-- 4. Clean dependent tables
DELETE FROM public.whatsapp_queue WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.cadencia_execucoes WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.interacoes_whatsapp WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.email_logs WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.call_logs WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.lead_logs WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.lead_score_events WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.alertas_comerciais WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.diagnosticos WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.meta_capi_logs WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');
DELETE FROM public.ga4_logs WHERE lead_id IN (SELECT id FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead');

-- 5. Delete the leads
DELETE FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead';

-- 6. Re-enable the trigger
ALTER TABLE public.leads ENABLE TRIGGER trigger_auto_send_whatsapp;