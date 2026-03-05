ALTER TABLE public.leads_blacklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access to blacklist"
  ON public.leads_blacklist
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);