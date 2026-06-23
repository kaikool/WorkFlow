-- =====================================================
-- TASKS: phân quyền Trưởng phòng, quyền mẫu định kỳ, cron UTC và invariant người nhận
-- =====================================================

-- Mẫu định kỳ chỉ người tạo xem/sửa/xoá/bật tắt.
ALTER TABLE task_recurring_templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'task_recurring_templates' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_recurring_templates', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "recurring_templates_select_own" ON task_recurring_templates
FOR SELECT TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "recurring_templates_no_direct_insert" ON task_recurring_templates
FOR INSERT TO authenticated WITH CHECK (FALSE);

CREATE POLICY "recurring_templates_no_direct_update" ON task_recurring_templates
FOR UPDATE TO authenticated USING (FALSE);

CREATE POLICY "recurring_templates_no_direct_delete" ON task_recurring_templates
FOR DELETE TO authenticated USING (FALSE);

-- Visibility helper: admin/BGĐ toàn chi nhánh; Trưởng phòng thấy phòng mình;
-- manager thường chỉ thấy việc mình tạo hoặc được giao.
CREATE OR REPLACE FUNCTION user_can_see_task(p_task_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_role TEXT;
  v_dept UUID;
  v_is_head BOOLEAN;
  v_task_dept UUID;
  v_task_creator UUID;
  v_task_assignee UUID;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;

  SELECT role, department_id, COALESCE(is_department_head, FALSE)
    INTO v_role, v_dept, v_is_head
  FROM profiles
  WHERE id = p_user_id;

  IF v_role IN ('admin', 'director') THEN RETURN TRUE; END IF;

  SELECT department_id, created_by, assignee_id
    INTO v_task_dept, v_task_creator, v_task_assignee
  FROM tasks
  WHERE id = p_task_id;

  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF v_task_creator = p_user_id THEN RETURN TRUE; END IF;
  IF v_task_assignee = p_user_id THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = p_user_id) THEN RETURN TRUE; END IF;
  IF v_role = 'manager' AND v_is_head AND v_task_dept = v_dept THEN RETURN TRUE; END IF;

  RETURN FALSE;
END $$;

GRANT EXECUTE ON FUNCTION user_can_see_task(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION _resolve_default_assignee(p_dept_id UUID)
RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT p.id
  FROM profiles p
  WHERE p.department_id = p_dept_id
    AND p.is_active = TRUE
    AND p.role NOT IN ('admin', 'director', 'driver', 'secretary', 'hr_officer')
  ORDER BY
    CASE WHEN p.role = 'manager' AND p.is_department_head = TRUE THEN 0 ELSE 1 END,
    CASE WHEN p.role = 'manager' THEN 0 ELSE 1 END,
    p.full_name ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION _resolve_default_assignee(UUID) TO authenticated, service_role;

-- RLS bảng tasks dùng chung helper để tránh lệch giữa list và detail.
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "Tasks read access" ON tasks;
CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated
USING (user_can_see_task(id, auth.uid()));

DROP POLICY IF EXISTS "tasks_no_direct_insert" ON tasks;
DROP POLICY IF EXISTS "Tasks create access" ON tasks;
CREATE POLICY "tasks_no_direct_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (FALSE);

DROP POLICY IF EXISTS "tasks_no_direct_update" ON tasks;
DROP POLICY IF EXISTS "Tasks update access" ON tasks;
CREATE POLICY "tasks_no_direct_update" ON tasks FOR UPDATE TO authenticated USING (FALSE);

DROP POLICY IF EXISTS "tasks_no_direct_delete" ON tasks;
DROP POLICY IF EXISTS "Tasks delete access" ON tasks;
CREATE POLICY "tasks_no_direct_delete" ON tasks FOR DELETE TO authenticated USING (FALSE);

-- Tạo công việc: staff hub được giao việc; người nhận không bao gồm BGĐ/admin/role ngoài module.
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION task_create(
  p_title             TEXT,
  p_description       TEXT DEFAULT NULL,
  p_priority          task_priority DEFAULT 'medium',
  p_due_date          TIMESTAMPTZ DEFAULT NULL,
  p_dept_id           UUID DEFAULT NULL,
  p_assignee_ids      UUID[] DEFAULT NULL,
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_requires_approval BOOLEAN DEFAULT FALSE,
  p_batch_id          UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_dept_code    TEXT;
  v_is_hub       BOOLEAN;
  v_task_id       UUID;
  v_a             UUID;
  v_dept_assignee UUID;
  v_creator_name  TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT p.role, p.department_id, d.code, p.full_name
    INTO v_role, v_dept, v_dept_code, v_creator_name
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  WHERE p.id = v_uid;

  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);

  IF v_role IN ('driver', 'secretary', 'hr_officer') OR (v_role = 'staff' AND NOT v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo công việc';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'Vui lòng nhập tiêu đề'; END IF;
  IF p_due_date IS NULL THEN RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành'; END IF;
  IF COALESCE(array_length(p_assignee_ids, 1), 0) = 0 AND p_dept_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban';
  END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND p_dept_id IS NOT NULL AND p_dept_id IS DISTINCT FROM v_dept THEN
    RAISE EXCEPTION 'Chỉ được giao công việc trong phòng mình';
  END IF;
  IF COALESCE(array_length(p_assignee_ids, 1), 0) > 0 AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ANY(p_assignee_ids)
      AND (p.is_active IS DISTINCT FROM TRUE OR p.role IN ('admin', 'director', 'driver', 'secretary', 'hr_officer'))
  ) THEN
    RAISE EXCEPTION 'Người nhận không hợp lệ';
  END IF;
  IF COALESCE(array_length(p_assignee_ids, 1), 0) > 0
     AND v_role NOT IN ('admin', 'director')
     AND EXISTS (
       SELECT 1 FROM profiles p
       WHERE p.id = ANY(p_assignee_ids)
         AND p.department_id IS DISTINCT FROM v_dept
     ) THEN
    RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình';
  END IF;

  IF COALESCE(array_length(p_assignee_ids, 1), 0) = 0 AND p_dept_id IS NOT NULL THEN
    v_dept_assignee := _resolve_default_assignee(p_dept_id);
    IF v_dept_assignee IS NULL THEN
      RAISE EXCEPTION 'Phòng nhận chưa có Trưởng phòng hoặc người nhận mặc định';
    END IF;
  END IF;

  INSERT INTO tasks (
    title, description, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''), COALESCE(p_priority, 'medium'),
    p_due_date, p_dept_id,
    CASE WHEN COALESCE(array_length(p_assignee_ids, 1), 0) > 0 THEN p_assignee_ids[1] ELSE v_dept_assignee END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  ) RETURNING id INTO v_task_id;

  IF COALESCE(array_length(p_assignee_ids, 1), 0) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;
      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        VALUES (v_a, 'Bạn có công việc mới', v_creator_name || ' đã giao: ' || trim(p_title), 'task', '/dashboard/tasks?id=' || v_task_id::text);
      END IF;
    END LOOP;
  ELSIF p_dept_id IS NOT NULL THEN
    INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_dept_assignee)
    ON CONFLICT (task_id, user_id) DO NOTHING;

    INSERT INTO notifications (user_id, title, content, type, link)
    VALUES (v_dept_assignee, 'Phòng có công việc mới', v_creator_name || ' đã giao: ' || trim(p_title), 'task', '/dashboard/tasks?id=' || v_task_id::text);
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID) TO authenticated;

-- Phân công lại: quyền cấp phòng chỉ thuộc Trưởng phòng; người nhận phải hợp lệ và cùng phòng công việc.
DROP FUNCTION IF EXISTS task_delegate(UUID, UUID[]);

CREATE OR REPLACE FUNCTION task_delegate(
  p_task_id      UUID,
  p_assignee_ids UUID[]
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_is_head  BOOLEAN;
  v_task     tasks%ROWTYPE;
  v_actor    TEXT;
  v_a        UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id, COALESCE(is_department_head, FALSE), full_name
    INTO v_role, v_dept, v_is_head, v_actor
  FROM profiles
  WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF v_task.department_id IS NULL THEN RAISE EXCEPTION 'Công việc chưa có phòng nhận'; END IF;

  IF NOT (
    v_role IN ('admin', 'director')
    OR (v_role = 'manager' AND v_is_head AND v_task.department_id = v_dept)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền phân công công việc này';
  END IF;

  IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  IF EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ANY(p_assignee_ids)
      AND (
        p.is_active IS DISTINCT FROM TRUE
        OR p.role IN ('admin', 'director', 'driver', 'secretary', 'hr_officer')
        OR p.department_id IS DISTINCT FROM v_task.department_id
      )
  ) THEN
    RAISE EXCEPTION 'Người nhận không hợp lệ hoặc không thuộc phòng nhận việc';
  END IF;

  DELETE FROM task_assignees WHERE task_id = p_task_id;
  FOREACH v_a IN ARRAY p_assignee_ids LOOP
    INSERT INTO task_assignees (task_id, user_id)
    VALUES (p_task_id, v_a)
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;

  UPDATE tasks
  SET assignee_id = p_assignee_ids[1],
      status = CASE WHEN v_task.status = 'todo' THEN 'doing'::task_status ELSE v_task.status END
  WHERE id = p_task_id;

  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT a,
         'Bạn được phân công công việc mới',
         v_actor || ' đã phân công: ' || v_task.title,
         'task',
         '/dashboard/tasks?id=' || p_task_id::text
  FROM unnest(p_assignee_ids) a
  WHERE a <> v_uid;
END $$;

GRANT EXECUTE ON FUNCTION task_delegate(UUID, UUID[]) TO authenticated;

-- Dashboard task: non-head manager luôn scope mine; Trưởng phòng mới scope phòng.
DROP FUNCTION IF EXISTS tasks_dashboard(TEXT, JSONB);
DROP FUNCTION IF EXISTS tasks_dashboard(TEXT, JSONB, INT, INT);

CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT DEFAULT 'mine',
  p_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_is_head  BOOLEAN;
  v_now      TIMESTAMPTZ := NOW();
  v_counts   JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id, COALESCE(is_department_head, FALSE)
    INTO v_role, v_dept, v_is_head
  FROM profiles
  WHERE id = v_uid;

  IF v_role = 'staff' OR (v_role = 'manager' AND NOT v_is_head) THEN
    p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN
    p_scope := 'dept';
  END IF;

  WITH task_set AS (
    SELECT t.*,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue
    FROM tasks t
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND user_can_see_task(t.id, v_uid) AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept' AND v_role = 'manager' AND v_is_head AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
  ), counts AS (
    SELECT jsonb_build_object(
      'todo',              COUNT(*) FILTER (WHERE status = 'todo'),
      'doing',             COUNT(*) FILTER (WHERE status = 'doing'),
      'submitted',         COUNT(*) FILTER (WHERE status = 'submitted'),
      'done',              COUNT(*) FILTER (WHERE status = 'done'),
      'canceled',          COUNT(*) FILTER (WHERE status = 'canceled'),
      'overdue',           COUNT(*) FILTER (WHERE is_overdue),
      'awaiting_approval', COUNT(*) FILTER (WHERE status = 'submitted'),
      'extensions_pending', (SELECT COUNT(*) FROM task_extension_requests er WHERE er.status = 'pending' AND user_can_see_task(er.task_id, v_uid))
    ) AS val FROM task_set
  ), task_list AS (
    SELECT t.id, t.title, t.description, t.status, t.priority,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           t.requires_approval, t.batch_id, t.is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url, 'department_id', c.department_id) AS creator,
           COALESCE(a.assignees, '[]'::jsonb) AS assignees
    FROM task_set t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN profiles c ON c.id = t.created_by
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url, 'department_id', p.department_id, 'role', p.role, 'is_department_head', p.is_department_head)) AS assignees
      FROM task_assignees ta
      JOIN profiles p ON p.id = ta.user_id
      WHERE ta.task_id = t.id
    ) a ON true
    ORDER BY t.is_overdue DESC, t.due_date ASC NULLS LAST, t.created_at DESC
    LIMIT 50
  ), resource_view AS (
    SELECT COALESCE(jsonb_agg(r.* ORDER BY r.active_count DESC), '[]'::jsonb) AS val
    FROM (
      SELECT ta.user_id, p.full_name, p.avatar_url,
             COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) AS active_count,
             COUNT(*) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS overdue_count
      FROM task_assignees ta
      JOIN tasks t ON t.id = ta.task_id
      JOIN profiles p ON p.id = ta.user_id
      WHERE t.is_archived = FALSE
        AND ((p_scope = 'dept' AND v_role = 'manager' AND v_is_head AND t.department_id = v_dept)
          OR (p_scope = 'branch' AND v_role IN ('admin', 'director')))
      GROUP BY ta.user_id, p.full_name, p.avatar_url
      LIMIT 20
    ) r
  )
  SELECT jsonb_build_object(
    'counts', COALESCE(c.val, '{}'::jsonb),
    'lists', COALESCE((SELECT jsonb_agg(row_to_json(tl.*) ORDER BY tl.is_overdue DESC, tl.due_date NULLS LAST, tl.created_at DESC) FROM task_list tl), '[]'::jsonb),
    'resource_view', CASE WHEN p_scope = 'mine' THEN '[]'::jsonb ELSE COALESCE((SELECT val FROM resource_view), '[]'::jsonb) END,
    'scope', p_scope,
    'role', v_role
  ) INTO v_counts
  FROM counts c;

  RETURN v_counts;
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB) TO authenticated;

-- Home dashboard counters dùng cùng visibility.
CREATE OR REPLACE FUNCTION dashboard_summary()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_now       TIMESTAMPTZ := NOW();
  v_today_end TIMESTAMPTZ := date_trunc('day', NOW()) + INTERVAL '1 day';
  v_counts    JSONB;
  v_today     JSONB;
  v_docs      JSONB;
  v_leaves    JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;

  WITH visible AS (
    SELECT t.id, t.batch_id, t.status, t.priority, t.due_date, t.updated_at
    FROM tasks t
    WHERE t.is_archived = FALSE
      AND user_can_see_task(t.id, v_uid)
  )
  SELECT jsonb_build_object(
    'active', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status IN ('todo','doing','submitted')),
    'urgent', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status IN ('todo','doing','submitted') AND priority = 'high'),
    'overdue', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'done_today', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'done' AND updated_at >= date_trunc('day', v_now))
  ) INTO v_counts
  FROM visible;

  SELECT COALESCE(jsonb_agg(row_to_json(top.*) ORDER BY top.due_date ASC NULLS LAST), '[]'::jsonb)
  INTO v_today
  FROM (
    SELECT * FROM (
      SELECT DISTINCT ON (COALESCE(t.batch_id, t.id))
             t.id, t.title, t.status, t.priority, t.due_date,
             (t.due_date < v_now) AS is_overdue
      FROM tasks t
      WHERE t.is_archived = FALSE
        AND t.status IN ('todo','doing','submitted')
        AND (t.due_date IS NULL OR t.due_date < v_today_end)
        AND user_can_see_task(t.id, v_uid)
      ORDER BY COALESCE(t.batch_id, t.id), t.due_date ASC NULLS LAST
    ) deduped
    ORDER BY deduped.due_date ASC NULLS LAST
    LIMIT 10
  ) top;

  SELECT COALESCE(jsonb_agg(row_to_json(d.*)), '[]'::jsonb)
  INTO v_docs
  FROM (
    SELECT d.id, d.short_code, d.title, d.status, d.created_at, d.updated_at,
           d.current_assignee_id, d.creator_id,
           (SELECT row_to_json(c.*) FROM (SELECT id, name, sla_hours, color FROM document_categories WHERE id = d.category_id) c) AS category,
           (SELECT COALESCE(jsonb_agg(row_to_json(h.*)), '[]'::jsonb)
            FROM (SELECT id, document_id, sender_id, receiver_id, status, sent_at, received_at
                  FROM document_handovers WHERE document_id = d.id ORDER BY sent_at DESC) h) AS handovers
    FROM documents d
    WHERE d.status <> 'COMPLETED'
      AND ((d.current_assignee_id = v_uid AND NOT EXISTS (
             SELECT 1 FROM document_handovers h WHERE h.document_id = d.id AND h.sender_id = v_uid AND h.status = 'PENDING'))
        OR EXISTS (SELECT 1 FROM document_handovers h WHERE h.document_id = d.id AND h.receiver_id = v_uid AND h.status = 'PENDING'))
    ORDER BY d.updated_at DESC
    LIMIT 5
  ) d;

  SELECT COALESCE(jsonb_agg(row_to_json(l.*) ORDER BY l.start_time), '[]'::jsonb)
  INTO v_leaves
  FROM (
    SELECT s.id, s.title, s.status, s.start_time, s.end_time,
           s.created_by, p.full_name AS creator_name, p.avatar_url AS creator_avatar
    FROM schedules s
    LEFT JOIN profiles p ON p.id = s.created_by
    WHERE s.type = 'leave'
      AND s.status IN ('approved', 'in_progress')
      AND s.start_time <= NOW()
      AND s.end_time >= date_trunc('day', NOW())
    ORDER BY s.start_time
    LIMIT 20
  ) l;

  RETURN jsonb_build_object(
    'counts', COALESCE(v_counts, jsonb_build_object('active',0,'urgent',0,'overdue',0,'done_today',0)),
    'today_tasks', COALESCE(v_today, '[]'::jsonb),
    'pending_docs', COALESCE(v_docs, '[]'::jsonb),
    'today_leaves', COALESCE(v_leaves, '[]'::jsonb),
    'role', v_role
  );
END $$;

GRANT EXECUTE ON FUNCTION dashboard_summary() TO authenticated;

-- Sửa/xoá: creator + Trưởng phòng của creator + admin/BGĐ.
CREATE OR REPLACE FUNCTION task_update(
  p_task_id     UUID,
  p_title       TEXT,
  p_description TEXT DEFAULT NULL,
  p_priority    task_priority DEFAULT 'medium',
  p_due_date    TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_is_head BOOLEAN;
  v_task tasks%ROWTYPE;
  v_creator_dept UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, COALESCE(is_department_head, FALSE) INTO v_role, v_dept, v_is_head FROM profiles WHERE id = v_uid;
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF v_task.status = 'canceled' OR v_task.is_archived THEN RAISE EXCEPTION 'Không thể sửa công việc đã đóng hoặc đã lưu trữ'; END IF;
  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;
  IF NOT (v_role IN ('admin','director') OR v_task.created_by = v_uid OR (v_role = 'manager' AND v_is_head AND v_dept = v_creator_dept)) THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa công việc này';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN RAISE EXCEPTION 'Vui lòng nhập tiêu đề'; END IF;
  IF p_due_date IS NULL THEN RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành'; END IF;
  UPDATE tasks
  SET title = trim(p_title), description = NULLIF(trim(COALESCE(p_description, '')), ''),
      priority = COALESCE(p_priority, 'medium'), due_date = p_due_date, updated_at = NOW()
  WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_update(UUID, TEXT, TEXT, task_priority, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION task_delete(p_task_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_is_head BOOLEAN;
  v_task tasks%ROWTYPE;
  v_creator_dept UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, COALESCE(is_department_head, FALSE) INTO v_role, v_dept, v_is_head FROM profiles WHERE id = v_uid;
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;
  IF NOT (v_role IN ('admin','director') OR v_task.created_by = v_uid OR (v_role = 'manager' AND v_is_head AND v_dept = v_creator_dept)) THEN
    RAISE EXCEPTION 'Bạn không có quyền xoá công việc này';
  END IF;
  DELETE FROM tasks WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_delete(UUID) TO authenticated;

-- Trạng thái: quyền cấp phòng chỉ thuộc Trưởng phòng.
CREATE OR REPLACE FUNCTION task_update_status(
  p_task_id UUID,
  p_new_status task_status,
  p_comment TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_is_head BOOLEAN;
  v_task tasks%ROWTYPE;
  v_creator_dept UUID;
  v_is_assignee BOOLEAN;
  v_is_top_admin BOOLEAN;
  v_is_head_manager BOOLEAN;
  v_is_creator BOOLEAN;
  v_is_creator_head BOOLEAN;
  v_actor_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, COALESCE(is_department_head, FALSE), full_name
    INTO v_role, v_dept, v_is_head, v_actor_name
  FROM profiles WHERE id = v_uid;
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN RAISE EXCEPTION 'Bạn không có quyền với công việc này'; END IF;

  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;
  v_is_assignee := v_task.assignee_id = v_uid OR EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid);
  v_is_top_admin := v_role IN ('admin','director');
  v_is_head_manager := v_is_top_admin OR (v_role = 'manager' AND v_is_head AND v_task.department_id = v_dept);
  v_is_creator := v_task.created_by = v_uid;
  v_is_creator_head := v_role = 'manager' AND v_is_head AND v_dept = v_creator_dept;

  IF v_task.status = p_new_status THEN RETURN; END IF;

  IF p_new_status = 'canceled' THEN
    RAISE EXCEPTION 'Hãy dùng chức năng huỷ công việc';
  ELSIF p_new_status = 'doing' THEN
    IF v_task.status NOT IN ('todo','submitted','done') THEN RAISE EXCEPTION 'Không thể chuyển sang Đang làm từ trạng thái hiện tại'; END IF;
    IF v_task.status IN ('submitted','done') THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN RAISE EXCEPTION 'Vui lòng nhập lý do'; END IF;
      IF NOT (v_is_head_manager OR v_is_creator OR v_is_creator_head) THEN RAISE EXCEPTION 'Bạn không có quyền trả về công việc này'; END IF;
      UPDATE tasks SET status = p_new_status, last_returned_at = NOW(), last_return_reason = p_comment WHERE id = p_task_id;
    ELSE
      IF NOT (v_is_assignee OR v_is_head_manager) THEN RAISE EXCEPTION 'Bạn không có quyền chuyển trạng thái'; END IF;
      UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
    END IF;
  ELSIF p_new_status = 'submitted' THEN
    IF NOT v_task.requires_approval THEN RAISE EXCEPTION 'Công việc này không cần duyệt, hãy bấm Hoàn thành'; END IF;
    IF NOT v_is_assignee THEN RAISE EXCEPTION 'Chỉ người được giao mới được gửi kết quả'; END IF;
    IF v_task.status <> 'doing' THEN RAISE EXCEPTION 'Công việc cần đang thực hiện trước khi gửi kết quả'; END IF;
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  ELSIF p_new_status = 'done' THEN
    IF v_task.requires_approval AND v_task.status = 'submitted' THEN
      IF NOT (v_is_head_manager OR v_is_creator OR v_is_creator_head) THEN RAISE EXCEPTION 'Bạn không có quyền duyệt kết quả'; END IF;
    ELSIF v_task.status IN ('todo','doing') THEN
      IF NOT (v_is_assignee OR v_is_creator OR v_is_creator_head OR v_is_top_admin) THEN RAISE EXCEPTION 'Bạn không có quyền hoàn thành công việc này'; END IF;
    ELSE
      RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
    END IF;
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  ELSIF p_new_status = 'todo' THEN
    IF NOT v_is_head_manager THEN RAISE EXCEPTION 'Chỉ Trưởng phòng được đặt lại trạng thái Chưa làm'; END IF;
    UPDATE tasks SET status = p_new_status WHERE id = p_task_id;
  ELSE
    RAISE EXCEPTION 'Trạng thái không hợp lệ: %', p_new_status;
  END IF;

  IF p_new_status = 'done' THEN
    INSERT INTO task_comments (task_id, user_id, content) VALUES (p_task_id, v_uid, v_actor_name || ' đã hoàn thành.');
  ELSIF p_new_status = 'doing' AND p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content) VALUES (p_task_id, v_uid, v_actor_name || ' trả về công việc. Lý do: ' || p_comment);
  ELSIF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content) VALUES (p_task_id, v_uid, p_comment);
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION task_update_status(UUID, task_status, TEXT) TO authenticated;

-- Gia hạn: Trưởng phòng phòng nhận + creator + admin/BGĐ.
CREATE OR REPLACE FUNCTION task_decide_extension(
  p_extension_id UUID,
  p_approve BOOLEAN,
  p_comment TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_is_head BOOLEAN;
  v_ext task_extension_requests%ROWTYPE;
  v_task tasks%ROWTYPE;
  v_actor TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, COALESCE(is_department_head, FALSE), full_name INTO v_role, v_dept, v_is_head, v_actor FROM profiles WHERE id = v_uid;
  SELECT * INTO v_ext FROM task_extension_requests WHERE id = p_extension_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy yêu cầu gia hạn'; END IF;
  IF v_ext.status <> 'pending' THEN RAISE EXCEPTION 'Yêu cầu đã được xử lý'; END IF;
  SELECT * INTO v_task FROM tasks WHERE id = v_ext.task_id;
  IF NOT (v_role IN ('admin','director') OR v_task.created_by = v_uid OR (v_role = 'manager' AND v_is_head AND v_task.department_id = v_dept)) THEN
    RAISE EXCEPTION 'Bạn không có quyền duyệt yêu cầu này';
  END IF;
  UPDATE task_extension_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_uid, review_comment = p_comment, decided_at = NOW()
  WHERE id = p_extension_id;
  IF p_approve THEN UPDATE tasks SET due_date = v_ext.new_due_date WHERE id = v_ext.task_id; END IF;
  INSERT INTO notifications (user_id, title, content, type, link)
  VALUES (v_ext.requested_by,
          CASE WHEN p_approve THEN 'Đã duyệt gia hạn' ELSE 'Đã từ chối gia hạn' END,
          v_actor || ' — "' || v_task.title || '"' || CASE WHEN p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN ': ' || p_comment ELSE '' END,
          'extension', '/dashboard/tasks?id=' || v_ext.task_id::text);
END $$;

GRANT EXECUTE ON FUNCTION task_decide_extension(UUID, BOOLEAN, TEXT) TO authenticated;

-- Mẫu định kỳ: chỉ creator sửa/xoá/bật tắt; target user không gồm BGĐ/admin/role ngoài module.
CREATE OR REPLACE FUNCTION recurring_template_delete(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  DELETE FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có quyền hoặc không tìm thấy'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_delete(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION recurring_template_toggle(p_id UUID, p_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  UPDATE task_recurring_templates SET is_active = p_active WHERE id = p_id AND created_by = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có quyền hoặc không tìm thấy'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_toggle(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION recurring_template_upsert(
  p_title                 TEXT,
  p_description           TEXT,
  p_priority              task_priority DEFAULT 'medium',
  p_target_department_ids UUID[] DEFAULT '{}',
  p_target_user_ids       UUID[] DEFAULT '{}',
  p_schedule_kind         TEXT DEFAULT 'weekly',
  p_weekly_dow            INT DEFAULT NULL,
  p_weekly_time           TEXT DEFAULT NULL,
  p_monthly_dom           INT DEFAULT NULL,
  p_monthly_time          TEXT DEFAULT NULL,
  p_timezone              TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  p_due_days_after_fire   INT DEFAULT 7,
  p_is_active             BOOLEAN DEFAULT TRUE,
  p_default_assignee_id   UUID DEFAULT NULL,
  p_id                    UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_dept_code TEXT;
  v_is_hub BOOLEAN;
  v_id UUID;
  v_next TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT p.role, p.department_id, d.code INTO v_role, v_dept, v_dept_code
  FROM profiles p LEFT JOIN departments d ON d.id = p.department_id WHERE p.id = v_uid;
  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);
  IF v_role IN ('driver','secretary','hr_officer') OR (v_role = 'staff' AND NOT v_is_hub) THEN RAISE EXCEPTION 'Bạn không có quyền tạo công việc định kỳ'; END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid) THEN RAISE EXCEPTION 'Bạn không có quyền sửa mẫu định kỳ này'; END IF;
  IF COALESCE(array_length(p_target_department_ids,1),0) = 0 AND COALESCE(array_length(p_target_user_ids,1),0) = 0 THEN RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban'; END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND EXISTS (SELECT 1 FROM unnest(p_target_department_ids) AS target_dept_id WHERE target_dept_id IS DISTINCT FROM v_dept) THEN RAISE EXCEPTION 'Chỉ được tạo công việc định kỳ trong phòng mình'; END IF;
  IF COALESCE(array_length(p_target_user_ids,1),0) > 0 AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = ANY(p_target_user_ids) AND (p.is_active IS DISTINCT FROM TRUE OR p.role IN ('admin','director','driver','secretary','hr_officer'))
  ) THEN RAISE EXCEPTION 'Người nhận không hợp lệ'; END IF;
  IF COALESCE(array_length(p_target_user_ids,1),0) > 0 AND v_role NOT IN ('admin','director') AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = ANY(p_target_user_ids) AND p.department_id IS DISTINCT FROM v_dept
  ) THEN RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình'; END IF;
  IF p_default_assignee_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_default_assignee_id
      AND (
        p.is_active IS DISTINCT FROM TRUE
        OR p.role IN ('admin','director','driver','secretary','hr_officer')
      )
  ) THEN RAISE EXCEPTION 'Người nhận mặc định không hợp lệ'; END IF;
  IF p_default_assignee_id IS NOT NULL AND v_role NOT IN ('admin','director') AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_default_assignee_id
      AND p.department_id IS DISTINCT FROM v_dept
  ) THEN RAISE EXCEPTION 'Chỉ được chọn người nhận mặc định trong phòng mình'; END IF;
  IF p_default_assignee_id IS NOT NULL
     AND COALESCE(array_length(p_target_department_ids,1),0) > 0
     AND NOT EXISTS (
       SELECT 1 FROM profiles p
       WHERE p.id = p_default_assignee_id
         AND p.department_id = ANY(p_target_department_ids)
     ) THEN
    RAISE EXCEPTION 'Người nhận mặc định phải thuộc phòng ban nhận việc';
  END IF;

  v_next := _recurring_next_run(p_schedule_kind, p_weekly_dow, p_weekly_time, p_monthly_dom, p_monthly_time, p_timezone, NOW());

  IF p_id IS NOT NULL THEN
    UPDATE task_recurring_templates SET
      title = trim(p_title), description = NULLIF(trim(COALESCE(p_description,'')), ''), priority = p_priority,
      target_department_ids = p_target_department_ids, target_user_ids = p_target_user_ids,
      schedule_kind = p_schedule_kind, weekly_dow = p_weekly_dow, weekly_time = p_weekly_time::TIME,
      monthly_dom = p_monthly_dom, monthly_time = p_monthly_time::TIME, timezone = p_timezone,
      due_days_after_fire = p_due_days_after_fire, is_active = p_is_active,
      default_assignee_id = p_default_assignee_id, next_run_at = v_next
    WHERE id = p_id AND created_by = v_uid RETURNING id INTO v_id;
  ELSE
    INSERT INTO task_recurring_templates (
      title, description, priority, target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire, created_by, is_active, default_assignee_id, next_run_at
    ) VALUES (
      trim(p_title), NULLIF(trim(COALESCE(p_description,'')), ''), p_priority, p_target_department_ids, p_target_user_ids,
      p_schedule_kind, p_weekly_dow, p_weekly_time::TIME, p_monthly_dom, p_monthly_time::TIME,
      p_timezone, p_due_days_after_fire, v_uid, p_is_active, p_default_assignee_id, v_next
    ) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID, UUID) TO authenticated;

-- Worker sinh mỗi task theo từng phòng hoặc từng cán bộ được giao.
CREATE OR REPLACE FUNCTION recurring_fire_due()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
  v_t RECORD;
  v_uid UUID;
  v_task_id UUID;
  v_a UUID;
  v_dept_id UUID;
  v_target_id UUID;
BEGIN
  FOR v_t IN
    SELECT * FROM task_recurring_templates
    WHERE is_active = TRUE AND next_run_at <= NOW()
    ORDER BY next_run_at ASC
    LIMIT 20
  LOOP
    v_uid := COALESCE(v_t.created_by, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));
    IF v_uid IS NULL THEN CONTINUE; END IF;

    UPDATE task_recurring_templates
    SET last_fired_at = NOW(),
        next_run_at = _recurring_next_run(v_t.schedule_kind, v_t.weekly_dow, v_t.weekly_time, v_t.monthly_dom, v_t.monthly_time, v_t.timezone, NOW())
    WHERE id = v_t.id;

    IF COALESCE(array_length(v_t.target_department_ids, 1), 0) > 0 THEN
      FOREACH v_dept_id IN ARRAY v_t.target_department_ids LOOP
        SELECT CASE
          WHEN EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = v_t.default_assignee_id
              AND p.department_id = v_dept_id
              AND p.is_active = TRUE
              AND p.role NOT IN ('admin','director','driver','secretary','hr_officer')
          ) THEN v_t.default_assignee_id
          ELSE _resolve_default_assignee(v_dept_id)
        END INTO v_target_id;
        IF v_target_id IS NULL THEN CONTINUE; END IF;
        INSERT INTO tasks (title, description, priority, due_date, department_id, assignee_id, created_by, status, metadata, is_archived, requires_approval)
        VALUES (v_t.title, v_t.description, v_t.priority, NOW() + (v_t.due_days_after_fire || ' days')::INTERVAL,
                v_dept_id, v_target_id, v_uid, 'todo'::task_status, jsonb_build_object('from_recurring', true, 'recurring_template_id', v_t.id), FALSE, TRUE)
        RETURNING id INTO v_task_id;
        INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_target_id) ON CONFLICT DO NOTHING;
        INSERT INTO notifications (user_id, title, content, type, link)
        VALUES (v_target_id, 'Công việc định kỳ', 'Hệ thống đã sinh: ' || v_t.title, 'task', '/dashboard/tasks?id=' || v_task_id::text);
        v_count := v_count + 1;
      END LOOP;
    END IF;

    IF COALESCE(array_length(v_t.target_user_ids, 1), 0) > 0 THEN
      FOREACH v_a IN ARRAY v_t.target_user_ids LOOP
        INSERT INTO tasks (title, description, priority, due_date, department_id, assignee_id, created_by, status, metadata, is_archived, requires_approval)
        SELECT v_t.title, v_t.description, v_t.priority, NOW() + (v_t.due_days_after_fire || ' days')::INTERVAL,
               p.department_id, p.id, v_uid, 'todo'::task_status, jsonb_build_object('from_recurring', true, 'recurring_template_id', v_t.id), FALSE, TRUE
        FROM profiles p
        WHERE p.id = v_a AND p.is_active = TRUE AND p.role NOT IN ('admin','director','driver','secretary','hr_officer')
        RETURNING id INTO v_task_id;
        IF v_task_id IS NOT NULL THEN
          INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a) ON CONFLICT DO NOTHING;
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_a, 'Công việc định kỳ', 'Hệ thống đã sinh: ' || v_t.title, 'task', '/dashboard/tasks?id=' || v_task_id::text);
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION recurring_fire_due() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
