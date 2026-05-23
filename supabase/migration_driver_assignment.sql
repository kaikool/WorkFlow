-- ==============================================
-- MIGRATION: THÊM DRIVER_ID VÀO VEHICLES VÀ SCHEDULES
-- Mục đích: Hỗ trợ gán Lái xe chuyên trách cho Xe và Lái xe cụ thể cho Lịch trình
-- ==============================================

-- 1. Bảng vehicles: Thêm cột driver_id để xác định tài xế chuyên trách mặc định của xe
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Bảng schedules: Thêm cột driver_id để gán tài xế thực hiện chuyến đi
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 3. Cập nhật RLS cho schedules để cho phép driver_id được xem và cập nhật chuyến đi của mình
-- Xóa policy cũ nếu có (Policy SELECT và UPDATE cho driver)
DROP POLICY IF EXISTS "Driver can view schedules they are assigned to" ON schedules;
DROP POLICY IF EXISTS "Driver can update schedules they are assigned to" ON schedules;

-- Policy SELECT: Lái xe được quyền xem các chuyến đi mà họ được gán
CREATE POLICY "Driver can view schedules they are assigned to"
ON schedules FOR SELECT
USING (
    driver_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM schedule_participants sp
        WHERE sp.schedule_id = id AND sp.profile_id = auth.uid()
    )
);

-- Policy UPDATE: Lái xe được quyền cập nhật (progress/status/start_km/end_km/etc) chuyến đi của mình
CREATE POLICY "Driver can update schedules they are assigned to"
ON schedules FOR UPDATE
USING (
    driver_id = auth.uid()
);

-- Tùy chọn (Tùy chọn di chuyển dữ liệu cũ): Nếu bạn muốn, có thể cập nhật driver_id dựa trên một logic nào đó, nhưng thường bỏ qua vì dữ liệu mới sẽ gán trực tiếp.
