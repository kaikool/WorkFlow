-- Migration: Cập nhật email toàn bộ user thành @vietinbank.vn
-- Chạy trong Supabase Dashboard → SQL Editor
-- Cần quyền service_role (Superuser) — Supabase SQL Editor mặc định có quyền này.
-- 
-- Cách dùng:
--   1. Mở https://supabase.com/dashboard/project/hnnjbnskxzpfkkjgrazh/sql/new
--   2. Copy toàn bộ file này vào
--   3. Bấm "Run" hoặc "Run Selected"
--   4. Kiểm tra kết quả ở message phía dưới

BEGIN;

-- 1. Cập nhật email trong auth.users (dùng để đăng nhập)
--    Giữ nguyên phần username trước @, chỉ đổi domain
UPDATE auth.users
SET email = SPLIT_PART(email, '@', 1) || '@vietinbank.vn'
WHERE email IS NOT NULL
  AND SPLIT_PART(email, '@', 2) IS DISTINCT FROM 'vietinbank.vn';

-- 2. Cập nhật profiles.ad_account
--    Nếu ad_account có @ → đổi domain thành @vietinbank.vn
--    Nếu ad_account không có @ (chỉ username) → giữ nguyên (không thêm domain)
UPDATE profiles
SET ad_account = SPLIT_PART(ad_account, '@', 1) || '@vietinbank.vn'
WHERE ad_account IS NOT NULL
  AND ad_account LIKE '%@%'
  AND SPLIT_PART(ad_account, '@', 2) IS DISTINCT FROM 'vietinbank.vn';

-- 3. Thông báo kết quả
DO $$
DECLARE
  auth_count integer;
  profile_count integer;
BEGIN
  GET DIAGNOSTICS auth_count = ROW_COUNT;

  SELECT COUNT(*) INTO profile_count
  FROM profiles
  WHERE ad_account LIKE '%@vietinbank.vn';

  RAISE NOTICE '✅ Đã cập nhật % email trong auth.users', auth_count;
  RAISE NOTICE '📧 profiles.ad_account có % user với @vietinbank.vn', profile_count;
END $$;

COMMIT;
