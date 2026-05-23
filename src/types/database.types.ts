// ============================================================================
// DATABASE TYPES — Hand-crafted theo schema.sql + migrations hiện tại.
// ----------------------------------------------------------------------------
// File này được viết tay vì dự án chưa cài Supabase CLI để auto-gen.
//
// Khi nào cài được CLI, thay file này bằng output của:
//   npx supabase gen types typescript --linked > src/types/database.types.ts
//
// Cập nhật thủ công bắt buộc sau mỗi migration mới — đối chiếu với:
//   /schema.sql  (snapshot)  +  /supabase/migration_*.sql
// ============================================================================

// --- ENUMS ------------------------------------------------------------------

export type UserRole =
  | "admin"
  | "director"
  | "manager"
  | "staff"
  | "secretary"
  | "hr_officer"
  | "driver";

export type TaskStatus = "todo" | "doing" | "done" | "late" | "closed";
export type TaskPriority = "low" | "medium" | "high";

export type ScheduleType = "meeting" | "trip" | "event" | "leave";
export type ScheduleStatus = "pending" | "approved" | "rejected" | "in_progress" | "completed";

export type DocumentStatus =
  | "DRAFT"
  | "PENDING_RECEIPT"
  | "IN_REVIEW"
  | "RETURNED"
  | "COMPLETED";

export type HandoverStatus = "PENDING" | "ACCEPTED" | "REJECTED";

// --- HELPER TYPES -----------------------------------------------------------

type Timestamp = string;       // ISO 8601 TIMESTAMPTZ
type Uuid = string;
type DateString = string;      // YYYY-MM-DD
type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

// --- DATABASE INTERFACE -----------------------------------------------------

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: Uuid;
          code: string | null;
          name: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          code?: string | null;
          name: string;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
      };

      profiles: {
        Row: {
          id: Uuid;
          full_name: string | null;
          department_id: Uuid | null;
          role: UserRole;
          avatar_url: string | null;
          phone: string | null;
          birthday: DateString | null;
          gender: string | null;
          ad_account: string | null;
          branch_join_date: DateString | null;
          title: string | null;
          is_department_head: boolean;
          is_active: boolean;
          must_change_password: boolean | null;
          updated_at: Timestamp;
        };
        Insert: {
          id: Uuid;
          full_name?: string | null;
          department_id?: Uuid | null;
          role?: UserRole;
          avatar_url?: string | null;
          phone?: string | null;
          birthday?: DateString | null;
          gender?: string | null;
          ad_account?: string | null;
          branch_join_date?: DateString | null;
          title?: string | null;
          is_department_head?: boolean;
          is_active?: boolean;
          must_change_password?: boolean | null;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      tasks: {
        Row: {
          id: Uuid;
          title: string;
          description: string | null;
          status: TaskStatus;
          priority: TaskPriority;
          task_type: string | null;
          progress: number;
          assignee_id: Uuid | null;
          created_by: Uuid | null;
          department_id: Uuid | null;
          due_date: Timestamp | null;
          target_value: number | null;
          current_value: number;
          unit: string | null;
          metadata: Record<string, Json>;
          is_archived: boolean;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          title: string;
          description?: string | null;
          status?: TaskStatus;
          priority?: TaskPriority;
          task_type?: string | null;
          progress?: number;
          assignee_id?: Uuid | null;
          created_by?: Uuid | null;
          department_id?: Uuid | null;
          due_date?: Timestamp | null;
          target_value?: number | null;
          current_value?: number;
          unit?: string | null;
          metadata?: Record<string, Json>;
          is_archived?: boolean;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
      };

      task_assignees: {
        Row: {
          task_id: Uuid;
          user_id: Uuid;
          created_at: Timestamp;
        };
        Insert: {
          task_id: Uuid;
          user_id: Uuid;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["task_assignees"]["Insert"]>;
      };

      task_comments: {
        Row: {
          id: Uuid;
          task_id: Uuid | null;
          user_id: Uuid | null;
          content: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          task_id?: Uuid | null;
          user_id?: Uuid | null;
          content: string;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["task_comments"]["Insert"]>;
      };

      notifications: {
        Row: {
          id: Uuid;
          user_id: Uuid | null;
          title: string;
          content: string | null;
          type: string | null;
          link: string | null;
          is_read: boolean;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          user_id?: Uuid | null;
          title: string;
          content?: string | null;
          type?: string | null;
          link?: string | null;
          is_read?: boolean;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };

      vehicles: {
        Row: {
          id: Uuid;
          name: string;
          plate_number: string;
          type: string | null;
          status: string;
          driver_id: Uuid | null;
          driver_name: string | null;
          driver_phone: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          name: string;
          plate_number: string;
          type?: string | null;
          status?: string;
          driver_id?: Uuid | null;
          driver_name?: string | null;
          driver_phone?: string | null;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Insert"]>;
      };

      rooms: {
        Row: {
          id: Uuid;
          name: string;
          capacity: number | null;
          location: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          name: string;
          capacity?: number | null;
          location?: string | null;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>;
      };

      schedules: {
        Row: {
          id: Uuid;
          title: string;
          description: string | null;
          type: ScheduleType;
          status: ScheduleStatus;
          start_time: Timestamp;
          end_time: Timestamp;
          location: string | null;
          room_id: Uuid | null;
          vehicle_id: Uuid | null;
          driver_id: Uuid | null;
          department_id: Uuid | null;
          created_by: Uuid | null;
          use_room: boolean;
          use_vehicle: boolean;
          requested_vehicle_type: string | null;
          metadata: Record<string, Json>;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          title: string;
          description?: string | null;
          type?: ScheduleType;
          status?: ScheduleStatus;
          start_time: Timestamp;
          end_time: Timestamp;
          location?: string | null;
          room_id?: Uuid | null;
          vehicle_id?: Uuid | null;
          driver_id?: Uuid | null;
          department_id?: Uuid | null;
          created_by?: Uuid | null;
          use_room?: boolean;
          use_vehicle?: boolean;
          requested_vehicle_type?: string | null;
          metadata?: Record<string, Json>;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["schedules"]["Insert"]>;
      };

      schedule_participants: {
        Row: {
          id: Uuid;
          schedule_id: Uuid | null;
          profile_id: Uuid | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          schedule_id?: Uuid | null;
          profile_id?: Uuid | null;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["schedule_participants"]["Insert"]>;
      };

      recognitions: {
        Row: {
          id: Uuid;
          sender_id: Uuid | null;
          receiver_id: Uuid | null;
          content: string;
          type: string;
          department_id: Uuid | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          sender_id?: Uuid | null;
          receiver_id?: Uuid | null;
          content: string;
          type?: string;
          department_id?: Uuid | null;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["recognitions"]["Insert"]>;
      };

      document_categories: {
        Row: {
          id: Uuid;
          name: string;
          sla_hours: number;
          color: "slate" | "blue" | "amber" | "emerald" | "red";
          created_by: Uuid | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          name: string;
          sla_hours?: number;
          color?: "slate" | "blue" | "amber" | "emerald" | "red";
          created_by?: Uuid | null;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["document_categories"]["Insert"]>;
      };

      documents: {
        Row: {
          id: Uuid;
          short_code: string;
          title: string;
          customer_name: string | null;
          category_id: Uuid | null;
          attached_image_urls: string[];
          creator_id: Uuid;
          current_assignee_id: Uuid | null;
          status: DocumentStatus;
          completed_at: Timestamp | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          short_code?: string;          // tự sinh bởi trigger
          title: string;
          customer_name?: string | null;
          category_id?: Uuid | null;
          attached_image_urls?: string[];
          creator_id: Uuid;
          current_assignee_id?: Uuid | null;
          status?: DocumentStatus;
          completed_at?: Timestamp | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
      };

      document_handovers: {
        Row: {
          id: Uuid;
          document_id: Uuid;
          sender_id: Uuid;
          receiver_id: Uuid;
          status: HandoverStatus;
          sent_at: Timestamp;
          received_at: Timestamp | null;
          note: string | null;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          document_id: Uuid;
          sender_id: Uuid;
          receiver_id: Uuid;
          status?: HandoverStatus;
          sent_at?: Timestamp;
          received_at?: Timestamp | null;
          note?: string | null;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["document_handovers"]["Insert"]>;
      };

      push_subscriptions: {
        Row: {
          id: Uuid;
          user_id: Uuid;
          subscription: Json;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          user_id: Uuid;
          subscription: Json;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Insert"]>;
      };

      account_requests: {
        Row: {
          id: Uuid;
          email: string;
          full_name: string | null;
          requested_role: UserRole | null;
          invite_code: string | null;
          status: string;
          created_at: Timestamp;
        };
        Insert: {
          id?: Uuid;
          email: string;
          full_name?: string | null;
          requested_role?: UserRole | null;
          invite_code?: string | null;
          status?: string;
          created_at?: Timestamp;
        };
        Update: Partial<Database["public"]["Tables"]["account_requests"]["Insert"]>;
      };
    };

    Views: Record<string, never>;

    Functions: {
      transfer_document: {
        Args: { p_document_id: Uuid; p_receiver_id: Uuid; p_note?: string | null };
        Returns: Uuid;                       // handover id
      };
      acknowledge_document: {
        Args: { p_handover_id: Uuid };
        Returns: void;
      };
      reject_document: {
        Args: { p_handover_id: Uuid; p_reason: string };
        Returns: void;
      };
      complete_document: {
        Args: { p_document_id: Uuid };
        Returns: void;
      };
      check_schedule_participant_conflicts: {
        Args: {
          p_participant_ids: Uuid[];
          p_start: Timestamp;
          p_end: Timestamp;
          p_ignore_schedule_id?: Uuid | null;
        };
        Returns: Array<{
          schedule_id: Uuid;
          title: string;
          start_time: Timestamp;
          end_time: Timestamp;
          status: ScheduleStatus;
          profile_id: Uuid;
          full_name: string | null;
        }>;
      };
      get_leave_safe: {
        Args: { p_schedule_id: Uuid };
        Returns: Array<{
          title: string;
          description: string | null;
          metadata: Record<string, Json>;
          can_view_detail: boolean;
        }>;
      };
      user_is_in_document_handovers: {
        Args: { p_doc_id: Uuid; p_user_id: Uuid };
        Returns: boolean;
      };
      user_is_document_creator: {
        Args: { p_doc_id: Uuid; p_user_id: Uuid };
        Returns: boolean;
      };
      auto_archive_and_cleanup: {
        Args: Record<string, never>;
        Returns: void;
      };
    };

    Enums: {
      user_role: UserRole;
      task_status: TaskStatus;
      task_priority: TaskPriority;
      schedule_type: ScheduleType;
      schedule_status: ScheduleStatus;
      document_status: DocumentStatus;
      handover_status: HandoverStatus;
    };
  };
}

// --- TIỆN ÍCH KHÁC ----------------------------------------------------------

// Shortcut row types — dùng phổ biến hơn full path
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Ví dụ sử dụng:
//   import type { Tables } from "@/types/database.types";
//   type Document = Tables<"documents">;
//   type DocumentInsert = TablesInsert<"documents">;
