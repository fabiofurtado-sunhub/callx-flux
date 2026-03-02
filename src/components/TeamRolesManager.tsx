import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, Shield, Plus, Trash2, UserPlus, Crown } from 'lucide-react';

interface UserProfile {
  user_id: string;
  nome: string;
  email: string;
  role: string;
}

interface Team {
  id: string;
  nome: string;
  gestor_id: string;
  members: { user_id: string; nome: string; email: string; role: string }[];
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin', color: 'bg-destructive text-destructive-foreground' },
  { value: 'gestor', label: 'Gestor', color: 'bg-primary text-primary-foreground' },
  { value: 'closer', label: 'Closer', color: 'bg-blue-600 text-white' },
  { value: 'sdr', label: 'SDR', color: 'bg-green-600 text-white' },
  { value: 'suporte', label: 'Suporte', color: 'bg-yellow-600 text-white' },
  { value: 'financeiro', label: 'Financeiro', color: 'bg-orange-600 text-white' },
];

export default function TeamRolesManager() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamGestor, setNewTeamGestor] = useState('');
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all profiles with roles
      const { data: profiles } = await supabase.from('profiles').select('user_id, nome, email');
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');

      const roleMap = new Map<string, string>();
      roles?.forEach(r => roleMap.set(r.user_id, r.role));

      const userList: UserProfile[] = (profiles || []).map(p => ({
        ...p,
        role: roleMap.get(p.user_id) || 'closer',
      }));
      setUsers(userList);

      // Fetch teams with members
      const { data: teamsData } = await supabase.from('teams').select('id, nome, gestor_id');
      const { data: membersData } = await supabase.from('team_members').select('team_id, user_id');

      const teamsList: Team[] = (teamsData || []).map(t => ({
        ...t,
        members: (membersData || [])
          .filter(m => m.team_id === t.id)
          .map(m => {
            const u = userList.find(u => u.user_id === m.user_id);
            return { user_id: m.user_id, nome: u?.nome || '', email: u?.email || '', role: u?.role || '' };
          }),
      }));
      setTeams(teamsList);
    } catch (err) {
      console.error('Error fetching team data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await supabase.from('user_roles').update({ role: newRole as any }).eq('user_id', userId);
      toast.success('Role atualizado');
      fetchData();
    } catch {
      toast.error('Erro ao atualizar role');
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !newTeamGestor) {
      toast.error('Nome e gestor são obrigatórios');
      return;
    }
    try {
      await supabase.from('teams').insert({ nome: newTeamName.trim(), gestor_id: newTeamGestor });
      toast.success('Time criado!');
      setCreateTeamOpen(false);
      setNewTeamName('');
      setNewTeamGestor('');
      fetchData();
    } catch {
      toast.error('Erro ao criar time');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Tem certeza que deseja excluir este time?')) return;
    await supabase.from('teams').delete().eq('id', teamId);
    toast.success('Time excluído');
    fetchData();
  };

  const handleAddMember = async () => {
    if (!addMemberTeamId || !selectedMember) return;
    try {
      await supabase.from('team_members').insert({ team_id: addMemberTeamId, user_id: selectedMember });
      toast.success('Membro adicionado');
      setAddMemberTeamId(null);
      setSelectedMember('');
      fetchData();
    } catch {
      toast.error('Erro ao adicionar membro');
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId);
    toast.success('Membro removido');
    fetchData();
  };

  const getRoleColor = (role: string) => ROLE_OPTIONS.find(r => r.value === role)?.color || 'bg-muted text-muted-foreground';
  const getRoleLabel = (role: string) => ROLE_OPTIONS.find(r => r.value === role)?.label || role;

  const gestores = users.filter(u => u.role === 'admin' || u.role === 'gestor');

  if (loading) return <p className="text-sm text-muted-foreground py-4">Carregando...</p>;

  return (
    <div className="space-y-8">
      {/* Gestão de Roles */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-base font-display font-semibold text-foreground">Gestão de Roles</h3>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Usuário</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium text-card-foreground">{u.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${getRoleColor(u.role)}`}>{getRoleLabel(u.role)}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.user_id !== user?.id ? (
                      <Select value={u.role} onValueChange={(v) => handleRoleChange(u.user_id, v)}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Você</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gestão de Times */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="text-base font-display font-semibold text-foreground">Times</h3>
          </div>
          <Button size="sm" onClick={() => setCreateTeamOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Novo Time
          </Button>
        </div>

        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum time criado</p>
        ) : (
          <div className="grid gap-4">
            {teams.map(team => {
              const gestor = users.find(u => u.user_id === team.gestor_id);
              return (
                <div key={team.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-card-foreground">{team.nome}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Crown className="w-3 h-3 text-primary" />
                        <span className="text-xs text-muted-foreground">Gestor: {gestor?.nome || 'Não definido'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs h-7"
                        onClick={() => { setAddMemberTeamId(team.id); setSelectedMember(''); }}
                      >
                        <UserPlus className="w-3 h-3" />
                        Membro
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => handleDeleteTeam(team.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {team.members.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {team.members.map(m => (
                        <div key={m.user_id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50">
                          <span className="text-xs font-medium text-card-foreground">{m.nome}</span>
                          <Badge className={`text-[9px] px-1 py-0 ${getRoleColor(m.role)}`}>{getRoleLabel(m.role)}</Badge>
                          <button
                            onClick={() => handleRemoveMember(team.id, m.user_id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Team Dialog */}
      <Dialog open={createTeamOpen} onOpenChange={setCreateTeamOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Time</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome do Time</Label>
              <Input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Ex: Time Comercial SP" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Gestor Responsável</Label>
              <Select value={newTeamGestor} onValueChange={setNewTeamGestor}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o gestor" />
                </SelectTrigger>
                <SelectContent>
                  {gestores.map(g => (
                    <SelectItem key={g.user_id} value={g.user_id}>{g.nome} ({g.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateTeamOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTeam}>Criar Time</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!addMemberTeamId} onOpenChange={(open) => { if (!open) setAddMemberTeamId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Membro</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs">Usuário</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione o usuário" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(u => !teams.find(t => t.id === addMemberTeamId)?.members.some(m => m.user_id === u.user_id))
                  .map(u => (
                    <SelectItem key={u.user_id} value={u.user_id}>{u.nome} - {getRoleLabel(u.role)}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddMemberTeamId(null)}>Cancelar</Button>
            <Button onClick={handleAddMember}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
