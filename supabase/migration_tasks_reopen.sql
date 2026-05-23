-- =====================================================================
-- MIGRATION: TASK REOPEN — Trả lại task đã hoàn thành kèm phản hồi
-- =====================================================================
-- Cho phép người tạo (created_by), Trưởng phòng cùng phòng, Admin/Director
-- trả lại task ở trạng thái 'done' → quay về 'doing' kèm lý do.
--
-- Nghiệp vụ:
--   • NV gửi báo cáo → LĐP không đồng ý → trả lại NV.
--   • Phòng B gửi báo cáo → người tạo phòng A không đồng ý → trả lại Phòng B.
--   • BGĐ giao cho Phòng → Phòng nộp → BGĐ không đồng ý → trả lại Phòng.
-- =====================================================================

CREATE OR REPLACE FUNCTION task_update_status(
  p_task_id    UUID,
  p_new_status task_status,
  p_comment    TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task         tasks%ROWTYPE;
  v_is_assignee  BOOLEAN;
  v_is_manager   BOOLEAN;
  v_is_creator   BOOLEAN;
  v_actor_name   TEXT;
  v_self_approve BOOLEAN := FALSE;
  v_is_reopen    BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor_name
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền với công việc này';
  END IF;

  v_is_assignee := (v_task.assignee_id = v_uid)
    OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid);
  v_is_manager  := v_role IN ('admin', 'director')
    OR (v_role = 'manager' AND v_task.department_id = v_dept);
  v_is_creator  := v_task.created_by = v_uid;

  IF v_task.status = p_new_status THEN RETURN; END IF;

  IF p_new_status = 'canceled' THEN
    RAISE EXCEPTION 'Hãy dùng task_cancel để hủy công việc';

  ELSIF p_new_status = 'doing' THEN
    -- Cho phép: todo → doing, submitted → doing (trả về), done → doing (reopen)
    IF v_task.status NOT IN ('todo', 'submitted', 'done') THEN
      RAISE EXCEPTION 'Không thể chuyển sang Đang làm từ trạng thái hiện tại';
    END IF;

    IF v_task.status = 'submitted' THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả về';
      END IF;
      IF NOT (v_is_manager OR v_is_creator) THEN
        RAISE EXCEPTION 'Chỉ Trưởng phòng hoặc người tạo được trả về báo cáo';
      END IF;

    ELSIF v_task.status = 'done' THEN
      -- Reopen: bắt buộc comment + chỉ creator/manager/admin/director
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả lại';
      END IF;
      IF NOT (v_is_manager OR v_is_creator) THEN
        RAISE EXCEPTION 'Chỉ người tạo hoặc cấp duyệt được trả lại báo cáo đã hoàn thành';
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

  UPDATE tasks SET status = p_new_status WHERE id = p_task_id;

  IF v_self_approve THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            '[Hệ thống] ' || v_actor_name
            || ' tự nộp và tự ghi nhận hoàn thành báo cáo của chính mình.');
  END IF;

  IF v_is_reopen THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            '[Hệ thống] ' || v_actor_name
            || ' trả lại báo cáo đã hoàn thành. Lý do: ' || p_comment);
  ELSIF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid, p_comment);
  END IF;

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         CASE WHEN v_is_reopen THEN 'Báo cáo bị trả lại'
              ELSE 'Trạng thái công việc đã đổi' END,
         v_actor_name || ' → "' || v_task.title || '": ' ||
           CASE p_new_status
             WHEN 'doing'     THEN
               CASE WHEN v_is_reopen THEN 'Cần làm lại — ' || COALESCE(p_comment, '')
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
