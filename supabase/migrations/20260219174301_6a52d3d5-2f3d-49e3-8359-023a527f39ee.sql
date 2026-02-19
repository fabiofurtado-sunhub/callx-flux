
-- Table to store ad spend data from Google Sheets
CREATE TABLE public.ad_spend (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dia date NOT NULL,
  campanha text NOT NULL DEFAULT '',
  adset text NOT NULL DEFAULT '',
  ad_name text NOT NULL DEFAULT '',
  valor_gasto numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(dia, campanha, adset, ad_name)
);

-- Enable RLS
ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view ad spend
CREATE POLICY "Authenticated users can view ad_spend"
ON public.ad_spend FOR SELECT
USING (true);

-- Only admins/gestores can insert/update (for the edge function we use service role)
CREATE POLICY "Service role can manage ad_spend"
ON public.ad_spend FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ad_spend;

-- Trigger for updated_at
CREATE TRIGGER update_ad_spend_updated_at
BEFORE UPDATE ON public.ad_spend
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
