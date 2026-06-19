-- Migration: cập nhật policy lịch trình + luồng xe
-- Mục tiêu:
-- 1. Lịch không có BGĐ tham gia chỉ hiển thị cho creator, participant, cùng phòng, admin.
-- 2. Điều phối chỉ xem/cập nhật lịch có use_vehicle=true; lái xe chỉ xem/cập nhật chuyến được gán qua schedules.driver_id.
-- 3. Lịch có xe ở trạng thái pending để chờ điều phối gán xe/lái xe; gán xong thì approved.

BEGIN;

DROP POLICY IF EXISTS "Public read schedules" ON schedules;
CREATE POLICY "Public read schedules" ON schedules FOR SELECT USING (
    auth.uid() = created_by
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (
        SELECT 1 FROM schedule_participants sp
        WHERE sp.schedule_id = schedules.id AND sp.profile_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM schedule_participants sp
        JOIN profiles p ON p.id = sp.profile_id
        WHERE sp.schedule_id = schedules.id AND p.role = 'director'
    )
    OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = schedules.created_by AND p.role = 'director'
    )
    OR EXISTS (
        SELECT 1 FROM profiles p
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE p.id = auth.uid()
        AND schedules.use_vehicle = true
        AND (p.role = 'secretary' OR (p.role = 'manager' AND d.code = '13602'))
    )
    OR driver_id = auth.uid()
);

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
);

NOTIFY pgrst, 'reload schema';

COMMIT;
