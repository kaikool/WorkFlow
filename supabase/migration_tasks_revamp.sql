-- =====================================================================
-- MIGRATION: TASKS MODULE REVAMP (P0 — DB foundation)
-- =====================================================================
-- Mục đích:
--   1. Tạo enum task_priority (đang ref nhưng chưa CREATE TYPE)
--   2. Thêm task_status: 'submitted', 'canceled'; deprecate 'late','closed'
--   3. Đảm bảo bảng task_assignees tồn tại (junction multi-assignee)
--   4. Drop 4 cột KPI (target_value, current_value, unit, progress)
--   5. Thêm cột tasks.updated_at + trigger touch
--   6. Tạo bảng task_extension_requests (xin gia hạn deadline)
--   7. Trigger auto-cancel khi assignee cuối rời task
--   8. RLS helpers + policies (deny direct mutation, buộc qua RPC)
--   9. 9 RPCs SECURITY DEFINER cốt lõi:
--      - tasks_dashboard (gộp counts+list+resource_view)
--      - task_create, task_update_status, task_delegate
--      - task_request_extension, task_decide_extension
--      - task_add_comment, task_cancel, task_archive
--  10. Cập nhật auto_archive_and_cleanup theo enum mới
--
-- LƯU Ý:
-- - Postgres không cho DROP enum value khi còn ref → giữ 'late'/'closed'
--   nguyên, chỉ migrate row sang status hợp lệ mới + code TS bỏ qua 2 value cũ.
-- - guard_tasks_update trigger cũ (từ migration_security_and_integrity)
--   không còn cần thiết — paradigm mới là RLS DENY direct UPDATE + RPC
--   SECURITY DEFINER validate.
--
-- Cách chạy:
--   1. Backup DB (Supabase Dashboard → Database → Backups → Manual snapshot)
--   2. SQL Editor → paste & run toàn file
--   3. Chạy NOTIFY ở cuối (đã có sẵn)
--   4. Verify bằng các query ở comment cuối file
-- =====================================================================


-- =====================================================================
-- §1. ENUM
-- =====================================================================

-- task_priority: tạo nếu chưa có (line 73 schema.sql ref nhưng KHÔNG CREATE)
DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Thêm 2 status mới (idempotent)
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'canceled';

-- Migrate dữ liệu cũ (KHÔNG drop value 'late','closed' khỏi enum vì Postgres không cho)
-- - 'late' = derived state, chuyển về 'doing' (cron sẽ tự tính late mỗi sáng nếu cần)
-- - 'closed' = gộp vào 'done' + is_archived=true
UPDATE tasks SET status = 'doing' WHERE status = 'late';
UPDATE tasks SET status = 'done', is_archived = true WHERE status = 'closed';


-- =====================================================================
-- §2. BẢNG task_assignees (junction multi-assignee)
-- =====================================================================
-- Bảng có thể đã tồn tại từ trước (tạo qua Supabase UI hoặc migration cũ)
-- với schema khác nhau. Pattern dưới đảm bảo cấu trúc cuối cùng đồng nhất.

-- 2a. Tạo bảng nếu chưa có
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

-- 2b. Migrate legacy schema: rename 'created_at' → 'assigned_at' nếu cần
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='task_assignees' AND column_name='created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='task_assignees' AND column_name='assigned_at'
  ) THEN
    ALTER TABLE task_assignees RENAME COLUMN created_at TO assigned_at;
  END IF;
END $$;

-- 2c. Đảm bảo cột assigned_at có mặt (kể cả khi cả 2 bảng cũ đều thiếu)
ALTER TABLE task_assignees ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id, task_id);

-- 2d. Backfill từ tasks.assignee_id (dùng WHERE NOT EXISTS thay vì ON CONFLICT
--     vì không biết constraint name của bảng legacy)
INSERT INTO task_assignees (task_id, user_id, assigned_at)
SELECT t.id, t.assignee_id, COALESCE(t.created_at, NOW())
FROM tasks t
WHERE t.assignee_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM task_assignees ta
    WHERE ta.task_id = t.id AND ta.user_id = t.assignee_id
  );


-- =====================================================================
-- §3. DROP CỘT KPI + DROP GUARD TRIGGER CŨ
-- =====================================================================
ALTER TABLE tasks DROP COLUMN IF EXISTS target_value;
ALTER TABLE tasks DROP COLUMN IF EXISTS current_value;
ALTER TABLE tasks DROP COLUMN IF EXISTS unit;
ALTER TABLE tasks DROP COLUMN IF EXISTS progress;

-- Trigger guard cũ chặn staff đổi ownership (từ migration_security_and_integrity)
-- Paradigm mới: RLS DENY direct UPDATE, RPC SECURITY DEFINER validate → guard thừa
DROP TRIGGER IF EXISTS guard_tasks_update_trigger ON tasks;
DROP FUNCTION  IF EXISTS guard_tasks_update();

-- Constraint cấm task_type='kpi' (từ migration_security_and_integrity) — KPI đã drop
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_not_kpi;


-- =====================================================================
-- §4. CỘT tasks.updated_at + TRIGGER TOUCH
-- =====================================================================
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE tasks SET updated_at = COALESCE(updated_at, created_at, NOW()) WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION _touch_tasks_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tasks_touch_updated ON tasks;
CREATE TRIGGER trg_tasks_touch_updated
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION _touch_tasks_updated();


-- =====================================================================
-- §5. INDEXES
-- =====================================================================
-- idx_tasks_dept_status, idx_tasks_assignee, idx_tasks_created_by đã có sẵn
CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_updated   ON tasks(updated_at DESC) WHERE is_archived = false;


-- =====================================================================
-- §6. BẢNG task_extension_requests
-- =====================================================================
CREATE TABLE IF NOT EXISTS task_extension_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason          TEXT,
  old_due_date    TIMESTAMPTZ,
  new_due_date    TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_comment  TEXT,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_extension_task      ON task_extension_requests(task_id, status);
CREATE INDEX IF NOT EXISTS idx_extension_requester ON task_extension_requests(requested_by, status);


-- =====================================================================
-- §7. TRIGGER auto-cancel khi assignee cuối rời task
-- =====================================================================
-- Phòng case: admin xoá user → CASCADE xoá row task_assignees → task vô chủ.
CREATE OR REPLACE FUNCTION _auto_cancel_orphaned_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_status task_status;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM task_assignees WHERE task_id = OLD.task_id) THEN
    SELECT status INTO v_status FROM tasks WHERE id = OLD.task_id;
    IF v_status IS NOT NULL AND v_status NOT IN ('done', 'canceled') THEN
      UPDATE tasks SET status = 'canceled' WHERE id = OLD.task_id;
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_task_assignees_orphan ON task_assignees;
CREATE TRIGGER trg_task_assignees_orphan
  AFTER DELETE ON task_assignees
  FOR EACH ROW EXECUTE FUNCTION _auto_cancel_orphaned_task();


-- =====================================================================
-- §8. CẬP NHẬT auto_archive_and_cleanup (theo enum mới)
-- =====================================================================
CREATE OR REPLACE FUNCTION auto_archive_and_cleanup()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Lưu trữ task done/canceled trên 60 ngày
  UPDATE tasks
  SET is_archived = TRUE
  WHERE status IN ('done', 'canceled')
    AND created_at < NOW() - INTERVAL '60 days'
    AND is_archived = FALSE;

  -- Xoá notification cũ trên 30 ngày
  DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
END $$;


-- =====================================================================
-- §9. RLS HELPER user_can_see_task
-- =====================================================================
-- SECURITY DEFINER + STABLE — bẻ vòng recursion + cache trong query plan
CREATE OR REPLACE FUNCTION user_can_see_task(p_task_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_role TEXT;
  v_dept UUID;
  v_task_dept UUID;
  v_task_creator UUID;
  v_task_assignee UUID;
BEGIN
  IF p_user_id IS NULL THEN RETURN FALSE; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = p_user_id;
  IF v_role IN ('admin', 'director') THEN RETURN TRUE; END IF;

  SELECT department_id, created_by, assignee_id
    INTO v_task_dept, v_task_creator, v_task_assignee
  FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF v_task_creator = p_user_id THEN RETURN TRUE; END IF;
  IF v_task_assignee = p_user_id THEN RETURN TRUE; END IF;
  IF v_role = 'manager' AND v_task_dept = v_dept THEN RETURN TRUE; END IF;
  IF EXISTS (SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = p_user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END $$;

GRANT EXECUTE ON FUNCTION user_can_see_task(UUID, UUID) TO authenticated;


-- =====================================================================
-- §10. RLS POLICIES — TASKS (drop all existing then create fresh)
-- =====================================================================
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'tasks' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON tasks', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "tasks_select" ON tasks FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
  OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid())
);

-- Chặn INSERT/UPDATE/DELETE direct → buộc qua RPC
CREATE POLICY "tasks_no_direct_insert" ON tasks FOR INSERT TO authenticated WITH CHECK (FALSE);
CREATE POLICY "tasks_no_direct_update" ON tasks FOR UPDATE TO authenticated USING (FALSE);
CREATE POLICY "tasks_no_direct_delete" ON tasks FOR DELETE TO authenticated USING (FALSE);


-- =====================================================================
-- §11. RLS POLICIES — task_assignees + task_extension_requests
-- =====================================================================
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'task_assignees' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_assignees', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "task_assignees_select" ON task_assignees FOR SELECT TO authenticated
USING (user_can_see_task(task_id));

CREATE POLICY "task_assignees_no_direct_write" ON task_assignees
  FOR ALL TO authenticated USING (FALSE) WITH CHECK (FALSE);

ALTER TABLE task_extension_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_ext_select" ON task_extension_requests FOR SELECT TO authenticated
USING (user_can_see_task(task_id));

CREATE POLICY "task_ext_no_direct_write" ON task_extension_requests
  FOR ALL TO authenticated USING (FALSE) WITH CHECK (FALSE);


-- =====================================================================
-- §12. RLS POLICIES — task_comments (refresh)
-- =====================================================================
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'task_comments' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_comments', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "task_comments_select" ON task_comments FOR SELECT TO authenticated
USING (user_can_see_task(task_id));

CREATE POLICY "task_comments_insert_own" ON task_comments FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND user_can_see_task(task_id));

CREATE POLICY "task_comments_update_own" ON task_comments FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- =====================================================================
-- §13. RPC — tasks_dashboard (gộp counts + list + resource_view)
-- =====================================================================
CREATE OR REPLACE FUNCTION tasks_dashboard(
  p_scope  TEXT  DEFAULT 'mine',   -- 'mine' | 'dept' | 'branch'
  p_filter JSONB DEFAULT '{}'::jsonb
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  -- Restrict scope theo role
  IF v_role = 'staff' THEN
    p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN
    p_scope := 'dept';
  END IF;

  -- Counts
  WITH visible AS (
    SELECT t.*
    FROM tasks t
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
    )
  )
  INTO v_counts
  FROM visible;

  -- List (top 50 mới nhất, ưu tiên due_date gần nhất)
  SELECT jsonb_agg(row_to_json(x.*) ORDER BY x.is_overdue DESC, x.due_date NULLS LAST, x.created_at DESC)
  INTO v_lists
  FROM (
    SELECT t.id, t.title, t.description, t.status, t.priority, t.task_type,
           t.assignee_id, t.created_by, t.department_id,
           t.due_date, t.created_at, t.updated_at, t.metadata, t.is_archived,
           (t.due_date < v_now AND t.status NOT IN ('done','canceled')) AS is_overdue,
           jsonb_build_object('id', d.id, 'name', d.name) AS department,
           jsonb_build_object('id', c.id, 'full_name', c.full_name, 'avatar_url', c.avatar_url) AS creator,
           (SELECT jsonb_agg(jsonb_build_object(
                'id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url
              ))
            FROM task_assignees ta JOIN profiles p ON p.id = ta.user_id
            WHERE ta.task_id = t.id) AS assignees
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
    ORDER BY (t.due_date < v_now AND t.status NOT IN ('done','canceled')) DESC,
             t.due_date ASC NULLS LAST, t.created_at DESC
    LIMIT 50
  ) x;

  -- Resource view — chỉ manager/director/admin
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
        AND (
          (p_scope = 'dept'   AND t.department_id = v_dept)
          OR (p_scope = 'branch' AND v_role IN ('admin', 'director'))
          OR (p_scope = 'mine'   AND p.id = v_uid)
        )
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
    'role',          v_role
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB) TO authenticated;


-- =====================================================================
-- §14. RPC — task_create
-- =====================================================================
CREATE OR REPLACE FUNCTION task_create(
  p_title        TEXT,
  p_description  TEXT,
  p_task_type    TEXT,           -- 'task' | 'report'
  p_priority     task_priority,
  p_due_date     TIMESTAMPTZ,
  p_dept_id      UUID,
  p_assignee_ids UUID[],
  p_metadata     JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_role    TEXT;
  v_dept    UUID;
  v_task_id UUID;
  v_a       UUID;
  v_creator_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id, full_name
    INTO v_role, v_dept, v_creator_name
  FROM profiles WHERE id = v_uid;

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

  -- Staff chỉ tự ghi chú cho mình
  IF v_role = 'staff' THEN
    IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) != 1 OR p_assignee_ids[1] != v_uid THEN
      RAISE EXCEPTION 'Bạn chỉ được tự ghi chú việc cho mình';
    END IF;
    IF p_task_type = 'report' THEN
      RAISE EXCEPTION 'Nhân viên không được tạo yêu cầu báo cáo';
    END IF;
    IF p_dept_id IS NULL THEN p_dept_id := v_dept; END IF;
  END IF;

  -- Luồng A bắt buộc có assignee
  IF p_task_type = 'task' AND (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0) THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  -- Insert task
  INSERT INTO tasks (
    title, description, task_type, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived
  ) VALUES (
    p_title, p_description, p_task_type,
    COALESCE(p_priority, 'medium'),
    p_due_date, p_dept_id,
    CASE
      WHEN p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0
        THEN p_assignee_ids[1]
      ELSE NULL
    END,
    v_uid, 'todo'::task_status, COALESCE(p_metadata, '{}'::jsonb), FALSE
  )
  RETURNING id INTO v_task_id;

  -- Insert assignees + notifications cá nhân
  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id)
      VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;

      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT v_a,
               CASE WHEN p_task_type = 'report' THEN 'Bạn có yêu cầu báo cáo mới'
                    ELSE 'Bạn có công việc mới' END,
               v_creator_name || ' đã giao: ' || p_title,
               p_task_type,
               '/dashboard/tasks/' || v_task_id::text
        WHERE (SELECT role FROM profiles WHERE id = v_a) <> 'driver';
      END IF;
    END LOOP;
  ELSIF p_task_type = 'report' AND p_dept_id IS NOT NULL THEN
    -- Báo cáo chưa phân công → notify Trưởng phòng + Phó phòng của phòng đó
    INSERT INTO notifications (user_id, title, content, type, link)
    SELECT p.id,
           'Phòng có yêu cầu báo cáo mới',
           v_creator_name || ' đã yêu cầu: ' || p_title,
           'report',
           '/dashboard/tasks/' || v_task_id::text
    FROM profiles p
    WHERE p.department_id = p_dept_id
      AND p.role <> 'driver'
      AND (p.role = 'manager' OR p.is_department_head = TRUE)
      AND p.id <> v_uid;
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB) TO authenticated;


-- =====================================================================
-- §15. RPC — task_update_status (state machine)
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
  v_actor_name   TEXT;
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

  IF v_task.status = p_new_status THEN
    RETURN;  -- no-op
  END IF;

  -- State machine
  IF p_new_status = 'canceled' THEN
    RAISE EXCEPTION 'Hãy dùng task_cancel để hủy công việc';

  ELSIF p_new_status = 'doing' THEN
    IF NOT (v_is_assignee OR v_is_manager) THEN
      RAISE EXCEPTION 'Bạn không có quyền chuyển trạng thái';
    END IF;
    IF v_task.status NOT IN ('todo', 'submitted') THEN
      RAISE EXCEPTION 'Không thể chuyển sang Đang làm từ trạng thái hiện tại';
    END IF;
    -- submitted → doing là "trả về", bắt buộc có comment
    IF v_task.status = 'submitted' AND (p_comment IS NULL OR length(trim(p_comment)) = 0) THEN
      RAISE EXCEPTION 'Vui lòng nhập lý do trả về';
    END IF;
    IF v_task.status = 'submitted' AND NOT v_is_manager THEN
      RAISE EXCEPTION 'Chỉ Trưởng phòng được trả về báo cáo';
    END IF;

  ELSIF p_new_status = 'submitted' THEN
    IF v_task.task_type <> 'report' THEN
      RAISE EXCEPTION 'Chỉ báo cáo mới có trạng thái Đã nộp';
    END IF;
    IF NOT v_is_assignee THEN
      RAISE EXCEPTION 'Chỉ người được giao mới được nộp báo cáo';
    END IF;
    IF v_task.status <> 'doing' THEN
      RAISE EXCEPTION 'Báo cáo cần đang thực hiện trước khi nộp';
    END IF;

  ELSIF p_new_status = 'done' THEN
    IF v_task.task_type = 'report' THEN
      IF v_task.status <> 'submitted' THEN
        RAISE EXCEPTION 'Báo cáo cần được nộp trước khi duyệt';
      END IF;
      IF NOT v_is_manager THEN
        RAISE EXCEPTION 'Chỉ Trưởng phòng được duyệt báo cáo';
      END IF;
    ELSE
      IF NOT (v_is_assignee OR v_is_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền hoàn thành công việc này';
      END IF;
      IF v_task.status NOT IN ('todo', 'doing') THEN
        RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
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

  -- System comment nếu có
  IF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid, p_comment);
  END IF;

  -- Notify (trừ actor + driver)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Trạng thái công việc đã đổi',
         v_actor_name || ' → "' || v_task.title || '": ' ||
           CASE p_new_status
             WHEN 'doing'     THEN 'Đang làm'
             WHEN 'submitted' THEN 'Đã nộp'
             WHEN 'done'      THEN 'Hoàn thành'
             WHEN 'todo'      THEN 'Chưa làm'
             ELSE p_new_status::text
           END,
         v_task.task_type,
         '/dashboard/tasks/' || p_task_id::text
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
-- §16. RPC — task_delegate
-- =====================================================================
CREATE OR REPLACE FUNCTION task_delegate(
  p_task_id      UUID,
  p_assignee_ids UUID[]
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_task      tasks%ROWTYPE;
  v_actor     TEXT;
  v_a         UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;

  IF NOT (
    v_role IN ('admin', 'director')
    OR (v_role = 'manager' AND v_task.department_id = v_dept)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền phân công công việc này';
  END IF;

  IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  -- Replace assignees
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

  -- Notify new assignees
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT a,
         'Bạn được phân công công việc mới',
         v_actor || ' đã phân công: ' || v_task.title,
         v_task.task_type,
         '/dashboard/tasks/' || p_task_id::text
  FROM unnest(p_assignee_ids) a
  WHERE a <> v_uid
    AND (SELECT role FROM profiles WHERE id = a) <> 'driver';
END $$;

GRANT EXECUTE ON FUNCTION task_delegate(UUID, UUID[]) TO authenticated;


-- =====================================================================
-- §17. RPC — task_request_extension
-- =====================================================================
CREATE OR REPLACE FUNCTION task_request_extension(
  p_task_id      UUID,
  p_new_due_date TIMESTAMPTZ,
  p_reason       TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_task   tasks%ROWTYPE;
  v_actor  TEXT;
  v_ext_id UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT full_name INTO v_actor FROM profiles WHERE id = v_uid;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy công việc'; END IF;

  IF v_task.assignee_id <> v_uid AND NOT EXISTS (
    SELECT 1 FROM task_assignees WHERE task_id = p_task_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Chỉ người được giao mới được xin gia hạn';
  END IF;

  IF v_task.status IN ('done', 'canceled') THEN
    RAISE EXCEPTION 'Công việc đã đóng, không thể gia hạn';
  END IF;
  IF p_new_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn ngày gia hạn mới';
  END IF;
  IF v_task.due_date IS NOT NULL AND p_new_due_date <= v_task.due_date THEN
    RAISE EXCEPTION 'Ngày gia hạn phải sau hạn cũ';
  END IF;

  INSERT INTO task_extension_requests (task_id, requested_by, reason, old_due_date, new_due_date)
  VALUES (p_task_id, v_uid, p_reason, v_task.due_date, p_new_due_date)
  RETURNING id INTO v_ext_id;

  -- Notify creator + dept managers (trừ requester + driver)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT p.id,
         'Có yêu cầu gia hạn',
         v_actor || ' xin gia hạn: ' || v_task.title,
         'extension',
         '/dashboard/tasks/' || p_task_id::text
  FROM profiles p
  WHERE p.id <> v_uid
    AND p.role <> 'driver'
    AND (
      p.id = v_task.created_by
      OR (p.department_id = v_task.department_id
          AND (p.role = 'manager' OR p.is_department_head = TRUE))
    );

  RETURN v_ext_id;
END $$;

GRANT EXECUTE ON FUNCTION task_request_extension(UUID, TIMESTAMPTZ, TEXT) TO authenticated;


-- =====================================================================
-- §18. RPC — task_decide_extension
-- =====================================================================
CREATE OR REPLACE FUNCTION task_decide_extension(
  p_extension_id UUID,
  p_approve      BOOLEAN,
  p_comment      TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_role  TEXT;
  v_dept  UUID;
  v_ext   task_extension_requests%ROWTYPE;
  v_task  tasks%ROWTYPE;
  v_actor TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_actor
  FROM profiles WHERE id = v_uid;

  SELECT * INTO v_ext FROM task_extension_requests WHERE id = p_extension_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy yêu cầu gia hạn'; END IF;
  IF v_ext.status <> 'pending' THEN
    RAISE EXCEPTION 'Yêu cầu đã được xử lý';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = v_ext.task_id;

  IF NOT (
    v_role IN ('admin', 'director')
    OR (v_role = 'manager' AND v_task.department_id = v_dept)
    OR v_task.created_by = v_uid
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền duyệt yêu cầu này';
  END IF;

  UPDATE task_extension_requests
  SET status         = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by    = v_uid,
      review_comment = p_comment,
      decided_at     = NOW()
  WHERE id = p_extension_id;

  IF p_approve THEN
    UPDATE tasks SET due_date = v_ext.new_due_date WHERE id = v_ext.task_id;
  END IF;

  -- Notify requester
  INSERT INTO notifications (user_id, title, content, type, link)
  VALUES (v_ext.requested_by,
          CASE WHEN p_approve THEN 'Đã duyệt gia hạn' ELSE 'Đã từ chối gia hạn' END,
          v_actor || ' — "' || v_task.title || '"' ||
            CASE WHEN p_comment IS NOT NULL AND length(trim(p_comment)) > 0
                 THEN ': ' || p_comment ELSE '' END,
          'extension',
          '/dashboard/tasks/' || v_ext.task_id::text);
END $$;

GRANT EXECUTE ON FUNCTION task_decide_extension(UUID, BOOLEAN, TEXT) TO authenticated;


-- =====================================================================
-- §19. RPC — task_add_comment
-- =====================================================================
CREATE OR REPLACE FUNCTION task_add_comment(
  p_task_id        UUID,
  p_body           TEXT,
  p_attachment_ids UUID[] DEFAULT NULL  -- P2: link sang task_attachments
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_task       tasks%ROWTYPE;
  v_comment_id UUID;
  v_actor      TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  IF p_body IS NULL OR length(trim(p_body)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập nội dung';
  END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền bình luận';
  END IF;

  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  SELECT full_name INTO v_actor FROM profiles WHERE id = v_uid;

  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (p_task_id, v_uid, p_body)
  RETURNING id INTO v_comment_id;

  -- P2 sẽ link attachment.comment_id sau khi bảng task_attachments được tạo.
  -- Tạm thời chỉ trả comment_id, client tự update.

  -- Notify participants (trừ author + driver)
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Bình luận mới',
         v_actor || ' đã bình luận: ' || v_task.title,
         'comment',
         '/dashboard/tasks/' || p_task_id::text
  FROM (
    SELECT v_task.created_by AS u
    UNION
    SELECT user_id FROM task_assignees WHERE task_id = p_task_id
  ) tg
  WHERE u IS NOT NULL
    AND u <> v_uid
    AND (SELECT role FROM profiles WHERE id = u) <> 'driver';

  RETURN v_comment_id;
END $$;

GRANT EXECUTE ON FUNCTION task_add_comment(UUID, TEXT, UUID[]) TO authenticated;


-- =====================================================================
-- §20. RPC — task_cancel (creator + assignee + manager đều được)
-- =====================================================================
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

  -- System comment
  INSERT INTO task_comments (task_id, user_id, content)
  VALUES (p_task_id, v_uid,
          '[Hệ thống] Đã hủy công việc' ||
          CASE WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
               THEN '. Lý do: ' || p_reason ELSE '' END);

  -- Notify others
  INSERT INTO notifications (user_id, title, content, type, link)
  SELECT DISTINCT u,
         'Công việc đã bị hủy',
         v_actor || ' đã hủy: ' || v_task.title ||
         CASE WHEN p_reason IS NOT NULL AND length(trim(p_reason)) > 0
              THEN ' — ' || p_reason ELSE '' END,
         v_task.task_type,
         '/dashboard/tasks/' || p_task_id::text
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
-- §21. RPC — task_archive (admin/director)
-- =====================================================================
CREATE OR REPLACE FUNCTION task_archive(
  p_task_id UUID,
  p_archive BOOLEAN DEFAULT TRUE
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'director') THEN
    RAISE EXCEPTION 'Chỉ quản trị viên / Giám đốc được lưu trữ công việc';
  END IF;
  UPDATE tasks SET is_archived = p_archive WHERE id = p_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_archive(UUID, BOOLEAN) TO authenticated;


-- =====================================================================
-- §22. RELOAD POSTGREST
-- =====================================================================
NOTIFY pgrst, 'reload schema';


-- =====================================================================
-- §23. QUERIES VERIFY (chạy thủ công sau migration)
-- =====================================================================
-- SELECT enum_range(NULL::task_status);
--   ⇒ phải có 'submitted', 'canceled'; 'late','closed' vẫn còn (deprecated)
--
-- SELECT enum_range(NULL::task_priority);
--   ⇒ phải có 'low','medium','high'
--
-- SELECT COUNT(*) FROM information_schema.columns
-- WHERE table_name='tasks'
--   AND column_name IN ('target_value','current_value','unit','progress');
--   ⇒ = 0
--
-- SELECT proname FROM pg_proc
-- WHERE pronamespace='public'::regnamespace
--   AND (proname LIKE 'task_%' OR proname='tasks_dashboard' OR proname='user_can_see_task')
-- ORDER BY proname;
--   ⇒ phải thấy: task_add_comment, task_archive, task_cancel, task_create,
--               task_decide_extension, task_delegate, task_request_extension,
--               task_update_status, tasks_dashboard, user_can_see_task
--
-- SELECT * FROM tasks_dashboard('mine', '{}'::jsonb);
--   (chạy trong SQL Editor với "Switch role" → authenticated)
-- =====================================================================
