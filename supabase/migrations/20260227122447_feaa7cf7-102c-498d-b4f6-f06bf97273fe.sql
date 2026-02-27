-- Add ia_call_2 to lead_status enum (after ia_call)
ALTER TYPE public.lead_status ADD VALUE 'ia_call_2' AFTER 'ia_call';