-- Migration: Fix RLS policy để driver được phép từ chối lịch (set driver_id = null)
-- Lỗi: "violates security for table schedules" khi driver từ chối lịch
-- Nguyên nhân: Policy chỉ có USING(driver_id = auth.uid()) mà không có WITH CHECK
-- → Khi driver set driver_id = null, new row không thoả điều kiện → bị chặn.
--
-- Chạy trong Supabase Dashboard → SQL Editor
--
-- Cách dùng:
--   1. Mở https://supabase.com/dashboard/project/hnnjbnskxzpfkkjgrazh/sql/new
--   2. Copy toàn bộ file vào
--   3. Bấm "Run"

BEGIN;

DROP POLICY IF EXISTS "Driver can update schedules they are assigned to" ON schedules;

CREATE POLICY "Driver can update schedules they are assigned to"
ON schedules FOR UPDATE
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid() OR driver_id IS NULL);

NOTIFY pgrst, 'reload schema';

RAISE NOTICE '✅ Đã sửa policy Driver can update — cho phép driver set driver_id = null (từ chối).';

COMMIT;
