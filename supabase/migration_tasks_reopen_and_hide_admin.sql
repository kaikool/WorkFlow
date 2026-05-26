-- =====================================================================
-- MIGRATION: REOPEN TASK LOGIC FIX & HIDE ALL USER-FACING ADMIN REFERENCES
-- =====================================================================
-- File: supabase/migration_tasks_reopen_and_hide_admin.sql
--
-- Nội dung:
--  1) Cập nhật `task_update_status` (reopen done -> doing):
--     - Cho phép: Creator, Trưởng phòng của Creator, Trưởng phòng của Assignee, Lãnh đạo/IT
--     - Loại bỏ hoàn toàn nhãn "Admin" khỏi thông báo lỗi.
--  2) Cập nhật Trigger function `guard_task_status_transition`:
--     - Đồng bộ ma trận quyền mở lại (done -> doing).
--     - Loại bỏ hoàn toàn nhãn "Admin" khỏi thông báo lỗi.
--  3) Cập nhật `task_delete` và `task_edit`:
--     - Loại bỏ hoàn toàn nhãn "Admin" khỏi thông báo lỗi.
-- =====================================================================

-- 1. Hàm cập nhật trạng thái công việc
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
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả lại';
      END IF;
      IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager) THEN
        RAISE EXCEPTION 'Chỉ người giao hoặc cấp có thẩm quyền mới được mở lại báo cáo.';
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
      IF NOT (v_is_assignee OR v_is_manager OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
        RAISE EXCEPTION 'Bạn không có quyền hoàn thành công việc này';
      END IF;
      IF v_task.status NOT IN ('todo', 'doing') THEN
        RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
      END IF;
    ELSE
      -- Report
      IF v_task.requires_approval = FALSE THEN
        IF NOT (v_is_assignee OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
          RAISE EXCEPTION 'Bạn không có quyền ghi nhận hoàn thành báo cáo này';
        END IF;
        IF v_task.status NOT IN ('todo', 'doing') THEN
          RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
        END IF;
        IF v_is_manager THEN v_self_approve := TRUE; END IF;
      ELSE
        -- Report requires approval
        IF v_task.status = 'submitted' THEN
          IF NOT (v_is_manager OR v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
            RAISE EXCEPTION 'Bạn không có quyền duyệt / ghi nhận báo cáo';
          END IF;
        ELSIF v_task.status = 'doing' AND v_is_assignee AND v_is_manager THEN
          v_self_approve := TRUE;
        ELSIF v_task.status IN ('todo', 'doing') AND (v_is_creator OR v_is_creator_manager OR v_is_top_admin) THEN
          v_self_approve := FALSE;
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

  -- Update trạng thái
  IF v_is_reopen OR v_is_return_sub THEN
    UPDATE tasks
    SET status = p_new_status,
        last_returned_at  = NOW(),
        last_return_reason = p_comment
    WHERE id = p_task_id;
  ELSE
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  END IF;

  -- Ghi nhận lịch sử
  IF v_self_approve THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            v_actor_name || ' đã hoàn thành.');
  ELSIF p_new_status = 'done' THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            CASE WHEN v_task.task_type = 'report' AND v_task.status = 'submitted'
                 THEN v_actor_name || ' đã duyệt báo cáo.'
                 ELSE v_actor_name || ' đã hoàn thành.' END);
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


-- 2. Hàm trigger bảo vệ trạng thái công việc
CREATE OR REPLACE FUNCTION guard_task_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid                 UUID := auth.uid();
  v_role                TEXT;
  v_dept                UUID;
  v_creator_dept        UUID;
  v_is_creator          BOOLEAN;
  v_is_creator_manager  BOOLEAN;
  v_is_assignee_manager BOOLEAN;
  v_is_top_admin        BOOLEAN;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

    IF OLD.status = 'todo' AND NEW.status = 'done' THEN
      RAISE EXCEPTION 'Công việc phải chuyển sang Đang làm trước khi hoàn thành';
    END IF;

    IF OLD.status = 'done' AND NEW.status = 'doing' THEN
      SELECT department_id INTO v_creator_dept FROM profiles WHERE id = OLD.created_by;

      v_is_creator          := (OLD.created_by = v_uid);
      v_is_creator_manager  := (v_role = 'manager' AND v_dept = v_creator_dept);
      v_is_assignee_manager := (v_role = 'manager' AND v_dept = OLD.department_id);
      v_is_top_admin        := (v_role IN ('admin', 'director'));

      IF NOT (v_is_creator OR v_is_creator_manager OR v_is_assignee_manager OR v_is_top_admin) THEN
        RAISE EXCEPTION 'Chỉ người giao hoặc cấp có thẩm quyền mới được mở lại công việc.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;


-- 3. Hàm xóa công việc (hủy nhãn Admin)
CREATE OR REPLACE FUNCTION task_delete(p_task_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task         tasks%ROWTYPE;
  v_creator_dept UUID;
  v_is_top_admin BOOLEAN;
  v_is_creator   BOOLEAN;
  v_is_manager   BOOLEAN;
  v_actor_name   TEXT;
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
    RAISE EXCEPTION 'Chỉ người giao hoặc cấp có thẩm quyền mới được xoá công việc.';
  END IF;

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Công việc đã bị xóa',
         v_actor_name || ' đã xóa: ' || v_task.title,
         v_task.task_type,
         '/dashboard/tasks'
  FROM (
    SELECT assignee_id AS u FROM tasks WHERE id = p_task_id
    UNION
    SELECT user_id FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL AND u <> v_uid;

  DELETE FROM task_extension_requests WHERE task_id = p_task_id;
  DELETE FROM task_comments WHERE task_id = p_task_id;
  DELETE FROM task_assignees WHERE task_id = p_task_id;
  DELETE FROM tasks WHERE id = p_task_id;
END $$;


-- 4. Hàm sửa công việc (hủy nhãn Admin)
CREATE OR REPLACE FUNCTION task_edit(
  p_task_id     UUID,
  p_title       TEXT,
  p_description TEXT,
  p_priority    task_priority,
  p_due_date    TIMESTAMPTZ,
  p_metadata    JSONB DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task         tasks%ROWTYPE;
  v_creator_dept UUID;
  v_is_top_admin BOOLEAN;
  v_is_creator   BOOLEAN;
  v_is_manager   BOOLEAN;
  v_actor_name   TEXT;
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
    RAISE EXCEPTION 'Chỉ người giao hoặc cấp có thẩm quyền mới được sửa công việc.';
  END IF;

  IF v_task.status = 'canceled' THEN
    RAISE EXCEPTION 'Không sửa được công việc đã huỷ';
  END IF;
  IF v_task.is_archived THEN
    RAISE EXCEPTION 'Không sửa được công việc đã lưu trữ';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Tiêu đề không được trống';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;

  UPDATE tasks
  SET title = p_title,
      description = p_description,
      priority = p_priority,
      due_date = p_due_date,
      metadata = COALESCE(p_metadata, metadata),
      updated_at = NOW()
  WHERE id = p_task_id;

  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (p_task_id, v_uid, v_actor_name || ' đã cập nhật thông tin công việc.');

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Công việc được cập nhật',
         v_actor_name || ' đã cập nhật: ' || p_title,
         v_task.task_type,
         '/dashboard/tasks?id=' || p_task_id::text
  FROM (
    SELECT assignee_id AS u FROM tasks WHERE id = p_task_id
    UNION
    SELECT user_id FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL AND u <> v_uid;
END $$;

NOTIFY pgrst, 'reload schema';
