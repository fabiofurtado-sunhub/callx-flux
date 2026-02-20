-- Add 'fup_1' to the lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'fup_1' AFTER 'mensagem_enviada';