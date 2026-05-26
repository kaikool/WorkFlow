-- migration_tasks_standardize.sql
-- Chuẩn hóa Tasks module — sửa các vấn đề phát hiện khi dùng thực tế:
--
-- 1) **Batch task chưa phân công nhưng đã Hoàn thành**: nếu giao báo cáo cho phòng
--    mà người tạo không chọn cán bộ, task được tạo với task_assignees=[] → UI mâu thuẫn
--    "Chưa phân công + Hoàn thành" sau khi TP tự bấm xong, mất truy vết "ai báo cáo cuối".
--    → task_create AUTO-FILL Trưởng phòng (TP) làm assignee mặc định khi report + dept
--    không kèm assignee. Tương tự cho recurring_fire_due.
--
-- 2) **Reopen done vô hạn**: lúc trước cho cả TP cùng phòng + creator reopen done
--    → có thể tạo vòng lặp. Siết lại chỉ admin/director được reopen done.
--    Submitted→doing (return về sửa) vẫn giữ rộng cho creator + manager.
--
-- 3) **Truy vết "đã trả lại"**: thêm last_returned_at + last_return_reason
--    để UI hiện banner "Báo cáo bị trả lại — lý do: ..." cho người được giao.
--
-- 4) **task_cancel link sai**: dùng /dashboard/tasks/<id> thay vì /dashboard/tasks?id=<id>
--    → notification dẫn về 404. Sửa cho khớp các RPC khác.
--
-- Không phá interface — signatures giữ nguyên.

-- =====================================================================
-- §1. Thêm cột truy vết "đã trả lại"
-- =====================================================================
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS last_returned_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_return_reason TEXT;


-- =====================================================================
-- §2. task_create — auto-fill TP làm assignee cho report + dept
-- =====================================================================
-- Bản chất: giao báo cáo cho phòng X = giao cho TP của X. TP sau đó có quyền
-- "Phân công lại" để chuyển trách nhiệm sang cán bộ (task_delegate REPLACE).
-- task_assignees không bao giờ rỗng cho task đã tạo thành công.
CREATE OR REPLACE FUNCTION task_create(
  p_title             TEXT,
  p_description       TEXT,
  p_task_type         TEXT,
  p_priority          task_priority,
  p_due_date          TIMESTAMPTZ,
  p_dept_id           UUID,
  p_assignee_ids      UUID[],
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_requires_approval BOOLEAN DEFAULT FALSE,
  p_batch_id          UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_is_hub       BOOLEAN;
  v_task_id      UUID;
  v_a            UUID;
  v_creator_name TEXT;
  v_tp_id        UUID;
  v_dept_name    TEXT;
  v_assignees    UUID[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_creator_name
  FROM profiles WHERE id = v_uid;
  v_is_hub := _is_hub_department(v_dept);

  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền tạo công việc';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề công việc';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;
  IF p_task_type NOT IN ('task', 'report') THEN
    RAISE EXCEPTION 'Loại công việc không hợp lệ';
  END IF;

  -- ─── Quyền theo loại ─────────────────────────────────────────────
  IF v_role = 'staff' THEN
    IF p_task_type = 'task' THEN
      IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) != 1
         OR p_assignee_ids[1] != v_uid THEN
        RAISE EXCEPTION 'Bạn chỉ được tự ghi chú việc cho mình';
      END IF;
      IF p_dept_id IS NULL THEN p_dept_id := v_dept; END IF;
    ELSIF p_task_type = 'report' THEN
      IF NOT v_is_hub THEN
        RAISE EXCEPTION 'Bạn không có quyền yêu cầu báo cáo';
      END IF;
    END IF;
  ELSIF v_role = 'manager' THEN
    IF p_task_type = 'task' AND p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
      IF EXISTS (
        SELECT 1 FROM unnest(p_assignee_ids) a
        JOIN profiles pr ON pr.id = a
        WHERE pr.department_id IS DISTINCT FROM v_dept
      ) THEN
        RAISE EXCEPTION 'Trưởng phòng chỉ được giao việc trong phòng mình';
      END IF;
    ELSIF p_task_type = 'report' AND NOT v_is_hub THEN
      IF p_dept_id IS NOT NULL AND p_dept_id <> v_dept THEN
        RAISE EXCEPTION 'Trưởng phòng không thuộc phòng đầu mối chỉ được yêu cầu báo cáo trong phòng mình';
      END IF;
    END IF;
  END IF;

  IF p_task_type = 'task' AND (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0) THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  -- ─── AUTO-FILL TP cho report giao cho phòng không kèm assignee ───
  -- Bản chất giao cho phòng X = giao cho TP của X. Nếu không có TP active → raise.
  v_assignees := p_assignee_ids;
  IF p_task_type = 'report'
     AND p_dept_id IS NOT NULL
     AND (v_assignees IS NULL OR array_length(v_assignees, 1) = 0)
  THEN
    SELECT id INTO v_tp_id FROM profiles
    WHERE department_id = p_dept_id
      AND role = 'manager'
      AND is_department_head = TRUE
      AND is_active = TRUE
    LIMIT 1;

    -- Fallback: nếu chưa flag is_department_head thì lấy manager active đầu tiên
    IF v_tp_id IS NULL THEN
      SELECT id INTO v_tp_id FROM profiles
      WHERE department_id = p_dept_id
        AND role = 'manager'
        AND is_active = TRUE
      LIMIT 1;
    END IF;

    IF v_tp_id IS NULL THEN
      SELECT name INTO v_dept_name FROM departments WHERE id = p_dept_id;
      RAISE EXCEPTION 'Phòng "%" chưa có Trưởng phòng đang hoạt động — vui lòng chọn cán bộ cụ thể',
        COALESCE(v_dept_name, p_dept_id::text);
    END IF;

    v_assignees := ARRAY[v_tp_id];
  END IF;

  INSERT INTO tasks (
    title, description, task_type, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    p_title, p_description, p_task_type,
    COALESCE(p_priority, 'medium'), p_due_date, p_dept_id,
    CASE WHEN v_assignees IS NOT NULL AND array_length(v_assignees, 1) > 0
         THEN v_assignees[1] ELSE NULL END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  )
  RETURNING id INTO v_task_id;

  IF v_assignees IS NOT NULL AND array_length(v_assignees, 1) > 0 THEN
    FOREACH v_a IN ARRAY v_assignees LOOP
      INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;
      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT v_a,
               CASE WHEN p_task_type = 'report' THEN 'Bạn có yêu cầu báo cáo mới'
                    ELSE 'Bạn có công việc mới' END,
               v_creator_name || ' đã giao: ' || p_title,
               p_task_type,
               '/dashboard/tasks?id=' || v_task_id::text
        WHERE (SELECT role FROM profiles WHERE id = v_a) <> 'driver';
      END IF;
    END LOOP;
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(
  TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID
) TO authenticated;


-- =====================================================================
-- §3. task_update_status — siết quyền reopen done + truy vết last_returned
-- =====================================================================
-- Thay đổi:
--   - done → doing: chỉ admin/director (chặn TP cùng phòng + creator reopen vô hạn)
--   - submitted → doing: GIỮ NGUYÊN (creator/TP/admin/director được trả về sửa)
--   - Mọi return về (submitted→doing & done→doing): set last_returned_at + last_return_reason
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
  v_is_top_admin  BOOLEAN;  -- admin/director — quyền cao nhất, được reopen done
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
      IF NOT (v_is_manager OR v_is_creator) THEN
        RAISE EXCEPTION 'Chỉ Trưởng phòng hoặc người tạo được trả về báo cáo';
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
          -- Force complete
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

GRANT EXECUTE ON FUNCTION task_update_status(UUID, task_status, TEXT) TO authenticated;


-- =====================================================================
-- §4. task_cancel — fix link sai (/tasks/<id> → /tasks?id=<id>)
-- =====================================================================
-- Notification cũ trỏ về /dashboard/tasks/<UUID> → 404 vì route thật là ?id=<UUID>.
CREATE OR REPLACE FUNCTION task_cancel(
  p_task_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_task  tasks%ROWTYPE;
  v_actor TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT full_name INTO v_actor FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền hủy công việc này';
  END IF;
  IF v_task.status IN ('done', 'canceled') THEN
    RAISE EXCEPTION 'Công việc đã đóng';
  END IF;

  UPDATE tasks SET status = 'canceled' WHERE id = p_task_id;

  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (p_task_id, v_uid,
          'Đã hủy công việc' ||
          CASE WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
               THEN '. Lý do: ' || p_reason ELSE '' END);

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Công việc đã bị hủy',
         v_actor || ' đã hủy: ' || v_task.title ||
         CASE WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
              THEN ' — ' || p_reason ELSE '' END,
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

GRANT EXECUTE ON FUNCTION task_cancel(UUID, TEXT) TO authenticated;


-- =====================================================================
-- §5. recurring_fire_due — auto-fill TP cho target_department_ids
-- =====================================================================
-- Cùng nguyên tắc với task_create: báo cáo định kỳ giao cho phòng X → TP nhận.
-- Nếu phòng không có TP active thì SKIP phòng đó (template tiếp tục chạy, không fail toàn bộ).
CREATE OR REPLACE FUNCTION recurring_fire_due()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_template     task_recurring_templates%ROWTYPE;
  v_task_id      UUID;
  v_due          TIMESTAMPTZ;
  v_count        INT := 0;
  v_creator_name TEXT;
  v_dept         UUID;
  v_assignee     UUID;
  v_tp_id        UUID;
BEGIN
  FOR v_template IN
    SELECT * FROM task_recurring_templates
    WHERE is_active = TRUE
      AND next_run_at IS NOT NULL
      AND next_run_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    v_due := v_template.next_run_at + (v_template.due_days_after_fire || ' days')::interval;
    SELECT full_name INTO v_creator_name FROM profiles WHERE id = v_template.created_by;

    -- Sinh task cho từng department — auto-fill TP làm assignee
    IF array_length(v_template.target_department_ids, 1) > 0 THEN
      FOREACH v_dept IN ARRAY v_template.target_department_ids LOOP
        -- Tìm TP active của phòng
        SELECT id INTO v_tp_id FROM profiles
        WHERE department_id = v_dept
          AND role = 'manager'
          AND is_department_head = TRUE
          AND is_active = TRUE
        LIMIT 1;

        IF v_tp_id IS NULL THEN
          SELECT id INTO v_tp_id FROM profiles
          WHERE department_id = v_dept
            AND role = 'manager'
            AND is_active = TRUE
          LIMIT 1;
        END IF;

        -- Nếu phòng chưa có TP active → skip phòng này, log vào notifications của creator
        IF v_tp_id IS NULL THEN
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_template.created_by,
                  'Báo cáo định kỳ bị bỏ qua',
                  'Phòng không có Trưởng phòng đang hoạt động — báo cáo "' || v_template.title || '" không được sinh.',
                  v_template.task_type,
                  '/dashboard/admin/recurring');
          CONTINUE;
        END IF;

        INSERT INTO tasks (
          title, description, task_type, priority, due_date,
          department_id, assignee_id, created_by, status, metadata
        ) VALUES (
          v_template.title, v_template.description, v_template.task_type,
          v_template.priority, v_due,
          v_dept, v_tp_id, v_template.created_by, 'todo',
          jsonb_build_object('recurring_template_id', v_template.id)
        )
        RETURNING id INTO v_task_id;

        -- Ghi vào task_assignees để consistent với invariant "không bao giờ rỗng"
        INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_tp_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO notifications (user_id, title, content, type, link)
        VALUES (v_tp_id,
                'Yêu cầu báo cáo định kỳ',
                COALESCE(v_creator_name, 'Hệ thống tự động') || ' đã sinh tự động: ' || v_template.title,
                v_template.task_type,
                '/dashboard/tasks?id=' || v_task_id::text);

        v_count := v_count + 1;
      END LOOP;
    END IF;

    -- Sinh task cho từng user đích danh
    IF array_length(v_template.target_user_ids, 1) > 0 THEN
      FOREACH v_assignee IN ARRAY v_template.target_user_ids LOOP
        INSERT INTO tasks (
          title, description, task_type, priority, due_date,
          department_id, assignee_id, created_by, status, metadata
        )
        SELECT v_template.title, v_template.description, v_template.task_type,
               v_template.priority, v_due,
               p.department_id, p.id, v_template.created_by, 'todo',
               jsonb_build_object('recurring_template_id', v_template.id)
        FROM profiles p WHERE p.id = v_assignee
        RETURNING id INTO v_task_id;

        IF v_task_id IS NOT NULL THEN
          INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_assignee)
          ON CONFLICT DO NOTHING;
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_assignee,
                  'Công việc định kỳ',
                  COALESCE(v_creator_name, 'Hệ thống tự động') || ' đã giao: ' || v_template.title,
                  v_template.task_type,
                  '/dashboard/tasks?id=' || v_task_id::text);
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END IF;

    UPDATE task_recurring_templates
    SET last_fired_at = v_template.next_run_at,
        next_run_at = _recurring_next_run(
          schedule_kind, weekly_dow, weekly_time,
          monthly_dom, monthly_time, timezone,
          GREATEST(v_template.next_run_at, NOW())
        )
    WHERE id = v_template.id;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION recurring_fire_due() TO authenticated, service_role;


NOTIFY pgrst, 'reload schema';
