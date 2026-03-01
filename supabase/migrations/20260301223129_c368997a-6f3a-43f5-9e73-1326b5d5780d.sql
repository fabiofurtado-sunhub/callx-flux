
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS diag_cor_fundo text DEFAULT '#080C16',
  ADD COLUMN IF NOT EXISTS diag_cor_primaria text DEFAULT '#00FF78',
  ADD COLUMN IF NOT EXISTS diag_cor_secundaria text DEFAULT '#00D2C8',
  ADD COLUMN IF NOT EXISTS diag_cor_destaque text DEFAULT '#F59E0B',
  ADD COLUMN IF NOT EXISTS diag_cor_alerta text DEFAULT '#FF4455',
  ADD COLUMN IF NOT EXISTS diag_cor_card text DEFAULT '#0D1825',
  ADD COLUMN IF NOT EXISTS diag_cor_texto text DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS diag_cor_texto_muted text DEFAULT '#8899AA',
  ADD COLUMN IF NOT EXISTS diag_logo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS diag_nome_marca text DEFAULT 'MX3 Aceleradora Comercial',
  ADD COLUMN IF NOT EXISTS diag_slogan text DEFAULT 'Diagnóstico Comercial Confidencial';
