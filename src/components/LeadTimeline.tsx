import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Mail, MessageSquare, MailOpen, MousePointerClick, RefreshCw } from 'lucide-react';

interface TimelineEvent {
  id: string;
  date: string;
  type: 'stage_change' | 'email_sent' | 'email_opened' | 'email_clicked' | 'whatsapp' | 'cadencia';
  title: string;
  detail?: string;
  icon: 'arrow' | 'mail' | 'mail_open' | 'click' | 'whatsapp' | 'cadencia';
}

function getIconColor(type: TimelineEvent['type']) {
  switch (type) {
    case 'stage_change': return 'bg-primary/20 text-primary';
    case 'email_sent': return 'bg-blue-500/20 text-blue-400';
    case 'email_opened': return 'bg-emerald-500/20 text-emerald-400';
    case 'email_clicked': return 'bg-amber-500/20 text-amber-400';
    case 'whatsapp': return 'bg-green-500/20 text-green-400';
    case 'cadencia': return 'bg-purple-500/20 text-purple-400';
  }
}

function EventIcon({ type }: { type: TimelineEvent['type'] }) {
  const cls = "w-3.5 h-3.5";
  switch (type) {
    case 'stage_change': return <ArrowRight className={cls} />;
    case 'email_sent': return <Mail className={cls} />;
    case 'email_opened': return <MailOpen className={cls} />;
    case 'email_clicked': return <MousePointerClick className={cls} />;
    case 'whatsapp': return <MessageSquare className={cls} />;
    case 'cadencia': return <RefreshCw className={cls} />;
  }
}

export default function LeadTimeline({ leadId }: { leadId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) return;

    const fetchAll = async () => {
      setLoading(true);
      const [logsRes, emailRes, whatsRes, cadRes] = await Promise.all([
        supabase.from('lead_logs').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50),
        supabase.from('email_logs').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50),
        supabase.from('interacoes_whatsapp').select('*').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50),
        supabase.from('cadencia_execucoes').select('*, cadencia_etapas(titulo, canal)').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(50),
      ]);

      const all: TimelineEvent[] = [];

      // Lead logs (stage changes)
      (logsRes.data || []).forEach(l => {
        all.push({
          id: `log-${l.id}`,
          date: l.created_at,
          type: 'stage_change',
          title: l.acao,
          detail: l.de && l.para ? `${l.de} → ${l.para}` : undefined,
          icon: 'arrow',
        });
      });

      // Email logs
      (emailRes.data || []).forEach(e => {
        all.push({
          id: `email-${e.id}`,
          date: e.created_at,
          type: 'email_sent',
          title: `Email enviado: ${e.assunto || '(sem assunto)'}`,
          detail: e.status,
          icon: 'mail',
        });
        if (e.aberto && e.aberto_em) {
          all.push({
            id: `email-open-${e.id}`,
            date: e.aberto_em,
            type: 'email_opened',
            title: `Email aberto: ${e.assunto || '(sem assunto)'}`,
            icon: 'mail_open',
          });
        }
        if (e.clicado && e.clicado_em) {
          all.push({
            id: `email-click-${e.id}`,
            date: e.clicado_em,
            type: 'email_clicked',
            title: `Link clicado no email`,
            detail: e.link_clicado || undefined,
            icon: 'click',
          });
        }
      });

      // WhatsApp
      (whatsRes.data || []).forEach(w => {
        all.push({
          id: `wpp-${w.id}`,
          date: w.created_at,
          type: 'whatsapp',
          title: `WhatsApp ${w.tipo}`,
          detail: w.status,
          icon: 'whatsapp',
        });
      });

      // Cadência execuções
      (cadRes.data || []).forEach(c => {
        const etapa = c.cadencia_etapas as any;
        all.push({
          id: `cad-${c.id}`,
          date: c.executado_em || c.agendado_para,
          type: 'cadencia',
          title: etapa?.titulo ? `Cadência: ${etapa.titulo}` : 'Etapa da cadência',
          detail: `${c.status}${etapa?.canal ? ` (${etapa.canal})` : ''}`,
          icon: 'cadencia',
        });
      });

      all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(all);
      setLoading(false);
    };

    fetchAll();
  }, [leadId]);

  if (loading) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Carregando histórico...</p>;
  }

  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma interação registrada</p>;
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-[13px] top-2 bottom-2 w-px bg-border" />

      {events.map((ev) => (
        <div key={ev.id} className="relative flex items-start gap-3 py-2">
          {/* Icon dot */}
          <div className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0 ${getIconColor(ev.type)}`}>
            <EventIcon type={ev.type} />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-xs font-medium text-card-foreground leading-tight truncate">{ev.title}</p>
            {ev.detail && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{ev.detail}</p>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
              {format(new Date(ev.date), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
