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
      cash_menu_actions: {
        Row: {
          action_key: string
          completed_at: string | null
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          action_key: string
          completed_at?: string | null
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          action_key?: string
          completed_at?: string | null
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_menu_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_menu_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_progress: {
        Row: {
          completed: boolean
          id: string
          task_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          id?: string
          task_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          id?: string
          task_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_health: {
        Row: {
          client_user_id: string
          health_status: string | null
          id: string
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          client_user_id: string
          health_status?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          client_user_id?: string
          health_status?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
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
            referencedRelation: "admin_client_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "admin_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monday_wins: {
        Row: {
          cash_collected: number | null
          created_at: string | null
          deal_value: number | null
          id: string
          new_client: boolean | null
          occurred_on: string | null
          user_id: string
          win_text: string
        }
        Insert: {
          cash_collected?: number | null
          created_at?: string | null
          deal_value?: number | null
          id?: string
          new_client?: boolean | null
          occurred_on?: string | null
          user_id: string
          win_text: string
        }
        Update: {
          cash_collected?: number | null
          created_at?: string | null
          deal_value?: number | null
          id?: string
          new_client?: boolean | null
          occurred_on?: string | null
          user_id?: string
          win_text?: string
        }
        Relationships: []
      }
      monthly_totals: {
        Row: {
          biggest_win: string | null
          booked_calls: number | null
          business_confidence: number | null
          calls_showed: number | null
          content_posts: number | null
          created_at: string | null
          expenses: number | null
          id: string
          leads_generated: number | null
          month: string
          mrr: number | null
          needs_this_month: string | null
          new_clients: number | null
          nps: number | null
          offers_made: number | null
          oneoff_revenue: number | null
          user_id: string | null
        }
        Insert: {
          biggest_win?: string | null
          booked_calls?: number | null
          business_confidence?: number | null
          calls_showed?: number | null
          content_posts?: number | null
          created_at?: string | null
          expenses?: number | null
          id?: string
          leads_generated?: number | null
          month: string
          mrr?: number | null
          needs_this_month?: string | null
          new_clients?: number | null
          nps?: number | null
          offers_made?: number | null
          oneoff_revenue?: number | null
          user_id?: string | null
        }
        Update: {
          biggest_win?: string | null
          booked_calls?: number | null
          business_confidence?: number | null
          calls_showed?: number | null
          content_posts?: number | null
          created_at?: string | null
          expenses?: number | null
          id?: string
          leads_generated?: number | null
          month?: string
          mrr?: number | null
          needs_this_month?: string | null
          new_clients?: number | null
          nps?: number | null
          offers_made?: number | null
          oneoff_revenue?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_totals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_client_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "admin_client_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "admin_client_overview"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "admin_client_overview"
            referencedColumns: ["id"]
          },
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
      admin_client_overview: {
        Row: {
          days_since_monday_win: number | null
          days_since_submission: number | null
          full_name: string | null
          health_notes: string | null
          id: string | null
          is_admin: boolean | null
          last_biggest_win: string | null
          last_confidence: number | null
          last_monday_win_at: string | null
          last_mrr: number | null
          last_needs: string | null
          last_nps: number | null
          last_submission_at: string | null
          last_submission_month: string | null
          manual_status: string | null
          tier: string | null
        }
        Relationships: []
      }
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
