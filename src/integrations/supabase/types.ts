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
      activity_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["action_type"]
          client_id: string
          context: Json | null
          created_at: string
          document_id: string | null
          id: string
          metadata: Json | null
          search_query: string | null
          user_id: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["action_type"]
          client_id: string
          context?: Json | null
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json | null
          search_query?: string | null
          user_id: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["action_type"]
          client_id?: string
          context?: Json | null
          created_at?: string
          document_id?: string | null
          id?: string
          metadata?: Json | null
          search_query?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_logs: {
        Row: {
          action_type: string
          client_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_name: string | null
          target_type: string
          user_id: string
        }
        Insert: {
          action_type: string
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_name?: string | null
          target_type: string
          user_id: string
        }
        Update: {
          action_type?: string
          client_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          created_at: string
          id: string
          invite_code: string | null
          last_activity_at: string | null
          logo_url: string | null
          module: Database["public"]["Enums"]["client_module"]
          module_configured: boolean
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code?: string | null
          last_activity_at?: string | null
          logo_url?: string | null
          module?: Database["public"]["Enums"]["client_module"]
          module_configured?: boolean
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string | null
          last_activity_at?: string | null
          logo_url?: string | null
          module?: Database["public"]["Enums"]["client_module"]
          module_configured?: boolean
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          archived_at: string | null
          client_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      document_departments: {
        Row: {
          department_id: string
          document_id: string
        }
        Insert: {
          department_id: string
          document_id: string
        }
        Update: {
          department_id?: string
          document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_departments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_favorites: {
        Row: {
          created_at: string
          document_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_favorites_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_immutable_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          document_id: string
          file_hash: string | null
          id: string
          justification: string | null
          version_number: number
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          document_id: string
          file_hash?: string | null
          id?: string
          justification?: string | null
          version_number: number
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          document_id?: string
          file_hash?: string | null
          id?: string
          justification?: string | null
          version_number?: number
        }
        Relationships: []
      }
      document_relations: {
        Row: {
          created_at: string
          id: string
          related_document_id: string
          relation_type: string
          source_document_id: string
          strength: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          related_document_id: string
          relation_type?: string
          source_document_id: string
          strength?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          related_document_id?: string
          relation_type?: string
          source_document_id?: string
          strength?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_relations_related_document_id_fkey"
            columns: ["related_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_relations_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tags: {
        Row: {
          document_id: string
          tag_id: string
        }
        Insert: {
          document_id: string
          tag_id: string
        }
        Update: {
          document_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tags_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          change_notes: string | null
          created_at: string
          document_id: string
          file_size: number | null
          file_url: string
          id: string
          ocr_text: string | null
          uploaded_by: string
          version_number: number
        }
        Insert: {
          change_notes?: string | null
          created_at?: string
          document_id: string
          file_size?: number | null
          file_url: string
          id?: string
          ocr_text?: string | null
          uploaded_by: string
          version_number: number
        }
        Update: {
          change_notes?: string | null
          created_at?: string
          document_id?: string
          file_size?: number | null
          file_url?: string
          id?: string
          ocr_text?: string | null
          uploaded_by?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          client_id: string
          confidentiality_level: Database["public"]["Enums"]["confidentiality_level"]
          created_at: string
          current_version: number
          deleted_at: string | null
          department_id: string | null
          document_date: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_size: number | null
          file_url: string
          folder_id: string | null
          id: string
          ocr_text: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          client_id: string
          confidentiality_level?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          department_id?: string | null
          document_date?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_size?: number | null
          file_url: string
          folder_id?: string | null
          id?: string
          ocr_text?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          client_id?: string
          confidentiality_level?: Database["public"]["Enums"]["confidentiality_level"]
          created_at?: string
          current_version?: number
          deleted_at?: string | null
          department_id?: string | null
          document_date?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_size?: number | null
          file_url?: string
          folder_id?: string | null
          id?: string
          ocr_text?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          client_id: string
          created_at: string
          id: string
          message: string | null
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          message?: string | null
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          client_id: string | null
          created_at: string
          department_id: string | null
          department_notifications: boolean | null
          department_self_declared: boolean | null
          email: string
          full_name: string | null
          id: string
          preferred_language: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          department_id?: string | null
          department_notifications?: boolean | null
          department_self_declared?: boolean | null
          email: string
          full_name?: string | null
          id: string
          preferred_language?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          department_id?: string | null
          department_notifications?: boolean | null
          department_self_declared?: boolean | null
          email?: string
          full_name?: string | null
          id?: string
          preferred_language?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      role_acknowledgments: {
        Row: {
          acknowledged_at: string
          id: string
          module: Database["public"]["Enums"]["client_module"]
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          module: Database["public"]["Enums"]["client_module"]
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          id?: string
          module?: Database["public"]["Enums"]["client_module"]
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          client_id: string
          created_at: string
          filters: Json
          id: string
          is_pinned: boolean | null
          is_watched: boolean | null
          last_matched_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          filters?: Json
          id?: string
          is_pinned?: boolean | null
          is_watched?: boolean | null
          last_matched_at?: string | null
          name: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          filters?: Json
          id?: string
          is_pinned?: boolean | null
          is_watched?: boolean | null
          last_matched_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          clicked_document_id: string | null
          client_id: string
          created_at: string
          id: string
          query_text: string
          result_count: number
          user_id: string
        }
        Insert: {
          clicked_document_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          query_text: string
          result_count?: number
          user_id: string
        }
        Update: {
          clicked_document_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          query_text?: string
          result_count?: number
          user_id?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          can_download: boolean | null
          created_at: string
          created_by: string
          document_id: string
          expires_at: string | null
          id: string
          link_token: string | null
          password_hash: string | null
          recipient_user_id: string | null
          share_type: string
        }
        Insert: {
          can_download?: boolean | null
          created_at?: string
          created_by: string
          document_id: string
          expires_at?: string | null
          id?: string
          link_token?: string | null
          password_hash?: string | null
          recipient_user_id?: string | null
          share_type: string
        }
        Update: {
          can_download?: boolean | null
          created_at?: string
          created_by?: string
          document_id?: string
          expires_at?: string | null
          id?: string
          link_token?: string | null
          password_hash?: string | null
          recipient_user_id?: string | null
          share_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_audit_logs: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          client_id: string
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          client_id: string
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          client_id?: string
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      can_delete_in_module: { Args: { _user_id: string }; Returns: boolean }
      can_user_upload: { Args: { _user_id: string }; Returns: boolean }
      document_belongs_to_user_client: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
      escape_ilike_pattern: { Args: { pattern: string }; Returns: string }
      get_client_by_invite_code: { Args: { _code: string }; Returns: string }
      get_user_client_id: { Args: { _user_id: string }; Returns: string }
      get_user_module: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["client_module"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_admin: { Args: { _user_id: string }; Returns: boolean }
      is_client_suspended: { Args: { _user_id: string }; Returns: boolean }
      is_restricted_module: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_ultra_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_deactivated: { Args: { _user_id: string }; Returns: boolean }
      user_has_department_access: {
        Args: { _department_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_document_share: {
        Args: { _document_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      action_type:
        | "search"
        | "view"
        | "download"
        | "upload"
        | "update"
        | "delete"
      app_role: "super_admin" | "client_admin" | "staff" | "ultra_admin"
      client_module: "core" | "admin_publique"
      confidentiality_level: "public" | "internal" | "confidential"
      document_type:
        | "pdf"
        | "jpg"
        | "png"
        | "doc"
        | "docx"
        | "xls"
        | "xlsx"
        | "ppt"
        | "pptx"
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
      action_type: ["search", "view", "download", "upload", "update", "delete"],
      app_role: ["super_admin", "client_admin", "staff", "ultra_admin"],
      client_module: ["core", "admin_publique"],
      confidentiality_level: ["public", "internal", "confidential"],
      document_type: [
        "pdf",
        "jpg",
        "png",
        "doc",
        "docx",
        "xls",
        "xlsx",
        "ppt",
        "pptx",
      ],
    },
  },
} as const
