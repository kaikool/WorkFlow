-- 1. Tạo hàm check assignee tối ưu hóa bằng SECURITY DEFINER (bẻ gãy vòng đệ quy và bỏ parse JSONB)
CREATE OR REPLACE FUNCTION public.user_is_task_assignee(p_task_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_assignees 
    WHERE task_id = p_task_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_is_task_assignee(UUID, UUID) TO authenticated;

-- 2. Cập nhật lại policy Tasks read access
DROP POLICY IF EXISTS "Tasks read access" ON tasks;
CREATE POLICY "Tasks read access" ON tasks FOR SELECT
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
  OR public.user_is_task_assignee(id, auth.uid())
);

-- 3. Cập nhật lại policy Tasks update access
DROP POLICY IF EXISTS "Tasks update access" ON tasks;
CREATE POLICY "Tasks update access" ON tasks FOR UPDATE
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
  OR public.user_is_task_assignee(id, auth.uid())
);

NOTIFY pgrst, 'reload schema';
