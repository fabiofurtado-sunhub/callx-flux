
-- Table for storing call logs with transcriptions
CREATE TABLE public.call_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  call_sid text,
  agent_type text NOT NULL DEFAULT 'ia_call_2',
  status text NOT NULL DEFAULT 'initiated',
  duration_seconds integer DEFAULT NULL,
  telefone text,
  transcricao text DEFAULT NULL,
  resumo text DEFAULT NULL,
  sentimento text DEFAULT NULL,
  gravacao_url text DEFAULT NULL,
  erro text DEFAULT NULL,
  metadata jsonb DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view call_logs"
  ON public.call_logs FOR SELECT
  USING (true);

CREATE POLICY "Service and admins can insert call_logs"
  ON public.call_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service and admins can update call_logs"
  ON public.call_logs FOR UPDATE
  USING (true);

-- Index for fast lead lookups
CREATE INDEX idx_call_logs_lead_id ON public.call_logs(lead_id);
CREATE INDEX idx_call_logs_created_at ON public.call_logs(created_at DESC);
CREATE INDEX idx_call_logs_call_sid ON public.call_logs(call_sid);

-- Trigger for updated_at
CREATE TRIGGER update_call_logs_updated_at
  BEFORE UPDATE ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_logs;
