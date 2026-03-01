
-- Step 1: Only add enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'aluno_hub';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'suporte_hub';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_hub';
