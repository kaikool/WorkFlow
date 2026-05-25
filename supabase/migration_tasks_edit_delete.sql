-- migration_tasks_edit_delete.sql
-- Mở quyền Sửa nội dung + Xóa nháp cho người tạo (creator).
-- Bối cảnh: chính sách "anti-Delete" cứng nhắc làm khó khi creator gõ sai tiêu đề/hạn/ưu tiên
-- ngay sau khi tạo, hoặc tạo nhầm rồi không có cách rút lại nhanh. Cancel quá nặng cho
-- task chưa kịp ai động vào (đẩy notification + lưu trữ vĩnh viễn).
--
-- Hai RPC mới:
--   1) task_update — sửa title/description/priority/due_date BẤT KỲ LÚC NÀO (kể cả doing/submitted/done).
--      KHÔNG cho sửa: department_id, task_type, requires_approval, assignees (đã có task_delegate riêng).
--      Quyền: creator + admin/director. Mỗi lần sửa ghi 1 audit comment [Hệ thống] liệt kê field đã đổi.
--   2) task_delete_draft — XÓA HẲN khỏi DB (CASCADE). Quyền: chỉ creator.
--      Điều kiện: status='todo' AND 0 task_comments AND 0 task_attachments AND created_at trong 10 phút.
--      Hard-delete vì task chưa ảnh hưởng ai — Cancel sẽ phù hợp khi đã quá ngưỡng.

-- =====================================================================
-- §1. task_update — sửa nội dung
-- =====================================================================
CREATE OR REPLACE FUNCTION task_update(
  p_task_id     UUID,
  p_title       TEXT,
  p_description TEXT,
  p_priority    task_priority,
  p_due_date    TIMESTAMPTZ
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_task         tasks%ROWTYPE;
  v_is_creator   BOOLEAN;
  v_is_top_admin BOOLEAN;
  v_actor_name   TEXT;
  v_changes      TEXT[] := ARRAY[]::TEXT[];
  v_old_title    TEXT;
  v_old_desc     TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, full_name INTO v_role, v_actor_name FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;

  v_is_top_admin := v_role IN ('admin', 'director');
  v_is_creator   := v_task.created_by = v_uid;

  IF NOT (v_is_creator OR v_is_top_admin) THEN
    RAISE EXCEPTION 'Chỉ người tạo hoặc Lãnh đạo/Admin được sửa công việc';
  END IF;

  IF v_task.status = 'canceled' THEN
    RAISE EXCEPTION 'Không sửa được công việc đã huỷ';
  END IF;
  IF v_task.is_archived THEN
    RAISE EXCEPTION 'Không sửa được công việc đã lưu trữ';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;

  -- So sánh từng field để build audit log dễ đọc
  IF trim(v_task.title) IS DISTINCT FROM trim(p_title) THEN
    v_changes := v_changes || ('tiêu đề: "' || v_task.title || '" → "' || p_title || '"');
  END IF;

  v_old_desc := COALESCE(v_task.description, '');
  IF v_old_desc IS DISTINCT FROM COALESCE(p_description, '') THEN
    v_changes := v_changes || 'mô tả';
  END IF;

  IF v_task.priority IS DISTINCT FROM COALESCE(p_priority, 'medium') THEN
    v_changes := v_changes || (
      'mức độ: ' ||
      CASE v_task.priority WHEN 'high' THEN 'Khẩn' WHEN 'low' THEN 'Thấp' ELSE 'Bình thường' END ||
      ' → ' ||
      CASE COALESCE(p_priority, 'medium') WHEN 'high' THEN 'Khẩn' WHEN 'low' THEN 'Thấp' ELSE 'Bình thường' END
    );
  END IF;

  IF v_task.due_date IS DISTINCT FROM p_due_date THEN
    v_changes := v_changes || (
      'hạn: ' ||
      to_char(v_task.due_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI') ||
      ' → ' ||
      to_char(p_due_date AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI')
    );
  END IF;

  -- Không có gì đổi → trả về sớm, không tạo comment rác
  IF array_length(v_changes, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE tasks
  SET title       = trim(p_title),
      description = NULLIF(trim(COALESCE(p_description, '')), ''),
      priority    = COALESCE(p_priority, 'medium'),
      due_date    = p_due_date
  WHERE id = p_task_id;

  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (p_task_id, v_uid,
          '[Hệ thống] ' || v_actor_name || ' đã sửa: ' || array_to_string(v_changes, '; '));

  -- Notify người được giao (trừ chính người sửa)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Công việc vừa được sửa',
         v_actor_name || ' đã sửa "' || trim(p_title) || '"',
         v_task.task_type,
         '/dashboard/tasks?id=' || p_task_id::text
  FROM (
    SELECT v_task.created_by AS u
    UNION
    SELECT user_id FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL
    AND u <> v_uid
    AND (SELECT role FROM profiles WHERE id = u) <> 'driver';
END $$;

GRANT EXECUTE ON FUNCTION task_update(UUID, TEXT, TEXT, task_priority, TIMESTAMPTZ) TO authenticated;


-- =====================================================================
-- §2. task_delete_draft — xóa nháp (10 phút, chưa có comment/attachment)
-- =====================================================================
-- Cửa sổ 10 phút + status=todo + 0 comment + 0 attachment ≈ "task chưa kịp ai đụng vào".
-- Hard DELETE — CASCADE qua task_assignees, task_comments, task_attachments, task_extension_requests
-- (FK on tasks đã set ON DELETE CASCADE từ schema gốc).
CREATE OR REPLACE FUNCTION task_delete_draft(
  p_task_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_task            tasks%ROWTYPE;
  v_age_seconds     NUMERIC;
  v_comment_count   INT;
  v_attach_count    INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;

  IF v_task.created_by <> v_uid THEN
    RAISE EXCEPTION 'Chỉ người tạo được xoá nháp';
  END IF;
  IF v_task.status <> 'todo' THEN
    RAISE EXCEPTION 'Chỉ xoá được khi việc chưa bắt đầu';
  END IF;

  v_age_seconds := EXTRACT(EPOCH FROM (NOW() - v_task.created_at));
  IF v_age_seconds > 600 THEN
    RAISE EXCEPTION 'Quá hạn 10 phút — vui lòng dùng Huỷ thay vì xoá';
  END IF;

  -- Chỉ đếm comment của người dùng (loại trừ system audit nếu có).
  SELECT COUNT(*) INTO v_comment_count
  FROM task_comments
  WHERE task_id = p_task_id
    AND content NOT LIKE '[Hệ thống]%';

  IF v_comment_count > 0 THEN
    RAISE EXCEPTION 'Việc đã có bình luận — vui lòng dùng Huỷ thay vì xoá';
  END IF;

  SELECT COUNT(*) INTO v_attach_count FROM task_attachments WHERE task_id = p_task_id;
  IF v_attach_count > 0 THEN
    RAISE EXCEPTION 'Việc đã có file đính kèm — vui lòng dùng Huỷ thay vì xoá';
  END IF;

  -- Hard delete — CASCADE tự dọn task_assignees + task_comments [Hệ thống] + notifications link
  DELETE FROM tasks WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_delete_draft(UUID) TO authenticated;


NOTIFY pgrst, 'reload schema';
