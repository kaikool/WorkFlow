-- =====================================================================
-- MIGRATION: TASK RECURRING TEMPLATES (P3)
-- =====================================================================
-- Cho phép Director/Manager đặt lịch tự sinh task định kỳ
-- (vd: Thứ 6 15:00 hằng tuần → tự sinh task báo cáo cho 4 phòng).
--
-- Hỗ trợ 2 schedule_kind: 'weekly' và 'monthly'. Custom cron để dành.
--
-- Engine fire định kỳ:
--   1) Khuyến nghị: pg_cron (chạy mỗi 15 phút) — cần enable extension
--      qua Supabase Dashboard → Database → Extensions → pg_cron.
--   2) Fallback: gọi RPC recurring_fire_due() từ Vercel cron / cron tự
--      build (xem app/api/cron/notifications/route.ts).
-- =====================================================================

CREATE TABLE IF NOT EXISTS task_recurring_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  description           TEXT,
  task_type             TEXT NOT NULL DEFAULT 'report'
                          CHECK (task_type IN ('task', 'report')),
  priority              task_priority NOT NULL DEFAULT 'medium',

  target_department_ids UUID[] NOT NULL DEFAULT '{}',
  target_user_ids       UUID[] NOT NULL DEFAULT '{}',

  schedule_kind         TEXT NOT NULL DEFAULT 'weekly'
                          CHECK (schedule_kind IN ('weekly', 'monthly')),
  weekly_dow            SMALLINT CHECK (weekly_dow BETWEEN 0 AND 6),
  weekly_time           TIME,
  monthly_dom           SMALLINT CHECK (monthly_dom BETWEEN 1 AND 31),
  monthly_time          TIME,

  timezone              TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  due_days_after_fire   INT NOT NULL DEFAULT 7 CHECK (due_days_after_fire > 0),

  created_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  last_fired_at         TIMESTAMPTZ,
  next_run_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_active_next
  ON task_recurring_templates(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_recurring_created_by
  ON task_recurring_templates(created_by);


CREATE OR REPLACE FUNCTION _touch_recurring_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_recurring_touch_updated ON task_recurring_templates;
CREATE TRIGGER trg_recurring_touch_updated
  BEFORE UPDATE ON task_recurring_templates
  FOR EACH ROW EXECUTE FUNCTION _touch_recurring_updated();


-- =====================================================================
-- Helper: tính next_run_at dựa schedule_kind
-- =====================================================================
CREATE OR REPLACE FUNCTION _recurring_next_run(
  p_kind       TEXT,
  p_weekly_dow SMALLINT,
  p_weekly_time TIME,
  p_monthly_dom SMALLINT,
  p_monthly_time TIME,
  p_timezone   TEXT,
  p_after      TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_local      TIMESTAMP;
  v_dow        SMALLINT;
  v_days       SMALLINT;
  v_year       INT;
  v_month      INT;
  v_dom_clamp  INT;
  v_candidate  TIMESTAMP;
  v_last_day   INT;
BEGIN
  v_local := (p_after AT TIME ZONE p_timezone)::timestamp;

  IF p_kind = 'weekly' THEN
    IF p_weekly_dow IS NULL OR p_weekly_time IS NULL THEN RETURN NULL; END IF;
    v_dow := EXTRACT(DOW FROM v_local)::smallint;
    v_days := ((p_weekly_dow - v_dow) + 7) % 7;
    IF v_days = 0 AND v_local::time >= p_weekly_time THEN v_days := 7; END IF;
    v_candidate := (v_local::date + v_days)::timestamp + p_weekly_time;
    RETURN v_candidate AT TIME ZONE p_timezone;

  ELSIF p_kind = 'monthly' THEN
    IF p_monthly_dom IS NULL OR p_monthly_time IS NULL THEN RETURN NULL; END IF;
    v_year := EXTRACT(YEAR FROM v_local)::int;
    v_month := EXTRACT(MONTH FROM v_local)::int;
    v_last_day := EXTRACT(DAY FROM (date_trunc('month', make_date(v_year, v_month, 1))
                                    + interval '1 month - 1 day'))::int;
    v_dom_clamp := LEAST(p_monthly_dom, v_last_day);
    v_candidate := make_date(v_year, v_month, v_dom_clamp)::timestamp + p_monthly_time;
    IF (v_candidate AT TIME ZONE p_timezone) <= p_after THEN
      IF v_month = 12 THEN v_month := 1; v_year := v_year + 1; ELSE v_month := v_month + 1; END IF;
      v_last_day := EXTRACT(DAY FROM (date_trunc('month', make_date(v_year, v_month, 1))
                                      + interval '1 month - 1 day'))::int;
      v_dom_clamp := LEAST(p_monthly_dom, v_last_day);
      v_candidate := make_date(v_year, v_month, v_dom_clamp)::timestamp + p_monthly_time;
    END IF;
    RETURN v_candidate AT TIME ZONE p_timezone;
  END IF;

  RETURN NULL;
END $$;


-- =====================================================================
-- RLS
-- =====================================================================
ALTER TABLE task_recurring_templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='task_recurring_templates' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_recurring_templates', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "recurring_select" ON task_recurring_templates FOR SELECT TO authenticated
USING (
  public.current_user_role() IN ('admin', 'director')
  OR public.current_user_role() = 'manager'
  OR created_by = auth.uid()
);

CREATE POLICY "recurring_no_direct_write" ON task_recurring_templates
  FOR ALL TO authenticated USING (FALSE) WITH CHECK (FALSE);


-- =====================================================================
-- RPCs
-- =====================================================================

CREATE OR REPLACE FUNCTION recurring_template_upsert(
  p_id                    UUID,
  p_title                 TEXT,
  p_description           TEXT,
  p_task_type             TEXT,
  p_priority              task_priority,
  p_target_department_ids UUID[],
  p_target_user_ids       UUID[],
  p_schedule_kind         TEXT,
  p_weekly_dow            SMALLINT,
  p_weekly_time           TIME,
  p_monthly_dom           SMALLINT,
  p_monthly_time          TIME,
  p_timezone              TEXT,
  p_due_days_after_fire   INT,
  p_is_active             BOOLEAN
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
  v_id   UUID;
  v_next TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  IF v_role NOT IN ('admin', 'director', 'manager') THEN
    RAISE EXCEPTION 'Bạn không có quyền tạo lịch định kỳ';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_schedule_kind NOT IN ('weekly', 'monthly') THEN
    RAISE EXCEPTION 'Loại lịch không hợp lệ';
  END IF;
  IF p_schedule_kind = 'weekly' AND (p_weekly_dow IS NULL OR p_weekly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn thứ và giờ trong tuần';
  END IF;
  IF p_schedule_kind = 'monthly' AND (p_monthly_dom IS NULL OR p_monthly_time IS NULL) THEN
    RAISE EXCEPTION 'Vui lòng chọn ngày và giờ trong tháng';
  END IF;

  v_next := _recurring_next_run(
    p_schedule_kind, p_weekly_dow, p_weekly_time,
    p_monthly_dom, p_monthly_time, p_timezone, NOW()
  );

  IF p_id IS NULL THEN
    INSERT INTO task_recurring_templates (
      title, description, task_type, priority,
      target_department_ids, target_user_ids,
      schedule_kind, weekly_dow, weekly_time, monthly_dom, monthly_time,
      timezone, due_days_after_fire,
      created_by, is_active, next_run_at
    ) VALUES (
      p_title, p_description, p_task_type, COALESCE(p_priority, 'medium'),
      COALESCE(p_target_department_ids, '{}'), COALESCE(p_target_user_ids, '{}'),
      p_schedule_kind, p_weekly_dow, p_weekly_time, p_monthly_dom, p_monthly_time,
      COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'), COALESCE(p_due_days_after_fire, 7),
      v_uid, COALESCE(p_is_active, TRUE), v_next
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE task_recurring_templates
    SET title = p_title,
        description = p_description,
        task_type = p_task_type,
        priority = COALESCE(p_priority, 'medium'),
        target_department_ids = COALESCE(p_target_department_ids, '{}'),
        target_user_ids = COALESCE(p_target_user_ids, '{}'),
        schedule_kind = p_schedule_kind,
        weekly_dow = p_weekly_dow,
        weekly_time = p_weekly_time,
        monthly_dom = p_monthly_dom,
        monthly_time = p_monthly_time,
        timezone = COALESCE(p_timezone, 'Asia/Ho_Chi_Minh'),
        due_days_after_fire = COALESCE(p_due_days_after_fire, 7),
        is_active = COALESCE(p_is_active, is_active),
        next_run_at = v_next
    WHERE id = p_id
      AND (created_by = v_uid OR v_role IN ('admin', 'director'))
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Không tìm thấy hoặc không có quyền sửa'; END IF;
  END IF;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_upsert(
  UUID, TEXT, TEXT, TEXT, task_priority, UUID[], UUID[],
  TEXT, SMALLINT, TIME, SMALLINT, TIME, TEXT, INT, BOOLEAN
) TO authenticated;


CREATE OR REPLACE FUNCTION recurring_template_delete(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  DELETE FROM task_recurring_templates
  WHERE id = p_id
    AND (created_by = v_uid OR v_role IN ('admin', 'director'));
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có quyền hoặc không tìm thấy'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_delete(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION recurring_template_toggle(p_id UUID, p_active BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role INTO v_role FROM profiles WHERE id = v_uid;
  UPDATE task_recurring_templates
  SET is_active = p_active
  WHERE id = p_id
    AND (created_by = v_uid OR v_role IN ('admin', 'director'));
  IF NOT FOUND THEN RAISE EXCEPTION 'Không có quyền hoặc không tìm thấy'; END IF;
END $$;

GRANT EXECUTE ON FUNCTION recurring_template_toggle(UUID, BOOLEAN) TO authenticated;


-- =====================================================================
-- recurring_fire_due — sinh task cho mọi template đã đến hạn
-- =====================================================================
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
BEGIN
  FOR v_template IN
    SELECT * FROM task_recurring_templates
    WHERE is_active = TRUE
      AND next_run_at IS NOT NULL
      AND next_run_at <= NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Tính deadline = fire_time + N ngày
    v_due := v_template.next_run_at + (v_template.due_days_after_fire || ' days')::interval;
    SELECT full_name INTO v_creator_name FROM profiles WHERE id = v_template.created_by;

    -- Sinh task cho từng department (luồng B — chờ TP phân công)
    IF array_length(v_template.target_department_ids, 1) > 0 THEN
      FOREACH v_dept IN ARRAY v_template.target_department_ids LOOP
        INSERT INTO tasks (
          title, description, task_type, priority, due_date,
          department_id, created_by, status, metadata
        ) VALUES (
          v_template.title, v_template.description, v_template.task_type,
          v_template.priority, v_due,
          v_dept, v_template.created_by, 'todo',
          jsonb_build_object('recurring_template_id', v_template.id)
        )
        RETURNING id INTO v_task_id;

        -- Notify TP phòng đó
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT p.id,
               'Yêu cầu báo cáo định kỳ',
               COALESCE(v_creator_name, '[Hệ thống]') || ' đã sinh tự động: ' || v_template.title,
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

    -- Cập nhật template: last_fired + next_run mới
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
-- pg_cron schedule — yêu cầu enable extension trước
-- =====================================================================
-- Bỏ qua nếu pg_cron chưa enable. User tự enable qua:
--   Dashboard → Database → Extensions → tìm 'pg_cron' → Enable
-- Sau đó chạy lại block dưới:

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('fire-recurring-tasks')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fire-recurring-tasks');
    PERFORM cron.schedule(
      'fire-recurring-tasks',
      '*/15 * * * *',
      $cron$SELECT public.recurring_fire_due();$cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


NOTIFY pgrst, 'reload schema';
