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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      content_posts: {
        Row: {
          content_type: string | null
          created_at: string | null
          id: string
          leads: number | null
          likes: number | null
          notes: string | null
          platform: string
          posted_at: string
          user_id: string | null
          views: number | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          id?: string
          leads?: number | null
          likes?: number | null
          notes?: string | null
          platform: string
          posted_at: string
          user_id?: string | null
          views?: number | null
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          id?: string
          leads?: number | null
          likes?: number | null
          notes?: string | null
          platform?: string
          posted_at?: string
          user_id?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string | null
          id: string
          starting_mrr: number | null
          target_date: string | null
          target_mrr: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          starting_mrr?: number | null
          target_date?: string | null
          target_mrr: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          starting_mrr?: number | null
          target_date?: string | null
          target_mrr?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_totals: {
        Row: {
          content_posts: number | null
          created_at: string | null
          expenses: number | null
          id: string
          leads_generated: number | null
          month: string
          mrr: number | null
          new_clients: number | null
          oneoff_revenue: number | null
          user_id: string | null
        }
        Insert: {
          content_posts?: number | null
          created_at?: string | null
          expenses?: number | null
          id?: string
          leads_generated?: number | null
          month: string
          mrr?: number | null
          new_clients?: number | null
          oneoff_revenue?: number | null
          user_id?: string | null
        }
        Update: {
          content_posts?: number | null
          created_at?: string | null
          expenses?: number | null
          id?: string
          leads_generated?: number | null
          month?: string
          mrr?: number | null
          new_clients?: number | null
          oneoff_revenue?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_totals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      new_clients: {
        Row: {
          client_name: string
          created_at: string | null
          id: string
          monthly_value: number
          notes: string | null
          signed_date: string
          user_id: string | null
        }
        Insert: {
          client_name: string
          created_at?: string | null
          id?: string
          monthly_value: number
          notes?: string | null
          signed_date: string
          user_id?: string | null
        }
        Update: {
          client_name?: string
          created_at?: string | null
          id?: string
          monthly_value?: number
          notes?: string | null
          signed_date?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "new_clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          circle_url: string | null
          coach_notes: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          milestones_hit: number[] | null
          onboarded: boolean | null
          tier: string | null
        }
        Insert: {
          circle_url?: string | null
          coach_notes?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          milestones_hit?: number[] | null
          onboarded?: boolean | null
          tier?: string | null
        }
        Update: {
          circle_url?: string | null
          coach_notes?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          milestones_hit?: number[] | null
          onboarded?: boolean | null
          tier?: string | null
        }
        Relationships: []
      }
      resources: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          title: string
          url: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title: string
          url: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      roadmap_scores: {
        Row: {
          id: string
          module_number: number
          notes: string | null
          pillar: string
          score: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          module_number: number
          notes?: string | null
          pillar: string
          score?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          module_number?: number
          notes?: string | null
          pillar?: string
          score?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_wins: {
        Row: {
          created_at: string | null
          id: string
          user_id: string | null
          week_ending: string
          win_text: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id?: string | null
          week_ending: string
          win_text: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string | null
          week_ending?: string
          win_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_wins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
