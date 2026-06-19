-- Migration: fix recognitions RLS dùng SECURITY DEFINER helper
-- Lý do: subquery (SELECT role FROM profiles ...) trong RLS policy chạy qua profiles RLS
-- ("Users can view profiles in scope") gây lỗi "new row violates row-level security".
-- Dùng public.current_user_role() (SECURITY DEFINER) bypass RLS profiles.
-- Thêm helper current_user_is_active() để check is_active an toàn.

BEGIN;

CREATE OR REPLACE FUNCTION public.current_user_is_active()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT is_active FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_is_active() TO authenticated;

DROP POLICY IF EXISTS "Anyone active except driver can create recognitions" ON recognitions;
CREATE POLICY "Anyone active except driver can create recognitions" ON recognitions FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    public.current_user_role() != 'driver' AND
    public.current_user_is_active() = true
);

NOTIFY pgrst, 'reload schema';

COMMIT;
