-- Add new enum value 'mensagem_enviada' to lead_status
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'mensagem_enviada' AFTER 'lead';