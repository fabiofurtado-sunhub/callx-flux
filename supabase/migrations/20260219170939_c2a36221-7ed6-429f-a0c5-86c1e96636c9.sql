-- Add 'reuniao_realizada' to lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'reuniao_realizada' AFTER 'reuniao';