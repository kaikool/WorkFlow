-- ==============================================================================
-- MIGRATION: Cleanup — xoá schema chết & khoá chặt tasks cho Báo cáo
-- ==============================================================================
-- Mục đích:
--   1. Xoá bảng task_attachments + RPCs + storage policies (không UI nào dùng)
--   2. Thêm CHECK constraint tasks.task_type = 'report' (chỉ nhận Báo cáo)
--   3. Rút gọn RPC task_create — bỏ nhánh 'task' (Luồng A)
--   4. Cập nhật task_recurring_templates CHECK constraint chỉ 'report'
--   5. Dọn index/trigger chết (nếu có)
--
-- Cách chạy:
--   Supabase Dashboard → SQL Editor → Paste & Run
--   (Data task_type='task' đã xoá trước đó qua REST API)
-- ==============================================================================

-- =====================================================================
-- 1. XOÁ task_attachments (bảng + RPCs + storage policies)
-- =====================================================================

-- 1a. Xoá RPCs trước (phải xoá dependency trước)
DROP FUNCTION IF EXISTS task_attachment_register(UUID, TEXT, TEXT, TEXT, INTEGER, UUID);
DROP FUNCTION IF EXISTS task_attachment_remove(UUID);

-- 1b. Xoá storage policies cho bucket task-attachments
DROP POLICY IF EXISTS "task_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_insert" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_update" ON storage.objects;
DROP POLICY IF EXISTS "task_attachments_delete" ON storage.objects;

-- 1c. Xoá RLS policies trên bảng
DROP POLICY IF EXISTS "task_attachments_select" ON task_attachments;
DROP POLICY IF EXISTS "task_attachments_no_direct_write" ON task_attachments;

-- 1d. Xoá index
DROP INDEX IF EXISTS idx_task_attachments_task;
DROP INDEX IF EXISTS idx_task_attachments_comment;

-- 1e. Xoá bảng
DROP TABLE IF EXISTS task_attachments;

-- =====================================================================
-- 2. CHECK CONSTRAINT — tasks chỉ nhận 'report'
-- =====================================================================

-- Xoá constraint cũ nếu còn (từ migration cũ)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_not_kpi;

-- Thêm constraint mới: chỉ 'report' được insert/update
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type = 'report');

-- =====================================================================
-- 3. RÚT GỌN RPC task_create — bỏ nhánh 'task'
-- =====================================================================

-- Xoá phiên bản cũ (có thể có nhiều overload)
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB);
DROP FUNCTION IF EXISTS task_create(TEXT, TEXT, TEXT, task_priority, TIMESTAMPTZ, UUID, UUID[], JSONB, BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION task_create(
  p_title        TEXT,
  p_description  TEXT,
  p_task_type    TEXT,           -- chỉ nhận 'report'
  p_priority     task_priority,
  p_due_date     TIMESTAMPTZ,
  p_dept_id      UUID,
  p_assignee_ids UUID[],
  p_metadata     JSONB DEFAULT '{}'::jsonb,
  p_requires_approval BOOLEAN DEFAULT FALSE,
  p_batch_id          UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_role    TEXT;
  v_dept    UUID;
  v_task_id UUID;
  v_a       UUID;
  v_creator_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;

  SELECT role, department_id, full_name
    INTO v_role, v_dept, v_creator_name
  FROM profiles WHERE id = v_uid;

  IF v_role IN ('driver', 'secretary', 'hr_officer') THEN
    RAISE EXCEPTION 'Vai trò của bạn không có quyền tạo công việc';
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Vui lòng nhập tiêu đề';
  END IF;
  IF p_due_date IS NULL THEN
    RAISE EXCEPTION 'Vui lòng chọn hạn hoàn thành';
  END IF;
  IF p_task_type IS DISTINCT FROM 'report' THEN
    RAISE EXCEPTION 'Chỉ hỗ trợ tạo báo cáo';
  END IF;

  -- Staff không được tạo yêu cầu báo cáo
  IF v_role = 'staff' THEN
    RAISE EXCEPTION 'Nhân viên không được tạo yêu cầu báo cáo';
  END IF;

  -- Insert task
  INSERT INTO tasks (
    title, description, task_type, priority, due_date, department_id,
    assignee_id, created_by, status, metadata, is_archived,
    requires_approval, batch_id
  ) VALUES (
    p_title, p_description, 'report', COALESCE(p_priority, 'medium'),
    p_due_date, p_dept_id,
    CASE
      WHEN p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0
        THEN p_assignee_ids[1]
      ELSE NULL
    END,
    v_uid, 'todo'::task_status, COALESCE(p_metadata, '{}'::jsonb), FALSE,
    COALESCE(p_requires_approval, FALSE),
    p_batch_id
  )
  RETURNING id INTO v_task_id;

  -- Insert assignees + notifications
  IF p_assignee_ids IS NOT NULL AND array_length(p_assignee_ids, 1) > 0 THEN
    FOREACH v_a IN ARRAY p_assignee_ids LOOP
      INSERT INTO task_assignees (task_id, user_id)
      VALUES (v_task_id, v_a)
      ON CONFLICT (task_id, user_id) DO NOTHING;

      IF v_a <> v_uid THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        SELECT v_a,
               'Bạn có yêu cầu báo cáo mới',
               v_creator_name || ' đã yêu cầu: ' || p_title,
               'report',
               '/dashboard/tasks/' || v_task_id::text
        WHERE (SELECT role FROM profiles WHERE id = v_a) <> 'driver';
      END IF;
    END LOOP;
  ELSIF p_dept_id IS NOT NULL THEN
    -- Báo cáo chưa phân công → notify Trưởng phòng + Phó phòng
    INSERT INTO notifications (user_id, title, content, type, link)
    SELECT p.id,
           'Phòng có yêu cầu báo cáo mới',
           v_creator_name || ' đã yêu cầu: ' || p_title,
           'report',
           '/dashboard/tasks/' || v_task_id::text
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
-- 4. task_recurring_templates CHECK — chỉ 'report'
-- =====================================================================

ALTER TABLE task_recurring_templates DROP CONSTRAINT IF EXISTS task_recurring_templates_task_type_check;
ALTER TABLE task_recurring_templates ADD CONSTRAINT task_recurring_templates_task_type_check
  CHECK (task_type = 'report');

-- =====================================================================
-- 5. XOÁ GUARD TRIGGER task_assignee ROLE (chỉ cần cho Giao việc)
-- =====================================================================

-- guard_task_assignee_role() kiểm tra assignee không phải admin/director/...
-- Báo cáo assignee có thể là bất kỳ ai, trigger này vô dụng
DROP TRIGGER IF EXISTS trg_guard_task_assignee_role ON task_assignees;
DROP FUNCTION IF EXISTS guard_task_assignee_role();

-- =====================================================================
-- 6. DỌN task_status enum comment — 'late'/'closed' vẫn tồn tại
--    (Postgres không cho drop enum value, chỉ migrate data)
-- =====================================================================
-- Không thể DROP value khỏi enum, nhưng data đã migrate:
--   'late' → 'doing'
--   'closed' → 'done' + is_archived=true
-- Giữ nguyên, không làm gì thêm.

-- =====================================================================
-- KẾT THÚC
-- =====================================================================
NOTIFY pgrst, 'reload schema';
