-- Add new enum value 'ultima_mensagem' after 'ia_call'
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'ultima_mensagem' AFTER 'ia_call';
