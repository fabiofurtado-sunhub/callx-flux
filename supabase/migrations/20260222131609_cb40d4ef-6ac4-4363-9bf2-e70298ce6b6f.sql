
-- Add funil column to leads table to distinguish between Callx and Core AI funnels
ALTER TABLE public.leads ADD COLUMN funil text NOT NULL DEFAULT 'callx';

-- Create index for filtering by funil
CREATE INDEX idx_leads_funil ON public.leads (funil);

-- Update existing leads to be in the callx funil
UPDATE public.leads SET funil = 'callx' WHERE funil = 'callx';
