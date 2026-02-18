
-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'vendedor');

-- Enum para status do funil
CREATE TYPE public.lead_status AS ENUM ('lead', 'reuniao', 'proposta', 'venda', 'perdido');

-- Enum para status WhatsApp
CREATE TYPE public.whatsapp_status AS ENUM ('pendente', 'enviado', 'entregue', 'falha', 'erro_envio');

-- Tabela de perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tabela de roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'vendedor',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function para checar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Tabela de leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT DEFAULT '',
  campanha TEXT DEFAULT '',
  adset TEXT DEFAULT '',
  grupo_anuncios TEXT DEFAULT '',
  vendedor_id UUID REFERENCES auth.users(id),
  vendedor_nome TEXT DEFAULT '',
  status_funil lead_status NOT NULL DEFAULT 'lead',
  data_entrada TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_ultimo_movimento TIMESTAMPTZ NOT NULL DEFAULT now(),
  valor_proposta NUMERIC DEFAULT NULL,
  valor_venda NUMERIC DEFAULT NULL,
  motivo_perda TEXT DEFAULT NULL,
  score_lead INTEGER NOT NULL DEFAULT 10,
  probabilidade_fechamento INTEGER NOT NULL DEFAULT 0,
  origem TEXT DEFAULT 'google_sheets',
  envio_whatsapp_status whatsapp_status NOT NULL DEFAULT 'pendente',
  envio_whatsapp_data TIMESTAMPTZ DEFAULT NULL,
  lead_time INTEGER DEFAULT NULL,
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Admin e gestor podem ver tudo, vendedor só seus leads
CREATE POLICY "Admins and gestores can view all leads" ON public.leads FOR SELECT USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR vendedor_id = auth.uid()
);
CREATE POLICY "Admins and gestores can insert leads" ON public.leads FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);
CREATE POLICY "Admins gestores and owners can update leads" ON public.leads FOR UPDATE USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR vendedor_id = auth.uid()
);
CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE USING (
  public.has_role(auth.uid(), 'admin')
);

-- Tabela de interações WhatsApp
CREATE TABLE public.interacoes_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'envio',
  conteudo TEXT NOT NULL DEFAULT '',
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  status whatsapp_status NOT NULL DEFAULT 'pendente',
  response_data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.interacoes_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view interactions" ON public.interacoes_whatsapp FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert interactions" ON public.interacoes_whatsapp FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

-- Tabela de metas
CREATE TABLE public.metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_receita_mensal NUMERIC NOT NULL DEFAULT 500000,
  meta_vendas_mensal INTEGER NOT NULL DEFAULT 30,
  custo_por_lead NUMERIC NOT NULL DEFAULT 25,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view metas" ON public.metas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update metas" ON public.metas FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert metas" ON public.metas FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Tabela de configurações ZAPI
CREATE TABLE public.configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zapi_webhook TEXT DEFAULT '',
  zapi_token TEXT DEFAULT '',
  zapi_instance_id TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage configuracoes" ON public.configuracoes FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Tabela de log de movimentação
CREATE TABLE public.lead_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  acao TEXT NOT NULL,
  de TEXT DEFAULT NULL,
  para TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view logs" ON public.lead_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert logs" ON public.lead_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_metas_updated_at BEFORE UPDATE ON public.metas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_configuracoes_updated_at BEFORE UPDATE ON public.configuracoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  
  -- Primeiro usuário vira admin
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendedor');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Habilitar realtime para leads
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
