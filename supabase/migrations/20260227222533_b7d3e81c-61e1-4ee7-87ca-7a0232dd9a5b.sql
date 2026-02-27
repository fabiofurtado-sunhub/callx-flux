
-- Fix overly permissive INSERT policy
DROP POLICY "Service and admins can insert call_logs" ON public.call_logs;
CREATE POLICY "Authenticated users can insert call_logs"
  ON public.call_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Fix overly permissive UPDATE policy
DROP POLICY "Service and admins can update call_logs" ON public.call_logs;
CREATE POLICY "Admins gestores can update call_logs"
  ON public.call_logs FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
