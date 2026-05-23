// ============================================================================
// DATABASE TYPES — STUB
// ----------------------------------------------------------------------------
// File này nên được auto-generate bởi Supabase CLI:
//
//   npx supabase login
//   npx supabase link --project-ref <PROJECT_REF>
//   npx supabase gen types typescript --linked > src/types/database.types.ts
//
// Khi chưa cài Supabase CLI, type `Database` ở dưới là stub — components dùng
// `any` cho data Supabase. Sau khi gen real types, mọi `supabase.from(...)`
// query sẽ tự suy luận type chính xác → bỏ được các `as unknown as XxxRow[]`
// cast trong _lib/fetch*.ts.
//
// Tài liệu: https://supabase.com/docs/guides/api/rest/generating-types
// ============================================================================

export interface Database {
  public: {
    Tables: Record<string, { Row: any; Insert: any; Update: any }>;
    Views: Record<string, { Row: any }>;
    Functions: Record<string, { Args: any; Returns: any }>;
    Enums: Record<string, string>;
  };
}
