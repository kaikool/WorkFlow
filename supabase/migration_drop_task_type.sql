-- ==============================================================================
-- MIGRATION: Xoá task_type hoàn toàn (chỉ còn Báo cáo)
-- ==============================================================================
-- Mục đích:
--   1. Xoá cột task_type khỏi bảng tasks (đã có CHECK constraint = 'report')
--   2. Xoá cột task_type khỏi bảng task_recurring_templates
--   3. RPC task_create — bỏ tham số p_task_type
--   4. RPC tasks_dashboard — bỏ task_type khỏi SELECT
--   5. Các RPC recurring / analytics — bỏ task_type
--
-- Điều kiện:
--   - Data task_type='task' đã xoá, còn task_type='report' duy nhất
--   - CHECK constraint 'task_type = report' đã active
-- ==============================================================================

-- =====================================================================
-- 1. XOÁ CỘT task_type
-- =====================================================================
ALTER TABLE tasks DROP COLUMN IF EXISTS task_type;
ALTER TABLE task_recurring_templates DROP COLUMN IF EXISTS task_type;

-- =====================================================================
-- 2. RPC task_create — bỏ p_task_type
-- =====================================================================
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB);
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION task_create(
  p_title             TEXT,
  p_description       TEXT,
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
  v_dept_code    TEXT;
  v_is_hub       BOOLEAN;
  v_task_id      UUID;
  v_a            UUID;
  v_creator_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT p.role, p.department_id, d.code, p.full_name
    INTO v_role, v_dept, v_dept_code, v_creator_name
    FROM profiles p
    LEFT JOIN departments d ON d.id = p.department_id
   WHERE p.id = v_uid;

  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);

  IF v_role IN ('driver', 'secretary', 'hr_officer')
     OR (v_role = 'staff' AND NOT v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo báo cáo';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;
  IF (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) IS NULL) AND p_dept_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban';
  END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND p_dept_id IS DISTINCT FROM v_dept THEN
    RAISE EXCEPTION 'Trưởng phòng chỉ được yêu cầu báo cáo trong phòng mình';
  END IF;
  IF p_assignee_ids IS NOT NULL
     AND array_length(p_assignee_ids, 1) > 0
     AND v_role NOT IN ('admin', 'director')
     AND EXISTS (
       SELECT 1
       FROM profiles p
       WHERE p.id = ANY(p_assignee_ids)
         AND p.department_id IS DISTINCT FROM v_dept
     ) THEN
    RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình';
  END IF;

  INSERT INTO tasks (
    title, description, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    p_title, p_description, COALESCE(p_priority, 'medium'),
    p_due_date, p_dept_id,
    CASE WHEN p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0
         THEN p_assignee_ids[1] ELSE NULL END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  )
  RETURNING id INTO v_task_id;

  -- Insert assignees + notifications
  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;
      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT v_a,
               'Bạn có yêu cầu báo cáo mới',
               v_creator_name || ' đã yêu cầu: ' || p_title,
               'report',
               '/dashboard/tasks?id=' || v_task_id::text
        WHERE (SELECT role FROM profiles WHERE id = v_a) <> 'driver';
      END IF;
    END LOOP;
  ELSIF p_dept_id IS NOT NULL THEN
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
  TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID
) TO authenticated;

-- =====================================================================
-- 3. RPC tasks_dashboard + INDEXES — tối ưu hiệu suất
-- =====================================================================
DROP FUNCTION IF EXISTS tasks_dashboard(TEXT, JSONB);
DROP FUNCTION IF EXISTS tasks_dashboard(TEXT, JSONB, INT, INT);

-- Index phủ scope mine: assignee_id + created_by (phổ biến nhất)
CREATE INDEX IF NOT EXISTS idx_tasks_mine
  ON tasks(assignee_id, created_by)
  WHERE is_archived = false;

-- Index cho resource_view: user_id → task_id join
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_task
  ON task_assignees(user_id, task_id);

CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT  DEFAULT 'mine',
  p_filter JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_role     TEXT;
  v_dept     UUID;
  v_now      TIMESTAMPTZ := NOW();
  v_counts   JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  IF v_role = 'staff' THEN p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN p_scope := 'dept';
  END IF;

  -- Counts + List: 1 shared CTE, không scan 2 lần
  WITH task_set AS (
    SELECT t.*,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue
    FROM tasks t
    WHERE t.is_archived = FALSE
      AND (
        (p_scope = 'mine' AND (t.assignee_id = v_uid OR t.created_by = v_uid
          OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = v_uid)))
        OR (p_scope = 'dept'   AND t.department_id = v_dept)
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
      'extensions_pending', (SELECT COUNT(*) FROM task_extension_requests er
        WHERE er.status = 'pending' AND user_can_see_task(er.task_id, v_uid))
    ) AS val FROM task_set
  ), task_list AS (
    SELECT t.id, t.title, t.description, t.status, t.priority,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           t.is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url) AS creator,
           a.assignees
    FROM task_set t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN profiles    c ON c.id = t.created_by
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url)) AS assignees
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
        AND ((p_scope = 'dept' AND t.department_id = v_dept)
          OR (p_scope = 'branch' AND v_role IN ('admin', 'director')))
      GROUP BY ta.user_id, p.full_name, p.avatar_url
      ORDER BY active_count DESC
      LIMIT 20
    ) r
  )
  SELECT jsonb_build_object(
    'counts', COALESCE(c.val, '{}'::jsonb),
    'lists', COALESCE((SELECT jsonb_agg(row_to_json(tl.*) ORDER BY tl.is_overdue DESC, tl.due_date NULLS LAST, tl.created_at DESC) FROM task_list tl), '[]'::jsonb),
    'resource_view', CASE WHEN p_scope = 'mine' THEN '[]'::jsonb ELSE COALESCE((SELECT val FROM resource_view), '[]'::jsonb) END,
    'scope', p_scope,
    'role', v_role
  )
  INTO v_counts
  FROM counts c;

  RETURN v_counts;
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB) TO authenticated;

-- =====================================================================
-- 3b. RPC task_update / task_delete — đồng bộ action frontend
-- =====================================================================
DROP FUNCTION IF EXISTS task_update(UUID, TEXT, TEXT, task_priority, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS task_delete(UUID);

CREATE OR REPLACE FUNCTION task_update(
  p_task_id     UUID,
  p_title       TEXT,
  p_description TEXT DEFAULT NULL,
  p_priority    task_priority DEFAULT 'medium',
  p_due_date    TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task         tasks%ROWTYPE;
  v_creator_dept UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  IF v_task.status = 'canceled' OR v_task.is_archived THEN
    RAISE EXCEPTION 'Không thể sửa công việc đã đóng hoặc đã lưu trữ';
  END IF;
  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  IF NOT (
    v_role IN ('admin', 'director')
    OR v_task.created_by = v_uid
    OR (v_role = 'manager' AND v_dept = v_creator_dept)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa công việc này';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;

  UPDATE tasks
     SET title = trim(p_title),
         description = NULLIF(trim(COALESCE(p_description, '')), ''),
         priority = COALESCE(p_priority, 'medium'),
         due_date = p_due_date,
         updated_at = NOW()
   WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_update(UUID, TEXT, TEXT, task_priority, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION task_delete(p_task_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_role         TEXT;
  v_dept         UUID;
  v_task         tasks%ROWTYPE;
  v_creator_dept UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;
  SELECT department_id INTO v_creator_dept FROM profiles WHERE id = v_task.created_by;

  IF NOT (
    v_role IN ('admin', 'director')
    OR v_task.created_by = v_uid
    OR (v_role = 'manager' AND v_dept = v_creator_dept)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền xoá công việc này';
  END IF;

  DELETE FROM tasks WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_delete(UUID) TO authenticated;

-- =====================================================================
-- 4. RPC recurring_template_upsert — bỏ p_task_type
-- =====================================================================
DROP FUNCTION IF EXISTS recurring_template_upsert(UUID, TEXT, TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID, UUID);

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
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_dept_code TEXT;
  v_is_hub    BOOLEAN;
  v_id        UUID;
  v_next      TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT p.role, p.department_id, d.code
    INTO v_role, v_dept, v_dept_code
    FROM profiles p
    LEFT JOIN departments d ON d.id = p.department_id
   WHERE p.id = v_uid;

  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);
  IF v_role IN ('driver', 'secretary', 'hr_officer')
     OR (v_role = 'staff' AND NOT v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo lịch báo cáo định kỳ';
  END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa template này';
  END IF;
  IF COALESCE(array_length(p_target_department_ids, 1), 0) = 0
     AND COALESCE(array_length(p_target_user_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban';
  END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND EXISTS (
    SELECT 1 FROM unnest(p_target_department_ids) AS target_dept_id
    WHERE target_dept_id IS DISTINCT FROM v_dept
  ) THEN
    RAISE EXCEPTION 'Trưởng phòng chỉ được tạo lịch báo cáo cho phòng mình';
  END IF;
  IF COALESCE(array_length(p_target_user_ids, 1), 0) > 0
     AND v_role NOT IN ('admin', 'director')
     AND EXISTS (
       SELECT 1
       FROM profiles p
       WHERE p.id = ANY(p_target_user_ids)
         AND p.department_id IS DISTINCT FROM v_dept
     ) THEN
    RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình';
  END IF;

  v_next := _recurring_next_run(
    p_schedule_kind, p_weekly_dow, p_weekly_time,
    p_monthly_dom, p_monthly_time, p_timezone, NOW()
  );

  IF p_id IS NOT NULL AND EXISTS (SELECT 1 FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid) THEN
    UPDATE task_recurring_templates SET
      title = p_title,
      description = p_description,
      priority = p_priority,
      target_department_ids = p_target_department_ids,
      target_user_ids = p_target_user_ids,
      schedule_kind = p_schedule_kind,
      weekly_dow = p_weekly_dow,
      weekly_time = p_weekly_time::TIME,
      monthly_dom = p_monthly_dom,
      monthly_time = p_monthly_time::TIME,
      timezone = p_timezone,
      due_days_after_fire = p_due_days_after_fire,
      is_active = p_is_active,
      default_assignee_id = p_default_assignee_id,
      next_run_at = v_next
    WHERE id = p_id
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO task_recurring_templates (
      title, description, priority, target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire, created_by, is_active, default_assignee_id, next_run_at
    ) VALUES (
      p_title, p_description, p_priority, p_target_department_ids, p_target_user_ids,
      p_schedule_kind, p_weekly_dow, p_weekly_time::TIME, p_monthly_dom, p_monthly_time::TIME,
      p_timezone, p_due_days_after_fire, v_uid, p_is_active, p_default_assignee_id, v_next
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(
  TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID, UUID
) TO authenticated;

-- =====================================================================
-- 5. RPC recurring_fire_due — bỏ p_task_type
-- =====================================================================
CREATE OR REPLACE FUNCTION recurring_fire_due()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
  v_t     RECORD;
  v_uid   UUID;
  v_task_id UUID;
  v_a     UUID;
BEGIN
  FOR v_t IN
    SELECT * FROM task_recurring_templates
    WHERE is_active = TRUE AND next_run_at <= NOW()
    ORDER BY next_run_at ASC
    LIMIT 20
  LOOP
    -- Gán created_by = admin nếu creator bị xoá
    v_uid := COALESCE(v_t.created_by, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));
    IF v_uid IS NULL THEN CONTINUE; END IF;

    -- Ghi nhận đã fire
    UPDATE task_recurring_templates
    SET last_fired_at = NOW(),
        next_run_at = _recurring_next_run(
          v_t.schedule_kind, v_t.weekly_dow, v_t.weekly_time,
          v_t.monthly_dom, v_t.monthly_time, v_t.timezone, NOW()
        )
    WHERE id = v_t.id;

    -- Xác định target
    DECLARE
      v_target_ids UUID[] := v_t.target_user_ids;
      v_dept_id    UUID;
      v_tp_id      UUID;
    BEGIN
      -- Phòng ban: resolve TP
      IF v_t.target_department_ids IS NOT NULL AND array_length(v_t.target_department_ids, 1) > 0 THEN
        FOREACH v_dept_id IN ARRAY v_t.target_department_ids LOOP
          -- Nếu có default_assignee_id thì dùng, không thì resolve TP
          v_tp_id := COALESCE(
            v_t.default_assignee_id,
            _resolve_default_assignee(v_dept_id)
          );
          IF v_tp_id IS NOT NULL THEN
            v_target_ids := array_append(v_target_ids, v_tp_id);
          END IF;
        END LOOP;
      END IF;

      -- Tạo task
      INSERT INTO tasks (
        title, description, priority, due_date, department_id,
        assignee_id, created_by, status, metadata, is_archived,
        requires_approval
      ) VALUES (
        v_t.title, v_t.description, v_t.priority,
        NOW() + (v_t.due_days_after_fire || ' days')::INTERVAL,
        CASE WHEN array_length(v_t.target_department_ids, 1) = 1
             THEN v_t.target_department_ids[1] ELSE NULL END,
        v_target_ids[1],
        v_uid, 'todo'::task_status,
        '{"from_recurring": true}'::jsonb, FALSE,
        TRUE
      )
      RETURNING id INTO v_task_id;

      -- Insert assignees
      IF v_target_ids IS NOT NULL THEN
        FOREACH v_a IN ARRAY v_target_ids LOOP
          INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a)
          ON CONFLICT (task_id, user_id) DO NOTHING;
        END LOOP;
      END IF;

      v_count := v_count + 1;
    END;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION recurring_fire_due() TO authenticated;

-- =====================================================================
-- 6. RPC tasks_analytics — bỏ task_type
-- =====================================================================
DROP FUNCTION IF EXISTS tasks_analytics(TIMESTAMPTZ, TIMESTAMPTZ, UUID);

CREATE OR REPLACE FUNCTION tasks_analytics(
  p_from    TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_to      TIMESTAMPTZ DEFAULT NOW(),
  p_dept_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_dept_code TEXT;
  v_scope_dept UUID;
  v_can_branch BOOLEAN;
  v_result    JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT p.role, p.department_id, d.code
    INTO v_role, v_dept, v_dept_code
    FROM profiles p
    LEFT JOIN departments d ON d.id = p.department_id
   WHERE p.id = v_uid;

  v_can_branch := v_role IN ('admin', 'director') OR v_dept_code = '13602';
  IF v_role NOT IN ('admin', 'director', 'manager') AND NOT (v_role = 'staff' AND v_dept_code = '13602') THEN
    RAISE EXCEPTION 'Không có quyền xem thống kê';
  END IF;
  v_scope_dept := CASE WHEN v_can_branch THEN p_dept_id ELSE v_dept END;

  WITH base AS (
    SELECT t.*
    FROM tasks t
    WHERE t.created_at BETWEEN p_from AND p_to
      AND (v_scope_dept IS NULL OR t.department_id = v_scope_dept)
      AND t.is_archived = FALSE
  )
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'by_status', jsonb_build_object(
      'todo', COUNT(*) FILTER (WHERE status = 'todo'),
      'doing', COUNT(*) FILTER (WHERE status = 'doing'),
      'submitted', COUNT(*) FILTER (WHERE status = 'submitted'),
      'done', COUNT(*) FILTER (WHERE status = 'done'),
      'canceled', COUNT(*) FILTER (WHERE status = 'canceled')
    ),
    'overdue', COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('done','canceled')),
    'avg_completion_days', COALESCE(
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)::numeric, 1)
       FROM tasks WHERE status = 'done' AND created_at BETWEEN p_from AND p_to),
      0
    ),
    'daily_counts', (
      SELECT jsonb_agg(jsonb_build_object('date', d::date, 'count', COALESCE(c, 0)))
      FROM generate_series(p_from::date, p_to::date, '1 day'::interval) d
      LEFT JOIN (SELECT created_at::date AS dt, COUNT(*) AS c FROM base GROUP BY created_at::date) sub ON sub.dt = d::date
    )
  ) INTO v_result
  FROM base;

  RETURN v_result;
END $$;

GRANT EXECUTE ON FUNCTION tasks_analytics(TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;

-- =====================================================================
-- KẾT THÚC
-- =====================================================================
NOTIFY pgrst, 'reload schema';
