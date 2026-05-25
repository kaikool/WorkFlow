-- migration_dashboard_summary_fix_pending_docs.sql
-- Fix: Widget "Hồ sơ cần xử lý" trên dashboard hiển thị nhầm hồ sơ user đã chuyển đi.
--
-- Bối cảnh:
--   Pattern transit state PENDING_RECEIPT (ARCHITECTURE.md §6.8): khi user chuyển hồ sơ,
--   RPC transfer_document chỉ đổi documents.status='PENDING_RECEIPT', KHÔNG đổi
--   current_assignee_id ngay (chỉ thay đổi khi receiver acknowledge_document).
--   Do đó hồ sơ user đã chuyển đi vẫn match điều kiện current_assignee_id = uid,
--   khiến widget dashboard hiển thị nó với label "Chờ tôi nhận" — sai logic
--   (đáng lẽ phải hiện cho receiver, không phải sender).
--
-- Fix:
--   Loại bỏ doc có outgoing handover PENDING từ user khỏi danh sách "cần xử lý".
--   Lý do nghiệp vụ: hồ sơ tôi đã chuyển đi đang chờ người khác xác nhận —
--   tôi không cần hành động gì nữa, không nên lẫn với "việc cần làm hôm nay".

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

  -- 1) Counts
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

  -- 2) Việc cần làm hôm nay
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

  -- 3) Pending docs: hồ sơ cần tôi hành động — KHÔNG bao gồm doc tôi đã chuyển đi.
  --    Điều kiện match:
  --      (a) Tôi đang giữ trên bàn (current_assignee_id = me) VÀ không có outgoing PENDING từ tôi.
  --      (b) Có người chuyển cho tôi (incoming PENDING với receiver = me).
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
           -- (a) Tôi đang giữ, chưa chuyển đi (loại doc có outgoing PENDING từ tôi)
           (
             d.current_assignee_id = v_uid
             AND NOT EXISTS (
               SELECT 1 FROM document_handovers h
                WHERE h.document_id = d.id
                  AND h.sender_id = v_uid
                  AND h.status = 'PENDING'
             )
           )
           -- (b) Có người chuyển cho tôi, đang chờ tôi nhận
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
