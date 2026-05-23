-- =====================================================================
-- MIGRATION: SPLIT permission cho Giao việc (task) vs Yêu cầu báo cáo (report)
-- =====================================================================
-- Quy tắc đúng (sửa lại):
--   • Giao việc (task_type='task'): chỉ admin/director/manager.
--     Staff (kể cả phòng đầu mối) → chỉ tự ghi chú.
--   • Yêu cầu báo cáo (task_type='report'): admin/director/manager + staff hub.
-- =====================================================================

DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);

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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_creator_name
  FROM profiles WHERE id = v_uid;
  v_is_hub := _is_hub_department(v_dept);

  IF v_role IN ('driver', 'secretary') THEN
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
      -- Staff (kể cả hub) chỉ tự ghi chú task cho mình
      IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) != 1
         OR p_assignee_ids[1] != v_uid THEN
        RAISE EXCEPTION 'Bạn chỉ được tự ghi chú việc cho mình';
      END IF;
      IF p_dept_id IS NULL THEN p_dept_id := v_dept; END IF;
    ELSIF p_task_type = 'report' THEN
      -- Staff phải thuộc phòng đầu mối mới được tạo yêu cầu báo cáo
      IF NOT v_is_hub THEN
        RAISE EXCEPTION 'Bạn không có quyền yêu cầu báo cáo';
      END IF;
      -- Hub staff: cross-dept OK
    END IF;
  ELSIF v_role = 'manager' THEN
    IF p_task_type = 'task' AND p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
      -- Manager (kể cả hub) chỉ giao task trong phòng mình
      IF EXISTS (
        SELECT 1 FROM unnest(p_assignee_ids) a
        JOIN profiles pr ON pr.id = a
        WHERE pr.department_id IS DISTINCT FROM v_dept
      ) THEN
        RAISE EXCEPTION 'Trưởng phòng chỉ được giao việc trong phòng mình';
      END IF;
    ELSIF p_task_type = 'report' AND NOT v_is_hub THEN
      -- Manager non-hub: yêu cầu báo cáo chỉ trong phòng mình
      IF p_dept_id IS NOT NULL AND p_dept_id <> v_dept THEN
        RAISE EXCEPTION 'Trưởng phòng không thuộc phòng đầu mối chỉ được yêu cầu báo cáo trong phòng mình';
      END IF;
    END IF;
  END IF;
  -- admin/director: không có restriction

  IF p_task_type = 'task' AND (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0) THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  INSERT INTO tasks (
    title, description, task_type, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    p_title, p_description, p_task_type,
    COALESCE(p_priority, 'medium'), p_due_date, p_dept_id,
    CASE WHEN p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0
         THEN p_assignee_ids[1] ELSE NULL END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  )
  RETURNING id INTO v_task_id;

  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
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
  ELSIF p_task_type = 'report' AND p_dept_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, content, type, link)
    SELECT p.id, 'Phòng có yêu cầu báo cáo mới',
           v_creator_name || ' đã yêu cầu: ' || p_title,
           'report', '/dashboard/tasks?id=' || v_task_id::text
    FROM profiles p
    WHERE p.department_id = p_dept_id
      AND p.role <> 'driver'
      AND (p.role = 'manager' OR p.is_department_head = TRUE)
      AND p.id <> v_uid;
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(
  TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID
) TO authenticated;

NOTIFY pgrst, 'reload schema';
