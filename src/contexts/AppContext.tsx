import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Lead, generateMockLeads, LeadStatus } from '@/data/mockData';

interface AppContextType {
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  moveLeadToStage: (leadId: string, newStage: LeadStatus) => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

interface Settings {
  zapiWebhook: string;
  zapiToken: string;
  zapiInstanceId: string;
  custoPorLead: number;
  metaVendasMensal: number;
  metaReceitaMensal: number;
}

const defaultSettings: Settings = {
  zapiWebhook: '',
  zapiToken: '',
  zapiInstanceId: '',
  custoPorLead: 25,
  metaVendasMensal: 30,
  metaReceitaMensal: 500000,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(generateMockLeads(45));
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const moveLeadToStage = (leadId: string, newStage: LeadStatus) => {
    setLeads(prev =>
      prev.map(l =>
        l.id === leadId
          ? { ...l, status_funil: newStage, data_ultimo_movimento: new Date().toISOString() }
          : l
      )
    );
  };

  return (
    <AppContext.Provider value={{ leads, setLeads, moveLeadToStage, settings, setSettings }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
