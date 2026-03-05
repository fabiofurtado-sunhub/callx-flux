-- STOP the cron job that keeps reimporting leads
SELECT cron.unschedule(1);

-- Disable WhatsApp trigger
ALTER TABLE public.leads DISABLE TRIGGER trigger_auto_send_whatsapp;

-- Blacklist these phones
INSERT INTO public.leads_blacklist (telefone, funil)
SELECT telefone, funil FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead'
ON CONFLICT (telefone, funil) DO NOTHING;

-- Clean all dependent tables
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

-- Delete the leads
DELETE FROM public.leads WHERE funil = 'callx' AND status_funil = 'lead';

-- Re-enable trigger
ALTER TABLE public.leads ENABLE TRIGGER trigger_auto_send_whatsapp;