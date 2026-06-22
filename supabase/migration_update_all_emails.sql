-- Migration: Cập nhật email toàn bộ user thành @vietinbank.vn
-- Chạy trong Supabase Dashboard → SQL Editor
-- Cần quyền service_role (Superuser) — Supabase SQL Editor mặc định có quyền này.
-- 
-- Cách dùng:
--   1. Mở https://supabase.com/dashboard/project/hnnjbnskxzpfkkjgrazh/sql/new
--   2. Copy toàn bộ file này vào
--   3. Bấm "Run" hoặc "Run Selected"
--   4. Kiểm tra kết quả ở message phía dưới
--
-- Ghi chú: Đã cập nhật code frontend ở 3 file:
--   - src/app/dashboard/profile/page.tsx          (@agribank.com.vn → @vietinbank.vn)
--   - src/app/dashboard/team/_components/ProfileDetailDialog.tsx (@yourbank.com.vn → @vietinbank.vn)
--   - src/app/dashboard/team/_components/EditProfileDialog.tsx (placeholder)

BEGIN;

-- 1. Cập nhật email trong auth.users (dùng để đăng nhập)
UPDATE auth.users
SET email = SPLIT_PART(email, '@', 1) || '@vietinbank.vn'
WHERE email IS NOT NULL
  AND SPLIT_PART(email, '@', 2) IS DISTINCT FROM 'vietinbank.vn';

-- 2. Cập nhật profiles.ad_account — đã có @ thì đổi domain
UPDATE profiles
SET ad_account = SPLIT_PART(ad_account, '@', 1) || '@vietinbank.vn'
WHERE ad_account IS NOT NULL
  AND ad_account LIKE '%@%'
  AND SPLIT_PART(ad_account, '@', 2) IS DISTINCT FROM 'vietinbank.vn';

-- 3. Cập nhật profiles.ad_account — username thuần (không có @) → thêm @vietinbank.vn
UPDATE profiles
SET ad_account = ad_account || '@vietinbank.vn'
WHERE ad_account IS NOT NULL
  AND ad_account NOT LIKE '%@%';

-- 4. Thông báo kết quả
DO $$
DECLARE
  auth_updated integer := 0;
  profile_domain_updated integer := 0;
  profile_username_updated integer := 0;
  total_count integer := 0;
BEGIN
  SELECT COUNT(*) INTO auth_updated FROM auth.users WHERE email LIKE '%@vietinbank.vn';
  SELECT COUNT(*) INTO profile_domain_updated FROM profiles WHERE ad_account LIKE '%@vietinbank.vn';
  SELECT COUNT(*) INTO profile_username_updated FROM profiles WHERE ad_account LIKE '%@vietinbank.vn';
  SELECT COUNT(*) INTO total_count FROM profiles WHERE ad_account LIKE '%@vietinbank.vn';
  RAISE NOTICE '✅ auth.users có % email @vietinbank.vn', auth_updated;
  RAISE NOTICE '✅ profiles.ad_account có % user với @vietinbank.vn', total_count;
END $$;

COMMIT;
