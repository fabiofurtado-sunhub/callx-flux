-- Add 'ia_call' to the lead_status enum, after 'fup_1'
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'ia_call' AFTER 'fup_1';