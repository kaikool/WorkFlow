-- =====================================================
-- MIGRATION: RESET MẬT KHẨU HÀNG LOẠT VỀ MẶC ĐỊNH
-- Dùng khi: sau khi bỏ password plaintext, các tài khoản cũ
-- không còn nguồn để Supabase Auth khớp password.
-- =====================================================
-- HƯỚNG DẪN SỬ DỤNG
-- 1. Mở Supabase Dashboard → SQL Editor
-- 2. Sửa biến v_default_password bên dưới theo ý bạn (tối thiểu 6 ký tự)
-- 3. Chạy script
-- 4. Thông báo cho toàn bộ cán bộ đăng nhập với mật khẩu mặc định, sau đó vào /dashboard/profile để đổi
-- =====================================================

-- Bật extension pgcrypto nếu chưa có (Supabase mặc định đã bật)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_default_password TEXT := 'Workflow@2026';  -- ⬅️ ĐỔI CHỖ NÀY nếu muốn mật khẩu khác
  v_updated_count INTEGER;
BEGIN
  -- Kiểm tra độ dài tối thiểu
  IF char_length(v_default_password) < 6 THEN
    RAISE EXCEPTION 'Mật khẩu mặc định phải ≥ 6 ký tự';
  END IF;

  -- Cập nhật bcrypt hash của TOÀN BỘ user trong auth.users
  -- Đồng thời gắn flag must_change_password để buộc đổi mật khẩu lần đầu đăng nhập
  UPDATE auth.users
  SET
    encrypted_password = crypt(v_default_password, gen_salt('bf')),
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                       || jsonb_build_object('must_change_password', true);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE '✅ Đã reset mật khẩu cho % tài khoản về: %', v_updated_count, v_default_password;
  RAISE NOTICE '⚠️  Thông báo cho cán bộ vào /dashboard/profile để đổi mật khẩu sau khi đăng nhập.';
END $$;

-- Cập nhật profile flag tương ứng (để FE có thể đọc nhanh không cần đụng auth.users)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
UPDATE profiles SET must_change_password = TRUE WHERE is_active = TRUE;

NOTIFY pgrst, 'reload schema';
