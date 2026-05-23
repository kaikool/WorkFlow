-- =====================================================================
-- MIGRATION: HUB PERMISSION cho Analytics + Recurring RPCs
-- =====================================================================
-- Fix: client cho phép staff hub, nhưng server vẫn block.
-- Đồng bộ check: staff hub (code IN 13618/13602/13605/13609/13603)
-- được xem analytics + quản lý recurring templates.
-- =====================================================================

CREATE OR REPLACE FUNCTION tasks_analytics(
  p_from DATE,
  p_to   DATE,
  p_dept_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_is_hub    BOOLEAN;
  v_now       TIMESTAMPTZ := NOW();
  v_scope_dept UUID;
  v_totals    JSONB;
  v_daily     JSONB;
  v_by_dept   JSONB;
  v_top       JSONB;
  v_recur     INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;
  v_is_hub := _is_hub_department(v_dept);

  IF v_role NOT IN ('admin', 'director', 'manager') AND NOT (v_role = 'staff' AND v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền xem báo cáo';
  END IF;

  -- Scope:
  --   • admin/director/staff-hub/manager-hub → toàn nhánh (có thể filter dept)
  --   • manager non-hub → chỉ dept mình
  IF v_role = 'manager' AND NOT v_is_hub THEN
    v_scope_dept := v_dept;
  ELSE
    v_scope_dept := p_dept_id;
  END IF;

  WITH base AS (
    SELECT * FROM tasks
    WHERE created_at::date BETWEEN p_from AND p_to
      AND (v_scope_dept IS NULL OR department_id = v_scope_dept)
      AND is_archived = FALSE
  )
  SELECT jsonb_build_object(
    'completed',         COUNT(*) FILTER (WHERE status = 'done'),
    'overdue',           COUNT(*) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'submitted_pending', COUNT(*) FILTER (WHERE status = 'submitted'),
    'extensions_pending', (
      SELECT COUNT(*) FROM task_extension_requests er
      JOIN tasks t ON t.id = er.task_id
      WHERE er.status = 'pending'
        AND t.created_at::date BETWEEN p_from AND p_to
        AND (v_scope_dept IS NULL OR t.department_id = v_scope_dept)
    ),
    'total',    COUNT(*),
    'canceled', COUNT(*) FILTER (WHERE status = 'canceled')
  )
  INTO v_totals FROM base;

  SELECT jsonb_agg(row_to_json(d.*) ORDER BY d.date)
  INTO v_daily
  FROM (
    SELECT d::date AS date,
           (SELECT COUNT(*) FROM tasks t
            WHERE t.created_at::date <= d
              AND t.status = 'done'
              AND t.updated_at::date = d
              AND (v_scope_dept IS NULL OR t.department_id = v_scope_dept)) AS count
    FROM generate_series(p_from, p_to, interval '1 day') AS d
  ) d;

  SELECT jsonb_agg(row_to_json(r.*) ORDER BY r.overdue DESC, r.active DESC)
  INTO v_by_dept
  FROM (
    SELECT dept.id AS dept_id, dept.name AS dept_name,
           COUNT(t.id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS active,
           COUNT(t.id) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS overdue,
           COUNT(t.id) FILTER (WHERE t.status = 'done' AND t.updated_at::date BETWEEN p_from AND p_to) AS completed
    FROM departments dept
    LEFT JOIN tasks t ON t.department_id = dept.id
    WHERE (v_scope_dept IS NULL OR dept.id = v_scope_dept)
    GROUP BY dept.id, dept.name
    HAVING COUNT(t.id) > 0
  ) r;

  SELECT jsonb_agg(row_to_json(p.*) ORDER BY p.active DESC, p.overdue DESC)
  INTO v_top
  FROM (
    SELECT pr.id AS user_id, pr.full_name, pr.avatar_url,
           dpt.name AS department_name,
           COUNT(ta.task_id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS active,
           COUNT(ta.task_id) FILTER (WHERE t.due_date < v_now AND t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) AS overdue,
           COUNT(ta.task_id) FILTER (WHERE t.status = 'done' AND t.updated_at::date BETWEEN p_from AND p_to) AS completed
    FROM task_assignees ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN profiles pr ON pr.id = ta.user_id
    LEFT JOIN departments dpt ON dpt.id = pr.department_id
    WHERE (v_scope_dept IS NULL OR t.department_id = v_scope_dept)
    GROUP BY pr.id, pr.full_name, pr.avatar_url, dpt.name
    HAVING COUNT(ta.task_id) FILTER (WHERE t.status NOT IN ('done','canceled') AND t.is_archived = FALSE) > 0
    ORDER BY active DESC
    LIMIT 10
  ) p;

  SELECT COUNT(*) INTO v_recur
  FROM task_recurring_templates
  WHERE is_active = TRUE
    AND (v_scope_dept IS NULL
         OR v_scope_dept = ANY(target_department_ids)
         OR EXISTS (
           SELECT 1 FROM profiles p
           WHERE p.id = ANY(target_user_ids) AND p.department_id = v_scope_dept
         ));

  RETURN jsonb_build_object(
    'totals',          COALESCE(v_totals, '{}'::jsonb),
    'daily_completed', COALESCE(v_daily, '[]'::jsonb),
    'by_department',   COALESCE(v_by_dept, '[]'::jsonb),
    'top_people',      COALESCE(v_top, '[]'::jsonb),
    'recurring_active', COALESCE(v_recur, 0),
    'role',            v_role,
    'scope_dept',      v_scope_dept,
    'from',            p_from,
    'to',              p_to
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_analytics(DATE, DATE, UUID) TO authenticated;


-- =====================================================================
-- recurring_template_upsert: allow staff hub
-- =====================================================================
CREATE OR REPLACE FUNCTION recurring_template_upsert(
  p_id                    UUID,
  p_title                 TEXT,
  p_description           TEXT,
  p_task_type             TEXT,
  p_priority              task_priority,
  p_target_department_ids UUID[],
  p_target_user_ids       UUID[],
  p_schedule_kind         TEXT,
  p_weekly_dow            SMALLINT,
  p_weekly_time           TIME,
  p_monthly_dom           SMALLINT,
  p_monthly_time          TIME,
  p_timezone              TEXT,
  p_due_days_after_fire   INT,
  p_is_active             BOOLEAN
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_role   TEXT;
  v_dept   UUID;
  v_is_hub BOOLEAN;
  v_id     UUID;
  v_next   TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;
  v_is_hub := _is_hub_department(v_dept);

  IF v_role NOT IN ('admin', 'director', 'manager') AND NOT (v_role = 'staff' AND v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo lịch định kỳ';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_schedule_kind NOT IN ('weekly', 'monthly') THEN
    RAISE EXCEPTION 'Loại lịch không hợp lệ';
  END IF;
  IF p_schedule_kind = 'weekly' AND (p_weekly_dow IS NULL OR p_weekly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn thứ và giờ trong tuần';
  END IF;
  IF p_schedule_kind = 'monthly' AND (p_monthly_dom IS NULL OR p_monthly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn ngày và giờ trong tháng';
  END IF;

  v_next := _recurring_next_run(
    p_schedule_kind, p_weekly_dow, p_weekly_time,
    p_monthly_dom, p_monthly_time, p_timezone, NOW()
  );

  IF p_id IS NULL THEN
    INSERT INTO task_recurring_templates (
      title, description, task_type, priority,
      target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire,
      created_by, is_active, next_run_at
    ) VALUES (
      p_title, p_description, p_task_type, COALESCE(p_priority, 'medium'),
      COALESCE(p_target_department_ids, '{}'), COALESCE(p_target_user_ids, '{}'),
      p_schedule_kind, p_weekly_dow, p_weekly_time, p_monthly_dom, p_monthly_time,
      COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'), COALESCE(p_due_days_after_fire, 7),
      v_uid, COALESCE(p_is_active, TRUE), v_next
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE task_recurring_templates
    SET title = p_title, description = p_description, task_type = p_task_type,
        priority = COALESCE(p_priority, 'medium'),
        target_department_ids = COALESCE(p_target_department_ids, '{}'),
        target_user_ids = COALESCE(p_target_user_ids, '{}'),
        schedule_kind = p_schedule_kind,
        weekly_dow = p_weekly_dow, weekly_time = p_weekly_time,
        monthly_dom = p_monthly_dom, monthly_time = p_monthly_time,
        timezone = COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'),
        due_days_after_fire = COALESCE(p_due_days_after_fire, 7),
        is_active = COALESCE(p_is_active, is_active),
        next_run_at = v_next
    WHERE id = p_id
      AND (created_by = v_uid OR v_role IN ('admin', 'director'))
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hoặc không có quyền sửa'; END IF;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(
  UUID, TEXT, TEXT, TEXT, task_priority, UUID[], UUID[],
  TEXT, SMALLINT, TIME, SMALLINT, TIME, TEXT, INT, BOOLEAN
) TO authenticated;

NOTIFY pgrst, 'reload schema';
