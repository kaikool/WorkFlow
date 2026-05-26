-- Fix lỗi tự ghi chú của staff: Trưởng phòng vẫn nhìn thấy
-- Giải pháp: Ghi đè department_id = NULL cho các self-note của staff (vì tự ghi chú mang tính cá nhân, không thuộc phòng ban)

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
      -- [FIX] Force department_id = NULL để Trưởng phòng không thấy được self-note của staff qua bộ đếm phòng
      p_dept_id := NULL;
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
    END IF;
  ELSIF p_task_type = 'report' AND NOT v_is_hub THEN
    IF p_dept_id IS NOT NULL AND p_dept_id <> v_dept THEN
      RAISE EXCEPTION 'Trưởng phòng không thuộc phòng đầu mối chỉ được yêu cầu báo cáo trong phòng mình';
    END IF;
  END IF;

  IF p_task_type = 'task' AND (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0) THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  -- ─── AUTO-FILL TP cho report giao cho phòng không kèm assignee ───
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

-- Backfill data cũ: set department_id = NULL cho các task tự ghi chú của staff
UPDATE tasks
SET department_id = NULL
WHERE task_type = 'task'
  AND created_by IN (SELECT id FROM profiles WHERE role = 'staff')
  AND assignee_id = created_by
  AND department_id IS NOT NULL;
