-- =====================================================
-- MIGRATION BỔ SUNG #3: TỐI ƯU RLS & SIẾT PROFILES
-- A5: Gói (SELECT role/department FROM profiles WHERE id=auth.uid()) thành STABLE function
--     để Postgres cache trong cùng 1 query plan.
-- A8: Profiles SELECT chỉ cho phép xem trong phạm vi cho phép (cùng phòng / admin / director / hr / secretary)
-- =====================================================

-- 1. STABLE function cache role & department của caller
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_department()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_head()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(is_department_head, FALSE) FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_department() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_head() TO authenticated;

-- 2. Tái cấu trúc policy tasks/kpis với function đã cache
DROP POLICY IF EXISTS "Tasks read access" ON tasks;
CREATE POLICY "Tasks read access" ON tasks FOR SELECT
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
  OR (metadata->>'assigned_line' IS NOT NULL AND auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(metadata->'assigned_line'))))
);

DROP POLICY IF EXISTS "Tasks update access" ON tasks;
CREATE POLICY "Tasks update access" ON tasks FOR UPDATE
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
  OR (metadata->>'assigned_line' IS NOT NULL AND auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(metadata->'assigned_line'))))
);

DROP POLICY IF EXISTS "Tasks delete access" ON tasks;
CREATE POLICY "Tasks delete access" ON tasks FOR DELETE
USING (
  public.current_user_role() IN ('admin', 'director')
  OR auth.uid() = created_by
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
);

DROP POLICY IF EXISTS "KPIs read access" ON kpis;
CREATE POLICY "KPIs read access" ON kpis FOR SELECT
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
);

DROP POLICY IF EXISTS "KPIs create access" ON kpis;
CREATE POLICY "KPIs create access" ON kpis FOR INSERT
WITH CHECK (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
);

DROP POLICY IF EXISTS "KPIs update access" ON kpis;
CREATE POLICY "KPIs update access" ON kpis FOR UPDATE
USING (
  public.current_user_role() IN ('admin', 'director')
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
  OR auth.uid() = assignee_id
  OR auth.uid() = created_by
);

DROP POLICY IF EXISTS "KPIs delete access" ON kpis;
CREATE POLICY "KPIs delete access" ON kpis FOR DELETE
USING (
  public.current_user_role() IN ('admin', 'director')
  OR auth.uid() = created_by
  OR (public.current_user_role() = 'manager' AND department_id = public.current_user_department())
);

-- 3. A8: Siết SELECT profiles — không còn USING (true)
-- Cho phép xem profile khi:
--   - Chính mình
--   - Admin / Director / HR Officer / Secretary (toàn quyền nhân sự)
--   - Cùng phòng ban
--   - Cùng tham gia ít nhất 1 schedule (để hiển thị tên người tham gia chéo phòng)
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view profiles in scope" ON profiles FOR SELECT
USING (
  -- Tự xem mình
  id = auth.uid()
  -- Admin/BGĐ/HR/Thư ký toàn quyền xem danh bạ
  OR public.current_user_role() IN ('admin', 'director', 'hr_officer', 'secretary')
  -- Cùng phòng ban
  OR department_id = public.current_user_department()
  -- BGĐ luôn được hiển thị cho mọi người (để xem timeline)
  OR role = 'director'
  -- Driver luôn được hiển thị (để TCTH gán xe)
  OR role = 'driver'
  -- Cùng tham gia ít nhất 1 schedule với caller
  OR EXISTS (
    SELECT 1 FROM schedule_participants sp1
    JOIN schedule_participants sp2 ON sp1.schedule_id = sp2.schedule_id
    WHERE sp1.profile_id = profiles.id AND sp2.profile_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
