-- ==============================================================================
-- migration_performance_v2.sql
-- Composite indexes cho time-range queries + cursor pagination cho handover.
-- Áp dụng: chạy trong Supabase SQL Editor, không block writes (CONCURRENTLY).
-- ==============================================================================
BEGIN;

-- 1. Thay thế index đơn cho room scheduling bằng composite index phủ time-range query
--    Query pattern: WHERE room_id IS NOT NULL AND start_time < X AND end_time > Y
DROP INDEX IF EXISTS idx_schedules_room;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_room_time
  ON schedules(room_id, start_time, end_time)
  WHERE room_id IS NOT NULL;

-- 2. Thay thế index đơn cho vehicle scheduling bằng composite index phủ time-range query
--    Query pattern: WHERE vehicle_id IS NOT NULL AND start_time < X AND end_time > Y
DROP INDEX IF EXISTS idx_schedules_vehicle;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_vehicle_time
  ON schedules(vehicle_id, start_time, end_time)
  WHERE vehicle_id IS NOT NULL;

-- 3. Index cho cursor pagination documents(updated_at DESC)
--    Query pattern: ORDER BY updated_at DESC LIMIT 50
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_updated_desc
  ON documents(updated_at DESC);

NOTIFY pgrst, 'reload schema';
COMMIT;
