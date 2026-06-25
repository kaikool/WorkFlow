-- Migration: Fix RLS policy để coordinator (secretary/TCTH) duyệt "tự túc phương tiện"
-- Lỗi: "violates row level security for table schedule" khi coordinator bấm "Tự túc PT"
-- Nguyên nhân: Policy "Coordinator and Creator can update schedules" không có WITH CHECK riêng,
--   mặc định dùng lại USING có điều kiện schedules.use_vehicle = true.
--   Khi coordinator set use_vehicle = false (tự túc PT), new row không thoả WITH CHECK → bị chặn.
--
-- Cách fix: Thêm WITH CHECK riêng, bỏ schedules.use_vehicle = true khỏi WITH CHECK
--   (USING vẫn giữ nguyên để coordinator chỉ thấy hàng có xe).
--
-- Chạy trong Supabase Dashboard → SQL Editor
--
-- Cách dùng:
--   1. Mở https://supabase.com/dashboard/project/hnnjbnskxzpfkkjgrazh/sql/new
--   2. Copy toàn bộ file vào
--   3. Bấm "Run"

BEGIN;

DROP POLICY IF EXISTS "Coordinator and Creator can update schedules" ON schedules;

CREATE POLICY "Coordinator and Creator can update schedules" ON schedules FOR UPDATE
USING (
    auth.uid() = created_by 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = auth.uid() 
      AND schedules.use_vehicle = true
      AND (p.role = 'secretary' OR (p.role = 'manager' AND d.code = '13602'))
    )
    OR driver_id = auth.uid()
)
WITH CHECK (
    auth.uid() = created_by 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = auth.uid() 
      AND (p.role = 'secretary' OR (p.role = 'manager' AND d.code = '13602'))
    )
    OR driver_id = auth.uid()
    OR driver_id IS NULL
);

NOTIFY pgrst, 'reload schema';

COMMIT;
