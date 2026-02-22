
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funil TEXT NOT NULL DEFAULT 'callx',
  etapa TEXT NOT NULL,
  titulo TEXT NOT NULL DEFAULT '',
  conteudo TEXT NOT NULL DEFAULT '',
  delay_horas INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view templates"
  ON public.message_templates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage templates"
  ON public.message_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed current CallX templates
INSERT INTO public.message_templates (funil, etapa, titulo, conteudo, delay_horas, ordem) VALUES
  ('callx', 'lead', 'Mensagem inicial CallX', 'Mensagem automática enviada ao novo lead do CallX (configurada na edge function send-whatsapp)', 0, 1),
  ('callx', 'fup_1', 'FUP 1 - Opção A', 'Boa tarde {{nome}}\n\nTe chamei sobre o CallX, mas pode ser que tenha passado batido.\n\nMe diz só uma coisa rápida:\n\nHoje sua maior dor está em gerar demanda ou em converter melhor o que já chega?', 24, 1),
  ('callx', 'fup_1', 'FUP 1 - Opção B', 'Vou ser direto.\n\nNos últimos 10 dias, fechamos 4 operações que estavam exatamente no mesmo cenário: lead entrando e dinheiro ficando na mesa por falta de processo.\n\nSe não for prioridade agora, sem problema.\n\nMas se você quiser entender como estamos organizando isso, eu te explico em 20 minutos.\n\nPrefere amanhã ou segunda pela manhã?', 24, 2),
  ('callx', 'fup_1', 'FUP 1 - Opção C', 'Boa tarde {{nome}}\n\nEu te chamei esses dias sobre o CallX e fiquei na dúvida se a mensagem fez sentido para você.\n\nNão gosto de insistir quando não é prioridade.\n\nMas como tenho visto muita empresa deixando dinheiro na mesa por falta de timing e follow-up, preferi confirmar antes de encerrar por aqui.\n\nSe hoje não é o momento, me fala com tranquilidade.\n\nSe fizer sentido entender como estamos organizando outras operações, eu separo 20 minutos para te mostrar.\n\nPrefere amanhã ou segunda pela manhã?', 24, 3);
