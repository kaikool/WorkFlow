-- migration_tasks_default_assignee.sql
-- Mở 1 cơ chế DUY NHẤT để "tìm người nhận mặc định cho 1 phòng":
--   _resolve_default_assignee(p_dept_id, p_override) → UUID
--
-- Logic ưu tiên:
--   1. p_override (nếu admin/creator pre-pick trên template recurring + còn active)
--   2. TP active của phòng (role=manager + is_department_head)
--   3. Manager active đầu tiên của phòng (phòng chưa flag head)
--   4. NULL — caller quyết raise hay skip
--
-- Tận dụng cho:
--   - task_create: ad-hoc, p_override luôn NULL → giữ nguyên hành vi auto-fill TP
--   - recurring_fire_due: dùng v_template.default_assignee_id làm override
--
-- Thêm field `default_assignee_id` vào `task_recurring_templates` (nullable).
-- ON DELETE SET NULL → nếu cán bộ đã chọn rời tổ chức, template tự fallback về TP
-- thay vì gãy.

-- =====================================================================
-- §1. Helper chung — tìm người nhận mặc định
-- =====================================================================
CREATE OR REPLACE FUNCTION _resolve_default_assignee(
  p_dept_id  UUID,
  p_override UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Bước 1: override do người tạo template chỉ định — ưu tiên tuyệt đối nếu còn active.
  -- KHÔNG ép phải cùng phòng: admin có thể uỷ quyền chéo phòng nếu nghiệp vụ cho phép.
  IF p_override IS NOT NULL THEN
    SELECT id INTO v_id FROM profiles WHERE id = p_override AND is_active = TRUE;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  IF p_dept_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Bước 2: TP active của phòng
  SELECT id INTO v_id FROM profiles
  WHERE department_id = p_dept_id
    AND role = 'manager'
    AND is_department_head = TRUE
    AND is_active = TRUE
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Bước 3: fallback manager active đầu tiên — phòng có thể chưa flag is_department_head
  SELECT id INTO v_id FROM profiles
  WHERE department_id = p_dept_id
    AND role = 'manager'
    AND is_active = TRUE
  LIMIT 1;

  RETURN v_id; -- có thể NULL, caller xử lý
END $$;

GRANT EXECUTE ON FUNCTION _resolve_default_assignee(UUID, UUID) TO authenticated, service_role;


-- =====================================================================
-- §2. Thêm cột `default_assignee_id` vào `task_recurring_templates`
-- =====================================================================
ALTER TABLE task_recurring_templates
  ADD COLUMN IF NOT EXISTS default_assignee_id UUID
    REFERENCES profiles(id) ON DELETE SET NULL;

-- Comment để hiện rõ ý nghĩa khi DBA xem schema
COMMENT ON COLUMN task_recurring_templates.default_assignee_id IS
  'Cán bộ mặc định nhận task sinh ra từ template này. NULL → fallback Trưởng phòng của target_department_ids.';


-- =====================================================================
-- §3. task_create — tận dụng helper (ad-hoc, không có override)
-- =====================================================================
-- Bản chất giữ nguyên với migration_tasks_standardize.sql §2: report giao cho phòng
-- mà không kèm assignee thì auto-fill TP. Khác duy nhất: gọi helper thay vì inline.
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
  v_is_hub       BOOLEAN;
  v_task_id      UUID;
  v_a            UUID;
  v_creator_name TEXT;
  v_tp_id        UUID;
  v_dept_name    TEXT;
  v_assignees    UUID[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id, full_name INTO v_role, v_dept, v_creator_name
  FROM profiles WHERE id = v_uid;
  v_is_hub := _is_hub_department(v_dept);

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
    IF p_task_type = 'task' THEN
      IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) != 1
         OR p_assignee_ids[1] != v_uid THEN
        RAISE EXCEPTION 'Bạn chỉ được tự ghi chú việc cho mình';
      END IF;
      IF p_dept_id IS NULL THEN p_dept_id := v_dept; END IF;
    ELSIF p_task_type = 'report' THEN
      IF NOT v_is_hub THEN
        RAISE EXCEPTION 'Bạn không có quyền yêu cầu báo cáo';
      END IF;
    END IF;
  ELSIF v_role = 'manager' THEN
    IF p_task_type = 'task' AND p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
      IF EXISTS (
        SELECT 1 FROM unnest(p_assignee_ids) a
        JOIN profiles pr ON pr.id = a
        WHERE pr.department_id IS DISTINCT FROM v_dept
      ) THEN
        RAISE EXCEPTION 'Trưởng phòng chỉ được giao việc trong phòng mình';
      END IF;
    ELSIF p_task_type = 'report' AND NOT v_is_hub THEN
      IF p_dept_id IS NOT NULL AND p_dept_id <> v_dept THEN
        RAISE EXCEPTION 'Trưởng phòng không thuộc phòng đầu mối chỉ được yêu cầu báo cáo trong phòng mình';
      END IF;
    END IF;
  END IF;

  IF p_task_type = 'task' AND (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0) THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận';
  END IF;

  -- Auto-fill TP qua helper chung (ad-hoc → không có override)
  v_assignees := p_assignee_ids;
  IF p_task_type = 'report'
     AND p_dept_id IS NOT NULL
     AND (v_assignees IS NULL OR array_length(v_assignees, 1) = 0)
  THEN
    v_tp_id := _resolve_default_assignee(p_dept_id, NULL);

    IF v_tp_id IS NULL THEN
      SELECT name INTO v_dept_name FROM departments WHERE id = p_dept_id;
      RAISE EXCEPTION 'Phòng "%" chưa có Trưởng phòng đang hoạt động — vui lòng chọn cán bộ cụ thể',
        COALESCE(v_dept_name, p_dept_id::text);
    END IF;

    v_assignees := ARRAY[v_tp_id];
  END IF;

  INSERT INTO tasks (
    title, description, task_type, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    p_title, p_description, p_task_type,
    COALESCE(p_priority, 'medium'), p_due_date, p_dept_id,
    CASE WHEN v_assignees IS NOT NULL AND array_length(v_assignees, 1) > 0
         THEN v_assignees[1] ELSE NULL END,
    v_uid, 'todo'::task_status,
    COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  )
  RETURNING id INTO v_task_id;

  IF v_assignees IS NOT NULL AND array_length(v_assignees, 1) > 0 THEN
    FOREACH v_a IN ARRAY v_assignees LOOP
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
  END IF;

  RETURN v_task_id;
END $$;

GRANT EXECUTE ON FUNCTION task_create(
  TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID
) TO authenticated;


-- =====================================================================
-- §4. recurring_fire_due — ưu tiên template.default_assignee_id
-- =====================================================================
-- Khác bản trước: helper nhận v_template.default_assignee_id. Nếu admin/creator
-- pre-pick "Anh Tài kế toán" → mọi kỳ sinh task gán thẳng cho Anh Tài, không cần
-- TP phân công lại sau khi nhận. Nếu Anh Tài inactive sau này, fallback về TP.
CREATE OR REPLACE FUNCTION recurring_fire_due()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_template     task_recurring_templates%ROWTYPE;
  v_task_id      UUID;
  v_due          TIMESTAMPTZ;
  v_count        INT := 0;
  v_creator_name TEXT;
  v_dept         UUID;
  v_assignee     UUID;
  v_target_id    UUID;
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

    -- Sinh task cho từng department — dùng helper với override = template.default_assignee_id
    IF array_length(v_template.target_department_ids, 1) > 0 THEN
      FOREACH v_dept IN ARRAY v_template.target_department_ids LOOP
        v_target_id := _resolve_default_assignee(v_dept, v_template.default_assignee_id);

        IF v_target_id IS NULL THEN
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_template.created_by,
                  'Báo cáo định kỳ bị bỏ qua',
                  'Phòng không có Trưởng phòng đang hoạt động — báo cáo "' || v_template.title || '" không được sinh.',
                  v_template.task_type,
                  '/dashboard/tasks/recurring');
          CONTINUE;
        END IF;

        INSERT INTO tasks (
          title, description, task_type, priority, due_date,
          department_id, assignee_id, created_by, status, metadata
        ) VALUES (
          v_template.title, v_template.description, v_template.task_type,
          v_template.priority, v_due,
          v_dept, v_target_id, v_template.created_by, 'todo',
          jsonb_build_object('recurring_template_id', v_template.id)
        )
        RETURNING id INTO v_task_id;

        INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_target_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO notifications (user_id, title, content, type, link)
        VALUES (v_target_id,
                'Yêu cầu báo cáo định kỳ',
                COALESCE(v_creator_name, '[Hệ thống]') || ' đã sinh tự động: ' || v_template.title,
                v_template.task_type,
                '/dashboard/tasks?id=' || v_task_id::text);

        v_count := v_count + 1;
      END LOOP;
    END IF;

    -- Sinh task cho từng user đích danh (target_user_ids) — không qua helper
    IF array_length(v_template.target_user_ids, 1) > 0 THEN
      FOREACH v_assignee IN ARRAY v_template.target_user_ids LOOP
        INSERT INTO tasks (
          title, description, task_type, priority, due_date,
          department_id, assignee_id, created_by, status, metadata
        )
        SELECT v_template.title, v_template.description, v_template.task_type,
               v_template.priority, v_due,
               p.department_id, p.id, v_template.created_by, 'todo',
               jsonb_build_object('recurring_template_id', v_template.id)
        FROM profiles p WHERE p.id = v_assignee
        RETURNING id INTO v_task_id;

        IF v_task_id IS NOT NULL THEN
          INSERT INTO task_assignees (task_id, user_id) VALUES (v_task_id, v_assignee)
          ON CONFLICT DO NOTHING;
          INSERT INTO notifications (user_id, title, content, type, link)
          VALUES (v_assignee,
                  'Công việc định kỳ',
                  COALESCE(v_creator_name, '[Hệ thống]') || ' đã giao: ' || v_template.title,
                  v_template.task_type,
                  '/dashboard/tasks?id=' || v_task_id::text);
          v_count := v_count + 1;
        END IF;
      END LOOP;
    END IF;

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
END $$;

GRANT EXECUTE ON FUNCTION recurring_fire_due() TO authenticated, service_role;


-- =====================================================================
-- §5. recurring_template_upsert — nhận p_default_assignee_id
-- =====================================================================
-- Giữ chữ ký cũ + thêm 1 param optional ở cuối để không vỡ client cũ
-- (chưa update wrapper). Validate role/quyền tạo template y nguyên hành vi cũ.
CREATE OR REPLACE FUNCTION recurring_template_upsert(
  p_id                    UUID,
  p_title                 TEXT,
  p_description           TEXT,
  p_task_type             TEXT,
  p_priority              task_priority,
  p_target_department_ids UUID[],
  p_target_user_ids       UUID[],
  p_schedule_kind         TEXT,
  p_weekly_dow            INT,
  p_weekly_time           TEXT,
  p_monthly_dom           INT,
  p_monthly_time          TEXT,
  p_timezone              TEXT DEFAULT 'Asia/Ho_Chi_Minh',
  p_due_days_after_fire   INT DEFAULT 7,
  p_is_active             BOOLEAN DEFAULT TRUE,
  p_default_assignee_id   UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_role    TEXT;
  v_dept    UUID;
  v_is_hub  BOOLEAN;
  v_id      UUID := p_id;
  v_next    TIMESTAMPTZ;
  v_time    TIME;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;
  v_is_hub := _is_hub_department(v_dept);

  IF NOT (
    v_role IN ('admin', 'director', 'manager')
    OR (v_role = 'staff' AND v_is_hub)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo template định kỳ';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_task_type NOT IN ('task', 'report') THEN
    RAISE EXCEPTION 'Loại công việc không hợp lệ';
  END IF;
  IF p_schedule_kind NOT IN ('weekly', 'monthly') THEN
    RAISE EXCEPTION 'Lịch không hợp lệ';
  END IF;
  IF p_schedule_kind = 'weekly' AND (p_weekly_dow IS NULL OR p_weekly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn thứ và giờ';
  END IF;
  IF p_schedule_kind = 'monthly' AND (p_monthly_dom IS NULL OR p_monthly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn ngày và giờ';
  END IF;

  -- Validate default_assignee_id nếu có
  IF p_default_assignee_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_default_assignee_id AND is_active = TRUE) THEN
      RAISE EXCEPTION 'Cán bộ mặc định đã không còn hoạt động';
    END IF;
  END IF;

  v_time := COALESCE(
    p_weekly_time::TIME,
    p_monthly_time::TIME,
    '09:00'::TIME
  );

  v_next := _recurring_next_run(
    p_schedule_kind, p_weekly_dow, p_weekly_time,
    p_monthly_dom, p_monthly_time,
    COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'),
    NOW()
  );

  IF v_id IS NULL THEN
    INSERT INTO task_recurring_templates (
      title, description, task_type, priority,
      target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire,
      created_by, is_active, next_run_at, default_assignee_id
    ) VALUES (
      trim(p_title), NULLIF(trim(COALESCE(p_description, '')), ''), p_task_type,
      COALESCE(p_priority, 'medium'),
      COALESCE(p_target_department_ids, ARRAY[]::UUID[]),
      COALESCE(p_target_user_ids, ARRAY[]::UUID[]),
      p_schedule_kind, p_weekly_dow, p_weekly_time::TIME,
      p_monthly_dom, p_monthly_time::TIME,
      COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'),
      COALESCE(p_due_days_after_fire, 7),
      v_uid, COALESCE(p_is_active, TRUE), v_next, p_default_assignee_id
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE task_recurring_templates SET
      title                  = trim(p_title),
      description            = NULLIF(trim(COALESCE(p_description, '')), ''),
      task_type              = p_task_type,
      priority               = COALESCE(p_priority, 'medium'),
      target_department_ids  = COALESCE(p_target_department_ids, ARRAY[]::UUID[]),
      target_user_ids        = COALESCE(p_target_user_ids, ARRAY[]::UUID[]),
      schedule_kind          = p_schedule_kind,
      weekly_dow             = p_weekly_dow,
      weekly_time            = p_weekly_time::TIME,
      monthly_dom            = p_monthly_dom,
      monthly_time           = p_monthly_time::TIME,
      timezone               = COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'),
      due_days_after_fire    = COALESCE(p_due_days_after_fire, 7),
      is_active              = COALESCE(p_is_active, TRUE),
      next_run_at            = v_next,
      default_assignee_id    = p_default_assignee_id,
      updated_at             = NOW()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(
  UUID, TEXT, TEXT, TEXT, task_priority,
  UUID[], UUID[],
  TEXT, INT, TEXT, INT, TEXT,
  TEXT, INT, BOOLEAN, UUID
) TO authenticated;


NOTIFY pgrst, 'reload schema';
