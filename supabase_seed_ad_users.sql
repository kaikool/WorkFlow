-- ==========================================================
-- SCRIPT KHỞI TẠO DANH SÁCH CÁN BỘ VÀ PHÒNG BAN TỰ ĐỘNG
-- MẬT KHẨU MẶC ĐỊNH CHO TẤT CẢ TÀI KHOẢN: 12345
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Đảm bảo các cột bổ sung có sẵn trong bảng public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_department_head BOOLEAN DEFAULT false;

-- 1A. Dọn dẹp tất cả trigger bám trên public.profiles và auth.users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT trigger_name 
    FROM information_schema.triggers 
    WHERE event_object_schema = 'public' 
      AND event_object_table = 'profiles'
  ) LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.profiles;';
  END LOOP;
END $$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT trigger_name 
    FROM information_schema.triggers 
    WHERE event_object_schema = 'auth' 
      AND event_object_table = 'users'
      AND trigger_name <> 'on_auth_user_created'
  ) LOOP
    EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON auth.users;';
  END LOOP;
END $$;

-- 1B. Tạo trigger handle_new_user chuẩn, có cơ chế an toàn
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  IF new.id IS NOT NULL THEN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', ''), 'staff')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 1C. Tạo các phòng ban mới bằng Tiếng Việt
INSERT INTO public.departments (name) VALUES ('PGD Gamuda') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments (name) VALUES ('PGD Hào Nam') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments (name) VALUES ('PGD Khương Mai') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments (name) VALUES ('PGD Linh Đàm') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments (name) VALUES ('PGD Minh Khai') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments (name) VALUES ('PGD Nam Hà Nội') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Phòng KHDN') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Phòng bán lẻ') ON CONFLICT (name) DO NOTHING;
INSERT INTO public.departments (name) VALUES ('Phòng dịch vụ khách hàng') ON CONFLICT (name) DO NOTHING;

-- 2. Khởi tạo danh sách cán bộ
-- Cán bộ: Nguyễn Hưng Chi (CHINH) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'chinh@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'chinh@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Hưng Chi"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Hưng Chi"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Hưng Chi', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Vũ Thị Lệ Mỹ (MYVTL) - Phó Trưởng phòng - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'myvtl@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'myvtl@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Vũ Thị Lệ Mỹ"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Vũ Thị Lệ Mỹ"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Vũ Thị Lệ Mỹ', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hà Thị Hồng Diệp (DIEPHTH) - Phó Trưởng phòng - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'diephth@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'diephth@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hà Thị Hồng Diệp"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hà Thị Hồng Diệp"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hà Thị Hồng Diệp', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Văn Hùng (NGUYENVAN.HUNG) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nguyenvan.hung@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'nguyenvan.hung@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Văn Hùng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Văn Hùng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Văn Hùng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Kim Hương (HUONG.NTK) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'huong.ntk@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'huong.ntk@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Kim Hương"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Kim Hương"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Kim Hương', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Thanh Giang (NTT.GIANG) - Trưởng phòng - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ntt.giang@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ntt.giang@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Thanh Giang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Thanh Giang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Thanh Giang', 'manager', v_dept_id, true, 'Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hồ Thị Hải Vân (VANHH) - Phó Trưởng phòng - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'vanhh@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'vanhh@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hồ Thị Hải Vân"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hồ Thị Hải Vân"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hồ Thị Hải Vân', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trần Thị Sáng (SANGTT) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'sangtt@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'sangtt@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trần Thị Sáng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trần Thị Sáng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trần Thị Sáng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Việt Anh (NGUYENTHIVIET.ANH) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nguyenthiviet.anh@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'nguyenthiviet.anh@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Việt Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Việt Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Việt Anh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đỗ Thị Huyền (DOTHI.HUYEN) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dothi.huyen@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'dothi.huyen@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đỗ Thị Huyền"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đỗ Thị Huyền"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đỗ Thị Huyền', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trần Thị Huệ (TRANTHIHUE) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'tranthihue@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'tranthihue@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trần Thị Huệ"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trần Thị Huệ"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trần Thị Huệ', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thu Trang (TRANGNT13) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'trangnt13@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'trangnt13@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thu Trang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thu Trang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thu Trang', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đinh Thị Thu Huyền (HUYENDTT5) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'huyendtt5@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'huyendtt5@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đinh Thị Thu Huyền"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đinh Thị Thu Huyền"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đinh Thị Thu Huyền', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đoàn Thị Mai Hồng (HONGDTM) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hongdtm@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hongdtm@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đoàn Thị Mai Hồng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đoàn Thị Mai Hồng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đoàn Thị Mai Hồng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Bích Thủy (THUYNB1) - Phó Trưởng phòng - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'thuynb1@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'thuynb1@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Bích Thủy"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Bích Thủy"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Bích Thủy', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Thu Hằng (HANGNTT23) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hangntt23@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hangntt23@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Thu Hằng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Thu Hằng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Thu Hằng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hoàng Mạnh Hùng (HUNGHM1) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hunghm1@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hunghm1@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hoàng Mạnh Hùng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hoàng Mạnh Hùng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hoàng Mạnh Hùng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Lê Thị Thu (THULT5) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'thult5@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'thult5@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lê Thị Thu"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Lê Thị Thu"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Lê Thị Thu', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Duyên (DUYENNT5) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'duyennt5@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'duyennt5@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Duyên"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Duyên"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Duyên', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đỗ Thảo Nguyên (NGUYENDT2) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nguyendt2@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'nguyendt2@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đỗ Thảo Nguyên"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đỗ Thảo Nguyên"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đỗ Thảo Nguyên', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Cẩm Ly (LY.NTC) - Chuyên viên - Phòng dịch vụ khách hàng
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng dịch vụ khách hàng';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ly.ntc@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ly.ntc@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Cẩm Ly"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Cẩm Ly"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Cẩm Ly', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Ngô Thị Xuân Linh (LINHNTX) - Phó Trưởng phòng - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'linhntx@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'linhntx@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ngô Thị Xuân Linh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Ngô Thị Xuân Linh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Ngô Thị Xuân Linh', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Khương Minh Hưng (HUNGKM) - Phó Trưởng phòng - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hungkm@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hungkm@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Khương Minh Hưng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Khương Minh Hưng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Khương Minh Hưng', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Lê Thị Minh Huyền (HUYENLTM) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'huyenltm@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'huyenltm@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lê Thị Minh Huyền"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Lê Thị Minh Huyền"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Lê Thị Minh Huyền', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Lê Thị Phương (PHUONGLT280) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'phuonglt280@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'phuonglt280@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lê Thị Phương"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Lê Thị Phương"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Lê Thị Phương', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Thu Hương (HUONGNTT136) - Trưởng phòng - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'huongntt136@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'huongntt136@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Thu Hương"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Thu Hương"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Thu Hương', 'manager', v_dept_id, true, 'Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Bùi Quang Tiến (TIENBQ) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'tienbq@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'tienbq@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Bùi Quang Tiến"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Bùi Quang Tiến"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Bùi Quang Tiến', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Mai Phượng (PHUONGNM9) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'phuongnm9@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'phuongnm9@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Mai Phượng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Mai Phượng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Mai Phượng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Văn Hiển (HIENNV4) - Phó Trưởng phòng - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hiennv4@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hiennv4@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Văn Hiển"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Văn Hiển"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Văn Hiển', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Ngô Thị Hồng Mến (MENNTH) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'mennth@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'mennth@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ngô Thị Hồng Mến"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Ngô Thị Hồng Mến"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Ngô Thị Hồng Mến', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Phạm Hồng Thắng (PH.THANG) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ph.thang@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ph.thang@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Phạm Hồng Thắng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Phạm Hồng Thắng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Phạm Hồng Thắng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hoàng Ngọc Hà (HA.HN) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ha.hn@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ha.hn@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hoàng Ngọc Hà"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hoàng Ngọc Hà"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hoàng Ngọc Hà', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đinh Thị Tuyến (DT.TUYEN) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dt.tuyen@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'dt.tuyen@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đinh Thị Tuyến"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đinh Thị Tuyến"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đinh Thị Tuyến', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trần Thị Thu Trang (TRANGTTT20) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'trangttt20@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'trangttt20@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trần Thị Thu Trang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trần Thị Thu Trang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trần Thị Thu Trang', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hoàng Bích Phương (PHUONGHB) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'phuonghb@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'phuonghb@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hoàng Bích Phương"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hoàng Bích Phương"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hoàng Bích Phương', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Lưu Đức Long (LONG.LD) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'long.ld@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'long.ld@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lưu Đức Long"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Lưu Đức Long"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Lưu Đức Long', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đinh Quốc Huy (HUYDQ8) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'huydq8@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'huydq8@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đinh Quốc Huy"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đinh Quốc Huy"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đinh Quốc Huy', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Mai Phương Anh (ANHMP) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'anhmp@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'anhmp@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Mai Phương Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Mai Phương Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Mai Phương Anh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Phạm Thị Thảo Huyền (HUYENPTT2) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'huyenptt2@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'huyenptt2@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Phạm Thị Thảo Huyền"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Phạm Thị Thảo Huyền"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Phạm Thị Thảo Huyền', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đào Thị Thảo (THAODT3) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'thaodt3@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'thaodt3@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đào Thị Thảo"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đào Thị Thảo"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đào Thị Thảo', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hà Quỳnh Nga (NGAHQ) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ngahq@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ngahq@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hà Quỳnh Nga"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hà Quỳnh Nga"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hà Quỳnh Nga', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trần Thị Loan (LOANTT2) - Chuyên viên - Phòng KHDN
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng KHDN';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'loantt2@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'loantt2@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trần Thị Loan"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trần Thị Loan"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trần Thị Loan', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Tống Thị Tâm (TAM.TONGTHI) - Phó Trưởng phòng - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'tam.tongthi@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'tam.tongthi@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Tống Thị Tâm"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Tống Thị Tâm"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Tống Thị Tâm', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Linh Chi (CHINL) - Trưởng phòng - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'chinl@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'chinl@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Linh Chi"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Linh Chi"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Linh Chi', 'manager', v_dept_id, true, 'Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hoàng Minh Trung (TRUNG.HM) - Chuyên viên - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'trung.hm@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'trung.hm@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hoàng Minh Trung"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hoàng Minh Trung"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hoàng Minh Trung', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Lê Thị Khánh Ly (LY.LTK) - Chuyên viên - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ly.ltk@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ly.ltk@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lê Thị Khánh Ly"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Lê Thị Khánh Ly"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Lê Thị Khánh Ly', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị My Ly (LYNTM5) - Chuyên viên - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lyntm5@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'lyntm5@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị My Ly"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị My Ly"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị My Ly', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trần Tuấn Anh (ANHTT13) - Chuyên viên - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'anhtt13@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'anhtt13@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trần Tuấn Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trần Tuấn Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trần Tuấn Anh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hồ Thị Hồng Đăng (DANGHTH) - Chuyên viên - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'danghth@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'danghth@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hồ Thị Hồng Đăng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hồ Thị Hồng Đăng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hồ Thị Hồng Đăng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Minh Hiếu (HIEUNM3) - Chuyên viên - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hieunm3@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hieunm3@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Minh Hiếu"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Minh Hiếu"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Minh Hiếu', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đặng Lưu Diệu Linh (LINHDLD) - Chuyên viên - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'linhdld@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'linhdld@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đặng Lưu Diệu Linh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đặng Lưu Diệu Linh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đặng Lưu Diệu Linh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Phạm Nguyên Thành (THANHPN4) - Chuyên viên - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'thanhpn4@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'thanhpn4@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Phạm Nguyên Thành"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Phạm Nguyên Thành"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Phạm Nguyên Thành', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Quang Minh (MINHNQ6) - Chuyên viên - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'minhnq6@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'minhnq6@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Quang Minh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Quang Minh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Quang Minh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Cao Sơn (NCSON) - Phó Trưởng phòng - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ncson@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ncson@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Cao Sơn"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Cao Sơn"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Cao Sơn', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Bùi Đình Phú (PHUBD) - Phó Trưởng phòng - Phòng bán lẻ
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'Phòng bán lẻ';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'phubd@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'phubd@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Bùi Đình Phú"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Bùi Đình Phú"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Bùi Đình Phú', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Vương Ngọc Đức (DUCVN) - Chuyên viên - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ducvn@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ducvn@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Vương Ngọc Đức"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Vương Ngọc Đức"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Vương Ngọc Đức', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trần Thị Bích Ngọc (NGOCTTB1) - Chuyên viên - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ngocttb1@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ngocttb1@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trần Thị Bích Ngọc"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trần Thị Bích Ngọc"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trần Thị Bích Ngọc', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Ngọc (NTNGOC) - Chuyên viên - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ntngoc@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ntngoc@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Ngọc"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Ngọc"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Ngọc', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Ninh Tiến Dũng (DUNGNT54) - Chuyên viên - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dungnt54@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'dungnt54@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ninh Tiến Dũng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Ninh Tiến Dũng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Ninh Tiến Dũng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Thu Trang (TRANGNTT61) - Chuyên viên - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'trangntt61@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'trangntt61@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Thu Trang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Thu Trang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Thu Trang', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Tiến Đạt (DATNT17) - Chuyên viên - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'datnt17@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'datnt17@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Tiến Đạt"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Tiến Đạt"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Tiến Đạt', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Huyền Trang (NGUYENHUYENTRANG) - Phó Trưởng phòng - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nguyenhuyentrang@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'nguyenhuyentrang@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Huyền Trang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Huyền Trang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Huyền Trang', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thanh Hương (NGUYEN.THANHHUONG) - Phó Trưởng phòng - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nguyen.thanhhuong@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'nguyen.thanhhuong@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thanh Hương"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thanh Hương"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thanh Hương', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Phạm Nguyệt Mai (MAIPN) - Trưởng phòng - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'maipn@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'maipn@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Phạm Nguyệt Mai"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Phạm Nguyệt Mai"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Phạm Nguyệt Mai', 'manager', v_dept_id, true, 'Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hoàng Minh Hương (HUONGHM) - Chuyên viên - PGD Minh Khai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Minh Khai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'huonghm@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'huonghm@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hoàng Minh Hương"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hoàng Minh Hương"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hoàng Minh Hương', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Huyền Trang (TRANG.NTH) - Chuyên viên - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'trang.nth@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'trang.nth@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Huyền Trang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Huyền Trang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Huyền Trang', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trần Diệu Linh (LINHTD) - Phó Trưởng phòng - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'linhtd@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'linhtd@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trần Diệu Linh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trần Diệu Linh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trần Diệu Linh', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Đức Toàn (TOANND) - Trưởng phòng - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'toannd@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'toannd@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Đức Toàn"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Đức Toàn"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Đức Toàn', 'manager', v_dept_id, true, 'Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Bùi Thị Thu Hà (BUITHITHU.HA) - Phó Trưởng phòng - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'buithithu.ha@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'buithithu.ha@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Bùi Thị Thu Hà"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Bùi Thị Thu Hà"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Bùi Thị Thu Hà', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đỗ Thị Thu Hiền (HIEN.DOTHITHU) - Chuyên viên - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hien.dothithu@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hien.dothithu@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đỗ Thị Thu Hiền"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đỗ Thị Thu Hiền"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đỗ Thị Thu Hiền', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Phạm Thị Biên Thùy (THUY.PTB) - Chuyên viên - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'thuy.ptb@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'thuy.ptb@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Phạm Thị Biên Thùy"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Phạm Thị Biên Thùy"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Phạm Thị Biên Thùy', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trần Đình Hoàng (HOANGTD) - Chuyên viên - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hoangtd@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hoangtd@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trần Đình Hoàng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trần Đình Hoàng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trần Đình Hoàng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Lê Thị Tuyết Yến (YEN.LTT) - Chuyên viên - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'yen.ltt@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'yen.ltt@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lê Thị Tuyết Yến"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Lê Thị Tuyết Yến"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Lê Thị Tuyết Yến', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Hữu Đức (DUCNH1) - Chuyên viên - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ducnh1@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ducnh1@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Hữu Đức"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Hữu Đức"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Hữu Đức', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thu Trang (TRANGNT64) - Chuyên viên - PGD Nam Hà Nội
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Nam Hà Nội';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'trangnt64@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'trangnt64@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thu Trang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thu Trang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thu Trang', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thanh Xuân (NGUYEN.THANHXUAN) - Chuyên viên - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nguyen.thanhxuan@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'nguyen.thanhxuan@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thanh Xuân"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thanh Xuân"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thanh Xuân', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đỗ Thị Hải (HAIDT5) - Chuyên viên - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'haidt5@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'haidt5@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đỗ Thị Hải"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đỗ Thị Hải"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đỗ Thị Hải', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hồ Hữu Quang (HH.QUANG) - Chuyên viên - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hh.quang@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hh.quang@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hồ Hữu Quang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hồ Hữu Quang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hồ Hữu Quang', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đinh Ngọc Linh (DNLINH) - Phó Trưởng phòng - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dnlinh@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'dnlinh@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đinh Ngọc Linh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đinh Ngọc Linh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đinh Ngọc Linh', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thái An (ANNT4) - Chuyên viên - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'annt4@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'annt4@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thái An"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thái An"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thái An', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Bùi Thị Diệu Huyền (HUYENBTD) - Chuyên viên - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'huyenbtd@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'huyenbtd@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Bùi Thị Diệu Huyền"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Bùi Thị Diệu Huyền"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Bùi Thị Diệu Huyền', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Lê Hoàng Đức (LH.DUC) - Chuyên viên - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lh.duc@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'lh.duc@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lê Hoàng Đức"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Lê Hoàng Đức"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Lê Hoàng Đức', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Bùi Văn Thắng (THANGBV) - Trưởng phòng - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'thangbv@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'thangbv@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Bùi Văn Thắng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Bùi Văn Thắng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Bùi Văn Thắng', 'manager', v_dept_id, true, 'Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Vũ Phương Anh (VUPHUONGANH) - Phó Trưởng phòng - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'vuphuonganh@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'vuphuonganh@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Vũ Phương Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Vũ Phương Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Vũ Phương Anh', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Ngọc Khánh (KHANH.NTN) - Chuyên viên - PGD Hào Nam
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Hào Nam';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'khanh.ntn@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'khanh.ntn@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Ngọc Khánh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Ngọc Khánh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Ngọc Khánh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Ngô Thị Thu Huyền (HUYEN.NGOTHITHU) - Trưởng phòng - PGD Khương Mai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Khương Mai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'huyen.ngothithu@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'huyen.ngothithu@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ngô Thị Thu Huyền"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Ngô Thị Thu Huyền"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Ngô Thị Thu Huyền', 'manager', v_dept_id, true, 'Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đỗ Tuấn Dũng (DUNG.DOTUAN) - Chuyên viên - PGD Khương Mai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Khương Mai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'dung.dotuan@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'dung.dotuan@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đỗ Tuấn Dũng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đỗ Tuấn Dũng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đỗ Tuấn Dũng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thủy Ngân (NGANNT7) - Chuyên viên - PGD Khương Mai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Khương Mai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ngannt7@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ngannt7@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thủy Ngân"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thủy Ngân"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thủy Ngân', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Mỹ Anh (ANHNM9) - Chuyên viên - PGD Khương Mai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Khương Mai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'anhnm9@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'anhnm9@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Mỹ Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Mỹ Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Mỹ Anh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Vũ Thị Lan Phương (PHUONG.VTL) - Chuyên viên - PGD Khương Mai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Khương Mai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'phuong.vtl@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'phuong.vtl@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Vũ Thị Lan Phương"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Vũ Thị Lan Phương"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Vũ Thị Lan Phương', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Hoàng Phương Anh (ANHNHP) - Chuyên viên - PGD Khương Mai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Khương Mai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'anhnhp@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'anhnhp@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Hoàng Phương Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Hoàng Phương Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Hoàng Phương Anh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thu Trang (TRANGNT50) - Chuyên viên - PGD Khương Mai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Khương Mai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'trangnt50@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'trangnt50@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thu Trang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thu Trang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thu Trang', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Vũ Thị Thu (THUVT2) - Phó Trưởng phòng - PGD Khương Mai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Khương Mai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'thuvt2@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'thuvt2@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Vũ Thị Thu"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Vũ Thị Thu"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Vũ Thị Thu', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hoàng Mạnh Cường (CUONG.HM) - Phó Trưởng phòng - PGD Khương Mai
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Khương Mai';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'cuong.hm@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'cuong.hm@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hoàng Mạnh Cường"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hoàng Mạnh Cường"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hoàng Mạnh Cường', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Hà Như Linh (HN.LINH) - Phó Trưởng phòng - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hn.linh@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hn.linh@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Hà Như Linh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Hà Như Linh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Hà Như Linh', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trương Thị Thanh (THANH.TRUONGTHI) - Phó Trưởng phòng - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'thanh.truongthi@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'thanh.truongthi@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trương Thị Thanh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trương Thị Thanh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trương Thị Thanh', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thị Thu Thủy (NTTHU.THUY) - Chuyên viên - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ntthu.thuy@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ntthu.thuy@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thị Thu Thủy"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thị Thu Thủy"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thị Thu Thủy', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Ngô Thị Ngọc Thu (NGOCTHU.NT) - Chuyên viên - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ngocthu.nt@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ngocthu.nt@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ngô Thị Ngọc Thu"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Ngô Thị Ngọc Thu"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Ngô Thị Ngọc Thu', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Chu Minh Đức (DUCCM) - Trưởng phòng - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'duccm@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'duccm@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Chu Minh Đức"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Chu Minh Đức"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Chu Minh Đức', 'manager', v_dept_id, true, 'Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Lương Thị Hòa (HOALT6) - Chuyên viên - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hoalt6@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hoalt6@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lương Thị Hòa"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Lương Thị Hòa"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Lương Thị Hòa', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Phùng Thị Mai Trang (TRANGPTM1) - Chuyên viên - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'trangptm1@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'trangptm1@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Phùng Thị Mai Trang"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Phùng Thị Mai Trang"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Phùng Thị Mai Trang', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Cửu Trang Anh (ANHNCT) - Chuyên viên - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'anhnct@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'anhnct@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Cửu Trang Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Cửu Trang Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Cửu Trang Anh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Chu Việt Hoàng (CV.HOANG) - Chuyên viên - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'cv.hoang@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'cv.hoang@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Chu Việt Hoàng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Chu Việt Hoàng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Chu Việt Hoàng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đỗ Đức Anh (ANHDD2) - Chuyên viên - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'anhdd2@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'anhdd2@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đỗ Đức Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đỗ Đức Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đỗ Đức Anh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Bảo Ngọc (NGOCNB11) - Chuyên viên - PGD Linh Đàm
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Linh Đàm';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ngocnb11@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ngocnb11@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Bảo Ngọc"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Bảo Ngọc"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Bảo Ngọc', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Bích Ngọc (NGUYENBICHNGOC) - Phó Trưởng phòng - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'nguyenbichngoc@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'nguyenbichngoc@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Bích Ngọc"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Bích Ngọc"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Bích Ngọc', 'manager', v_dept_id, false, 'Phó Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đặng Ngọc Cường (CUONGDN) - Trưởng phòng - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'cuongdn@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'cuongdn@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đặng Ngọc Cường"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đặng Ngọc Cường"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đặng Ngọc Cường', 'manager', v_dept_id, true, 'Trưởng phòng')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Đặng Thị Thu Lành (LANHDTT) - Chuyên viên - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lanhdtt@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'lanhdtt@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Đặng Thị Thu Lành"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Đặng Thị Thu Lành"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Đặng Thị Thu Lành', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Thế Anh (ANHNT18) - Chuyên viên - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'anhnt18@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'anhnt18@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Thế Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Thế Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Thế Anh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Phạm Thị Vân (VANPT5) - Chuyên viên - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'vanpt5@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'vanpt5@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Phạm Thị Vân"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Phạm Thị Vân"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Phạm Thị Vân', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Nguyễn Tùng Lâm (LAMNT12) - Chuyên viên - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lamnt12@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'lamnt12@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Nguyễn Tùng Lâm"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Nguyễn Tùng Lâm"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Nguyễn Tùng Lâm', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Trần Thị Mai Anh (TTM.ANH) - Chuyên viên - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'ttm.anh@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'ttm.anh@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Trần Thị Mai Anh"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Trần Thị Mai Anh"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Trần Thị Mai Anh', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Bùi Hồng Ngọc (BH.NGOC) - Chuyên viên - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'bh.ngoc@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'bh.ngoc@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Bùi Hồng Ngọc"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Bùi Hồng Ngọc"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Bùi Hồng Ngọc', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Bùi Vũ Thanh Hằng (HANGBVT) - Chuyên viên - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'hangbvt@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'hangbvt@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Bùi Vũ Thanh Hằng"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Bùi Vũ Thanh Hằng"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Bùi Vũ Thanh Hằng', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;

-- Cán bộ: Lê Thị Hậu (LTHAU) - Chuyên viên - PGD Gamuda
DO $$
DECLARE
  v_user_id UUID;
  v_dept_id UUID;
BEGIN
  SELECT id INTO v_dept_id FROM public.departments WHERE name = 'PGD Gamuda';
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'lthau@bank.local';
  
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'lthau@bank.local', crypt('12345', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Lê Thị Hậu"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  ELSE
    UPDATE auth.users SET encrypted_password = crypt('12345', gen_salt('bf')), raw_user_meta_data = '{"full_name":"Lê Thị Hậu"}'::jsonb, updated_at = now() WHERE id = v_user_id;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, department_id, is_department_head, title)
  VALUES (v_user_id, 'Lê Thị Hậu', 'staff', v_dept_id, false, 'Chuyên viên')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    department_id = EXCLUDED.department_id,
    is_department_head = EXCLUDED.is_department_head,
    title = EXCLUDED.title;
END $$;
