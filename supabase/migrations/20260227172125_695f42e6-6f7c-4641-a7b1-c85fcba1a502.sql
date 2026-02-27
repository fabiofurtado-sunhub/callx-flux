
-- Add tags column (text array for free-form tags)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add valor_entrada (numeric)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_entrada numeric DEFAULT NULL;

-- Add valor_mrr (numeric)
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS valor_mrr numeric DEFAULT NULL;
