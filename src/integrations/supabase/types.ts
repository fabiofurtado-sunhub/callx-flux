export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_activity_log: {
        Row: {
          account_id: string
          created_at: string
          descricao: string | null
          id: string
          metadata: Json | null
          origem: string | null
          tipo_evento: string
          user_id: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          origem?: string | null
          tipo_evento?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          metadata?: Json | null
          origem?: string | null
          tipo_evento?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_activity_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          cnpj: string | null
          created_at: string
          faturamento_estimado: number | null
          hub_engagement_medio: number | null
          hub_score_empresa: number | null
          hub_status: string | null
          hub_usuarios_ativos: number | null
          id: string
          nicho: string | null
          nome_fantasia: string
          numero_funcionarios: number | null
          owner_id: string | null
          razao_social: string
          status: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          faturamento_estimado?: number | null
          hub_engagement_medio?: number | null
          hub_score_empresa?: number | null
          hub_status?: string | null
          hub_usuarios_ativos?: number | null
          id?: string
          nicho?: string | null
          nome_fantasia?: string
          numero_funcionarios?: number | null
          owner_id?: string | null
          razao_social?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          faturamento_estimado?: number | null
          hub_engagement_medio?: number | null
          hub_score_empresa?: number | null
          hub_status?: string | null
          hub_usuarios_ativos?: number | null
          id?: string
          nicho?: string | null
          nome_fantasia?: string
          numero_funcionarios?: number | null
          owner_id?: string | null
          razao_social?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ad_spend: {
        Row: {
          ad_name: string
          adset: string
          campanha: string
          created_at: string
          dia: string
          id: string
          updated_at: string
          valor_gasto: number
        }
        Insert: {
          ad_name?: string
          adset?: string
          campanha?: string
          created_at?: string
          dia: string
          id?: string
          updated_at?: string
          valor_gasto?: number
        }
        Update: {
          ad_name?: string
          adset?: string
          campanha?: string
          created_at?: string
          dia?: string
          id?: string
          updated_at?: string
          valor_gasto?: number
        }
        Relationships: []
      }
      alertas_comerciais: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          lido: boolean
          lido_em: string | null
          lido_por: string | null
          mensagem: string
          tipo: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          lido?: boolean
          lido_em?: string | null
          lido_por?: string | null
          mensagem?: string
          tipo?: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          lido?: boolean
          lido_em?: string | null
          lido_por?: string | null
          mensagem?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_comerciais_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      cadencia_etapas: {
        Row: {
          ativo: boolean
          canal: string
          condicao_referencia_id: string | null
          condicao_tipo: string | null
          condicional: boolean
          conteudo: string
          created_at: string
          dia: number
          funil: string
          id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal?: string
          condicao_referencia_id?: string | null
          condicao_tipo?: string | null
          condicional?: boolean
          conteudo?: string
          created_at?: string
          dia?: number
          funil?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          condicao_referencia_id?: string | null
          condicao_tipo?: string | null
          condicional?: boolean
          conteudo?: string
          created_at?: string
          dia?: number
          funil?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      cadencia_execucoes: {
        Row: {
          agendado_para: string
          cadencia_etapa_id: string
          created_at: string
          executado_em: string | null
          id: string
          lead_id: string
          resultado: Json | null
          status: string
        }
        Insert: {
          agendado_para: string
          cadencia_etapa_id: string
          created_at?: string
          executado_em?: string | null
          id?: string
          lead_id: string
          resultado?: Json | null
          status?: string
        }
        Update: {
          agendado_para?: string
          cadencia_etapa_id?: string
          created_at?: string
          executado_em?: string | null
          id?: string
          lead_id?: string
          resultado?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadencia_execucoes_cadencia_etapa_id_fkey"
            columns: ["cadencia_etapa_id"]
            isOneToOne: false
            referencedRelation: "cadencia_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadencia_execucoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          agent_type: string
          call_sid: string | null
          created_at: string
          duration_seconds: number | null
          erro: string | null
          gravacao_url: string | null
          id: string
          lead_id: string
          metadata: Json | null
          resumo: string | null
          sentimento: string | null
          status: string
          telefone: string | null
          transcricao: string | null
          updated_at: string
        }
        Insert: {
          agent_type?: string
          call_sid?: string | null
          created_at?: string
          duration_seconds?: number | null
          erro?: string | null
          gravacao_url?: string | null
          id?: string
          lead_id: string
          metadata?: Json | null
          resumo?: string | null
          sentimento?: string | null
          status?: string
          telefone?: string | null
          transcricao?: string | null
          updated_at?: string
        }
        Update: {
          agent_type?: string
          call_sid?: string | null
          created_at?: string
          duration_seconds?: number | null
          erro?: string | null
          gravacao_url?: string | null
          id?: string
          lead_id?: string
          metadata?: Json | null
          resumo?: string | null
          sentimento?: string | null
          status?: string
          telefone?: string | null
          transcricao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          diag_cor_alerta: string | null
          diag_cor_card: string | null
          diag_cor_destaque: string | null
          diag_cor_fundo: string | null
          diag_cor_primaria: string | null
          diag_cor_secundaria: string | null
          diag_cor_texto: string | null
          diag_cor_texto_muted: string | null
          diag_logo_url: string | null
          diag_nome_marca: string | null
          diag_slogan: string | null
          email_from_address: string | null
          email_from_name: string | null
          email_provider: string | null
          email_smtp_host: string | null
          email_smtp_port: number | null
          email_tracking_enabled: boolean | null
          google_sheets_url: string | null
          google_sheets_url_core_ai: string | null
          google_sheets_url_revenue_os: string | null
          horario_sugerido_texto: string | null
          id: string
          link_agendamento: string | null
          updated_at: string
          updated_by: string | null
          zapi_instance_id: string | null
          zapi_token: string | null
          zapi_webhook: string | null
        }
        Insert: {
          diag_cor_alerta?: string | null
          diag_cor_card?: string | null
          diag_cor_destaque?: string | null
          diag_cor_fundo?: string | null
          diag_cor_primaria?: string | null
          diag_cor_secundaria?: string | null
          diag_cor_texto?: string | null
          diag_cor_texto_muted?: string | null
          diag_logo_url?: string | null
          diag_nome_marca?: string | null
          diag_slogan?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          email_smtp_host?: string | null
          email_smtp_port?: number | null
          email_tracking_enabled?: boolean | null
          google_sheets_url?: string | null
          google_sheets_url_core_ai?: string | null
          google_sheets_url_revenue_os?: string | null
          horario_sugerido_texto?: string | null
          id?: string
          link_agendamento?: string | null
          updated_at?: string
          updated_by?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
          zapi_webhook?: string | null
        }
        Update: {
          diag_cor_alerta?: string | null
          diag_cor_card?: string | null
          diag_cor_destaque?: string | null
          diag_cor_fundo?: string | null
          diag_cor_primaria?: string | null
          diag_cor_secundaria?: string | null
          diag_cor_texto?: string | null
          diag_cor_texto_muted?: string | null
          diag_logo_url?: string | null
          diag_nome_marca?: string | null
          diag_slogan?: string | null
          email_from_address?: string | null
          email_from_name?: string | null
          email_provider?: string | null
          email_smtp_host?: string | null
          email_smtp_port?: number | null
          email_tracking_enabled?: boolean | null
          google_sheets_url?: string | null
          google_sheets_url_core_ai?: string | null
          google_sheets_url_revenue_os?: string | null
          horario_sugerido_texto?: string | null
          id?: string
          link_agendamento?: string | null
          updated_at?: string
          updated_by?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
          zapi_webhook?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          account_id: string
          cargo: string | null
          created_at: string
          decisor: boolean | null
          email: string | null
          hub_user_id: string | null
          id: string
          influencia: string | null
          lead_score: number | null
          nome: string
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          cargo?: string | null
          created_at?: string
          decisor?: boolean | null
          email?: string | null
          hub_user_id?: string | null
          id?: string
          influencia?: string | null
          lead_score?: number | null
          nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          cargo?: string | null
          created_at?: string
          decisor?: boolean | null
          email?: string | null
          hub_user_id?: string | null
          id?: string
          influencia?: string | null
          lead_score?: number | null
          nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosticos: {
        Row: {
          closer_id: string | null
          closer_nome: string | null
          created_at: string
          data_reuniao: string | null
          fechamento: Json | null
          id: string
          lead_id: string
          negociacao: Json | null
          spin_implicacao: Json | null
          spin_necessidade: Json | null
          spin_problema: Json | null
          spin_situacao: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          closer_id?: string | null
          closer_nome?: string | null
          created_at?: string
          data_reuniao?: string | null
          fechamento?: Json | null
          id?: string
          lead_id: string
          negociacao?: Json | null
          spin_implicacao?: Json | null
          spin_necessidade?: Json | null
          spin_problema?: Json | null
          spin_situacao?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          closer_id?: string | null
          closer_nome?: string | null
          created_at?: string
          data_reuniao?: string | null
          fechamento?: Json | null
          id?: string
          lead_id?: string
          negociacao?: Json | null
          spin_implicacao?: Json | null
          spin_necessidade?: Json | null
          spin_problema?: Json | null
          spin_situacao?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          account_id: string
          created_at: string
          id: string
          nome_arquivo: string | null
          opportunity_id: string | null
          status: string | null
          tipo: string
          uploaded_by: string | null
          url_documento: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          nome_arquivo?: string | null
          opportunity_id?: string | null
          status?: string | null
          tipo?: string
          uploaded_by?: string | null
          url_documento?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          nome_arquivo?: string | null
          opportunity_id?: string | null
          status?: string | null
          tipo?: string
          uploaded_by?: string | null
          url_documento?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          aberto: boolean
          aberto_em: string | null
          assunto: string
          cadencia_etapa_id: string | null
          clicado: boolean
          clicado_em: string | null
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          link_clicado: string | null
          provider_response: Json | null
          status: string
        }
        Insert: {
          aberto?: boolean
          aberto_em?: string | null
          assunto?: string
          cadencia_etapa_id?: string | null
          clicado?: boolean
          clicado_em?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          link_clicado?: string | null
          provider_response?: Json | null
          status?: string
        }
        Update: {
          aberto?: boolean
          aberto_em?: string | null
          assunto?: string
          cadencia_etapa_id?: string | null
          clicado?: boolean
          clicado_em?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          link_clicado?: string | null
          provider_response?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_cadencia_etapa_id_fkey"
            columns: ["cadencia_etapa_id"]
            isOneToOne: false
            referencedRelation: "cadencia_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_name: string
          ga_response: string | null
          id: string
          lead_id: string
          stage: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_name: string
          ga_response?: string | null
          id?: string
          lead_id: string
          stage: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_name?: string
          ga_response?: string | null
          id?: string
          lead_id?: string
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ga4_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_activity_events: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          tipo_evento: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          tipo_evento: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          tipo_evento?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_courses: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          drip_enabled: boolean
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          drip_enabled?: boolean
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          drip_enabled?: boolean
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      hub_lessons: {
        Row: {
          created_at: string
          duracao_total: number | null
          id: string
          material_url: string | null
          module_id: string
          nome: string
          ordem: number
          video_url: string | null
        }
        Insert: {
          created_at?: string
          duracao_total?: number | null
          id?: string
          material_url?: string | null
          module_id: string
          nome: string
          ordem?: number
          video_url?: string | null
        }
        Update: {
          created_at?: string
          duracao_total?: number | null
          id?: string
          material_url?: string | null
          module_id?: string
          nome?: string
          ordem?: number
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hub_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "hub_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_login_logs: {
        Row: {
          created_at: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      hub_modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "hub_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "hub_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      hub_profiles: {
        Row: {
          created_at: string
          crm_contact_id: string | null
          dias_consecutivos: number
          engagement_score: number
          id: string
          nome: string
          status: string
          telefone: string | null
          total_login_count: number
          ultimo_login: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crm_contact_id?: string | null
          dias_consecutivos?: number
          engagement_score?: number
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          total_login_count?: number
          ultimo_login?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          crm_contact_id?: string | null
          dias_consecutivos?: number
          engagement_score?: number
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          total_login_count?: number
          ultimo_login?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hub_user_progress: {
        Row: {
          concluida: boolean
          created_at: string
          data_conclusao: string | null
          id: string
          lesson_id: string
          porcentagem: number
          tempo_assistido: number
          ultimo_acesso: string
          user_id: string
        }
        Insert: {
          concluida?: boolean
          created_at?: string
          data_conclusao?: string | null
          id?: string
          lesson_id: string
          porcentagem?: number
          tempo_assistido?: number
          ultimo_acesso?: string
          user_id: string
        }
        Update: {
          concluida?: boolean
          created_at?: string
          data_conclusao?: string | null
          id?: string
          lesson_id?: string
          porcentagem?: number
          tempo_assistido?: number
          ultimo_acesso?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hub_user_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "hub_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      interacoes_whatsapp: {
        Row: {
          conteudo: string
          created_at: string
          data: string
          id: string
          lead_id: string
          response_data: Json | null
          status: Database["public"]["Enums"]["whatsapp_status"]
          tipo: string
        }
        Insert: {
          conteudo?: string
          created_at?: string
          data?: string
          id?: string
          lead_id: string
          response_data?: Json | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          tipo?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          data?: string
          id?: string
          lead_id?: string
          response_data?: Json | null
          status?: Database["public"]["Enums"]["whatsapp_status"]
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "interacoes_whatsapp_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_logs: {
        Row: {
          acao: string
          created_at: string
          de: string | null
          id: string
          lead_id: string
          para: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          de?: string | null
          id?: string
          lead_id: string
          para?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          de?: string | null
          id?: string
          lead_id?: string
          para?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_score_events: {
        Row: {
          created_at: string
          descricao: string | null
          evento: string
          id: string
          lead_id: string
          pontos: number
          referencia_id: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          evento: string
          id?: string
          lead_id: string
          pontos?: number
          referencia_id?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          evento?: string
          id?: string
          lead_id?: string
          pontos?: number
          referencia_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_score_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scoring_history: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          motivo: string | null
          score_anterior: number | null
          score_novo: number | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          motivo?: string | null
          score_anterior?: number | null
          score_novo?: number | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          motivo?: string | null
          score_anterior?: number | null
          score_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_scoring_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          account_id: string | null
          adset: string | null
          cadencia_inicio: string | null
          cadencia_saida_motivo: string | null
          cadencia_status: string | null
          campanha: string | null
          created_at: string
          data_entrada: string
          data_ultimo_movimento: string
          email: string | null
          empresa: string | null
          envio_whatsapp_data: string | null
          envio_whatsapp_status: Database["public"]["Enums"]["whatsapp_status"]
          faturamento: number | null
          funil: string
          grupo_anuncios: string | null
          id: string
          lead_time: number | null
          maior_gargalo_comercial: string | null
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          porte_empresa: string | null
          probabilidade_fechamento: number
          score_lead: number
          setor_empresa: string | null
          status_funil: Database["public"]["Enums"]["lead_status"]
          tags: string[] | null
          telefone: string
          tomador_decisao: boolean | null
          updated_at: string
          valor_entrada: number | null
          valor_mrr: number | null
          valor_proposta: number | null
          valor_venda: number | null
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          account_id?: string | null
          adset?: string | null
          cadencia_inicio?: string | null
          cadencia_saida_motivo?: string | null
          cadencia_status?: string | null
          campanha?: string | null
          created_at?: string
          data_entrada?: string
          data_ultimo_movimento?: string
          email?: string | null
          empresa?: string | null
          envio_whatsapp_data?: string | null
          envio_whatsapp_status?: Database["public"]["Enums"]["whatsapp_status"]
          faturamento?: number | null
          funil?: string
          grupo_anuncios?: string | null
          id?: string
          lead_time?: number | null
          maior_gargalo_comercial?: string | null
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          porte_empresa?: string | null
          probabilidade_fechamento?: number
          score_lead?: number
          setor_empresa?: string | null
          status_funil?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          telefone: string
          tomador_decisao?: boolean | null
          updated_at?: string
          valor_entrada?: number | null
          valor_mrr?: number | null
          valor_proposta?: number | null
          valor_venda?: number | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          account_id?: string | null
          adset?: string | null
          cadencia_inicio?: string | null
          cadencia_saida_motivo?: string | null
          cadencia_status?: string | null
          campanha?: string | null
          created_at?: string
          data_entrada?: string
          data_ultimo_movimento?: string
          email?: string | null
          empresa?: string | null
          envio_whatsapp_data?: string | null
          envio_whatsapp_status?: Database["public"]["Enums"]["whatsapp_status"]
          faturamento?: number | null
          funil?: string
          grupo_anuncios?: string | null
          id?: string
          lead_time?: number | null
          maior_gargalo_comercial?: string | null
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          porte_empresa?: string | null
          probabilidade_fechamento?: number
          score_lead?: number
          setor_empresa?: string | null
          status_funil?: Database["public"]["Enums"]["lead_status"]
          tags?: string[] | null
          telefone?: string
          tomador_decisao?: boolean | null
          updated_at?: string
          valor_entrada?: number | null
          valor_mrr?: number | null
          valor_proposta?: number | null
          valor_venda?: number | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          ativo: boolean
          conteudo: string
          created_at: string
          delay_horas: number
          etapa: string
          funil: string
          id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          conteudo?: string
          created_at?: string
          delay_horas?: number
          etapa: string
          funil?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          conteudo?: string
          created_at?: string
          delay_horas?: number
          etapa?: string
          funil?: string
          id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      meta_capi_logs: {
        Row: {
          created_at: string
          error_message: string | null
          event_name: string
          id: string
          lead_id: string
          meta_response: Json | null
          stage: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_name: string
          id?: string
          lead_id: string
          meta_response?: Json | null
          stage: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_name?: string
          id?: string
          lead_id?: string
          meta_response?: Json | null
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_capi_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      metas: {
        Row: {
          custo_por_lead: number
          id: string
          meta_receita_mensal: number
          meta_vendas_mensal: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          custo_por_lead?: number
          id?: string
          meta_receita_mensal?: number
          meta_vendas_mensal?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          custo_por_lead?: number
          id?: string
          meta_receita_mensal?: number
          meta_vendas_mensal?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          account_id: string
          created_at: string
          etapa_pipeline: string
          id: string
          motivo_perda: string | null
          nome_oportunidade: string
          origem: string | null
          previsao_fechamento: string | null
          probabilidade: number | null
          produto_interesse: string | null
          temperatura: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          account_id: string
          created_at?: string
          etapa_pipeline?: string
          id?: string
          motivo_perda?: string | null
          nome_oportunidade?: string
          origem?: string | null
          previsao_fechamento?: string | null
          probabilidade?: number | null
          produto_interesse?: string | null
          temperatura?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          account_id?: string
          created_at?: string
          etapa_pipeline?: string
          id?: string
          motivo_perda?: string | null
          nome_oportunidade?: string
          origem?: string | null
          previsao_fechamento?: string | null
          probabilidade?: number | null
          produto_interesse?: string | null
          temperatura?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          opportunity_id: string
          papel: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          opportunity_id: string
          papel?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          opportunity_id?: string
          papel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_contacts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          nome: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_queue: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          message: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          message: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          message?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gestor"
        | "vendedor"
        | "aluno_hub"
        | "suporte_hub"
        | "admin_hub"
        | "closer"
        | "sdr"
        | "suporte"
        | "financeiro"
      lead_status:
        | "lead"
        | "mensagem_enviada"
        | "fup_1"
        | "ia_call"
        | "ia_call_2"
        | "ultima_mensagem"
        | "reuniao"
        | "no_show"
        | "reuniao_realizada"
        | "proposta"
        | "venda"
        | "perdido"
      whatsapp_status:
        | "pendente"
        | "enviado"
        | "entregue"
        | "falha"
        | "erro_envio"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "gestor",
        "vendedor",
        "aluno_hub",
        "suporte_hub",
        "admin_hub",
        "closer",
        "sdr",
        "suporte",
        "financeiro",
      ],
      lead_status: [
        "lead",
        "mensagem_enviada",
        "fup_1",
        "ia_call",
        "ia_call_2",
        "ultima_mensagem",
        "reuniao",
        "no_show",
        "reuniao_realizada",
        "proposta",
        "venda",
        "perdido",
      ],
      whatsapp_status: [
        "pendente",
        "enviado",
        "entregue",
        "falha",
        "erro_envio",
      ],
    },
  },
} as const
