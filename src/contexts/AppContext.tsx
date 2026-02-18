import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type LeadStatus = 'lead' | 'reuniao' | 'proposta' | 'venda' | 'perdido';

export interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  campanha: string;
  adset: string;
  grupo_anuncios: string;
  vendedor_id: string | null;
  vendedor_nome: string;
  status_funil: LeadStatus;
  data_entrada: string;
  data_ultimo_movimento: string;
  valor_proposta: number | null;
  valor_venda: number | null;
  motivo_perda: string | null;
  score_lead: number;
  probabilidade_fechamento: number;
  envio_whatsapp_status: string;
  envio_whatsapp_data: string | null;
  lead_time: number | null;
  observacoes: string;
}

interface Settings {
  zapiWebhook: string;
  zapiToken: string;
  zapiInstanceId: string;
  googleSheetsUrl: string;
  custoPorLead: number;
  metaVendasMensal: number;
  metaReceitaMensal: number;
}

interface AppContextType {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  moveLeadToStage: (leadId: string, newStage: LeadStatus) => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  loading: boolean;
  refreshLeads: () => Promise<void>;
}

const defaultSettings: Settings = {
  zapiWebhook: '',
  zapiToken: '',
  zapiInstanceId: '',
  googleSheetsUrl: '',
  custoPorLead: 25,
  metaVendasMensal: 30,
  metaReceitaMensal: 500000,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchLeads = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('data_entrada', { ascending: false });

    if (!error && data) {
      setLeads(data.map(d => ({
        ...d,
        status_funil: d.status_funil as LeadStatus,
        valor_proposta: d.valor_proposta ? Number(d.valor_proposta) : null,
        valor_venda: d.valor_venda ? Number(d.valor_venda) : null,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchLeads();

      // Realtime subscription
      const channel = supabase
        .channel('leads-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
          fetchLeads();
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [user, fetchLeads]);

  const moveLeadToStage = async (leadId: string, newStage: LeadStatus) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    const scoreMap: Record<LeadStatus, number> = { lead: 10, reuniao: 30, proposta: 60, venda: 100, perdido: 5 };
    const probMap: Record<LeadStatus, number> = { lead: 10, reuniao: 30, proposta: 60, venda: 100, perdido: 0 };

    const updates: Record<string, any> = {
      status_funil: newStage,
      data_ultimo_movimento: new Date().toISOString(),
      score_lead: scoreMap[newStage],
      probabilidade_fechamento: probMap[newStage],
    };

    if (newStage === 'venda' || newStage === 'perdido') {
      const entrada = new Date(lead.data_entrada);
      const agora = new Date();
      updates.lead_time = Math.ceil((agora.getTime() - entrada.getTime()) / (1000 * 60 * 60 * 24));
    }

    await supabase.from('leads').update(updates).eq('id', leadId);

    // Log movement
    if (user) {
      await supabase.from('lead_logs').insert({
        lead_id: leadId,
        user_id: user.id,
        acao: 'Mudança de etapa',
        de: lead.status_funil,
        para: newStage,
      });
    }
  };

  return (
    <AppContext.Provider value={{ leads, setLeads, moveLeadToStage, settings, setSettings, loading, refreshLeads: fetchLeads }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
