-- =====================================================
-- MIGRATION: VÁ BẢO MẬT, TOÀN VẸN & HỢP NHẤT KPI
-- Mục tiêu:
--   1. Loại bỏ lưu mật khẩu plaintext trong account_requests
--   2. Bổ sung policy DELETE cho tasks/kpis/schedules có ràng buộc
--   3. Hợp nhất KPI vào bảng kpis (chấm dứt task_type='kpi' trong bảng tasks)
--   4. RPC cập nhật đóng góp KPI an toàn (kiểm tra quyền cấp DB)
--   5. CASCADE cho task_comments / task_assignees
--   6. Thêm indexes hỗ trợ truy vấn
--   7. Cờ is_active để admin duyệt tài khoản
-- =====================================================

-- =====================================================
-- 1. KÍCH HOẠT TÀI KHOẢN & GỠ MẬT KHẨU PLAINTEXT
-- =====================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Đặt mặc định cho dữ liệu sẵn có: tất cả người đang dùng coi như đã được duyệt
UPDATE profiles SET is_active = TRUE WHERE is_active IS NULL;

-- Trigger handle_new_user: tài khoản mới mặc định chưa kích hoạt (chờ admin duyệt)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'staff',
    FALSE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa cột password plaintext (nếu còn tồn tại trên DB cũ)
ALTER TABLE account_requests DROP COLUMN IF EXISTS password;

-- =====================================================
-- 2. POLICY DELETE CHO TASKS / KPIS / SCHEDULES
-- =====================================================
DROP POLICY IF EXISTS "Tasks delete access" ON tasks;
CREATE POLICY "Tasks delete access" ON tasks FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
  OR auth.uid() = created_by
  OR (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
    AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
  )
);

DROP POLICY IF EXISTS "KPIs delete access" ON kpis;
CREATE POLICY "KPIs delete access" ON kpis FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
  OR auth.uid() = created_by
  OR (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
    AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
  )
);

-- Schedules: cấm xóa khi đang in_progress để không mất hành trình tài xế
DROP POLICY IF EXISTS "Schedules delete access" ON schedules;
CREATE POLICY "Schedules delete access" ON schedules FOR DELETE
USING (
  status <> 'in_progress'
  AND (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = auth.uid()
      AND (
        p.role IN ('admin', 'secretary', 'hr_officer', 'director')
        OR (p.role = 'manager' AND d.code = '13602')
      )
    )
  )
);

-- =====================================================
-- 3. SIẾT POLICY UPDATE TASKS — KHÔNG CHO STAFF ĐỔI OWNERSHIP
-- (Hạn chế cột nhạy cảm thông qua trigger BEFORE UPDATE)
-- =====================================================
CREATE OR REPLACE FUNCTION public.guard_tasks_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
  v_dept uuid;
BEGIN
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = auth.uid();

  -- Admin / Director / Manager cùng phòng được phép thay đổi mọi cột
  IF v_role IN ('admin', 'director')
     OR (v_role = 'manager' AND OLD.department_id = v_dept) THEN
    RETURN NEW;
  END IF;

  -- Người tạo được sửa nội dung nhưng không chuyển sở hữu
  IF auth.uid() = OLD.created_by
     AND NEW.created_by = OLD.created_by THEN
    RETURN NEW;
  END IF;

  -- Còn lại (assignee / assigned_line) chỉ được cập nhật progress/status/current_value/metadata
  IF NEW.title       IS DISTINCT FROM OLD.title       THEN RAISE EXCEPTION 'Không có quyền đổi tiêu đề'; END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN RAISE EXCEPTION 'Không có quyền đổi mô tả'; END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN RAISE EXCEPTION 'Không có quyền đổi người tiếp nhận'; END IF;
  IF NEW.created_by  IS DISTINCT FROM OLD.created_by  THEN RAISE EXCEPTION 'Không có quyền đổi người tạo'; END IF;
  IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN RAISE EXCEPTION 'Không có quyền chuyển phòng ban'; END IF;
  IF NEW.priority    IS DISTINCT FROM OLD.priority    THEN RAISE EXCEPTION 'Không có quyền đổi mức độ'; END IF;
  IF NEW.due_date    IS DISTINCT FROM OLD.due_date    THEN RAISE EXCEPTION 'Không có quyền đổi hạn'; END IF;
  IF NEW.target_value IS DISTINCT FROM OLD.target_value THEN RAISE EXCEPTION 'Không có quyền đổi mục tiêu'; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tasks_update_trigger ON tasks;
CREATE TRIGGER guard_tasks_update_trigger
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_tasks_update();

-- =====================================================
-- 4. HỢP NHẤT KPI — DI CHUYỂN task_type='kpi' VỀ kpis
-- =====================================================
INSERT INTO kpis (
  id, title, description, status, priority, progress, assignee_id, created_by,
  department_id, due_date, target_value, current_value, unit, metadata, is_archived, created_at
)
SELECT
  id,
  title,
  description,
  status,
  priority,
  progress,
  assignee_id,
  created_by,
  department_id,
  due_date,
  target_value,
  current_value,
  unit,
  COALESCE(metadata, '{}'::jsonb),
  COALESCE(is_archived, FALSE),
  created_at
FROM tasks
WHERE task_type = 'kpi'
ON CONFLICT (id) DO NOTHING;

-- Sao chép comment qua KPI nếu có (giữ history thảo luận)
-- task_comments không liên kết tới kpis nên tạm để nguyên, sẽ refactor sau.

DELETE FROM tasks WHERE task_type = 'kpi';

-- Vô hiệu hoá task_type='kpi' về sau bằng CHECK constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_not_kpi;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_not_kpi
  CHECK (task_type IS NULL OR task_type <> 'kpi');

-- =====================================================
-- 5. RPC CẬP NHẬT ĐÓNG GÓP KPI AN TOÀN
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_kpi_contribution(
  p_kpi_id uuid,
  p_user_id uuid,
  p_value bigint
)
RETURNS TABLE (current_value bigint, progress int, status task_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_caller_dept uuid;
  v_kpi_dept uuid;
  v_target bigint;
  v_new_value bigint;
  v_new_progress int;
  v_new_status task_status;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Chưa xác thực';
  END IF;
  IF p_value < 0 THEN
    RAISE EXCEPTION 'Giá trị đóng góp không thể âm';
  END IF;

  SELECT role, department_id INTO v_caller_role, v_caller_dept
  FROM profiles WHERE id = v_caller;

  SELECT department_id, target_value, status INTO v_kpi_dept, v_target, v_new_status
  FROM kpis WHERE id = p_kpi_id;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy KPI';
  END IF;

  -- Quyền: chính mình | admin | director | manager cùng phòng
  IF NOT (
    v_caller = p_user_id
    OR v_caller_role IN ('admin', 'director')
    OR (v_caller_role = 'manager' AND v_caller_dept IS NOT DISTINCT FROM v_kpi_dept)
  ) THEN
    RAISE EXCEPTION 'Không có quyền chỉnh đóng góp của người khác';
  END IF;

  -- Cập nhật metadata.contributions[p_user_id] = p_value
  UPDATE kpis
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    ARRAY['contributions', p_user_id::text],
    to_jsonb(p_value),
    TRUE
  )
  WHERE id = p_kpi_id;

  -- Tính tổng đóng góp + hiệu chỉnh phòng
  SELECT
    COALESCE((
      SELECT SUM((value)::bigint)
      FROM jsonb_each_text(COALESCE(metadata->'contributions', '{}'::jsonb))
    ), 0)
    + COALESCE((metadata->>'general_adjustment')::bigint, 0)
  INTO v_new_value
  FROM kpis WHERE id = p_kpi_id;

  v_new_progress := CASE
    WHEN v_target > 0 THEN LEAST(100, GREATEST(0, ROUND(v_new_value::numeric / v_target * 100)::int))
    ELSE 0
  END;

  IF v_new_progress >= 100 AND v_new_status NOT IN ('done', 'closed') THEN
    v_new_status := 'done';
  END IF;

  UPDATE kpis
  SET
    current_value = v_new_value,
    progress = v_new_progress,
    status = v_new_status
  WHERE id = p_kpi_id;

  RETURN QUERY SELECT v_new_value, v_new_progress, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_kpi_contribution(uuid, uuid, bigint) TO authenticated;

-- =====================================================
-- 6. RPC HIỆU CHỈNH PHÒNG (general_adjustment) — chỉ leader
-- =====================================================
CREATE OR REPLACE FUNCTION public.adjust_kpi_general(
  p_kpi_id uuid,
  p_delta bigint
)
RETURNS TABLE (current_value bigint, progress int, status task_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_caller_dept uuid;
  v_kpi_dept uuid;
  v_target bigint;
  v_new_adj bigint;
  v_new_value bigint;
  v_new_progress int;
  v_new_status task_status;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Chưa xác thực'; END IF;

  SELECT role, department_id INTO v_caller_role, v_caller_dept
  FROM profiles WHERE id = v_caller;

  SELECT department_id, target_value, status INTO v_kpi_dept, v_target, v_new_status
  FROM kpis WHERE id = p_kpi_id;

  IF v_target IS NULL THEN RAISE EXCEPTION 'Không tìm thấy KPI'; END IF;

  IF NOT (
    v_caller_role IN ('admin', 'director')
    OR (v_caller_role = 'manager' AND v_caller_dept IS NOT DISTINCT FROM v_kpi_dept)
  ) THEN
    RAISE EXCEPTION 'Chỉ lãnh đạo phòng/BGĐ/Admin được hiệu chỉnh phòng';
  END IF;

  v_new_adj := COALESCE((SELECT (metadata->>'general_adjustment')::bigint FROM kpis WHERE id = p_kpi_id), 0) + p_delta;

  UPDATE kpis
  SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    ARRAY['general_adjustment'],
    to_jsonb(v_new_adj),
    TRUE
  )
  WHERE id = p_kpi_id;

  SELECT
    COALESCE((
      SELECT SUM((value)::bigint)
      FROM jsonb_each_text(COALESCE(metadata->'contributions', '{}'::jsonb))
    ), 0) + v_new_adj
  INTO v_new_value
  FROM kpis WHERE id = p_kpi_id;

  v_new_progress := CASE
    WHEN v_target > 0 THEN LEAST(100, GREATEST(0, ROUND(v_new_value::numeric / v_target * 100)::int))
    ELSE 0
  END;

  IF v_new_progress >= 100 AND v_new_status NOT IN ('done', 'closed') THEN
    v_new_status := 'done';
  END IF;

  UPDATE kpis
  SET current_value = v_new_value, progress = v_new_progress, status = v_new_status
  WHERE id = p_kpi_id;

  RETURN QUERY SELECT v_new_value, v_new_progress, v_new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_kpi_general(uuid, bigint) TO authenticated;

-- =====================================================
-- 7. CASCADE & FK BỔ SUNG
-- =====================================================
ALTER TABLE task_comments
  DROP CONSTRAINT IF EXISTS task_comments_task_id_fkey;
ALTER TABLE task_comments
  ADD CONSTRAINT task_comments_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

ALTER TABLE task_comments
  DROP CONSTRAINT IF EXISTS task_comments_user_id_fkey;
ALTER TABLE task_comments
  ADD CONSTRAINT task_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- task_assignees: cascade
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_assignees') THEN
    ALTER TABLE task_assignees DROP CONSTRAINT IF EXISTS task_assignees_task_id_fkey;
    ALTER TABLE task_assignees
      ADD CONSTRAINT task_assignees_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =====================================================
-- 8. INDEXES TỐI ƯU TRUY VẤN
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_schedules_driver_status ON schedules(driver_id, type, status);
CREATE INDEX IF NOT EXISTS idx_schedules_department_start ON schedules(department_id, start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_end_time ON schedules(end_time);
CREATE INDEX IF NOT EXISTS idx_schedules_room ON schedules(room_id, start_time);
CREATE INDEX IF NOT EXISTS idx_schedules_vehicle ON schedules(vehicle_id, start_time);
CREATE INDEX IF NOT EXISTS idx_tasks_department_status ON tasks(department_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_kpis_department ON kpis(department_id);
CREATE INDEX IF NOT EXISTS idx_kpis_assignee ON kpis(assignee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_participants_profile ON schedule_participants(profile_id);

-- =====================================================
-- 9. CHẶN GÁN XE TRÙNG LỊCH (TỪ DB LAYER)
-- =====================================================
CREATE OR REPLACE FUNCTION public.guard_vehicle_overlap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.vehicle_id IS NOT NULL
     AND NEW.status NOT IN ('rejected', 'completed')
     AND EXISTS (
       SELECT 1 FROM schedules s
       WHERE s.vehicle_id = NEW.vehicle_id
         AND s.id <> NEW.id
         AND s.status NOT IN ('rejected', 'completed')
         AND s.start_time < NEW.end_time
         AND s.end_time > NEW.start_time
     ) THEN
    RAISE EXCEPTION 'Xe đã được gán cho lịch trình khác trong khung giờ này';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_vehicle_overlap_trigger ON schedules;
CREATE TRIGGER guard_vehicle_overlap_trigger
  BEFORE INSERT OR UPDATE OF vehicle_id, start_time, end_time, status
  ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_vehicle_overlap();

NOTIFY pgrst, 'reload schema';
