-- ==============================================================================
-- WorkFlow Portal — Add reject_reason to document_handovers (2026-05-30)
-- ==============================================================================
-- Mục đích:
--   1. Thêm cột reject_reason vào document_handovers.
--   2. Cập nhật RPC reject_document để lưu reject_reason.
-- ==============================================================================

-- 1. Thêm cột reject_reason
ALTER TABLE document_handovers 
ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- 2. Cập nhật (hoặc tạo mới) RPC reject_document
CREATE OR REPLACE FUNCTION reject_document(
  p_handover_id UUID,
  p_reason TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_handover    document_handovers%ROWTYPE;
  v_doc         documents%ROWTYPE;
  v_actor_name  TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT full_name INTO v_actor_name FROM profiles WHERE id = v_uid;

  SELECT * INTO v_handover FROM document_handovers WHERE id = p_handover_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy lượt giao nhận'; END IF;
  
  IF v_handover.receiver_id <> v_uid THEN
    RAISE EXCEPTION 'Bạn không phải người nhận của lượt giao hồ sơ này';
  END IF;
  
  IF v_handover.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Hồ sơ này không ở trạng thái chờ nhận';
  END IF;

  SELECT * INTO v_doc FROM documents WHERE id = v_handover.document_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ gốc'; END IF;

  -- 1) Cập nhật handover thành REJECTED
  UPDATE document_handovers
  SET status = 'REJECTED',
      received_at = NOW(),
      reject_reason = p_reason
  WHERE id = p_handover_id;

  -- 2) Cập nhật trạng thái hồ sơ trả về cho người gửi (RETURNED)
  UPDATE documents
  SET status = 'RETURNED',
      current_assignee_id = v_handover.sender_id,
      updated_at = NOW()
  WHERE id = v_handover.document_id;

  -- 3) Gửi thông báo cho sender
  INSERT INTO notifications (user_id, title, content, type, link)
  VALUES (
    v_handover.sender_id,
    'Hồ sơ bị trả về',
    v_actor_name || ' đã trả về hồ sơ "' || v_doc.title || '" với lý do: ' || p_reason,
    'document_handover',
    '/dashboard/handover?id=' || v_doc.id::text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_document(UUID, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
