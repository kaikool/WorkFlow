-- =====================================================
-- MIGRATION BỔ SUNG: Bảo vệ nội dung đơn nghỉ phép ở tầng RLS
-- Mục tiêu: Khi cán bộ khác phòng xem lịch nghỉ phép, payload không trả
--           description/title chi tiết để chống đọc lén từ DevTools.
-- =====================================================

-- 1. Hàm helper: kiểm tra current user có được xem nội dung lịch không
CREATE OR REPLACE FUNCTION public.can_view_leave_detail(p_schedule_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_caller_dept uuid;
  v_caller_head boolean;
  v_creator_id uuid;
  v_creator_role text;
  v_creator_head boolean;
  v_creator_dept uuid;
  v_type text;
BEGIN
  IF v_caller IS NULL THEN RETURN FALSE; END IF;

  SELECT role, department_id, is_department_head
  INTO v_caller_role, v_caller_dept, v_caller_head
  FROM profiles WHERE id = v_caller;

  SELECT
    s.created_by, s.type::text,
    p.role, p.is_department_head, p.department_id
  INTO v_creator_id, v_type, v_creator_role, v_creator_head, v_creator_dept
  FROM schedules s
  LEFT JOIN profiles p ON p.id = s.created_by
  WHERE s.id = p_schedule_id;

  -- Không phải nghỉ phép → mọi người xem được nội dung
  IF v_type IS DISTINCT FROM 'leave' THEN RETURN TRUE; END IF;

  -- Chủ đơn
  IF v_caller = v_creator_id THEN RETURN TRUE; END IF;

  -- Admin / HR / BGĐ luôn xem được
  IF v_caller_role IN ('admin', 'hr_officer', 'director') THEN RETURN TRUE; END IF;

  -- Trưởng phòng / Manager: chỉ được khi cùng phòng và creator không phải lãnh đạo cùng cấp
  IF v_caller_role = 'manager' AND v_creator_dept = v_caller_dept THEN
    IF v_caller_head OR (NOT v_creator_head AND v_creator_role <> 'manager') THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_leave_detail(uuid) TO authenticated;

-- 2. Trigger BEFORE SELECT không khả thi trên Postgres.
-- Cách an toàn: tạo SECURITY DEFINER function trả về lịch + ẩn nội dung khi không có quyền.
-- App phía client gọi RPC này khi cần chi tiết đơn nghỉ phép.
CREATE OR REPLACE FUNCTION public.get_leave_safe(p_schedule_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  type text,
  status text,
  start_time timestamptz,
  end_time timestamptz,
  created_by uuid,
  department_id uuid,
  metadata jsonb,
  can_view_detail boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  v_allowed := public.can_view_leave_detail(p_schedule_id);

  RETURN QUERY
  SELECT
    s.id,
    CASE WHEN v_allowed THEN s.title ELSE 'Nghỉ phép' END,
    CASE WHEN v_allowed THEN s.description ELSE NULL END,
    s.type::text,
    s.status::text,
    s.start_time,
    s.end_time,
    s.created_by,
    s.department_id,
    CASE WHEN v_allowed THEN s.metadata ELSE jsonb_build_object() END,
    v_allowed
  FROM schedules s
  WHERE s.id = p_schedule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leave_safe(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
