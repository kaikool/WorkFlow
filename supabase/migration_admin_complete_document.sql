-- Migration: admin override hoàn thành hồ sơ (force-complete)
-- Lý do: admin/director cần có khả năng đóng luồng hồ sơ khi
-- người giữ hồ sơ không thể hoàn thành (nghỉ việc, sai sót...).
-- RPC này SECURITY DEFINER + tự check quyền admin/director ở backend.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_complete_document(
    p_document_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role text;
    v_doc_status text;
BEGIN
    -- 1. Check auth
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Phiên đăng nhập đã hết hạn';
    END IF;

    -- 2. Check role: chỉ admin/director
    SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
    IF v_role NOT IN ('admin', 'director') THEN
        RAISE EXCEPTION 'Chỉ admin hoặc BGĐ mới có quyền đóng hồ sơ';
    END IF;

    -- 3. Check document tồn tại và chưa completed
    SELECT status INTO v_doc_status FROM documents WHERE id = p_document_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ';
    END IF;
    IF v_doc_status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Hồ sơ đã được đóng trước đó';
    END IF;

    -- 4. Force complete — bypass current_assignee check
    UPDATE documents
    SET status = 'COMPLETED',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_document_id;

    -- 5. Notification cho creator (nếu khác người đóng)
    INSERT INTO notifications (user_id, title, content, type, link)
    SELECT
        d.creator_id,
        'Hồ sơ đã được đóng (Hỗ trợ)',
        CASE
            WHEN d.creator_id = auth.uid() THEN
                'Bạn đã đóng hồ sơ "' || d.title || '".'
            ELSE
                'Admin/BGĐ đã đóng hồ sơ "' || d.title || '" do bạn tạo.'
        END,
        'document_handover',
        '/dashboard/handover?id=' || p_document_id
    FROM documents d
    WHERE d.id = p_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_complete_document(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
