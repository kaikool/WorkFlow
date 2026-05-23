-- migration_dashboard_summary.sql
-- RPC dashboard_summary() — gộp 11 query của default dashboard về 1 round-trip duy nhất.
-- Trả về: { counts, today_tasks, pending_docs, role }
-- Visibility:
--   * admin / director: tất cả task active của chi nhánh.
--   * còn lại: task tôi tạo OR tôi là assignee (qua task_assignees junction).

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

  -- 1) Counts: 1 CTE quét visible task duy nhất, COUNT FILTER trên cùng tập hợp.
  WITH visible AS (
    SELECT t.id, t.status, t.priority, t.due_date, t.updated_at
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
    'active',     COUNT(*) FILTER (WHERE status IN ('todo','doing','submitted')),
    'urgent',     COUNT(*) FILTER (WHERE status IN ('todo','doing','submitted') AND priority = 'high'),
    'overdue',    COUNT(*) FILTER (WHERE due_date < v_now AND status NOT IN ('done','canceled')),
    'done_today', COUNT(*) FILTER (WHERE status = 'done' AND updated_at >= date_trunc('day', v_now))
  )
    INTO v_counts
    FROM visible;

  -- 2) Việc cần làm hôm nay: top 10 task của tôi (creator hoặc assignee) còn mở + due_date <= cuối ngày.
  SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
    INTO v_today
    FROM (
      SELECT t.id,
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
       ORDER BY t.due_date ASC NULLS LAST,
                CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END
       LIMIT 10
    ) r;

  -- 3) Pending docs: hồ sơ tôi đang giữ hoặc đang chờ tôi nhận, chưa hoàn tất.
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
           d.current_assignee_id = v_uid
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
NOTIFY pgrst, 'reload schema';
