-- migration_dashboard_counters_batch_aware.sql
-- Fix: Counter trên dashboard + trang Công việc đang đếm 1 batch thành nhiều task.
--
-- Bối cảnh:
--   Khi user giao 1 báo cáo cho N phòng (hoặc giao việc cho N người với chế độ batch),
--   hệ thống tạo N task rows có cùng batch_id. UI hiện gom các row này thành 1 BatchTaskCard
--   nhưng các counter ở RPC vẫn COUNT(*) → 1 batch hiển thị thành N count.
--
-- Fix:
--   Đổi mọi COUNT(*) liên quan đến task → COUNT(DISTINCT COALESCE(batch_id, id))
--   để mỗi batch chỉ đếm 1 (task single vẫn = 1 vì batch_id NULL → fallback id).
--
-- Áp dụng cho 2 RPC: dashboard_summary (KPI dashboard chính) + tasks_dashboard (trang Công việc).

-- ============================================================================
-- 1) dashboard_summary — KPI cards (active / urgent / overdue / done_today)
-- ============================================================================
CREATE OR REPLACE FUNCTION dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_role      TEXT;
  v_dept      UUID;
  v_is_power  BOOLEAN;
  v_now       TIMESTAMPTZ := NOW();
  v_today_end TIMESTAMPTZ := date_trunc('day', NOW()) + INTERVAL '1 day';
  v_counts    JSONB;
  v_today     JSONB;
  v_docs      JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Chưa đăng nhập';
  END IF;

  SELECT role, department_id
    INTO v_role, v_dept
    FROM profiles
   WHERE id = v_uid;

  v_is_power := v_role IN ('admin', 'director');

  -- 1) Counts — batch-aware: 1 batch chỉ tính 1.
  WITH visible AS (
    SELECT t.id, t.batch_id, t.status, t.priority, t.due_date, t.updated_at
      FROM tasks t
     WHERE t.is_archived = FALSE
       AND (
         v_is_power
         OR t.created_by = v_uid
         OR EXISTS (
           SELECT 1 FROM task_assignees ta
            WHERE ta.task_id = t.id AND ta.user_id = v_uid
         )
       )
  )
  SELECT jsonb_build_object(
    'active',     COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status IN ('todo','doing','submitted')),
    'urgent',     COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status IN ('todo','doing','submitted') AND priority = 'high'),
    'overdue',    COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'done_today', COUNT(DISTINCT COALESCE(batch_id, id)) FILTER (WHERE status = 'done' AND updated_at >= date_trunc('day', v_now))
  )
    INTO v_counts
    FROM visible;

  -- 2) Việc cần làm hôm nay: top 10 batch/task của tôi — DISTINCT ON batch để không lặp.
  SELECT COALESCE(jsonb_agg(row_to_json(top.*)
                            ORDER BY top.due_date ASC NULLS LAST,
                                     CASE top.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END),
                  '[]'::jsonb)
    INTO v_today
    FROM (
      SELECT * FROM (
        SELECT DISTINCT ON (COALESCE(t.batch_id, t.id))
               t.id,
               t.title,
               t.task_type,
               t.status,
               t.priority,
               t.due_date,
               (t.due_date < v_now) AS is_overdue
          FROM tasks t
         WHERE t.is_archived = FALSE
           AND t.status IN ('todo','doing','submitted')
           AND (t.due_date IS NULL OR t.due_date < v_today_end)
           AND (
             t.created_by = v_uid
             OR EXISTS (
               SELECT 1 FROM task_assignees ta
                WHERE ta.task_id = t.id AND ta.user_id = v_uid
             )
           )
         ORDER BY COALESCE(t.batch_id, t.id),
                  t.due_date ASC NULLS LAST,
                  CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
      ) deduped
      ORDER BY deduped.due_date ASC NULLS LAST,
               CASE deduped.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
      LIMIT 10
    ) top;

  -- 3) Pending docs (giữ nguyên — bug fix lần trước đã loại doc đã chuyển đi)
  SELECT COALESCE(jsonb_agg(row_to_json(d.*)), '[]'::jsonb)
    INTO v_docs
    FROM (
      SELECT d.id,
             d.short_code,
             d.title,
             d.status,
             d.created_at,
             d.updated_at,
             d.current_assignee_id,
             d.creator_id,
             (
               SELECT row_to_json(c.*) FROM (
                 SELECT id, name, sla_hours, color
                   FROM document_categories
                  WHERE id = d.category_id
               ) c
             ) AS category,
             (
               SELECT COALESCE(jsonb_agg(row_to_json(h.*)), '[]'::jsonb)
                 FROM (
                   SELECT id, document_id, sender_id, receiver_id, status, sent_at, received_at
                     FROM document_handovers
                    WHERE document_id = d.id
                    ORDER BY sent_at DESC
                 ) h
             ) AS handovers
        FROM documents d
       WHERE d.status <> 'COMPLETED'
         AND (
           (
             d.current_assignee_id = v_uid
             AND NOT EXISTS (
               SELECT 1 FROM document_handovers h
                WHERE h.document_id = d.id
                  AND h.sender_id = v_uid
                  AND h.status = 'PENDING'
             )
           )
           OR EXISTS (
             SELECT 1 FROM document_handovers h
              WHERE h.document_id = d.id
                AND h.receiver_id = v_uid
                AND h.status = 'PENDING'
           )
         )
       ORDER BY d.updated_at DESC
       LIMIT 5
    ) d;

  RETURN jsonb_build_object(
    'counts',       COALESCE(v_counts, jsonb_build_object('active',0,'urgent',0,'overdue',0,'done_today',0)),
    'today_tasks',  COALESCE(v_today, '[]'::jsonb),
    'pending_docs', COALESCE(v_docs,  '[]'::jsonb),
    'role',         v_role
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dashboard_summary() TO authenticated;

-- ============================================================================
-- 2) tasks_dashboard — Counter trên trang Công việc (tab Inbox / status filter)
-- ============================================================================
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

  -- Counters batch-aware: mỗi batch chỉ tính 1, task single = 1 (do batch_id NULL → COALESCE về id).
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
