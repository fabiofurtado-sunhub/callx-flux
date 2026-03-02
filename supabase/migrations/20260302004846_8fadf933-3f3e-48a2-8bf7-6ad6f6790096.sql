
-- 1. Create teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL DEFAULT '',
  gestor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage teams"
  ON public.teams FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view teams"
  ON public.teams FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 2. Create team_members table
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage team members"
  ON public.team_members FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores can manage own team members"
  ON public.team_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = team_members.team_id AND t.gestor_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can view team members"
  ON public.team_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 3. Create roles_permissions config table
CREATE TABLE public.roles_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL UNIQUE,
  permissoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  descricao text DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage permissions"
  ON public.roles_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view permissions"
  ON public.roles_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 4. Insert default permission matrices
INSERT INTO public.roles_permissions (role, descricao, permissoes) VALUES
('admin', 'Controle total do sistema', '{"accounts":{"view_all":true,"view_owned":true,"edit":true,"delete":true,"change_owner":true},"opportunities":{"create":true,"edit_all":true,"edit_owned":true,"move_pipeline":true,"change_value":true},"contacts":{"create":true,"edit":true,"delete":true},"documents":{"upload":true,"delete":true},"hub_data":{"view_engagement":true,"trigger_followup":true},"reports":{"view_team":true,"view_company":true,"export":true},"governance":{"change_owner":true,"override_pipeline":true,"force_close":true},"pipeline":{"view_fields":["all"]}}'::jsonb),
('gestor', 'Nível estratégico do time', '{"accounts":{"view_all":true,"view_owned":true,"edit":true,"delete":false,"change_owner":true},"opportunities":{"create":true,"edit_all":true,"edit_owned":true,"move_pipeline":true,"change_value":true},"contacts":{"create":true,"edit":true,"delete":false},"documents":{"upload":true,"delete":false},"hub_data":{"view_engagement":true,"trigger_followup":true},"reports":{"view_team":true,"view_company":true,"export":true},"governance":{"change_owner":true,"override_pipeline":false,"force_close":false},"pipeline":{"view_fields":["all"]}}'::jsonb),
('closer', 'Foco em fechamento', '{"accounts":{"view_all":false,"view_owned":true,"edit":true,"delete":false,"change_owner":false},"opportunities":{"create":true,"edit_all":false,"edit_owned":true,"move_pipeline":true,"change_value":true},"contacts":{"create":true,"edit":true,"delete":false},"documents":{"upload":true,"delete":false},"hub_data":{"view_engagement":true,"trigger_followup":false},"reports":{"view_team":false,"view_company":false,"export":false},"governance":{"change_owner":false,"override_pipeline":false,"force_close":false},"pipeline":{"view_fields":["status","valor_proposta","valor_venda","probabilidade"]}}'::jsonb),
('sdr', 'Foco em prospecção', '{"accounts":{"view_all":false,"view_owned":true,"edit":true,"delete":false,"change_owner":false},"opportunities":{"create":true,"edit_all":false,"edit_owned":true,"move_pipeline":true,"change_value":false},"contacts":{"create":true,"edit":true,"delete":false},"documents":{"upload":true,"delete":false},"hub_data":{"view_engagement":false,"trigger_followup":false},"reports":{"view_team":false,"view_company":false,"export":false},"governance":{"change_owner":false,"override_pipeline":false,"force_close":false},"pipeline":{"view_fields":["status"],"max_stage":"reuniao"}}'::jsonb),
('suporte', 'Acesso operacional', '{"accounts":{"view_all":true,"view_owned":true,"edit":false,"delete":false,"change_owner":false},"opportunities":{"create":false,"edit_all":false,"edit_owned":false,"move_pipeline":false,"change_value":false},"contacts":{"create":false,"edit":true,"delete":false},"documents":{"upload":false,"delete":false},"hub_data":{"view_engagement":true,"trigger_followup":false},"reports":{"view_team":false,"view_company":false,"export":false},"governance":{"change_owner":false,"override_pipeline":false,"force_close":false},"pipeline":{"view_fields":["status"]}}'::jsonb),
('vendedor', 'Legacy - migrar para closer ou sdr', '{"accounts":{"view_all":false,"view_owned":true,"edit":true,"delete":false,"change_owner":false},"opportunities":{"create":true,"edit_all":false,"edit_owned":true,"move_pipeline":true,"change_value":true},"contacts":{"create":true,"edit":true,"delete":false},"documents":{"upload":true,"delete":false},"hub_data":{"view_engagement":true,"trigger_followup":false},"reports":{"view_team":false,"view_company":false,"export":false},"governance":{"change_owner":false,"override_pipeline":false,"force_close":false},"pipeline":{"view_fields":["all"]}}'::jsonb),
('financeiro', 'Acesso financeiro', '{"accounts":{"view_all":true,"view_owned":false,"edit":false,"delete":false,"change_owner":false},"opportunities":{"create":false,"edit_all":false,"edit_owned":false,"move_pipeline":false,"change_value":false},"contacts":{"create":false,"edit":false,"delete":false},"documents":{"upload":false,"delete":false},"hub_data":{"view_engagement":false,"trigger_followup":false},"reports":{"view_team":false,"view_company":true,"export":true},"governance":{"change_owner":false,"override_pipeline":false,"force_close":false},"pipeline":{"view_fields":["valor_proposta","valor_venda"]}}'::jsonb);

-- 5. Migrate existing vendedor roles to closer
UPDATE public.user_roles SET role = 'closer' WHERE role = 'vendedor';

-- 6. Add updated_at trigger to teams
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Update handle_new_user to default to 'closer' instead of 'vendedor'
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'closer');
  END IF;
  
  RETURN NEW;
END;
$function$;
