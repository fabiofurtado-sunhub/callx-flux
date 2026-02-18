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
      configuracoes: {
        Row: {
          id: string
          updated_at: string
          updated_by: string | null
          zapi_instance_id: string | null
          zapi_token: string | null
          zapi_webhook: string | null
        }
        Insert: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
          zapi_webhook?: string | null
        }
        Update: {
          id?: string
          updated_at?: string
          updated_by?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
          zapi_webhook?: string | null
        }
        Relationships: []
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
      leads: {
        Row: {
          adset: string | null
          campanha: string | null
          created_at: string
          data_entrada: string
          data_ultimo_movimento: string
          email: string | null
          envio_whatsapp_data: string | null
          envio_whatsapp_status: Database["public"]["Enums"]["whatsapp_status"]
          grupo_anuncios: string | null
          id: string
          lead_time: number | null
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          origem: string | null
          probabilidade_fechamento: number
          score_lead: number
          status_funil: Database["public"]["Enums"]["lead_status"]
          telefone: string
          updated_at: string
          valor_proposta: number | null
          valor_venda: number | null
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          adset?: string | null
          campanha?: string | null
          created_at?: string
          data_entrada?: string
          data_ultimo_movimento?: string
          email?: string | null
          envio_whatsapp_data?: string | null
          envio_whatsapp_status?: Database["public"]["Enums"]["whatsapp_status"]
          grupo_anuncios?: string | null
          id?: string
          lead_time?: number | null
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          origem?: string | null
          probabilidade_fechamento?: number
          score_lead?: number
          status_funil?: Database["public"]["Enums"]["lead_status"]
          telefone: string
          updated_at?: string
          valor_proposta?: number | null
          valor_venda?: number | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          adset?: string | null
          campanha?: string | null
          created_at?: string
          data_entrada?: string
          data_ultimo_movimento?: string
          email?: string | null
          envio_whatsapp_data?: string | null
          envio_whatsapp_status?: Database["public"]["Enums"]["whatsapp_status"]
          grupo_anuncios?: string | null
          id?: string
          lead_time?: number | null
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          origem?: string | null
          probabilidade_fechamento?: number
          score_lead?: number
          status_funil?: Database["public"]["Enums"]["lead_status"]
          telefone?: string
          updated_at?: string
          valor_proposta?: number | null
          valor_venda?: number | null
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: []
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
      app_role: "admin" | "gestor" | "vendedor"
      lead_status: "lead" | "reuniao" | "proposta" | "venda" | "perdido"
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
      app_role: ["admin", "gestor", "vendedor"],
      lead_status: ["lead", "reuniao", "proposta", "venda", "perdido"],
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
