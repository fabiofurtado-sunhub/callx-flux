
-- ══════════════════════════════════════════
-- FASE 1: SCHEMA ACCOUNT-BASED CRM
-- ══════════════════════════════════════════

-- 1. ACCOUNTS (EMPRESAS) — entidade mãe
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL DEFAULT '',
  nome_fantasia TEXT NOT NULL DEFAULT '',
  cnpj TEXT DEFAULT '',
  nicho TEXT DEFAULT '',
  faturamento_estimado NUMERIC DEFAULT 0,
  numero_funcionarios INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'prospect',
  owner_id UUID DEFAULT NULL,
  hub_status TEXT DEFAULT 'inativo',
  hub_engagement_medio INTEGER DEFAULT 0,
  hub_usuarios_ativos INTEGER DEFAULT 0,
  hub_score_empresa INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestores can manage accounts"
  ON public.accounts FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Vendedores can view assigned accounts"
  ON public.accounts FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Vendedores can update assigned accounts"
  ON public.accounts FOR UPDATE
  USING (owner_id = auth.uid());

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. CONTACTS (PESSOAS) — pertence a ACCOUNT
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  cargo TEXT DEFAULT '',
  email TEXT DEFAULT '',
  telefone TEXT DEFAULT '',
  decisor BOOLEAN DEFAULT false,
  influencia TEXT DEFAULT 'media',
  lead_score INTEGER DEFAULT 0,
  hub_user_id UUID DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestores can manage contacts"
  ON public.contacts FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Vendedores can view contacts of assigned accounts"
  ON public.contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid()
  ));

CREATE POLICY "Vendedores can manage contacts of assigned accounts"
  ON public.contacts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid()
  ));

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3. OPPORTUNITIES — pertence a ACCOUNT
CREATE TABLE public.opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  nome_oportunidade TEXT NOT NULL DEFAULT '',
  valor NUMERIC DEFAULT 0,
  etapa_pipeline TEXT NOT NULL DEFAULT 'lead',
  probabilidade INTEGER DEFAULT 0,
  previsao_fechamento DATE DEFAULT NULL,
  produto_interesse TEXT DEFAULT '',
  origem TEXT DEFAULT '',
  temperatura TEXT DEFAULT 'morna',
  motivo_perda TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestores can manage opportunities"
  ON public.opportunities FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Vendedores can view opportunities of assigned accounts"
  ON public.opportunities FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid()
  ));

CREATE POLICY "Vendedores can manage opportunities of assigned accounts"
  ON public.opportunities FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid()
  ));

CREATE TRIGGER update_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4. OPPORTUNITY_CONTACTS — many-to-many
CREATE TABLE public.opportunity_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  papel TEXT DEFAULT 'envolvido',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(opportunity_id, contact_id)
);

ALTER TABLE public.opportunity_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestores can manage opp contacts"
  ON public.opportunity_contacts FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Vendedores can view opp contacts"
  ON public.opportunity_contacts FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.opportunities o
    JOIN public.accounts a ON a.id = o.account_id
    WHERE o.id = opportunity_id AND a.owner_id = auth.uid()
  ));


-- 5. DOCUMENTS — pertence a ACCOUNT, opcionalmente a OPPORTUNITY
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  opportunity_id UUID DEFAULT NULL REFERENCES public.opportunities(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'anexo',
  url_documento TEXT NOT NULL DEFAULT '',
  nome_arquivo TEXT DEFAULT '',
  status TEXT DEFAULT 'ativo',
  uploaded_by UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestores can manage documents"
  ON public.documents FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Vendedores can view documents of assigned accounts"
  ON public.documents FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid()
  ));

CREATE POLICY "Vendedores can insert documents for assigned accounts"
  ON public.documents FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid()
  ));


-- 6. LEAD_SCORING_HISTORY — pertence a CONTACT
CREATE TABLE public.lead_scoring_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  score_anterior INTEGER DEFAULT 0,
  score_novo INTEGER DEFAULT 0,
  motivo TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_scoring_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestores can manage scoring history"
  ON public.lead_scoring_history FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Authenticated users can view scoring history"
  ON public.lead_scoring_history FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- 7. ACCOUNT_ACTIVITY_LOG
CREATE TABLE public.account_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL DEFAULT '',
  origem TEXT DEFAULT 'manual',
  descricao TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'::jsonb,
  user_id UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.account_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestores can manage activity log"
  ON public.account_activity_log FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Vendedores can view activity of assigned accounts"
  ON public.account_activity_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can insert activity"
  ON public.account_activity_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- 8. Add account_id to leads table for backward compatibility / linking
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS account_id UUID DEFAULT NULL REFERENCES public.accounts(id) ON DELETE SET NULL;

-- 9. Indexes for performance
CREATE INDEX idx_contacts_account_id ON public.contacts(account_id);
CREATE INDEX idx_opportunities_account_id ON public.opportunities(account_id);
CREATE INDEX idx_documents_account_id ON public.documents(account_id);
CREATE INDEX idx_activity_log_account_id ON public.account_activity_log(account_id);
CREATE INDEX idx_leads_account_id ON public.leads(account_id);
CREATE INDEX idx_opportunity_contacts_opp ON public.opportunity_contacts(opportunity_id);
CREATE INDEX idx_opportunity_contacts_contact ON public.opportunity_contacts(contact_id);
CREATE INDEX idx_scoring_history_contact ON public.lead_scoring_history(contact_id);
