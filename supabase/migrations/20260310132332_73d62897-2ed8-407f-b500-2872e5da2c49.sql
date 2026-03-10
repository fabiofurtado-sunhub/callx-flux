CREATE POLICY "Authenticated users can insert blacklist"
ON public.leads_blacklist
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can select blacklist"
ON public.leads_blacklist
FOR SELECT
TO authenticated
USING (true);