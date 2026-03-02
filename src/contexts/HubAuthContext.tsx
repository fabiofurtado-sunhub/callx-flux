import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

interface HubAuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isHubUser: boolean;
  isHubAdmin: boolean;
  hubProfile: HubProfile | null;
  signOut: () => Promise<void>;
}

interface HubProfile {
  id: string;
  user_id: string;
  nome: string;
  telefone: string;
  engagement_score: number;
  total_login_count: number;
  ultimo_login: string | null;
  dias_consecutivos: number;
  status: string;
}

const HubAuthContext = createContext<HubAuthContextType | undefined>(undefined);

export function HubAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isHubUser, setIsHubUser] = useState(false);
  const [isHubAdmin, setIsHubAdmin] = useState(false);
  const [hubProfile, setHubProfile] = useState<HubProfile | null>(null);

  const checkHubRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['aluno_hub', 'admin_hub', 'suporte_hub']);
    
    const hasHubRole = (data && data.length > 0) || false;
    const hasAdminRole = (data || []).some((r) => r.role === 'admin_hub' || r.role === 'admin');
    setIsHubUser(hasHubRole);
    setIsHubAdmin(hasAdminRole);

    if (hasHubRole) {
      const { data: profile } = await supabase
        .from('hub_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      setHubProfile(profile as HubProfile | null);

      // Update login count and ultimo_login
      if (profile) {
        await supabase
          .from('hub_profiles')
          .update({
            total_login_count: (profile as any).total_login_count + 1,
            ultimo_login: new Date().toISOString(),
          })
          .eq('user_id', userId);
      }
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(() => checkHubRole(session.user.id), 0);
      } else {
        setIsHubUser(false);
        setIsHubAdmin(false);
        setHubProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        checkHubRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <HubAuthContext.Provider value={{ session, user: session?.user ?? null, loading, isHubUser, isHubAdmin, hubProfile, signOut }}>
      {children}
    </HubAuthContext.Provider>
  );
}

export function useHubAuth() {
  const ctx = useContext(HubAuthContext);
  if (!ctx) throw new Error('useHubAuth must be used within HubAuthProvider');
  return ctx;
}
