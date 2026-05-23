-- =====================================================================
-- MIGRATION: ANALYTICS PERMISSION refine — chỉ TCTH (13602) xem toàn nhánh
-- =====================================================================
-- Quy tắc đúng:
--   • Admin/Director: toàn nhánh.
--   • Manager TCTH (code 13602): toàn nhánh.
--   • Staff TCTH (13602): toàn nhánh.
--   • Manager phòng khác: CHỈ phòng mình.
--   • Staff phòng khác: KHÔNG xem được.
-- 4 phòng đầu mối khác (13618/13605/13609/13603) chỉ có quyền yêu cầu báo cáo,
-- KHÔNG xem analytics toàn nhánh.
-- =====================================================================

CREATE OR REPLACE FUNCTION tasks_analytics(
  p_from DATE,
  p_to   DATE,
  p_dept_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_role       TEXT;
  v_dept       UUID;
  v_dept_code  TEXT;
  v_is_tcth    BOOLEAN;
  v_now        TIMESTAMPTZ := NOW();
  v_scope_dept UUID;
  v_totals     JSONB;
  v_daily      JSONB;
  v_by_dept    JSONB;
  v_top        JSONB;
  v_recur      INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;
  SELECT code INTO v_dept_code FROM departments WHERE id = v_dept;
  v_is_tcth := v_dept_code = '13602';

  -- Permission gate
  IF NOT (
    v_role IN ('admin', 'director', 'manager')
    OR (v_role = 'staff' AND v_is_tcth)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền xem báo cáo';
  END IF;

  -- Scope:
  --   • admin/director/manager-TCTH/staff-TCTH → toàn nhánh (có thể filter dept)
  --   • manager non-TCTH → chỉ dept mình (bỏ p_dept_id từ client)
  IF v_role = 'manager' AND NOT v_is_tcth THEN
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

NOTIFY pgrst, 'reload schema';
