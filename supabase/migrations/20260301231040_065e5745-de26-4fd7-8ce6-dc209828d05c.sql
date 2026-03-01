
-- Hub Courses
CREATE TABLE public.hub_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  drip_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hub users can view active courses" ON public.hub_courses
  FOR SELECT USING (
    ativo = true AND (
      public.has_role(auth.uid(), 'aluno_hub') OR
      public.has_role(auth.uid(), 'admin_hub') OR
      public.has_role(auth.uid(), 'suporte_hub')
    )
  );
CREATE POLICY "Hub admins can manage courses" ON public.hub_courses
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin_hub') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Hub Modules
CREATE TABLE public.hub_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.hub_courses(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hub users can view modules" ON public.hub_modules
  FOR SELECT USING (
    public.has_role(auth.uid(), 'aluno_hub') OR
    public.has_role(auth.uid(), 'admin_hub') OR
    public.has_role(auth.uid(), 'suporte_hub')
  );
CREATE POLICY "Hub admins can manage modules" ON public.hub_modules
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin_hub') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Hub Lessons
CREATE TABLE public.hub_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.hub_modules(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  video_url TEXT DEFAULT '',
  material_url TEXT DEFAULT '',
  duracao_total INTEGER DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hub users can view lessons" ON public.hub_lessons
  FOR SELECT USING (
    public.has_role(auth.uid(), 'aluno_hub') OR
    public.has_role(auth.uid(), 'admin_hub') OR
    public.has_role(auth.uid(), 'suporte_hub')
  );
CREATE POLICY "Hub admins can manage lessons" ON public.hub_lessons
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin_hub') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Hub User Progress
CREATE TABLE public.hub_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID NOT NULL REFERENCES public.hub_lessons(id) ON DELETE CASCADE,
  tempo_assistido INTEGER NOT NULL DEFAULT 0,
  porcentagem INTEGER NOT NULL DEFAULT 0,
  concluida BOOLEAN NOT NULL DEFAULT false,
  data_conclusao TIMESTAMPTZ,
  ultimo_acesso TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);
ALTER TABLE public.hub_user_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own progress" ON public.hub_user_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON public.hub_user_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.hub_user_progress
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Hub admins can view all progress" ON public.hub_user_progress
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin_hub') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Hub Profiles
CREATE TABLE public.hub_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT '',
  telefone TEXT DEFAULT '',
  engagement_score INTEGER NOT NULL DEFAULT 0,
  total_login_count INTEGER NOT NULL DEFAULT 0,
  ultimo_login TIMESTAMPTZ,
  dias_consecutivos INTEGER NOT NULL DEFAULT 0,
  crm_contact_id UUID,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own hub profile" ON public.hub_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own hub profile" ON public.hub_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Hub admins can manage all hub profiles" ON public.hub_profiles
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin_hub') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Hub Login Logs
CREATE TABLE public.hub_login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ip TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_login_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own login logs" ON public.hub_login_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own login logs" ON public.hub_login_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hub admins can view all login logs" ON public.hub_login_logs
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin_hub') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Hub Activity Events
CREATE TABLE public.hub_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo_evento TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.hub_activity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own events" ON public.hub_activity_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own events" ON public.hub_activity_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Hub admins can view all events" ON public.hub_activity_events
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin_hub') OR
    public.has_role(auth.uid(), 'admin')
  );

-- Auto-create hub profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_hub_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'hub_user' = 'true' THEN
    INSERT INTO public.hub_profiles (user_id, nome)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email));
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'aluno_hub');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_hub_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_hub_user();

-- Updated_at triggers
CREATE TRIGGER update_hub_courses_updated_at BEFORE UPDATE ON public.hub_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hub_profiles_updated_at BEFORE UPDATE ON public.hub_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
