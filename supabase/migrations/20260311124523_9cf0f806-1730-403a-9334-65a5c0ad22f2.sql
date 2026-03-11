-- Allow admins to view all user roles (needed for team management)
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));