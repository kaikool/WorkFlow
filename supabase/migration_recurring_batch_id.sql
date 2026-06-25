-- Migration: gán batch_id chung cho các task sinh từ cùng 1 lần fire recurring
-- Mục đích: các task gửi nhiều phòng/nhiều người từ 1 mẫu định kỳ được gom
--   thành 1 batch trên UI, không hiển thị rời rạc từng cái.
--
-- Chạy trong Supabase Dashboard → SQL Editor

BEGIN;

CREATE OR REPLACE FUNCTION public.recurring_fire_due()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_template     task_recurring_templates%ROWTYPE;
  v_task_id      UUID;
  v_due          TIMESTAMPTZ;
  v_count        INT := 0;
  v_creator_name TEXT;
  v_dept         UUID;
  v_assignee     UUID;
  v_batch_id     UUID;  -- ⭐ batch_id chung cho 1 lần fire
BEGIN
  FOR v_template IN
    SELECT * FROM task_recurring_templates
    WHERE is_active = TRUE
      AND next_run_at IS NOT NULL
      AND next_run_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    v_due := v_template.next_run_at + (v_template.due_days_after_fire || ' days')::interval;
    SELECT full_name INTO v_creator_name FROM profiles WHERE id = v_template.created_by;
    v_batch_id := gen_random_uuid();  -- ⭐ 1 batch_id cho tất cả task lần này

    -- Sinh task cho từng department
    IF array_length(v_template.target_department_ids, 1) > 0 THEN
      FOREACH v_dept IN ARRAY v_template.target_department_ids LOOP
        INSERT INTO tasks (
          title, description, task_type, priority, due_date,
          department_id, created_by, status, metadata, batch_id
        ) VALUES (
          v_template.title, v_template.description, v_template.task_type,
          v_template.priority, v_due,
          v_dept, v_template.created_by, 'todo',
          jsonb_build_object('recurring_template_id', v_template.id),
          v_batch_id
        )
        RETURNING id INTO v_task_id;

        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT p.id,
               'Yêu cầu báo cáo định kỳ',
               COALESCE(v_creator_name, 'Hệ thống tự động') || ' đã sinh tự động: ' || v_template.title,
               v_template.task_type,
               '/dashboard/tasks?id=' || v_task_id::text
        FROM profiles p
        WHERE p.department_id = v_dept
          AND p.role <> 'driver'
          AND (p.role = 'manager' OR p.is_department_head = TRUE);

        v_count := v_count + 1;
      END LOOP;
    END IF;

    -- Sinh task cho từng user đích danh
    IF array_length(v_template.target_user_ids, 1) > 0 THEN
      FOREACH v_assignee IN ARRAY v_template.target_user_ids LOOP
        INSERT INTO tasks (
          title, description, task_type, priority, due_date,
          department_id, assignee_id, created_by, status, metadata,
          batch_id
        )
        SELECT v_template.title, v_template.description, v_template.task_type,
               v_template.priority, v_due,
               p.department_id, p.id, v_template.created_by, 'todo',
               jsonb_build_object('recurring_template_id', v_template.id),
               v_batch_id
        FROM profiles p WHERE p.id = v_assignee
        RETURNING id INTO v_task_id;

        IF v_task_id IS NOT NULL THEN
          INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_assignee)
          ON CONFLICT DO NOTHING;
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_assignee,
                  'Công việc định kỳ',
                  COALESCE(v_creator_name, 'Hệ thống tự động') || ' đã giao: ' || v_template.title,
                  v_template.task_type,
                  '/dashboard/tasks?id=' || v_task_id::text);
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END IF;

    -- Cập nhật template
    UPDATE task_recurring_templates
    SET last_fired_at = v_template.next_run_at,
        next_run_at = _recurring_next_run(
          schedule_kind, weekly_dow, weekly_time,
          monthly_dom, monthly_time, timezone,
          GREATEST(v_template.next_run_at, NOW())
        )
    WHERE id = v_template.id;
  END LOOP;

  RETURN v_count;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
