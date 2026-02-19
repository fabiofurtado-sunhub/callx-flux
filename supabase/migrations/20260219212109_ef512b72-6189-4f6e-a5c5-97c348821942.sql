
-- Table to store Meta CAPI event logs
CREATE TABLE public.meta_capi_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  stage text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  meta_response jsonb,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_capi_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view capi logs"
  ON public.meta_capi_logs FOR SELECT
  USING (true);

CREATE POLICY "Service can insert capi logs"
  ON public.meta_capi_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_meta_capi_logs_lead_id ON public.meta_capi_logs(lead_id);
CREATE INDEX idx_meta_capi_logs_created_at ON public.meta_capi_logs(created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_capi_logs;
