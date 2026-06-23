-- =====================================================
-- TASKS: bỏ người nhận mặc định trong mẫu định kỳ, chặn BGĐ làm phòng nhận
-- =====================================================

CREATE OR REPLACE FUNCTION _is_director_department(p_dept_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM departments d
    WHERE d.id = p_dept_id
      AND d.code = '13601'
  );
$$;

CREATE OR REPLACE FUNCTION guard_task_receiver_department()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.department_id IS NOT NULL AND _is_director_department(NEW.department_id) THEN
    RAISE EXCEPTION 'Ban Giám đốc không phải phòng nhận việc';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_task_receiver_department ON tasks;
CREATE TRIGGER trg_guard_task_receiver_department
  BEFORE INSERT OR UPDATE OF department_id ON tasks
  FOR EACH ROW EXECUTE FUNCTION guard_task_receiver_department();

CREATE OR REPLACE FUNCTION guard_recurring_template_receivers()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.target_department_ids, '{}'::uuid[])) AS dept_id
    WHERE _is_director_department(dept_id)
  ) THEN
    RAISE EXCEPTION 'Ban Giám đốc không phải phòng nhận việc định kỳ';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_recurring_template_receivers ON task_recurring_templates;
CREATE TRIGGER trg_guard_recurring_template_receivers
  BEFORE INSERT OR UPDATE OF target_department_ids ON task_recurring_templates
  FOR EACH ROW EXECUTE FUNCTION guard_recurring_template_receivers();

UPDATE task_recurring_templates t
SET target_department_ids = COALESCE((
  SELECT array_agg(dept_id)
  FROM unnest(t.target_department_ids) AS dept_id
  WHERE NOT _is_director_department(dept_id)
), '{}'::uuid[])
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(t.target_department_ids, '{}'::uuid[])) AS dept_id
  WHERE _is_director_department(dept_id)
);

ALTER TABLE task_recurring_templates
  DROP COLUMN IF EXISTS default_assignee_id;

DROP FUNCTION IF EXISTS recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID, UUID);
DROP FUNCTION IF EXISTS recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID);

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
  p_id                    UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_dept_code TEXT;
  v_is_hub BOOLEAN;
  v_id UUID;
  v_next TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT p.role, p.department_id, d.code INTO v_role, v_dept, v_dept_code
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  WHERE p.id = v_uid;

  v_is_hub := COALESCE(v_dept_code IN ('13618', '13601', '13602', '13605', '13609', '13603'), FALSE);

  IF v_role IN ('driver','secretary','hr_officer') OR (v_role = 'staff' AND NOT v_is_hub) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo công việc định kỳ';
  END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM task_recurring_templates WHERE id = p_id AND created_by = v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền sửa mẫu định kỳ này';
  END IF;
  IF COALESCE(array_length(p_target_department_ids,1),0) = 0 AND COALESCE(array_length(p_target_user_ids,1),0) = 0 THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng ban';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_target_department_ids, '{}'::uuid[])) AS dept_id
    WHERE _is_director_department(dept_id)
  ) THEN
    RAISE EXCEPTION 'Ban Giám đốc không phải phòng nhận việc định kỳ';
  END IF;
  IF v_role = 'manager' AND NOT v_is_hub AND EXISTS (
    SELECT 1 FROM unnest(p_target_department_ids) AS target_dept_id
    WHERE target_dept_id IS DISTINCT FROM v_dept
  ) THEN
    RAISE EXCEPTION 'Chỉ được tạo công việc định kỳ trong phòng mình';
  END IF;
  IF COALESCE(array_length(p_target_user_ids,1),0) > 0 AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ANY(p_target_user_ids)
      AND (p.is_active IS DISTINCT FROM TRUE OR p.role IN ('admin','director','driver','secretary','hr_officer'))
  ) THEN
    RAISE EXCEPTION 'Người nhận không hợp lệ';
  END IF;
  IF COALESCE(array_length(p_target_user_ids,1),0) > 0 AND v_role NOT IN ('admin','director') AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = ANY(p_target_user_ids)
      AND p.department_id IS DISTINCT FROM v_dept
  ) THEN
    RAISE EXCEPTION 'Chỉ được chọn cán bộ trong phòng mình';
  END IF;

  v_next := _recurring_next_run(p_schedule_kind, p_weekly_dow, p_weekly_time, p_monthly_dom, p_monthly_time, p_timezone, NOW());

  IF p_id IS NOT NULL THEN
    UPDATE task_recurring_templates SET
      title = trim(p_title),
      description = NULLIF(trim(COALESCE(p_description,'')), ''),
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
      next_run_at = v_next
    WHERE id = p_id AND created_by = v_uid
    RETURNING id INTO v_id;
  ELSE
    INSERT INTO task_recurring_templates (
      title, description, priority, target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire, created_by, is_active, next_run_at
    ) VALUES (
      trim(p_title), NULLIF(trim(COALESCE(p_description,'')), ''), p_priority, p_target_department_ids, p_target_user_ids,
      p_schedule_kind, p_weekly_dow, p_weekly_time::TIME, p_monthly_dom, p_monthly_time::TIME,
      p_timezone, p_due_days_after_fire, v_uid, p_is_active, v_next
    ) RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(TEXT, TEXT, task_priority, UUID[], UUID[], TEXT, INT, TEXT, INT, TEXT, TEXT, INT, BOOLEAN, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION recurring_fire_due()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INT := 0;
  v_t RECORD;
  v_uid UUID;
  v_task_id UUID;
  v_a UUID;
  v_dept_id UUID;
  v_target_id UUID;
BEGIN
  FOR v_t IN
    SELECT * FROM task_recurring_templates
    WHERE is_active = TRUE AND next_run_at <= NOW()
    ORDER BY next_run_at ASC
    LIMIT 20
  LOOP
    v_uid := COALESCE(v_t.created_by, (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1));
    IF v_uid IS NULL THEN CONTINUE; END IF;

    UPDATE task_recurring_templates
    SET last_fired_at = NOW(),
        next_run_at = _recurring_next_run(v_t.schedule_kind, v_t.weekly_dow, v_t.weekly_time, v_t.monthly_dom, v_t.monthly_time, v_t.timezone, NOW())
    WHERE id = v_t.id;

    IF COALESCE(array_length(v_t.target_department_ids, 1), 0) > 0 THEN
      FOREACH v_dept_id IN ARRAY v_t.target_department_ids LOOP
        IF _is_director_department(v_dept_id) THEN CONTINUE; END IF;
        v_target_id := _resolve_default_assignee(v_dept_id);
        IF v_target_id IS NULL THEN CONTINUE; END IF;
        INSERT INTO tasks (title, description, priority, due_date, department_id, assignee_id, created_by, status, metadata, is_archived, requires_approval)
        VALUES (v_t.title, v_t.description, v_t.priority, NOW() + (v_t.due_days_after_fire || ' days')::INTERVAL,
                v_dept_id, v_target_id, v_uid, 'todo'::task_status, jsonb_build_object('from_recurring', true, 'recurring_template_id', v_t.id), FALSE, TRUE)
        RETURNING id INTO v_task_id;
        INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_target_id) ON CONFLICT DO NOTHING;
        INSERT INTO notifications (user_id, title, content, type, link)
        VALUES (v_target_id, 'Công việc định kỳ', 'Hệ thống đã sinh: ' || v_t.title, 'task', '/dashboard/tasks?id=' || v_task_id::text);
        v_count := v_count + 1;
      END LOOP;
    END IF;

    IF COALESCE(array_length(v_t.target_user_ids, 1), 0) > 0 THEN
      FOREACH v_a IN ARRAY v_t.target_user_ids LOOP
        INSERT INTO tasks (title, description, priority, due_date, department_id, assignee_id, created_by, status, metadata, is_archived, requires_approval)
        SELECT v_t.title, v_t.description, v_t.priority, NOW() + (v_t.due_days_after_fire || ' days')::INTERVAL,
               p.department_id, p.id, v_uid, 'todo'::task_status, jsonb_build_object('from_recurring', true, 'recurring_template_id', v_t.id), FALSE, TRUE
        FROM profiles p
        WHERE p.id = v_a AND p.is_active = TRUE AND p.role NOT IN ('admin','director','driver','secretary','hr_officer')
        RETURNING id INTO v_task_id;
        IF v_task_id IS NOT NULL THEN
          INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_a) ON CONFLICT DO NOTHING;
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_a, 'Công việc định kỳ', 'Hệ thống đã sinh: ' || v_t.title, 'task', '/dashboard/tasks?id=' || v_task_id::text);
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION recurring_fire_due() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
