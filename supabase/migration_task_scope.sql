-- migration_task_scope.sql
-- Đồng bộ scope quyền giao việc / yêu cầu báo cáo cho cả ad-hoc + recurring.
-- Thay thế migration_recurring_scope.sql (file đó chỉ vá recurring; bản này vá cả task_create).
--
-- Matrix quyền (chốt lại với PO):
--
--   | Vai trò            | Luồng A — Giao việc         | Luồng B — Yêu cầu báo cáo        |
--   |--------------------|-----------------------------|----------------------------------|
--   | admin              | Mọi phòng / mọi cán bộ      | Mọi phòng / mọi cán bộ           |
--   | director           | Mọi phòng / mọi cán bộ      | Mọi phòng / mọi cán bộ           |
--   | manager hub        | Mọi phòng* / cán bộ phòng mình | Mọi phòng* / cán bộ phòng mình |
--   | manager non-hub    | Chỉ cán bộ trong phòng mình | Chỉ trong phòng mình             |
--   | staff hub          | ❌                          | Mọi phòng* / cán bộ phòng mình   |
--   | staff non-hub      | ❌                          | ❌                                |
--
--   (*) "Mọi phòng" = giao qua phòng → đầu mối là TP của phòng đó (auto-fill TP).
--
-- Nguyên tắc:
--   - Cá nhân cross-dept = bypass TP → cấm cho hub user.
--   - Hub user muốn cross-dept phải qua target_department_ids (TP phòng nhận tự phân công).
--   - Logic auto-fill TP đã có sẵn ở task_create §2 và recurring_fire_due — chỉ cần
--     mở condition để áp cho task_type='task' nữa (không thêm code mới).


-- =====================================================================
-- §1. task_create — mở auto-fill TP cho task_type='task' + siết scope hub
-- =====================================================================
-- Thay đổi so với bản trong migration_tasks_standardize.sql:
--   1) Auto-fill TP ở §C cũ (task_type='report') → mở thành task_type IN ('report','task').
--   2) §B manager Luồng B: thêm check assignee phải = v_dept khi hub (cross-dept user_ids → reject).
--   3) §A staff Luồng B: thêm check assignee phải = v_dept khi hub.
--   4) Relax §D "Vui lòng chọn người nhận" — cho phép empty assignees khi p_dept_id non-null
--      (auto-fill TP đảm nhận). Vẫn raise nếu cả dept lẫn assignees đều rỗng.

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

  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
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

  -- §A. Quyền theo loại + scope user_ids
  IF v_role = 'staff' THEN
    IF p_task_type = 'task' THEN
      -- Staff (any, kể cả hub) chỉ tự ghi chú task cho mình.
      IF p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) != 1
         OR p_assignee_ids[1] != v_uid THEN
        RAISE EXCEPTION 'Bạn chỉ được tự ghi chú việc cho mình';
      END IF;
      IF p_dept_id IS NULL THEN p_dept_id := v_dept; END IF;
    ELSIF p_task_type = 'report' THEN
      IF NOT v_is_hub THEN
        RAISE EXCEPTION 'Bạn không có quyền yêu cầu báo cáo';
      END IF;
      -- Staff hub: nếu chọn cán bộ cụ thể → phải cùng phòng mình (không bypass TP phòng khác).
      IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
        IF EXISTS (
          SELECT 1 FROM unnest(p_assignee_ids) a
          JOIN profiles pr ON pr.id = a
          WHERE pr.department_id IS DISTINCT FROM v_dept
        ) THEN
          RAISE EXCEPTION 'Cán bộ phòng đầu mối chỉ được yêu cầu báo cáo từ cán bộ trong phòng mình. Muốn yêu cầu phòng khác, hãy chọn "Cả phòng ban".';
        END IF;
      END IF;
    END IF;
  ELSIF v_role = 'manager' THEN
    IF p_task_type = 'task' THEN
      -- Manager (kể cả hub): nếu chọn cán bộ cụ thể → phải cùng phòng mình.
      IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
        IF EXISTS (
          SELECT 1 FROM unnest(p_assignee_ids) a
          JOIN profiles pr ON pr.id = a
          WHERE pr.department_id IS DISTINCT FROM v_dept
        ) THEN
          RAISE EXCEPTION 'Trưởng phòng chỉ được giao việc đích danh cho cán bộ trong phòng mình. Muốn giao phòng khác, hãy chọn "Cả phòng ban".';
        END IF;
      END IF;
      -- Manager non-hub: không được giao task cross-dept dù qua phòng.
      IF NOT v_is_hub AND p_dept_id IS NOT NULL AND p_dept_id <> v_dept THEN
        RAISE EXCEPTION 'Trưởng phòng không thuộc phòng đầu mối chỉ được giao việc trong phòng mình';
      END IF;
    ELSIF p_task_type = 'report' THEN
      IF v_is_hub THEN
        -- Manager hub: cá nhân cụ thể chỉ trong phòng mình; cross-dept đi qua p_dept_id.
        IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
          IF EXISTS (
            SELECT 1 FROM unnest(p_assignee_ids) a
            JOIN profiles pr ON pr.id = a
            WHERE pr.department_id IS DISTINCT FROM v_dept
          ) THEN
            RAISE EXCEPTION 'Trưởng phòng đầu mối chỉ được yêu cầu báo cáo đích danh cán bộ trong phòng mình. Muốn yêu cầu phòng khác, hãy chọn "Cả phòng ban".';
          END IF;
        END IF;
      ELSE
        -- Manager non-hub: dept_id phải = phòng mình; assignee (nếu có) phải = phòng mình.
        IF p_dept_id IS NOT NULL AND p_dept_id <> v_dept THEN
          RAISE EXCEPTION 'Trưởng phòng không thuộc phòng đầu mối chỉ được yêu cầu báo cáo trong phòng mình';
        END IF;
        IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
          IF EXISTS (
            SELECT 1 FROM unnest(p_assignee_ids) a
            JOIN profiles pr ON pr.id = a
            WHERE pr.department_id IS DISTINCT FROM v_dept
          ) THEN
            RAISE EXCEPTION 'Trưởng phòng không thuộc phòng đầu mối chỉ được yêu cầu báo cáo cán bộ trong phòng mình';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  -- Admin/Director: bỏ check — toàn quyền.

  -- §B. Phải có ít nhất 1 trong 2: dept_id (đầu mối → TP) hoặc assignees
  IF (p_assignee_ids IS NULL OR array_length(p_assignee_ids, 1) = 0)
     AND p_dept_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn người nhận hoặc phòng nhận';
  END IF;

  -- §C. AUTO-FILL TP cho cả task + report khi giao qua phòng (assignees rỗng).
  --     "Mọi phòng" → đầu mối là TP phòng đó. Reuse logic recurring_fire_due.
  v_assignees := p_assignee_ids;
  IF p_dept_id IS NOT NULL
     AND (v_assignees IS NULL OR array_length(v_assignees, 1) = 0)
  THEN
    SELECT id INTO v_tp_id FROM profiles
    WHERE department_id = p_dept_id
      AND role = 'manager'
      AND is_department_head = TRUE
      AND is_active = TRUE
    LIMIT 1;

    -- Fallback: chưa flag is_department_head → lấy manager active đầu tiên
    IF v_tp_id IS NULL THEN
      SELECT id INTO v_tp_id FROM profiles
      WHERE department_id = p_dept_id
        AND role = 'manager'
        AND is_active = TRUE
      LIMIT 1;
    END IF;

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
-- §2. recurring_template_upsert — siết scope khớp với task_create
-- =====================================================================
-- Cùng matrix như task_create. Hub manager Luồng A nay được dùng target_department_ids
-- (recurring_fire_due đã auto-fill TP phòng đích, không cần đổi).

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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;
  v_is_hub := _is_hub_department(v_dept);

  -- §A. Base permission gate
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

  -- §B. Staff: chỉ hub được tạo template báo cáo (không task)
  IF v_role = 'staff' THEN
    IF p_task_type = 'task' THEN
      RAISE EXCEPTION 'Bạn chỉ được tạo template yêu cầu báo cáo định kỳ';
    END IF;
    -- Staff hub report: cá nhân chỉ trong phòng mình; phòng khác đi qua target_department_ids
    IF p_target_user_ids IS NOT NULL AND array_length(p_target_user_ids, 1) > 0 THEN
      IF EXISTS (
        SELECT 1 FROM unnest(p_target_user_ids) a
        JOIN profiles pr ON pr.id = a
        WHERE pr.department_id IS DISTINCT FROM v_dept
      ) THEN
        RAISE EXCEPTION 'Cán bộ phòng đầu mối chỉ được yêu cầu báo cáo đích danh cán bộ trong phòng mình. Cross-phòng dùng "Cả phòng ban".';
      END IF;
    END IF;
  END IF;

  -- §C. Manager scope — khớp với task_create ad-hoc
  IF v_role = 'manager' THEN
    -- Cá nhân cụ thể (target_user_ids): luôn phải cùng phòng v_dept
    IF p_target_user_ids IS NOT NULL AND array_length(p_target_user_ids, 1) > 0 THEN
      IF EXISTS (
        SELECT 1 FROM unnest(p_target_user_ids) a
        JOIN profiles pr ON pr.id = a
        WHERE pr.department_id IS DISTINCT FROM v_dept
      ) THEN
        RAISE EXCEPTION 'Trưởng phòng chỉ được giao đích danh cho cán bộ trong phòng mình. Cross-phòng dùng "Cả phòng ban".';
      END IF;
    END IF;
    -- Non-hub: target_department_ids cũng phải = v_dept
    IF NOT v_is_hub
       AND p_target_department_ids IS NOT NULL
       AND array_length(p_target_department_ids, 1) > 0
    THEN
      IF EXISTS (
        SELECT 1 FROM unnest(p_target_department_ids) d
        WHERE d <> v_dept
      ) THEN
        RAISE EXCEPTION 'Trưởng phòng không thuộc phòng đầu mối chỉ được giao định kỳ trong phòng mình';
      END IF;
    END IF;
  END IF;
  -- Admin/Director: bỏ check.

  -- §D. Validate default_assignee_id (nếu có) — phải còn active
  IF p_default_assignee_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_default_assignee_id AND is_active = TRUE) THEN
      RAISE EXCEPTION 'Cán bộ mặc định đã không còn hoạt động';
    END IF;
  END IF;

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
