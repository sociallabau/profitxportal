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
      ad_campaigns: {
        Row: {
          ad_hook: string | null
          created_at: string
          current_followers: number | null
          daily_budget: number
          duration_days: number
          ended_at: string | null
          id: string
          launched_at: string
          notes: string | null
          offer_summary: string | null
          starting_followers: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_hook?: string | null
          created_at?: string
          current_followers?: number | null
          daily_budget?: number
          duration_days?: number
          ended_at?: string | null
          id?: string
          launched_at?: string
          notes?: string | null
          offer_summary?: string | null
          starting_followers?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_hook?: string | null
          created_at?: string
          current_followers?: number | null
          daily_budget?: number
          duration_days?: number
          ended_at?: string | null
          id?: string
          launched_at?: string
          notes?: string | null
          offer_summary?: string | null
          starting_followers?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_followers: {
        Row: {
          campaign_id: string
          created_at: string
          dm_history: Json
          handle: string
          hot_list_id: string | null
          id: string
          notes: string | null
          qualified: boolean | null
          stage: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          dm_history?: Json
          handle: string
          hot_list_id?: string | null
          id?: string
          notes?: string | null
          qualified?: boolean | null
          stage?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          dm_history?: Json
          handle?: string
          hot_list_id?: string | null
          id?: string
          notes?: string | null
          qualified?: boolean | null
          stage?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_followers_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
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
      client_journey: {
        Row: {
          added_date: string
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          stage: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          added_date?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          stage?: string
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          added_date?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          stage?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      client_questions: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          next_steps: Json | null
          question: string
          resource: string | null
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          next_steps?: Json | null
          question: string
          resource?: string | null
          user_id?: string
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          next_steps?: Json | null
          question?: string
          resource?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_posts: {
        Row: {
          category: string | null
          content_type: string | null
          created_at: string | null
          date: string | null
          hook: string | null
          id: string
          leads: number | null
          likes: number | null
          notes: string | null
          platform: string
          post_type: string | null
          posted_at: string
          script: string | null
          status: string | null
          thumbnail_url: string | null
          title: string | null
          user_id: string | null
          views: number | null
        }
        Insert: {
          category?: string | null
          content_type?: string | null
          created_at?: string | null
          date?: string | null
          hook?: string | null
          id?: string
          leads?: number | null
          likes?: number | null
          notes?: string | null
          platform: string
          post_type?: string | null
          posted_at: string
          script?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string | null
          views?: number | null
        }
        Update: {
          category?: string | null
          content_type?: string | null
          created_at?: string | null
          date?: string | null
          hook?: string | null
          id?: string
          leads?: number | null
          likes?: number | null
          notes?: string | null
          platform?: string
          post_type?: string | null
          posted_at?: string
          script?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string | null
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
      dm_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          label: string
          sort_order: number | null
          stage_key: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number | null
          stage_key: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number | null
          stage_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      drive_sync_state: {
        Row: {
          folder_id: string
          folder_name: string | null
          last_result: string | null
          last_synced_at: string | null
          updated_at: string
        }
        Insert: {
          folder_id: string
          folder_name?: string | null
          last_result?: string | null
          last_synced_at?: string | null
          updated_at?: string
        }
        Update: {
          folder_id?: string
          folder_name?: string | null
          last_result?: string | null
          last_synced_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      financial_audits: {
        Row: {
          audit: string | null
          created_at: string
          filename: string | null
          id: string
          kind: string
          period: string | null
          source_text: string | null
          user_id: string
        }
        Insert: {
          audit?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          kind?: string
          period?: string | null
          source_text?: string | null
          user_id?: string
        }
        Update: {
          audit?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          kind?: string
          period?: string | null
          source_text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string | null
          id: string
          retainer_tier_1: number | null
          retainer_tier_2: number | null
          retainer_tier_3: number | null
          starting_mrr: number | null
          target_date: string | null
          target_mrr: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          retainer_tier_1?: number | null
          retainer_tier_2?: number | null
          retainer_tier_3?: number | null
          starting_mrr?: number | null
          target_date?: string | null
          target_mrr: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          retainer_tier_1?: number | null
          retainer_tier_2?: number | null
          retainer_tier_3?: number | null
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
      hot_list: {
        Row: {
          business_name: string | null
          column_id: string
          created_at: string | null
          deal_value: number | null
          email: string | null
          id: string
          instagram_handle: string | null
          name: string
          notes: string | null
          phone: string | null
          position: number
          source: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_name?: string | null
          column_id?: string
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          id?: string
          instagram_handle?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: number
          source?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_name?: string | null
          column_id?: string
          created_at?: string | null
          deal_value?: number | null
          email?: string | null
          id?: string
          instagram_handle?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: number
          source?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          doc_id: string
          id: string
          tsv: unknown
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          doc_id: string
          id?: string
          tsv?: unknown
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          doc_id?: string
          id?: string
          tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_docs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          source_id: string | null
          source_type: string
          source_url: string | null
          title: string
          word_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          source_id?: string | null
          source_type?: string
          source_url?: string | null
          title: string
          word_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          source_id?: string | null
          source_type?: string
          source_url?: string | null
          title?: string
          word_count?: number
        }
        Relationships: []
      }
      module_pages: {
        Row: {
          created_at: string | null
          id: string
          module_id: string
          pillar: string
          sections: Json
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_id: string
          pillar: string
          sections?: Json
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          module_id?: string
          pillar?: string
          sections?: Json
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
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
          ad_spend: number | null
          biggest_win: string | null
          booked_calls: number | null
          business_confidence: number | null
          calls_showed: number | null
          content_posts: number | null
          created_at: string | null
          expense_contractors: number | null
          expense_other: number | null
          expense_owner_pay: number | null
          expense_software: number | null
          expenses: number | null
          id: string
          leads_generated: number | null
          meetings: number | null
          month: string
          mrr: number | null
          mrr_manual: number | null
          needs_this_month: string | null
          new_clients: number | null
          new_clients_is_mrr: boolean | null
          new_clients_total_value: number | null
          nps: number | null
          offers_made: number | null
          oneoff_revenue: number | null
          total_revenue: number | null
          user_id: string | null
        }
        Insert: {
          ad_spend?: number | null
          biggest_win?: string | null
          booked_calls?: number | null
          business_confidence?: number | null
          calls_showed?: number | null
          content_posts?: number | null
          created_at?: string | null
          expense_contractors?: number | null
          expense_other?: number | null
          expense_owner_pay?: number | null
          expense_software?: number | null
          expenses?: number | null
          id?: string
          leads_generated?: number | null
          meetings?: number | null
          month: string
          mrr?: number | null
          mrr_manual?: number | null
          needs_this_month?: string | null
          new_clients?: number | null
          new_clients_is_mrr?: boolean | null
          new_clients_total_value?: number | null
          nps?: number | null
          offers_made?: number | null
          oneoff_revenue?: number | null
          total_revenue?: number | null
          user_id?: string | null
        }
        Update: {
          ad_spend?: number | null
          biggest_win?: string | null
          booked_calls?: number | null
          business_confidence?: number | null
          calls_showed?: number | null
          content_posts?: number | null
          created_at?: string | null
          expense_contractors?: number | null
          expense_other?: number | null
          expense_owner_pay?: number | null
          expense_software?: number | null
          expenses?: number | null
          id?: string
          leads_generated?: number | null
          meetings?: number | null
          month?: string
          mrr?: number | null
          mrr_manual?: number | null
          needs_this_month?: string | null
          new_clients?: number | null
          new_clients_is_mrr?: boolean | null
          new_clients_total_value?: number | null
          nps?: number | null
          offers_made?: number | null
          oneoff_revenue?: number | null
          total_revenue?: number | null
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
      page_views: {
        Row: {
          id: string
          page: string
          user_id: string
          viewed_at: string | null
        }
        Insert: {
          id?: string
          page: string
          user_id: string
          viewed_at?: string | null
        }
        Update: {
          id?: string
          page?: string
          user_id?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "admin_client_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_revoked: boolean
          business_overview: string | null
          circle_url: string | null
          coach_notes: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          milestones_hit: number[] | null
          onboarded: boolean | null
          onboarding_notice_seen: boolean | null
          tier: string | null
          tier_seen: string | null
        }
        Insert: {
          access_revoked?: boolean
          business_overview?: string | null
          circle_url?: string | null
          coach_notes?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          milestones_hit?: number[] | null
          onboarded?: boolean | null
          onboarding_notice_seen?: boolean | null
          tier?: string | null
          tier_seen?: string | null
        }
        Update: {
          access_revoked?: boolean
          business_overview?: string | null
          circle_url?: string | null
          coach_notes?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          milestones_hit?: number[] | null
          onboarded?: boolean | null
          onboarding_notice_seen?: boolean | null
          tier?: string | null
          tier_seen?: string | null
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
      saved_answers: {
        Row: {
          answer: string
          created_at: string
          created_by: string
          id: string
          question: string
          times_used: number
          tsv: unknown
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          created_by?: string
          id?: string
          question: string
          times_used?: number
          tsv?: unknown
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          created_by?: string
          id?: string
          question?: string
          times_used?: number
          tsv?: unknown
          updated_at?: string
        }
        Relationships: []
      }
      saved_ideas: {
        Row: {
          ai_script: string | null
          id: string
          is_boosted: boolean | null
          likes: number | null
          outlier_label: string | null
          outlier_score: number | null
          saved_at: string | null
          source_caption: string | null
          source_handle: string | null
          source_thumbnail_url: string | null
          source_url: string | null
          source_video_url: string | null
          transcript: string | null
          user_id: string
          views: number | null
        }
        Insert: {
          ai_script?: string | null
          id?: string
          is_boosted?: boolean | null
          likes?: number | null
          outlier_label?: string | null
          outlier_score?: number | null
          saved_at?: string | null
          source_caption?: string | null
          source_handle?: string | null
          source_thumbnail_url?: string | null
          source_url?: string | null
          source_video_url?: string | null
          transcript?: string | null
          user_id: string
          views?: number | null
        }
        Update: {
          ai_script?: string | null
          id?: string
          is_boosted?: boolean | null
          likes?: number | null
          outlier_label?: string | null
          outlier_score?: number | null
          saved_at?: string | null
          source_caption?: string | null
          source_handle?: string | null
          source_thumbnail_url?: string | null
          source_url?: string | null
          source_video_url?: string | null
          transcript?: string | null
          user_id?: string
          views?: number | null
        }
        Relationships: []
      }
      transcription_jobs: {
        Row: {
          access_token: string | null
          completed_at: string | null
          created_at: string
          doc_id: string | null
          drive_file_id: string
          error: string | null
          id: string
          mime_type: string | null
          provider: string | null
          provider_job_id: string | null
          size_bytes: number | null
          status: string
          submitted_at: string | null
          title: string
          transcript_chars: number | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          completed_at?: string | null
          created_at?: string
          doc_id?: string | null
          drive_file_id: string
          error?: string | null
          id?: string
          mime_type?: string | null
          provider?: string | null
          provider_job_id?: string | null
          size_bytes?: number | null
          status?: string
          submitted_at?: string | null
          title: string
          transcript_chars?: number | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          completed_at?: string | null
          created_at?: string
          doc_id?: string | null
          drive_file_id?: string
          error?: string | null
          id?: string
          mime_type?: string | null
          provider?: string | null
          provider_job_id?: string | null
          size_bytes?: number | null
          status?: string
          submitted_at?: string | null
          title?: string
          transcript_chars?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcription_jobs_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_profile: {
        Row: {
          built_from: number
          content: string
          id: string
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          built_from?: number
          content: string
          id?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          built_from?: number
          content?: string
          id?: string
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      weekly_wins: {
        Row: {
          cash_amount: number | null
          created_at: string | null
          id: string
          source: string | null
          user_id: string | null
          week_ending: string
          win_text: string
        }
        Insert: {
          cash_amount?: number | null
          created_at?: string | null
          id?: string
          source?: string | null
          user_id?: string | null
          week_ending: string
          win_text: string
        }
        Update: {
          cash_amount?: number | null
          created_at?: string | null
          id?: string
          source?: string | null
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
          days_since_last_login: number | null
          days_since_last_win: number | null
          days_since_submission: number | null
          financials_views: number | null
          full_name: string | null
          health_notes: string | null
          id: string | null
          is_admin: boolean | null
          last_ad_spend: number | null
          last_biggest_win: string | null
          last_confidence: number | null
          last_content_posts: number | null
          last_expenses: number | null
          last_leads: number | null
          last_meetings: number | null
          last_mrr: number | null
          last_needs: string | null
          last_new_clients: number | null
          last_new_clients_is_mrr: boolean | null
          last_new_clients_value: number | null
          last_nps: number | null
          last_oneoffs: number | null
          last_submission_at: string | null
          last_submission_month: string | null
          last_total_revenue: number | null
          manual_status: string | null
          modules_completed: number | null
          most_visited_page: string | null
          roadmap_views: number | null
          tier: string | null
          total_wins_submitted: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      search_knowledge: {
        Args: { limit_n?: number; q: string }
        Returns: {
          chunk_id: string
          content: string
          doc_id: string
          rank: number
          source_type: string
          title: string
        }[]
      }
      search_knowledge_public: {
        Args: { limit_n?: number; q: string }
        Returns: {
          chunk_id: string
          content: string
          doc_id: string
          rank: number
          source_type: string
          title: string
        }[]
      }
      search_saved_answers: {
        Args: { limit_n?: number; q: string }
        Returns: {
          answer: string
          id: string
          question: string
          rank: number
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
