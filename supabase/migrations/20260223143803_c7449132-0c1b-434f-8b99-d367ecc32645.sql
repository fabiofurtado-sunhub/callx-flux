
-- ============================================================
-- 1. Tabela: cadencia_etapas
-- Define as etapas da cadência de automação por funil
-- ============================================================
CREATE TABLE public.cadencia_etapas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funil TEXT NOT NULL DEFAULT 'playbook_mx3',
  dia INTEGER NOT NULL DEFAULT 0,              -- D+0, D+1, D+3, etc.
  canal TEXT NOT NULL DEFAULT 'email',          -- 'email' | 'whatsapp'
  titulo TEXT NOT NULL DEFAULT '',
  conteudo TEXT NOT NULL DEFAULT '',
  condicional BOOLEAN NOT NULL DEFAULT false,   -- true = só dispara se condição for atendida
  condicao_tipo TEXT,                           -- 'nao_abriu_email' | 'nao_clicou_cta' | 'nao_converteu'
  condicao_referencia_id UUID,                  -- referência à etapa cuja condição deve ser verificada
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cadencia_etapas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cadencia"
  ON public.cadencia_etapas FOR SELECT USING (true);

CREATE POLICY "Admins can manage cadencia"
  ON public.cadencia_etapas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_cadencia_etapas_updated_at
  BEFORE UPDATE ON public.cadencia_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. Tabela: cadencia_execucoes
-- Registra a execução de cada etapa da cadência para cada lead
-- ============================================================
CREATE TABLE public.cadencia_execucoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  cadencia_etapa_id UUID NOT NULL REFERENCES public.cadencia_etapas(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente',      -- 'pendente' | 'enviado' | 'pulado' | 'falha'
  agendado_para TIMESTAMPTZ NOT NULL,
  executado_em TIMESTAMPTZ,
  resultado JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cadencia_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view execucoes"
  ON public.cadencia_execucoes FOR SELECT USING (true);

CREATE POLICY "Admins gestores can manage execucoes"
  ON public.cadencia_execucoes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- ============================================================
-- 3. Tabela: email_logs
-- Rastreamento de envio, abertura e clique de e-mails
-- ============================================================
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  cadencia_etapa_id UUID REFERENCES public.cadencia_etapas(id) ON DELETE SET NULL,
  assunto TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'enviado',       -- 'enviado' | 'entregue' | 'aberto' | 'clicado' | 'falha' | 'bounce'
  aberto BOOLEAN NOT NULL DEFAULT false,
  aberto_em TIMESTAMPTZ,
  clicado BOOLEAN NOT NULL DEFAULT false,
  clicado_em TIMESTAMPTZ,
  link_clicado TEXT,
  error_message TEXT,
  provider_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view email_logs"
  ON public.email_logs FOR SELECT USING (true);

CREATE POLICY "Admins gestores can manage email_logs"
  ON public.email_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- ============================================================
-- 4. Tabela: lead_score_events
-- Eventos que compõem o lead scoring dinâmico
-- ============================================================
CREATE TABLE public.lead_score_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,                          -- 'abriu_email' | 'clicou_link' | 'respondeu_whatsapp' | 'clicou_cta' | 'agendou_sessao' | 'inatividade' | 'descadastrou'
  pontos INTEGER NOT NULL DEFAULT 0,
  descricao TEXT,
  referencia_id UUID,                            -- id do email_log ou interacao_whatsapp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_score_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view score events"
  ON public.lead_score_events FOR SELECT USING (true);

CREATE POLICY "Admins gestores can manage score events"
  ON public.lead_score_events FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- ============================================================
-- 5. Tabela: alertas_comerciais
-- Notificações automáticas quando lead atinge 91+ pontos
-- ============================================================
CREATE TABLE public.alertas_comerciais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'oportunidade',     -- 'oportunidade' | 'reativacao' | 'convertido'
  mensagem TEXT NOT NULL DEFAULT '',
  lido BOOLEAN NOT NULL DEFAULT false,
  lido_por UUID,
  lido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.alertas_comerciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view alertas"
  ON public.alertas_comerciais FOR SELECT USING (true);

CREATE POLICY "Authenticated users can update alertas"
  ON public.alertas_comerciais FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestores can insert alertas"
  ON public.alertas_comerciais FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- ============================================================
-- 6. Configurações de e-mail na tabela configuracoes
-- ============================================================
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'azure',
  ADD COLUMN IF NOT EXISTS email_from_name TEXT DEFAULT 'MX3',
  ADD COLUMN IF NOT EXISTS email_from_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_smtp_host TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS email_smtp_port INTEGER DEFAULT 587,
  ADD COLUMN IF NOT EXISTS email_tracking_enabled BOOLEAN DEFAULT true;

-- ============================================================
-- 7. Campo cadencia_status no leads (controle de cadência ativa)
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cadencia_status TEXT DEFAULT 'ativa',  -- 'ativa' | 'pausada' | 'concluida' | 'convertida'
  ADD COLUMN IF NOT EXISTS cadencia_inicio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cadencia_saida_motivo TEXT;            -- 'clicou_cta' | 'timeout_d10' | 'manual'
