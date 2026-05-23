-- =====================================================================
-- MIGRATION: HUB DEPT PERMISSIONS + PAGINATION
-- =====================================================================
-- 1) Phòng đầu mối (code IN 13618,13602,13605,13609,13603) — cán bộ
--    được giao việc / yêu cầu báo cáo cho phòng khác (kể cả Staff).
-- 2) tasks_dashboard: thêm p_limit + p_offset cho pagination "Tải thêm".
-- =====================================================================

-- Helper inline check phòng đầu mối — tránh thêm bảng config
CREATE OR REPLACE FUNCTION _is_hub_department(p_dept_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code TEXT;
BEGIN
  IF p_dept_id IS NULL THEN RETURN FALSE; END IF;
  SELECT code INTO v_code FROM departments WHERE id = p_dept_id;
  RETURN v_code IN ('13618', '13602', '13605', '13609', '13603');
END $$;

GRANT EXECUTE ON FUNCTION _is_hub_department(UUID) TO authenticated;


-- =====================================================================
-- task_create: nới quyền cho hub
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

  -- Staff phòng thường: chỉ tự giao mình + chỉ luồng A.
  -- Staff phòng đầu mối: được giao cross-dept + tạo report.
  IF v_role = 'staff' AND NOT v_is_hub THEN
    IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) != 1
       OR p_assignee_ids[1] != v_uid THEN
      RAISE EXCEPTION 'Bạn chỉ được tự ghi chú việc cho mình';
    END IF;
    IF p_task_type = 'report' THEN
      RAISE EXCEPTION 'Nhân viên không được tạo yêu cầu báo cáo';
    END IF;
    IF p_dept_id IS NULL THEN p_dept_id := v_dept; END IF;
  END IF;

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


-- =====================================================================
-- tasks_dashboard: pagination + counts riêng (counts không bị paginated)
-- =====================================================================
CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT  DEFAULT 'mine',
  p_filter JSONB DEFAULT '{}'::jsonb,
  p_limit  INT   DEFAULT 50,
  p_offset INT   DEFAULT 0
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_counts   JSONB;
  v_lists    JSONB;
  v_resource JSONB;
  v_total    INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  IF v_role = 'staff' THEN
    p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN
    p_scope := 'dept';
  END IF;

  p_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  p_offset := GREATEST(COALESCE(p_offset, 0), 0);

  WITH visible AS (
    SELECT t.* FROM tasks t
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
  )
  SELECT jsonb_build_object(
    'todo',              COUNT(*) FILTER (WHERE status = 'todo'),
    'doing',             COUNT(*) FILTER (WHERE status = 'doing'),
    'submitted',         COUNT(*) FILTER (WHERE status = 'submitted'),
    'done',              COUNT(*) FILTER (WHERE status = 'done'),
    'canceled',          COUNT(*) FILTER (WHERE status = 'canceled'),
    'overdue',           COUNT(*) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'awaiting_approval', COUNT(*) FILTER (WHERE status = 'submitted'),
    'extensions_pending', (
      SELECT COUNT(*) FROM task_extension_requests er
      WHERE er.status = 'pending'
        AND user_can_see_task(er.task_id, v_uid)
    ),
    'total_visible', COUNT(*)
  )
  INTO v_counts FROM visible;

  v_total := COALESCE((v_counts->>'total_visible')::int, 0);

  SELECT jsonb_agg(row_to_json(x.*) ORDER BY x.sort_order)
  INTO v_lists
  FROM (
    SELECT t.id, t.title, t.description, t.status, t.priority, t.task_type,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           t.requires_approval, t.batch_id,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url) AS creator,
           (SELECT jsonb_agg(jsonb_build_object(
                'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url))
            FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id
            WHERE ta.task_id = t.id) AS assignees,
           ROW_NUMBER() OVER (
             ORDER BY (t.due_date < v_now AND t.status NOT IN ('done','canceled')) DESC,
                      t.due_date ASC NULLS LAST,
                      t.created_at DESC
           ) AS sort_order
    FROM tasks t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN profiles    c ON c.id = t.created_by
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (
          t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta
                     WHERE ta.task_id = t.id AND ta.user_id = v_uid)
        ))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
        OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
      )
    ORDER BY sort_order
    LIMIT p_limit OFFSET p_offset
  ) x;

  IF v_role IN ('manager', 'admin', 'director') THEN
    SELECT jsonb_agg(row_to_json(r.*) ORDER BY r.active_count DESC)
    INTO v_resource
    FROM (
      SELECT p.id AS user_id, p.full_name, p.avatar_url,
             COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) AS active_count,
             COUNT(*) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS overdue_count
      FROM task_assignees ta
      JOIN tasks t   ON t.id = ta.task_id
      JOIN profiles p ON p.id = ta.user_id
      WHERE t.is_archived = FALSE
        AND ((p_scope = 'dept'   AND t.department_id = v_dept)
             OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
             OR (p_scope = 'mine'   AND p.id = v_uid))
      GROUP BY p.id, p.full_name, p.avatar_url
      HAVING COUNT(*) FILTER (WHERE t.status NOT IN ('done','canceled')) > 0
      LIMIT 20
    ) r;
  ELSE
    v_resource := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'counts',        COALESCE(v_counts,   '{}'::jsonb),
    'lists',         COALESCE(v_lists,    '[]'::jsonb),
    'resource_view', COALESCE(v_resource, '[]'::jsonb),
    'scope',         p_scope,
    'role',          v_role,
    'limit',         p_limit,
    'offset',        p_offset,
    'has_more',      (p_offset + p_limit) < v_total
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB, INT, INT) TO authenticated;

NOTIFY pgrst, 'reload schema';
