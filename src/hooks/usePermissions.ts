import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PermissionMatrix {
  accounts: {
    view_all: boolean;
    view_owned: boolean;
    edit: boolean;
    delete: boolean;
    change_owner: boolean;
  };
  opportunities: {
    create: boolean;
    edit_all: boolean;
    edit_owned: boolean;
    move_pipeline: boolean;
    change_value: boolean;
  };
  contacts: {
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  documents: {
    upload: boolean;
    delete: boolean;
  };
  hub_data: {
    view_engagement: boolean;
    trigger_followup: boolean;
  };
  reports: {
    view_team: boolean;
    view_company: boolean;
    export: boolean;
  };
  governance: {
    change_owner: boolean;
    override_pipeline: boolean;
    force_close: boolean;
  };
  pipeline: {
    view_fields: string[];
    max_stage?: string;
  };
}

export type AppRole = 'admin' | 'gestor' | 'closer' | 'sdr' | 'suporte' | 'financeiro' | 'vendedor';

const DEFAULT_PERMISSIONS: PermissionMatrix = {
  accounts: { view_all: false, view_owned: true, edit: false, delete: false, change_owner: false },
  opportunities: { create: false, edit_all: false, edit_owned: false, move_pipeline: false, change_value: false },
  contacts: { create: false, edit: false, delete: false },
  documents: { upload: false, delete: false },
  hub_data: { view_engagement: false, trigger_followup: false },
  reports: { view_team: false, view_company: false, export: false },
  governance: { change_owner: false, override_pipeline: false, force_close: false },
  pipeline: { view_fields: ['status'] },
};

export function usePermissions() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionMatrix>(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchPermissions = async () => {
      try {
        // Fetch user role
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .not('role', 'in', '("aluno_hub","suporte_hub","admin_hub")');

        const roleData = roleRows?.[0] ?? null;

        if (!roleData) {
          setLoading(false);
          return;
        }

        const userRole = roleData.role as AppRole;
        setRole(userRole);

        // Fetch permission matrix for this role
        const { data: permData } = await supabase
          .from('roles_permissions')
          .select('permissoes')
          .eq('role', userRole)
          .maybeSingle();

        if (permData?.permissoes) {
          setPermissions(permData.permissoes as unknown as PermissionMatrix);
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user]);

  const can = (section: keyof PermissionMatrix, action: string): boolean => {
    const sectionPerms = permissions[section];
    if (!sectionPerms) return false;
    return (sectionPerms as Record<string, any>)[action] === true;
  };

  const isAdmin = role === 'admin';
  const isGestor = role === 'gestor';
  const isCloser = role === 'closer';
  const isSdr = role === 'sdr';
  const isSuporte = role === 'suporte';
  const isFinanceiro = role === 'financeiro';
  const isVendedor = role === 'vendedor';
  const isStrategic = isAdmin || isGestor;

  return {
    role,
    permissions,
    loading,
    can,
    isAdmin,
    isGestor,
    isCloser,
    isSdr,
    isSuporte,
    isFinanceiro,
    isVendedor,
    isStrategic,
  };
}
