-- migration_tasks_access_workflow_recurring_fix.sql
-- Vá 4 điểm:
-- 1) Chặn hr_officer khỏi module Tasks ở backend.
-- 2) Không cho hoàn thành trực tiếp todo -> done.
-- 3) Reopen done -> doing chỉ cho người tạo hoặc admin.
-- 4) Sửa lỗi _recurring_next_run khi recurring_template_upsert truyền INT/TEXT.

-- =====================================================================
-- §1. Overload _recurring_next_run cho tham số INT/TEXT từ RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION _recurring_next_run(
  p_kind         TEXT,
  p_weekly_dow   INT,
  p_weekly_time  TEXT,
  p_monthly_dom  INT,
  p_monthly_time TEXT,
  p_timezone     TEXT,
  p_after        TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN _recurring_next_run(
    p_kind,
    p_weekly_dow::SMALLINT,
    NULLIF(p_weekly_time, '')::TIME,
    p_monthly_dom::SMALLINT,
    NULLIF(p_monthly_time, '')::TIME,
    p_timezone,
    p_after
  );
END $$;


-- =====================================================================
-- §2. Guard creator/assignee role — chặn role ngoài module ở backend
-- =====================================================================
CREATE OR REPLACE FUNCTION guard_task_creator_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT;
  v_creator UUID := COALESCE(NEW.created_by, auth.uid());
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = v_creator;
  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền tạo công việc';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_task_creator_role ON tasks;
CREATE TRIGGER trg_guard_task_creator_role
  BEFORE INSERT ON tasks
  FOR EACH ROW EXECUTE FUNCTION guard_task_creator_role();

CREATE OR REPLACE FUNCTION guard_task_assignee_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM profiles WHERE id = NEW.user_id;
  IF v_role IN ('admin', 'director', 'driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò "%" không nhận công việc trong module Công việc', v_role;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_task_assignee_role ON task_assignees;
CREATE TRIGGER trg_guard_task_assignee_role
  BEFORE INSERT OR UPDATE OF user_id ON task_assignees
  FOR EACH ROW EXECUTE FUNCTION guard_task_assignee_role();


-- =====================================================================
-- §3. Guard status transition ở DB
-- =====================================================================
CREATE OR REPLACE FUNCTION guard_task_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid                 UUID := auth.uid();
  v_role                TEXT;
  v_dept                UUID;
  v_creator_dept        UUID;
  v_is_creator          BOOLEAN;
  v_is_creator_manager  BOOLEAN;
  v_is_assignee_manager BOOLEAN;
  v_is_top_admin        BOOLEAN;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

    IF OLD.status = 'todo' AND NEW.status = 'done' THEN
      RAISE EXCEPTION 'Công việc phải chuyển sang Đang làm trước khi hoàn thành';
    END IF;

    IF OLD.status = 'done' AND NEW.status = 'doing' THEN
      SELECT department_id INTO v_creator_dept FROM profiles WHERE id = OLD.created_by;

      v_is_creator          := (OLD.created_by = v_uid);
      v_is_creator_manager  := (v_role = 'manager' AND v_dept = v_creator_dept);
      v_is_assignee_manager := (v_role = 'manager' AND v_dept = OLD.department_id);
      v_is_top_admin        := (v_role IN ('admin', 'director'));

      IF NOT (v_is_creator OR v_is_creator_manager OR v_is_assignee_manager OR v_is_top_admin) THEN
        RAISE EXCEPTION 'Chỉ người giao hoặc cấp có thẩm quyền mới được mở lại công việc.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_task_status_transition ON tasks;
CREATE TRIGGER trg_guard_task_status_transition
  BEFORE UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION guard_task_status_transition();


-- =====================================================================
-- §4. tasks_dashboard — chặn role không có quyền module
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

  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền xem module Công việc';
  END IF;

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
    'todo',              COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'todo'),
    'doing',             COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'doing'),
    'submitted',         COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'submitted'),
    'done',              COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'done'),
    'canceled',          COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'canceled'),
    'overdue',           COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'awaiting_approval', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'submitted'),
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
