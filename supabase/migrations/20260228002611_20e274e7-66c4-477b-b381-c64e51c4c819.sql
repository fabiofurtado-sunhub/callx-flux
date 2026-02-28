CREATE TABLE public.whatsapp_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error_message text
);

ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage queue" ON public.whatsapp_queue
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Authenticated users can view queue" ON public.whatsapp_queue
  FOR SELECT USING (true);

CREATE INDEX idx_whatsapp_queue_status ON public.whatsapp_queue (status, created_at);