
-- Fix overly permissive INSERT policy
DROP POLICY "Service can insert capi logs" ON public.meta_capi_logs;

CREATE POLICY "Authenticated users can insert capi logs"
  ON public.meta_capi_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
