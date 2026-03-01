
-- Tabela para armazenar diagnósticos comerciais dos leads Revenue OS
CREATE TABLE public.diagnosticos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'rascunho', -- rascunho | finalizado
  
  -- Aba 1: Dados complementares
  data_reuniao timestamp with time zone,
  closer_id uuid,
  closer_nome text,
  
  -- Aba 2: SPIN (armazenado em JSONB para flexibilidade)
  spin_situacao jsonb DEFAULT '{}'::jsonb,
  spin_problema jsonb DEFAULT '{}'::jsonb,
  spin_implicacao jsonb DEFAULT '{}'::jsonb,
  spin_necessidade jsonb DEFAULT '{}'::jsonb,
  
  -- Aba 3: Fechamento
  fechamento jsonb DEFAULT '{}'::jsonb,
  
  -- Aba 4: Guia de Negociação
  negociacao jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_lead_diagnostico UNIQUE (lead_id)
);

-- RLS
ALTER TABLE public.diagnosticos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view diagnosticos"
ON public.diagnosticos FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestores can manage diagnosticos"
ON public.diagnosticos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Vendedores can insert diagnosticos"
ON public.diagnosticos FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Vendedores can update diagnosticos"
ON public.diagnosticos FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_diagnosticos_updated_at
BEFORE UPDATE ON public.diagnosticos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
