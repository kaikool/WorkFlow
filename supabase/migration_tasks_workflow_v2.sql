-- =====================================================================
-- MIGRATION: TASK WORKFLOW V2 (batch grouping + optional approval + self-approve)
-- =====================================================================
-- Thay đổi nghiệp vụ:
--   1. Mặc định bỏ duyệt báo cáo: doing → done thẳng (NV bấm "Hoàn thành").
--      Tickbox 'Cần TP duyệt' khi tạo → bật flow submitted → done.
--   2. Khi người nộp = người có quyền duyệt (TP/PP cùng phòng) → auto-done
--      bất kể requires_approval. Timeline ghi nhận audit comment.
--   3. Gom batch: cùng 1 UUID batch_id cho nhiều task tạo 1 lần.
-- =====================================================================

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_tasks_batch
  ON tasks(batch_id) WHERE batch_id IS NOT NULL;


-- =====================================================================
-- task_create: thêm 2 param p_requires_approval, p_batch_id
-- =====================================================================
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB);

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
  v_task_id      UUID;
  v_a            UUID;
  v_creator_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_creator_name
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

  IF v_role = 'staff' THEN
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
-- task_update_status: thêm logic skip duyệt + self-approve audit
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
  v_self_approve BOOLEAN := FALSE;
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

  IF v_task.status = p_new_status THEN RETURN; END IF;

  -- ─── State machine ────────────────────────────────────────────────
  IF p_new_status = 'canceled' THEN
    RAISE EXCEPTION 'Hãy dùng task_cancel để hủy công việc';

  ELSIF p_new_status = 'doing' THEN
    IF NOT (v_is_assignee OR v_is_manager) THEN
      RAISE EXCEPTION 'Bạn không có quyền chuyển trạng thái';
    END IF;
    IF v_task.status NOT IN ('todo', 'submitted') THEN
      RAISE EXCEPTION 'Không thể chuyển sang Đang làm từ trạng thái hiện tại';
    END IF;
    IF v_task.status = 'submitted' THEN
      IF p_comment IS NULL OR length(trim(p_comment)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả về';
      END IF;
      IF NOT v_is_manager THEN
        RAISE EXCEPTION 'Chỉ Trưởng phòng được trả về báo cáo';
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
      IF NOT (v_is_assignee OR v_is_manager) THEN
        RAISE EXCEPTION 'Bạn không có quyền hoàn thành công việc này';
      END IF;
      IF v_task.status NOT IN ('todo', 'doing') THEN
        RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
      END IF;
    ELSE
      -- Báo cáo
      IF v_task.requires_approval = FALSE THEN
        -- Không cần duyệt: assignee có thể done thẳng từ todo/doing
        IF NOT v_is_assignee THEN
          RAISE EXCEPTION 'Chỉ người được giao mới được ghi nhận hoàn thành';
        END IF;
        IF v_task.status NOT IN ('todo', 'doing') THEN
          RAISE EXCEPTION 'Không thể hoàn thành từ trạng thái hiện tại';
        END IF;
        -- Audit khi self-approve (assignee đồng thời là TP/admin/director của phòng)
        IF v_is_manager THEN v_self_approve := TRUE; END IF;
      ELSE
        -- Có yêu cầu duyệt
        IF v_task.status = 'submitted' THEN
          IF NOT v_is_manager THEN
            RAISE EXCEPTION 'Chỉ Trưởng phòng được duyệt báo cáo';
          END IF;
        ELSIF v_task.status = 'doing' AND v_is_assignee AND v_is_manager THEN
          -- Self-approve: TP tự nộp + tự duyệt cùng lúc, có audit
          v_self_approve := TRUE;
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

  UPDATE tasks SET status = p_new_status WHERE id = p_task_id;

  IF v_self_approve THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid,
            '[Hệ thống] ' || v_actor_name || ' tự nộp và tự ghi nhận hoàn thành báo cáo của chính mình.');
  END IF;

  IF p_comment IS NOT NULL AND length(trim(p_comment)) > 0 THEN
    INSERT INTO task_comments (task_id, user_id, content)
    VALUES (p_task_id, v_uid, p_comment);
  END IF;

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
-- tasks_dashboard: thêm batch_id + requires_approval vào list output
-- =====================================================================
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
  v_lists    JSONB;
  v_resource JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  IF v_role = 'staff' THEN
    p_scope := 'mine';
  ELSIF v_role NOT IN ('admin', 'director') AND p_scope = 'branch' THEN
    p_scope := 'dept';
  END IF;

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
    )
  )
  INTO v_counts FROM visible;

  SELECT jsonb_agg(row_to_json(x.*) ORDER BY x.is_overdue DESC, x.due_date NULLS LAST, x.created_at DESC)
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
    LIMIT 100
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
    'role',          v_role
  );
END $$;

GRANT EXECUTE ON FUNCTION tasks_dashboard(TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
