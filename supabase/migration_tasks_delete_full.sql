-- migration_tasks_delete_full.sql
-- Mở rộng quyền xóa, sửa và reopen cho Creator's Manager.
-- Gỡ bỏ giới hạn 10 phút, 0 comment, 0 file cho thao tác Xóa.

-- =====================================================================
-- §1. task_delete — Xóa cứng hoàn toàn (thay thế task_delete_draft)
-- =====================================================================
CREATE OR REPLACE FUNCTION task_delete(
  p_task_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_role            TEXT;
  v_dept            UUID;
  v_actor_name      TEXT;
  v_task            tasks%ROWTYPE;
  v_creator_dept    UUID;
  v_is_top_admin    BOOLEAN;
  v_is_creator      BOOLEAN;
  v_is_manager      BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor_name FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;

  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  v_is_top_admin := v_role IN ('admin', 'director');
  v_is_creator   := v_task.created_by = v_uid;
  v_is_manager   := v_role = 'manager' AND v_dept = v_creator_dept;

  IF NOT (v_is_creator OR v_is_top_admin OR v_is_manager) THEN
    RAISE EXCEPTION 'Chỉ người tạo, Trưởng phòng người tạo hoặc Lãnh đạo/Admin được xoá công việc';
  END IF;

  -- Bắn notification cho những người được giao trước khi hard delete (không trỏ link chi tiết vì task bị xóa)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Công việc đã bị xóa',
         v_actor_name || ' đã xóa: ' || v_task.title,
         v_task.task_type,
         '/dashboard/tasks'
  FROM (
    SELECT user_id AS u FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL
    AND u <> v_uid
    AND (SELECT role FROM profiles WHERE id = u) <> 'driver';

  -- Hard delete — CASCADE tự dọn task_assignees + task_comments + task_attachments db rows.
  -- Lưu ý: Storage file vẫn sẽ mồ côi và dọn bằng cron job.
  DELETE FROM tasks WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_delete(UUID) TO authenticated;

-- Xóa RPC cũ
DROP FUNCTION IF EXISTS task_delete_draft(UUID);


-- =====================================================================
-- §2. task_update — Bổ sung quyền cho Creator's Manager
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
  v_dept         UUID;
  v_task         tasks%ROWTYPE;
  v_creator_dept UUID;
  v_is_creator   BOOLEAN;
  v_is_top_admin BOOLEAN;
  v_is_manager   BOOLEAN;
  v_actor_name   TEXT;
  v_changes      TEXT[] := ARRAY[]::TEXT[];
  v_old_title    TEXT;
  v_old_desc     TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor_name FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;

  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  v_is_top_admin := v_role IN ('admin', 'director');
  v_is_creator   := v_task.created_by = v_uid;
  v_is_manager   := v_role = 'manager' AND v_dept = v_creator_dept;

  IF NOT (v_is_creator OR v_is_top_admin OR v_is_manager) THEN
    RAISE EXCEPTION 'Chỉ người tạo, Trưởng phòng người tạo hoặc Lãnh đạo/Admin được sửa công việc';
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

  -- So sánh field...
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
          v_actor_name || ' đã sửa: ' || array_to_string(v_changes, '; '));

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
-- §3. task_update_status — Sửa logic Reopen done -> doing
-- =====================================================================
CREATE OR REPLACE FUNCTION task_update_status(
  p_task_id    UUID,
  p_new_status task_status,
  p_comment    TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid           UUID := auth.uid();
  v_role          TEXT;
  v_dept          UUID;
  v_task          tasks%ROWTYPE;
  v_creator_dept  UUID;
  v_is_assignee   BOOLEAN;
  v_is_manager    BOOLEAN;
  v_is_top_admin  BOOLEAN;
  v_is_creator    BOOLEAN;
  v_is_creator_manager BOOLEAN;
  v_actor_name    TEXT;
  v_self_approve  BOOLEAN := FALSE;
  v_is_reopen     BOOLEAN := FALSE;
  v_is_return_sub BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor_name
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền với công việc này';
  END IF;

  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  v_is_assignee  := (v_task.assignee_id = v_uid)
    OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid);
  v_is_top_admin := v_role IN ('admin', 'director');
  v_is_manager   := v_is_top_admin
    OR (v_role = 'manager' AND v_task.department_id = v_dept);
  v_is_creator   := v_task.created_by = v_uid;
  v_is_creator_manager := (v_role = 'manager' AND v_dept = v_creator_dept);

  IF v_task.status = p_new_status THEN RETURN; END IF;

  IF p_new_status = 'canceled' THEN
    RAISE EXCEPTION 'Hãy dùng task_cancel để hủy công việc';

  ELSIF p_new_status = 'doing' THEN
    IF v_task.status NOT IN ('todo', 'submitted', 'done') THEN
      RAISE EXCEPTION 'Không thể chuyển sang Đang làm từ trạng thái hiện tại';
    END IF;

    IF v_task.status = 'submitted' THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả về';
      END IF;
      IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền trả về báo cáo này';
      END IF;
      v_is_return_sub := TRUE;

    ELSIF v_task.status = 'done' THEN
      -- SỬA LUẬT: Lãnh đạo/Admin HOẶC Creator HOẶC Trưởng phòng Creator được quyền mở lại
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả lại';
      END IF;
      IF NOT (v_is_top_admin OR v_is_creator OR v_is_creator_manager) THEN
        RAISE EXCEPTION 'Chỉ Người tạo, Trưởng phòng người tạo hoặc Lãnh đạo/Admin được trả lại báo cáo đã hoàn thành';
      END IF;
      v_is_reopen := TRUE;

    ELSE
      -- todo → doing
      IF NOT (v_is_assignee OR v_is_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền chuyển trạng thái';
      END IF;
    END IF;

  ELSIF p_new_status = 'submitted' THEN
    IF v_task.task_type <> 'report' THEN
      RAISE EXCEPTION 'Chỉ báo cáo mới có trạng thái Đã nộp';
    END IF;
    IF NOT v_task.requires_approval THEN
      RAISE EXCEPTION 'Báo cáo này không cần duyệt, hãy bấm Hoàn thành';
    END IF;
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Chỉ người được giao mới được nộp báo cáo';
    END IF;
    IF v_task.status <> 'doing' THEN
      RAISE EXCEPTION 'Báo cáo cần đang thực hiện trước khi nộp';
    END IF;

  ELSIF p_new_status = 'done' THEN
    IF v_task.task_type = 'task' THEN
      IF NOT (v_is_assignee OR v_is_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền hoàn thành công việc này';
      END IF;
      IF v_task.status NOT IN ('todo', 'doing') THEN
        RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
      END IF;
    ELSE
      IF v_task.requires_approval = FALSE THEN
        IF NOT v_is_assignee THEN
          RAISE EXCEPTION 'Chỉ người được giao mới được ghi nhận hoàn thành';
        END IF;
        IF v_task.status NOT IN ('todo', 'doing') THEN
          RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
        END IF;
        IF v_is_manager THEN v_self_approve := TRUE; END IF;
      ELSE
        IF v_task.status = 'submitted' THEN
          IF NOT v_is_manager THEN
            RAISE EXCEPTION 'Chỉ Trưởng phòng được duyệt báo cáo';
          END IF;
        ELSIF v_task.status = 'doing' AND v_is_assignee AND v_is_manager THEN
          v_self_approve := TRUE;
        ELSE
          RAISE EXCEPTION 'Báo cáo cần được nộp trước khi duyệt';
        END IF;
      END IF;
    END IF;

  ELSIF p_new_status = 'todo' THEN
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'Chỉ Trưởng phòng được đặt lại trạng thái Chưa làm';
    END IF;

  ELSE
    RAISE EXCEPTION 'Trạng thái không hợp lệ: %', p_new_status;
  END IF;

  -- Update trạng thái + (nếu return) gắn cờ truy vết
  IF v_is_reopen OR v_is_return_sub THEN
    UPDATE tasks
    SET status = p_new_status,
        last_returned_at  = NOW(),
        last_return_reason = p_comment
    WHERE id = p_task_id;
  ELSE
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  END IF;

  IF v_self_approve THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' đã hoàn thành.');
  END IF;

  IF v_is_reopen THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' trả lại báo cáo đã hoàn thành. Lý do: ' || p_comment);
  ELSIF v_is_return_sub THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' trả về báo cáo để sửa. Lý do: ' || p_comment);
  ELSIF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid, p_comment);
  END IF;

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         CASE WHEN v_is_reopen THEN 'Báo cáo bị trả lại'
              WHEN v_is_return_sub THEN 'Báo cáo cần sửa lại'
              ELSE 'Trạng thái công việc đã đổi' END,
         v_actor_name || ' → "' || v_task.title || '": ' ||
           CASE p_new_status
             WHEN 'doing'     THEN
               CASE WHEN v_is_reopen THEN 'Cần làm lại — ' || COALESCE(p_comment, '')
                    WHEN v_is_return_sub THEN 'Trả về sửa — ' || COALESCE(p_comment, '')
                    ELSE 'Đang làm' END
             WHEN 'submitted' THEN 'Đã nộp'
             WHEN 'done'      THEN 'Hoàn thành'
             WHEN 'todo'      THEN 'Chưa làm'
             ELSE p_new_status::text
           END,
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

GRANT EXECUTE ON FUNCTION task_update_status(UUID, task_status, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
