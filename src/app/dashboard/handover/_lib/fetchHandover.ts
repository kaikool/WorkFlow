// Query Supabase trả về list hồ sơ + categories + handovers

import { createClient } from "@/utils/supabase/client";
import type { DocumentCategory, DocumentRow } from "./types";

const supabase = createClient();

// FK disambiguator dùng TÊN CỘT (an toàn hơn tên constraint Postgres tự sinh,
// vì constraint có thể có suffix _1, _2 nếu bảng từng drop-recreate).
//
// Slim payload (Gói C):
//   - creator/current_assignee VAN giữ nested departments(name) vì DocumentDetailDialog dùng.
//   - sender/receiver trong handovers chỉ cần full_name+avatar (HandoverTimeline) →
//     bỏ department_id + departments(name) → giảm ~30% payload hồ sơ có nhiều handover.
const LIST_SELECT = `
  *,
  category:document_categories ( id, name, sla_hours, color ),
  creator:profiles!creator_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
  current_assignee:profiles!current_assignee_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
  handovers:document_handovers (
    id, document_id, sender_id, receiver_id, status, sent_at, received_at, note, created_at,
    sender:profiles!sender_id ( id, full_name, avatar_url ),
    receiver:profiles!receiver_id ( id, full_name, avatar_url )
  )
`;

// Detail cần đầy đủ thong tin hơn (department) cho hầu hết profile liên quan.
const DETAIL_SELECT = `
  *,
  category:document_categories ( id, name, sla_hours, color ),
  creator:profiles!creator_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
  current_assignee:profiles!current_assignee_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
  handovers:document_handovers (
    id, document_id, sender_id, receiver_id, status, sent_at, received_at, note, created_at,
    sender:profiles!sender_id ( id, full_name, avatar_url, department_id, departments ( name ) ),
    receiver:profiles!receiver_id ( id, full_name, avatar_url, department_id, departments ( name ) )
  )
`;

// Helper: PostgrestError có property non-enumerable → console.log ra {}.
// Trích xuất các field quan trọng để debug dễ hơn.
function logSupabaseError(label: string, error: any) {
  console.error(label, {
    message: error?.message,
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
}

export async function fetchAllDocuments(): Promise<DocumentRow[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(LIST_SELECT)
    .order("updated_at", { ascending: false });
  if (error) {
    logSupabaseError("fetchAllDocuments error:", error);
    return [];
  }
  return (data || []) as unknown as DocumentRow[];
}

export async function fetchDocumentById(documentId: string): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from("documents")
    .select(DETAIL_SELECT)
    .eq("id", documentId)
    .single();
  if (error) {
    logSupabaseError("fetchDocumentById error:", error);
    return null;
  }
  return data as unknown as DocumentRow;
}

export async function fetchCategories(): Promise<DocumentCategory[]> {
  const { data, error } = await supabase
    .from("document_categories")
    .select("*")
    .order("name");
  if (error) {
    logSupabaseError("fetchCategories error:", error);
    return [];
  }
  return (data || []) as DocumentCategory[];
}
