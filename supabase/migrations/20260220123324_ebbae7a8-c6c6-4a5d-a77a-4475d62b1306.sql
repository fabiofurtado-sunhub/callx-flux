-- Create ga4_logs table
CREATE TABLE public.ga4_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  ga_response TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ga4_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ga4 logs"
  ON public.ga4_logs FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert ga4 logs"
  ON public.ga4_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ga4_logs;