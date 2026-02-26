
-- Add Core AI Google Sheets URL column to configuracoes
ALTER TABLE public.configuracoes
ADD COLUMN google_sheets_url_core_ai text DEFAULT '';
