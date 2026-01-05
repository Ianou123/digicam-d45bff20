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
      clients: {
        Row: {
          created_at: string
          id: string
          invite_code: string | null
          last_activity_at: string | null
          logo_url: string | null
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
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
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
          department_id: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_size: number | null
          file_url: string
          id: string
          ocr_text: string | null
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
          department_id?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          file_size?: number | null
          file_url: string
          id?: string
          ocr_text?: string | null
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
          department_id?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          file_size?: number | null
          file_url?: string
          id?: string
          ocr_text?: string | null
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
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          client_id: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          preferred_language: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          preferred_language?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          client_id?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          preferred_language?: string | null
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
      get_client_by_invite_code: { Args: { _code: string }; Returns: string }
      get_user_client_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_admin: { Args: { _user_id: string }; Returns: boolean }
      is_client_suspended: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      action_type:
        | "search"
        | "view"
        | "download"
        | "upload"
        | "update"
        | "delete"
      app_role: "super_admin" | "client_admin" | "staff"
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
      app_role: ["super_admin", "client_admin", "staff"],
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
