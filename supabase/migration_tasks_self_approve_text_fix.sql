-- migration_tasks_self_approve_text_fix.sql
-- Sửa đổi câu comment hệ thống khi Trưởng phòng tự nộp và tự duyệt báo cáo của chính mình,
-- đồng thời loại bỏ hoàn toàn tiền tố "[Hệ thống]" ở tất cả comment audit tự động của hệ thống.
-- Từ ngữ mới: "đã hoàn thành", "trả lại báo cáo...", "trả về báo cáo..." (không còn bất kỳ tiền tố nào).

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
