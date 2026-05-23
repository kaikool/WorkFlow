-- ============================================================================
-- DEPRECATION: GỠ MODULE KPIS HOÀN TOÀN
-- ----------------------------------------------------------------------------
-- Mục đích: Xoá sạch mọi schema/function/policy liên quan đến module KPIs.
-- App đã dừng dùng KPIs từ phiên deprecation 2026-05-23.
--
-- ⚠️ CẢNH BÁO: SCRIPT NÀY KHÔNG THỂ HOÀN TÁC.
-- Trước khi chạy:
--   1. Backup database (Supabase Dashboard → Database → Backups → Manual snapshot)
--   2. Export data nếu cần (Dashboard → Table Editor → kpis → Export CSV)
--
-- Chạy 1 lần trong Supabase SQL Editor → Run.
-- ============================================================================

-- 1) Drop các RPC function liên quan KPIs (CASCADE để xoá luôn dependencies)
DROP FUNCTION IF EXISTS public.update_kpi_contribution(uuid, uuid, bigint) CASCADE;
DROP FUNCTION IF EXISTS public.adjust_kpi_general(uuid, bigint) CASCADE;

-- 2) Drop bảng kpis. CASCADE để tự drop:
--    - Index (idx_kpis_department, idx_kpis_assignee)
--    - Tất cả RLS policies (KPIs read/create/update/delete access)
--    - Trigger nếu có
--    - Foreign key dependents nếu có (không có vì tasks không tham chiếu kpis)
DROP TABLE IF EXISTS public.kpis CASCADE;

-- 3) Bỏ CHECK constraint cấm task_type='kpi' trên bảng tasks
--    (constraint này từng được thêm trong migration_security_and_integrity.sql §4)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_task_type_not_kpi;

-- 4) Cập nhật function auto_archive_and_cleanup — bỏ khối UPDATE kpis
--    (function này còn được dùng cho tasks, nên KHÔNG drop hẳn — chỉ ghi đè)
CREATE OR REPLACE FUNCTION auto_archive_and_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Đưa công việc/báo cáo đã hoàn thành hoặc đóng trên 60 ngày vào lưu trữ
    UPDATE tasks
    SET is_archived = true
    WHERE status IN ('done', 'closed')
    AND created_at < NOW() - INTERVAL '60 days'
    AND is_archived = false;

    -- Xóa thông báo cũ hơn 30 ngày
    DELETE FROM notifications WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ============================================================================
-- Verify sau khi chạy:
--   SELECT * FROM information_schema.tables WHERE table_name = 'kpis';
--   -- Phải trả 0 row.
--
--   SELECT proname FROM pg_proc WHERE proname IN ('update_kpi_contribution', 'adjust_kpi_general');
--   -- Phải trả 0 row.
--
--   SELECT conname FROM pg_constraint WHERE conname = 'tasks_task_type_not_kpi';
--   -- Phải trả 0 row.
-- ============================================================================
