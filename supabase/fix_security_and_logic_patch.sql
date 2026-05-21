-- ==============================================
-- MIGRATION: BẢN VÁ BẢO MẬT & PHÂN QUYỀN RLS DATABASE
-- Mục đích: Khắc phục các lỗ hổng Spoofing, thắt chặt RLS bảng participants và enum.
-- ==============================================

-- 1. Bổ sung giá trị 'leave' vào kiểu dữ liệu Enum schedule_type
ALTER TYPE schedule_type ADD VALUE IF NOT EXISTS 'leave';

-- 2. Sửa chính sách RLS cho bảng tasks (Ngăn chặn mạo danh người tạo công việc)
DROP POLICY IF EXISTS "Anyone can create tasks" ON tasks;
CREATE POLICY "Anyone can create tasks" ON tasks FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
);

-- 3. Sửa chính sách RLS cho bảng schedules (Ngăn chặn mạo danh người tạo lịch trình)
DROP POLICY IF EXISTS "Anyone can create schedules" ON schedules;
CREATE POLICY "Anyone can create schedules" ON schedules FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND created_by = auth.uid()
);

-- 4. Thắt chặt RLS bảng schedule_participants để ngăn chặn thêm thành viên bừa bãi
DROP POLICY IF EXISTS "Anyone can join/be invited to schedules" ON schedule_participants;
CREATE POLICY "Anyone can join/be invited to schedules" ON schedule_participants FOR INSERT 
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND (
        profile_id = auth.uid() -- Tự đăng ký tham gia lịch trình
        OR EXISTS (
            SELECT 1 FROM schedules s
            WHERE s.id = schedule_participants.schedule_id AND s.created_by = auth.uid() -- Được mời bởi người tạo lịch trình
        )
    )
);
