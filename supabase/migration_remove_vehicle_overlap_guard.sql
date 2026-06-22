-- Migration: Xoá trigger guard_vehicle_overlap — cho phép xe overlapping
-- Lý do: Xe có thể điều điều về (shuttle), không cần chặn trùng giờ ở DB layer.
-- Chạy trong Supabase Dashboard → SQL Editor
--
-- Cách dùng:
--   1. Mở https://supabase.com/dashboard/project/hnnjbnskxzpfkkjgrazh/sql/new
--   2. Copy toàn bộ file này vào
--   3. Bấm "Run"

BEGIN;

DROP TRIGGER IF EXISTS guard_vehicle_overlap_trigger ON schedules;
DROP FUNCTION IF EXISTS public.guard_vehicle_overlap();

NOTIFY pgrst, 'reload schema';

RAISE NOTICE '✅ Đã xoá trigger guard_vehicle_overlap — xe có thể overlapping tự do.';

COMMIT;
