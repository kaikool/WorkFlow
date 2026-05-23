-- ============================================================================
-- FIX: Vòng lặp vô hạn (infinite recursion) trong RLS module Handover
-- ----------------------------------------------------------------------------
-- Nguyên nhân: policy của `documents` tham chiếu `document_handovers` qua
-- EXISTS, và policy của `document_handovers` lại tham chiếu ngược `documents`
-- → 2 policy kích hoạt RLS của nhau → recursion (error 42P17).
--
-- Cách fix: tách 2 truy vấn cross-table ra SECURITY DEFINER helper function.
-- Vì SECURITY DEFINER bỏ qua RLS, không trigger lại policy của bảng kia.
--
-- Chạy 1 lần trong Supabase SQL Editor sau khi đã chạy migration_handover_module.sql.
-- ============================================================================

-- 1) Helper: kiểm tra user có nằm trong luồng handover của document nào không
CREATE OR REPLACE FUNCTION user_is_in_document_handovers(p_doc_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM document_handovers
    WHERE document_id = p_doc_id
      AND (sender_id = p_user_id OR receiver_id = p_user_id)
  );
$$;

-- 2) Helper: kiểm tra user có phải creator của document hay không
CREATE OR REPLACE FUNCTION user_is_document_creator(p_doc_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM documents
    WHERE id = p_doc_id AND creator_id = p_user_id
  );
$$;


-- 3) Drop policy cũ (gây recursion) ------------------------------------------
DROP POLICY IF EXISTS "Documents read access" ON documents;
DROP POLICY IF EXISTS "Handovers read access" ON document_handovers;


-- 4) Recreate documents.SELECT — dùng helper thay vì EXISTS inline -----------
CREATE POLICY "Documents read access" ON documents FOR SELECT
USING (
    creator_id = auth.uid()
    OR current_assignee_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR user_is_in_document_handovers(id, auth.uid())
);


-- 5) Recreate document_handovers.SELECT — dùng helper khác ------------------
CREATE POLICY "Handovers read access" ON document_handovers FOR SELECT
USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR user_is_document_creator(document_id, auth.uid())
);


-- ============================================================================
-- Verify: chạy thử 2 câu select dưới (login bất kỳ user) phải trả về data,
-- không còn lỗi 42P17.
--
--   SELECT id, short_code, status FROM documents LIMIT 5;
--   SELECT id, document_id, status FROM document_handovers LIMIT 5;
-- ============================================================================
