-- 1. Tạo Enums (Sử dụng DO block để tránh lỗi nếu đã tồn tại)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'director', 'manager', 'staff');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'secretary';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr_officer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'driver';

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('todo', 'doing', 'done', 'late');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'closed';



DO $$ BEGIN
    CREATE TYPE schedule_type AS ENUM ('meeting', 'trip', 'event');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE schedule_status AS ENUM ('pending', 'approved', 'rejected', 'in_progress', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 2. Tạo bảng Departments (Phòng ban)
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- 3. Tạo bảng Profiles (Thông tin người dùng)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    department_id UUID REFERENCES departments(id),
    role user_role DEFAULT 'staff',
    avatar_url TEXT,
    phone TEXT,
    birthday DATE,
    gender TEXT,
    ad_account TEXT UNIQUE,
    branch_join_date DATE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm các cột mới nếu bảng đã được tạo trước đó
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ad_account TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_join_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_department_head BOOLEAN DEFAULT false;

-- 4. Tạo bảng Tasks (Công việc & Mục tiêu)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    task_type TEXT DEFAULT 'task',
    progress INTEGER DEFAULT 0,
    assignee_id UUID REFERENCES profiles(id),
    created_by UUID REFERENCES profiles(id),
    due_date TIMESTAMPTZ,
    target_value BIGINT,
    current_value BIGINT DEFAULT 0,
    unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Đảm bảo các cột mới tồn tại nếu bảng đã được tạo trước đó
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_value BIGINT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS current_value BIGINT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Cập nhật dữ liệu cũ
UPDATE tasks SET is_archived = false WHERE is_archived IS NULL;

-- Hàm tự động dọn dẹp dữ liệu cũ
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

    -- Đưa KPIs đã hoàn thành trên 60 ngày vào lưu trữ
    UPDATE kpis 
    SET is_archived = true 
    WHERE status IN ('done', 'closed') 
    AND created_at < NOW() - INTERVAL '60 days' 
    AND is_archived = false;

    -- Xóa thông báo cũ hơn 30 ngày
    DELETE FROM notifications 
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 4.5. Tạo bảng KPIs (Chỉ tiêu)
CREATE TABLE IF NOT EXISTS kpis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    progress INTEGER DEFAULT 0,
    assignee_id UUID REFERENCES profiles(id),
    created_by UUID REFERENCES profiles(id),
    department_id UUID REFERENCES departments(id),
    due_date TIMESTAMPTZ,
    target_value BIGINT,
    current_value BIGINT DEFAULT 0,
    unit TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tạo bảng Task Comments (Bình luận công việc)
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tạo bảng Notifications (Thông báo)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    type TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tạo bảng Vehicles (Phương tiện)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plate_number TEXT NOT NULL UNIQUE,
    type TEXT, -- 4 chỗ, 7 chỗ, 16 chỗ
    status TEXT DEFAULT 'available', -- available, busy, maintenance
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tạo bảng Rooms (Phòng họp)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    capacity INTEGER,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tạo bảng Schedules (Lịch trình & Đặt chỗ)
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type schedule_type DEFAULT 'meeting',
    status schedule_status DEFAULT 'pending',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT, -- Địa điểm bên ngoài hoặc ghi chú
    room_id UUID REFERENCES rooms(id),
    vehicle_id UUID REFERENCES vehicles(id),
    department_id UUID REFERENCES departments(id),
    created_by UUID REFERENCES profiles(id),
    use_room BOOLEAN DEFAULT false,
    use_vehicle BOOLEAN DEFAULT false,
    requested_vehicle_type TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tạo bảng Recognitions (Vinh danh)
CREATE TABLE IF NOT EXISTS recognitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES profiles(id),
    receiver_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    type TEXT DEFAULT 'praise',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Bảng trung gian Người tham gia lịch trình
CREATE TABLE IF NOT EXISTS schedule_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE schedule_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read schedule_participants" ON schedule_participants;
DROP POLICY IF EXISTS "Anyone can join/be invited to schedules" ON schedule_participants;
DROP POLICY IF EXISTS "Anyone can delete schedule_participants" ON schedule_participants;
CREATE POLICY "Public read schedule_participants" ON schedule_participants FOR SELECT USING (true);
CREATE POLICY "Anyone can join/be invited to schedules" ON schedule_participants FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Anyone can delete schedule_participants" ON schedule_participants FOR DELETE
USING (
    auth.uid() IS NOT NULL AND (
        profile_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM schedules s
            WHERE s.id = schedule_participants.schedule_id AND s.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
            LEFT JOIN departments d ON p.department_id = d.id
            WHERE p.id = auth.uid()
            AND (p.role IN ('admin', 'secretary', 'hr_officer') OR (p.role = 'manager' AND d.code = '13602'))
        )
    )
);

-- 11. Tạo bảng Notifications (Thông báo)
INSERT INTO departments (name) 
VALUES 
('Tín dụng'), 
('Giao dịch viên'), 
('Kho quỹ'), 
('Pháp chế'), 
('Công nghệ thông tin'),
('Tổ chức Tổng hợp')
ON CONFLICT (name) DO NOTHING;

-- Chèn dữ liệu mẫu cho Xe
INSERT INTO vehicles (name, plate_number, type)
VALUES 
('Toyota Fortuner', '30F-123.45', '7 chỗ'),
('Toyota Camry', '30A-999.99', '4 chỗ'),
('Ford Transit', '30B-555.55', '16 chỗ')
ON CONFLICT (plate_number) DO NOTHING;

-- Chèn dữ liệu mẫu cho Phòng họp
INSERT INTO rooms (name, capacity, location)
VALUES 
('Phòng họp lớn (Tầng 2)', 30, 'Tầng 2 - Khu A'),
('Phòng họp nhỏ (Tầng 1)', 10, 'Tầng 1 - Khu B'),
('Hội trường chính', 100, 'Tầng 3')
ON CONFLICT (name) DO NOTHING;

-- 7. Thiết lập Row Level Security (RLS)
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recognitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Xóa các policies cũ nếu có để tránh lỗi trùng lặp khi chạy lại
DROP POLICY IF EXISTS "Public read departments" ON departments;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Staff see assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Anyone can create tasks" ON tasks;
DROP POLICY IF EXISTS "Managers, Directors and Admin can update tasks" ON tasks;

-- Tạo lại Policies
CREATE POLICY "Public read departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Tasks read access" ON tasks FOR SELECT 
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
    OR auth.uid() = assignee_id 
    OR auth.uid() = created_by
    OR (metadata->>'assigned_line' IS NOT NULL AND auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(metadata->'assigned_line'))))
);

CREATE POLICY "Anyone can create tasks" ON tasks FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Tasks update access" ON tasks FOR UPDATE 
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
    OR auth.uid() = assignee_id 
    OR auth.uid() = created_by
    OR (metadata->>'assigned_line' IS NOT NULL AND auth.uid()::text = ANY(ARRAY(SELECT jsonb_array_elements_text(metadata->'assigned_line'))))
);

-- KPI Policies
DROP POLICY IF EXISTS "KPIs read access" ON kpis;
CREATE POLICY "KPIs read access" ON kpis FOR SELECT 
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
    OR auth.uid() = assignee_id 
    OR auth.uid() = created_by
);

DROP POLICY IF EXISTS "KPIs create access" ON kpis;
CREATE POLICY "KPIs create access" ON kpis FOR INSERT 
WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
);

DROP POLICY IF EXISTS "KPIs update access" ON kpis;
CREATE POLICY "KPIs update access" ON kpis FOR UPDATE 
USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR (
        (SELECT role FROM profiles WHERE id = auth.uid()) = 'manager'
        AND department_id = (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
    OR auth.uid() = assignee_id
    OR auth.uid() = created_by
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Xóa các policies cũ nếu có
DROP POLICY IF EXISTS "Anyone can view task comments" ON task_comments;
DROP POLICY IF EXISTS "Users can post comments" ON task_comments;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- Tạo lại Policies
CREATE POLICY "Anyone can view task comments" ON task_comments FOR SELECT USING (true);
CREATE POLICY "Users can post comments" ON task_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view recognitions" ON recognitions;
DROP POLICY IF EXISTS "Admins can create recognitions" ON recognitions;
CREATE POLICY "Anyone can view recognitions" ON recognitions FOR SELECT USING (true);
CREATE POLICY "Admins can create recognitions" ON recognitions FOR INSERT WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
);

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated users can create notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.check_schedule_participant_conflicts(
  p_participant_ids uuid[],
  p_start timestamptz,
  p_end timestamptz,
  p_ignore_schedule_id uuid DEFAULT NULL
)
RETURNS TABLE (
  schedule_id uuid,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  status schedule_status,
  profile_id uuid,
  full_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.title,
    s.start_time,
    s.end_time,
    s.status,
    p.id,
    p.full_name
  FROM schedules s
  JOIN schedule_participants sp ON sp.schedule_id = s.id
  JOIN profiles p ON p.id = sp.profile_id
  WHERE s.status <> 'rejected'
    AND (p_ignore_schedule_id IS NULL OR s.id <> p_ignore_schedule_id)
    AND sp.profile_id = ANY(p_participant_ids)
    AND s.start_time < p_end
    AND s.end_time > p_start;
$$;

GRANT EXECUTE ON FUNCTION public.check_schedule_participant_conflicts(uuid[], timestamptz, timestamptz, uuid) TO authenticated;

-- Policies cho Lịch trình
DROP POLICY IF EXISTS "Public read schedules" ON schedules;
CREATE POLICY "Public read schedules" ON schedules FOR SELECT USING (
    auth.uid() = created_by
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
        AND (p.role IN ('admin', 'secretary', 'hr_officer') OR (p.role = 'manager' AND d.code = '13602'))
    )
    OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'driver'
    )
);

DROP POLICY IF EXISTS "Anyone can create schedules" ON schedules;
CREATE POLICY "Anyone can create schedules" ON schedules FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "TCTH and Creator can update schedules" ON schedules;
CREATE POLICY "TCTH and Creator can update schedules" ON schedules FOR UPDATE 
USING (
    auth.uid() = created_by 
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'secretary', 'hr_officer'))
    OR EXISTS (
      SELECT 1 FROM profiles p
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = auth.uid() 
      AND (p.role IN ('admin', 'secretary', 'hr_officer') OR (p.role = 'manager' AND d.code = '13602'))
    )
    OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'driver'
    )
);

-- Policies cho Phòng và Xe (Admin và Thư ký Tổ chức Tổng hợp toàn quyền, User chỉ xem)
DROP POLICY IF EXISTS "Public read vehicles" ON vehicles;
CREATE POLICY "Public read vehicles" ON vehicles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write vehicles" ON vehicles;
DROP POLICY IF EXISTS "Admin and Secretary write vehicles" ON vehicles;
CREATE POLICY "Admin and Secretary write vehicles" ON vehicles FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        LEFT JOIN departments d ON p.department_id = d.id 
        WHERE p.id = auth.uid() 
        AND (p.role IN ('admin', 'secretary') OR d.name = 'Tổ chức Tổng hợp')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p 
        LEFT JOIN departments d ON p.department_id = d.id 
        WHERE p.id = auth.uid() 
        AND (p.role IN ('admin', 'secretary') OR d.name = 'Tổ chức Tổng hợp')
    )
);

DROP POLICY IF EXISTS "Public read rooms" ON rooms;
CREATE POLICY "Public read rooms" ON rooms FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin write rooms" ON rooms;
DROP POLICY IF EXISTS "Admin and Secretary write rooms" ON rooms;
CREATE POLICY "Admin and Secretary write rooms" ON rooms FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM profiles p 
        LEFT JOIN departments d ON p.department_id = d.id 
        WHERE p.id = auth.uid() 
        AND (p.role IN ('admin', 'secretary') OR d.name = 'Tổ chức Tổng hợp')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p 
        LEFT JOIN departments d ON p.department_id = d.id 
        WHERE p.id = auth.uid() 
        AND (p.role IN ('admin', 'secretary') OR d.name = 'Tổ chức Tổng hợp')
    )
);

-- 8. Trigger tự động tạo Profile khi Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'staff')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Xóa trigger cũ nếu có trước khi tạo lại
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- 9. Cấu hình Supabase Storage cho Avatars
-- Chạy các lệnh này trong SQL Editor để tạo bucket và phân quyền
/*
-- Tạo bucket lưu trữ ảnh đại diện
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Cho phép mọi người xem ảnh đại diện (Public Read)
CREATE POLICY "Avatar Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Cho phép người dùng tải lên ảnh của chính mình
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);

-- Cho phép người dùng cập nhật ảnh của chính mình
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.uid() = (storage.foldername(name))[1]::uuid);
*/

-- 12. Tạo bảng Push Subscriptions (Lưu đăng ký thông báo PWA)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, subscription)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions" 
ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- 13. Tạo bảng Account Requests (Yêu cầu cấp tài khoản mới)
CREATE TABLE IF NOT EXISTS account_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role user_role DEFAULT 'staff',
    department_id UUID REFERENCES departments(id),
    password TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE account_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert account requests" ON account_requests;
CREATE POLICY "Anyone can insert account requests" ON account_requests 
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can view account requests" ON account_requests;
CREATE POLICY "Only admins can view account requests" ON account_requests 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "Only admins can update account requests" ON account_requests;
CREATE POLICY "Only admins can update account requests" ON account_requests 
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

NOTIFY pgrst, 'reload schema';


