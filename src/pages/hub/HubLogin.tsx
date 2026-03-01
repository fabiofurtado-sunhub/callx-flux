import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Lock, LogIn, UserPlus, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function HubLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Acesso autorizado.');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nome, hub_user: 'true' },
            emailRedirectTo: window.location.origin + '/plataforma',
          },
        });
        if (error) throw error;
        toast.success('Conta criada! Verifique seu email para ativar.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro na autenticação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#111111' }}>
      <div className="w-full max-w-sm space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-none border border-[#FF1657]/30" style={{ background: '#1a1a1a' }}>
            <Shield className="w-6 h-6" style={{ color: '#FF1657' }} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] tracking-[4px] uppercase font-medium" style={{ color: '#FF1657' }}>
              ACESSO RESTRITO
            </p>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>
              MX3 EXECUTION HUB
            </h1>
            <p className="text-xs" style={{ color: '#666666' }}>
              Plataforma Oficial MX3
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 border" style={{ background: '#1a1a1a', borderColor: '#2a2a2a' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <Label className="text-[10px] tracking-[2px] uppercase" style={{ color: '#666666' }}>
                  Nome completo
                </Label>
                <Input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  placeholder="Seu nome"
                  required={!isLogin}
                  className="mt-1.5 rounded-none border-[#2a2a2a] text-white placeholder:text-[#444] focus-visible:ring-[#FF1657]/50"
                  style={{ background: '#111111' }}
                />
              </div>
            )}
            <div>
              <Label className="text-[10px] tracking-[2px] uppercase" style={{ color: '#666666' }}>
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="mt-1.5 rounded-none border-[#2a2a2a] text-white placeholder:text-[#444] focus-visible:ring-[#FF1657]/50"
                style={{ background: '#111111' }}
              />
            </div>
            <div>
              <Label className="text-[10px] tracking-[2px] uppercase" style={{ color: '#666666' }}>
                Senha
              </Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="mt-1.5 rounded-none border-[#2a2a2a] text-white placeholder:text-[#444] focus-visible:ring-[#FF1657]/50"
                style={{ background: '#111111' }}
              />
            </div>
            <Button
              type="submit"
              className="w-full gap-2 rounded-none font-medium text-sm tracking-wide"
              style={{ background: '#FF1657', color: '#FFFFFF' }}
              disabled={loading}
            >
              {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {loading ? 'AGUARDE...' : isLogin ? 'ACESSAR PLATAFORMA' : 'CRIAR CONTA'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs hover:underline"
              style={{ color: '#FF1657' }}
            >
              {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
            </button>
          </div>
        </div>

        {/* Security footer */}
        <div className="flex items-center justify-center gap-2">
          <Lock className="w-3 h-3" style={{ color: '#333' }} />
          <p className="text-[10px]" style={{ color: '#333' }}>
            Conexão segura · Ambiente restrito
          </p>
        </div>
      </div>
    </div>
  );
}
