-- Seed danh sach can bo Chi nhanh Hoang Mai.
-- Chay trong Supabase SQL Editor bang quyen owner/service role.
-- Tai khoan dang nhap: UserAD hoac UserAD@bank.local. Mat khau mac dinh: 123.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Cập nhật hàm trigger tạo profile sang phiên bản an toàn để tránh lỗi trùng khóa (duplicate key) khi chèn dữ liệu
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'staff')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'secretary';
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr_officer';
-- ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'driver';


ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ad_account TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_join_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_department_head BOOLEAN DEFAULT false;
-- Cleanup du lieu seed cu cho dung danh sach UserAD ben duoi.
-- Pham vi xoa: chi cac profile/auth.users co ad_account trong danh sach hoac email dang userad@bank.local.
DO $$
DECLARE
  v_profile_ids uuid[];
  v_emails text[];
BEGIN
  SELECT array_agg(lower(x) || '@bank.local') INTO v_emails
  FROM unnest(ARRAY[
    'HUNGDN',
    'NTB.HANH',
    'QUYNHLN',
    'DQTRUNG',
    'NGAT.TT',
    'HUONG.CT',
    'TUPA',
    'LT.HIEU',
    'PHUONG.NTM',
    'LANTTHI',
    'NGOC.PQ',
    'HOA.PQ',
    'THUNTP',
    'DAO.TH',
    'QUYENPD',
    'VAN.VUTHIHA',
    'PHUCTD',
    'NCCONG',
    'CHANGMT',
    'MAI.HN',
    'ANHMT1',
    'KHANH.PN',
    'NHANNT16',
    'DAONT4',
    'CHINH',
    'NGUYENVAN.HUNG',
    'HUONG.NTK',
    'DIEPHTH',
    'NTT.GIANG',
    'MYVTL',
    'VANHH',
    'SANGTT',
    'NGUYENTHIVIET.ANH',
    'DOTHI.HUYEN',
    'TRANTHIHUE',
    'TRANGNT13',
    'HUYENDTT5',
    'HONGDTM',
    'THUYNB1',
    'HANGNTT23',
    'HUNGHM1',
    'THULT5',
    'DUYENNT5',
    'LY.NTC',
    'NGUYENDT2',
    'LINHNTX',
    'HUNGKM',
    'HUYENLTM',
    'PHUONGLT280',
    'HUONGNTT136',
    'TIENBQ',
    'PHUONGNM9',
    'HIENNV4',
    'MENNTH',
    'PH.THANG',
    'HA.HN',
    'DT.TUYEN',
    'TRANGTTT20',
    'PHUONGHB',
    'LONG.LD',
    'HUYDQ8',
    'ANHMP',
    'HUYENPTT2',
    'THAODT3',
    'NGAHQ',
    'LOANTT2',
    'PHUBD',
    'CHINL',
    'TAM.TONGTHI',
    'NCSON',
    'DANGHTH',
    'TRUNG.HM',
    'LY.LTK',
    'LYNTM5',
    'ANHTT13',
    'HIEUNM3',
    'LINHDLD',
    'THANHPN4',
    'MINHNQ6',
    'THANGLC',
    'QUYENDM',
    'NTM.HOANG',
    'NGUYENPX',
    'MANHCD',
    'ANHMQ',
    'NGUYEN.THANHHUONG',
    'NGUYENHUYENTRANG',
    'HUONGHM',
    'MAIPN',
    'DUCVN',
    'NGOCTTB1',
    'DUNGNT54',
    'TRANGNTT61',
    'DATNT17',
    'BUITHITHU.HA',
    'HIEN.DOTHITHU',
    'TRANG.NTH',
    'LINHTD',
    'THUY.PTB',
    'HOANGTD',
    'YEN.LTT',
    'TOANND',
    'DUCNH1',
    'TRANGNT64',
    'THANGBV',
    'NGUYEN.THANHXUAN',
    'VUPHUONGANH',
    'HAIDT5',
    'KHANH.NTN',
    'HH.QUANG',
    'DNLINH',
    'ANNT4',
    'LH.DUC',
    'DUNG.DOTUAN',
    'HUYEN.NGOTHITHU',
    'CUONG.HM',
    'THUVT2',
    'NGANNT7',
    'PHUONG.VTL',
    'ANHNHP',
    'TRANGNT50',
    'ANHNM9',
    'THANH.TRUONGTHI',
    'NTTHU.THUY',
    'NGOCTHU.NT',
    'DUCCM',
    'HOALT6',
    'TRANGPTM1',
    'HN.LINH',
    'ANHNCT',
    'CV.HOANG',
    'ANHDD2',
    'NGOCNB11',
    'NGUYENBICHNGOC',
    'CUONGDN',
    'LANHDTT',
    'ANHNT18',
    'VANPT5',
    'LAMNT12',
    'TTM.ANH',
    'BH.NGOC',
    'HANGBVT',
    'LTHAU'
  ]::text[]) AS x;

  SELECT array_agg(DISTINCT p.id) INTO v_profile_ids
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.ad_account = ANY(ARRAY[
    'HUNGDN',
    'NTB.HANH',
    'QUYNHLN',
    'DQTRUNG',
    'NGAT.TT',
    'HUONG.CT',
    'TUPA',
    'LT.HIEU',
    'PHUONG.NTM',
    'LANTTHI',
    'NGOC.PQ',
    'HOA.PQ',
    'THUNTP',
    'DAO.TH',
    'QUYENPD',
    'VAN.VUTHIHA',
    'PHUCTD',
    'NCCONG',
    'CHANGMT',
    'MAI.HN',
    'ANHMT1',
    'KHANH.PN',
    'NHANNT16',
    'DAONT4',
    'CHINH',
    'NGUYENVAN.HUNG',
    'HUONG.NTK',
    'DIEPHTH',
    'NTT.GIANG',
    'MYVTL',
    'VANHH',
    'SANGTT',
    'NGUYENTHIVIET.ANH',
    'DOTHI.HUYEN',
    'TRANTHIHUE',
    'TRANGNT13',
    'HUYENDTT5',
    'HONGDTM',
    'THUYNB1',
    'HANGNTT23',
    'HUNGHM1',
    'THULT5',
    'DUYENNT5',
    'LY.NTC',
    'NGUYENDT2',
    'LINHNTX',
    'HUNGKM',
    'HUYENLTM',
    'PHUONGLT280',
    'HUONGNTT136',
    'TIENBQ',
    'PHUONGNM9',
    'HIENNV4',
    'MENNTH',
    'PH.THANG',
    'HA.HN',
    'DT.TUYEN',
    'TRANGTTT20',
    'PHUONGHB',
    'LONG.LD',
    'HUYDQ8',
    'ANHMP',
    'HUYENPTT2',
    'THAODT3',
    'NGAHQ',
    'LOANTT2',
    'PHUBD',
    'CHINL',
    'TAM.TONGTHI',
    'NCSON',
    'DANGHTH',
    'TRUNG.HM',
    'LY.LTK',
    'LYNTM5',
    'ANHTT13',
    'HIEUNM3',
    'LINHDLD',
    'THANHPN4',
    'MINHNQ6',
    'THANGLC',
    'QUYENDM',
    'NTM.HOANG',
    'NGUYENPX',
    'MANHCD',
    'ANHMQ',
    'NGUYEN.THANHHUONG',
    'NGUYENHUYENTRANG',
    'HUONGHM',
    'MAIPN',
    'DUCVN',
    'NGOCTTB1',
    'DUNGNT54',
    'TRANGNTT61',
    'DATNT17',
    'BUITHITHU.HA',
    'HIEN.DOTHITHU',
    'TRANG.NTH',
    'LINHTD',
    'THUY.PTB',
    'HOANGTD',
    'YEN.LTT',
    'TOANND',
    'DUCNH1',
    'TRANGNT64',
    'THANGBV',
    'NGUYEN.THANHXUAN',
    'VUPHUONGANH',
    'HAIDT5',
    'KHANH.NTN',
    'HH.QUANG',
    'DNLINH',
    'ANNT4',
    'LH.DUC',
    'DUNG.DOTUAN',
    'HUYEN.NGOTHITHU',
    'CUONG.HM',
    'THUVT2',
    'NGANNT7',
    'PHUONG.VTL',
    'ANHNHP',
    'TRANGNT50',
    'ANHNM9',
    'THANH.TRUONGTHI',
    'NTTHU.THUY',
    'NGOCTHU.NT',
    'DUCCM',
    'HOALT6',
    'TRANGPTM1',
    'HN.LINH',
    'ANHNCT',
    'CV.HOANG',
    'ANHDD2',
    'NGOCNB11',
    'NGUYENBICHNGOC',
    'CUONGDN',
    'LANHDTT',
    'ANHNT18',
    'VANPT5',
    'LAMNT12',
    'TTM.ANH',
    'BH.NGOC',
    'HANGBVT',
    'LTHAU'
  ]::text[])
     OR lower(u.email) = ANY(v_emails);

  IF v_profile_ids IS NOT NULL THEN
    DELETE FROM public.notifications WHERE user_id = ANY(v_profile_ids);
    DELETE FROM public.push_subscriptions WHERE user_id = ANY(v_profile_ids);
    DELETE FROM public.schedule_participants WHERE profile_id = ANY(v_profile_ids);
    DELETE FROM public.task_comments WHERE user_id = ANY(v_profile_ids);
    DELETE FROM public.recognitions WHERE sender_id = ANY(v_profile_ids) OR receiver_id = ANY(v_profile_ids);
    DELETE FROM public.account_requests WHERE lower(email) = ANY(v_emails);
    DELETE FROM public.tasks WHERE assignee_id = ANY(v_profile_ids) OR created_by = ANY(v_profile_ids);
    DELETE FROM public.schedules WHERE created_by = ANY(v_profile_ids);
    DELETE FROM public.profiles WHERE id = ANY(v_profile_ids);
  END IF;

  DELETE FROM auth.identities
  WHERE lower(provider_id) = ANY(v_emails)
     OR lower(identity_data->>'email') = ANY(v_emails)
     OR (v_profile_ids IS NOT NULL AND user_id = ANY(v_profile_ids));

  DELETE FROM auth.users WHERE lower(email) = ANY(v_emails);
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS departments_code_key ON public.departments (code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_ad_account_key ON public.profiles (ad_account) WHERE ad_account IS NOT NULL;

WITH source(code, department, is_department_head, first_middle, given_name, full_name, gender, birthday, position_name, title, ad_account, branch_join_date) AS (
  VALUES
  ('13601','Ban giám đốc',false,'Dương Ngọc','Hùng','Dương Ngọc Hùng','Nam','8/7/1981','Phó Giám Đốc','Phó Giám đốc (KHDN)','HUNGDN','3/7/2016'),
  ('13601','Ban giám đốc',true,'Nguyễn Thị Bích','Hạnh','Nguyễn Thị Bích Hạnh','Nữ','5/1/1980','Giám đốc','Giám đốc','NTB.HANH','1/12/2021'),
  ('13601','Ban giám đốc',false,'Lương Thị Như','Quỳnh','Lương Thị Như Quỳnh','Nữ','11/26/1982','Phó Giám Đốc','Phó Giám đốc (Bán lẻ)','QUYNHLN','1/10/2022'),
  ('13601','Ban giám đốc',false,'Dương Quang','Trung','Dương Quang Trung','Nam','7/17/1974','Phó Giám Đốc','Phó Giám đốc (KHDN)','DQTRUNG','5/9/2021'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Trần Thị','Ngát','Trần Thị Ngát','Nữ','11/9/1982','Phó Phòng','Phó phòng TCTH','NGAT.TT','1/1/2026'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Chu Thị Thiên','Hương','Chu Thị Thiên Hương','Nữ','3/11/1983','Phó Phòng','Phó phòng TCTH','HUONG.CT','1/1/2026'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Phạm Anh','Tư','Phạm Anh Tư','Nữ','5/26/1982','Nhân Viên','Nhân viên lao công, tạp vụ','TUPA','5/2/2007'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Lương Trung','Hiệu','Lương Trung Hiệu','Nam','1/30/1984','Nhân Viên','Nhân viên quản lý nợ CVĐ','LT.HIEU','7/2/2012'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Nguyễn Thị Minh','Phương','Nguyễn Thị Minh Phương','Nữ','11/6/1978','Nhân Viên','Hậu kiểm','PHUONG.NTM','10/1/2023'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Trần Thị','Lan','Trần Thị Lan','Nữ','7/20/1981','Nhân Viên','Hậu kiểm','LANTTHI','8/4/2015'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Phạm Quang','Ngọc','Phạm Quang Ngọc','Nam','10/16/1971','Nhân Viên','Nhân viên hành chính quản trị','NGOC.PQ','6/25/2024'),
  ('13602','Phòng Tổ chức Tổng hợp',true,'Phạm Quang','Hòa','Phạm Quang Hòa','Nam','6/30/1973','Phó Phòng','Phó phòng TCTH','HOA.PQ','1/1/2026'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Nguyễn Thị Phương','Thu','Nguyễn Thị Phương Thu','Nữ','9/23/1980','Nhân Viên','Hậu kiểm','THUNTP','7/1/2024'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Trần Huy','Đạo','Trần Huy Đạo','Nam','6/16/1985','Nhân Viên','Lái xe','DAO.TH','3/7/2016'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Phạm Đức','Quyền','Phạm Đức Quyền','Nam','8/11/1981','Nhân Viên','Lái xe','QUYENPD','3/7/2016'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Vũ Thị Hà','Vân','Vũ Thị Hà Vân','Nữ','11/18/1988','Nhân Viên','Nhân viên nhân sự tiền lương','VAN.VUTHIHA','4/1/2023'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Trần Đình','Phúc','Trần Đình Phúc','Nam','12/25/1992','Nhân Viên','Nhân viên thu nợ','PHUCTD','1/1/2025'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Nguyễn Chí','Công','Nguyễn Chí Công','Nam','10/29/1987','Nhân Viên','Lái xe','NCCONG','10/22/2019'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Mai Thị','Chang','Mai Thị Chang','Nữ','1/16/1991','Nhân Viên','Nhân viên nhân sự tiền lương','CHANGMT','6/1/2021'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Hoàng Ngọc','Mai','Hoàng Ngọc Mai','Nữ','5/10/1995','Nhân Viên','Lễ tân','MAI.HN','4/1/2021'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Mai Tuấn','Anh','Mai Tuấn Anh','Nam','4/16/1975','Nhân Viên','Lái xe','ANHMT1','1/12/2022'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Phạm Ngọc','Khánh','Phạm Ngọc Khánh','Nam','3/19/1999','Nhân Viên','Lái xe','KHANH.PN','12/23/2022'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Nguyễn Thị','Nhàn','Nguyễn Thị Nhàn','Nữ','4/12/1984','Nhân Viên','Đầu bếp','NHANNT16','2/23/2023'),
  ('13602','Phòng Tổ chức Tổng hợp',false,'Nguyễn Thị','Đào','Nguyễn Thị Đào','Nữ','9/21/1993','Nhân Viên','Nhân viên lao công, tạp vụ','DAONT4','4/1/2024'),
  ('13603','Phòng dịch vụ khách hàng',false,'Nguyễn Hưng','Chi','Nguyễn Hưng Chi','Nữ','8/15/1981','Nhân Viên','GDV độc lập','CHINH','8/1/2019'),
  ('13603','Phòng dịch vụ khách hàng',false,'Nguyễn Văn','Hùng','Nguyễn Văn Hùng','Nam','9/12/1979','Nhân Viên','Kỹ sư Điện toán','NGUYENVAN.HUNG','3/7/2016'),
  ('13603','Phòng dịch vụ khách hàng',false,'Nguyễn Thị Kim','Hương','Nguyễn Thị Kim Hương','Nữ','11/26/1976','Nhân Viên','Thủ kho','HUONG.NTK','4/1/2026'),
  ('13603','Phòng dịch vụ khách hàng',false,'Hà Thị Hồng','Diệp','Hà Thị Hồng Diệp','Nữ','4/23/1978','Phó Phòng','Phó phòng Dịch vụ KH (Kế toán)','DIEPHTH','12/1/2025'),
  ('13603','Phòng dịch vụ khách hàng',true,'Nguyễn Thị Thanh','Giang','Nguyễn Thị Thanh Giang','Nữ','2/13/1980','Phó Phòng','Phó phòng Dịch vụ KH (Kế toán)','NTT.GIANG','1/1/2021'),
  ('13603','Phòng dịch vụ khách hàng',false,'Vũ Thị Lệ','Mỹ','Vũ Thị Lệ Mỹ','Nữ','7/18/1974','Phó Phòng','Phó phòng Dịch vụ KH (Kế toán)','MYVTL','12/1/2025'),
  ('13603','Phòng dịch vụ khách hàng',false,'Hồ Thị Hải','Vân','Hồ Thị Hải Vân','Nữ','12/27/1973','Phó Phòng','Phó phòng Dịch vụ KH (Kế toán)','VANHH','10/1/2023'),
  ('13603','Phòng dịch vụ khách hàng',false,'Trần Thị','Sáng','Trần Thị Sáng','Nữ','2/2/1985','Nhân Viên','GDV độc lập','SANGTT','12/1/2014'),
  ('13603','Phòng dịch vụ khách hàng',false,'Nguyễn Thị Việt','Anh','Nguyễn Thị Việt Anh','Nữ','8/20/1985','Nhân Viên','GDV độc lập','NGUYENTHIVIET.ANH','3/18/2019'),
  ('13603','Phòng dịch vụ khách hàng',false,'Đỗ Thị','Huyền','Đỗ Thị Huyền','Nữ','8/3/1987','Nhân Viên','Nhân viên kế toán tài chính','DOTHI.HUYEN','7/1/2020'),
  ('13603','Phòng dịch vụ khách hàng',false,'Trần Thị','Huệ','Trần Thị Huệ','Nữ','8/21/1980','Nhân Viên','Thủ quỹ','TRANTHIHUE','4/1/2026'),
  ('13603','Phòng dịch vụ khách hàng',false,'Nguyễn Thu','Trang','Nguyễn Thu Trang','Nữ','11/12/1991','Nhân Viên','GDV độc lập','TRANGNT13','12/1/2014'),
  ('13603','Phòng dịch vụ khách hàng',false,'Đinh Thị Thu','Huyền','Đinh Thị Thu Huyền','Nữ','4/30/1990','Nhân Viên','GDV độc lập','HUYENDTT5','12/1/2014'),
  ('13603','Phòng dịch vụ khách hàng',false,'Đoàn Thị Mai','Hồng','Đoàn Thị Mai Hồng','Nữ','6/18/1994','Nhân Viên','Nhân viên kế toán tài chính','HONGDTM','3/27/2023'),
  ('13603','Phòng dịch vụ khách hàng',false,'Nguyễn Bích','Thủy','Nguyễn Bích Thủy','Nữ','3/3/1990','Phó Phòng','Phó phòng Dịch vụ KH (Kế toán)','THUYNB1','1/20/2022'),
  ('13603','Phòng dịch vụ khách hàng',false,'Nguyễn Thị Thu','Hằng','Nguyễn Thị Thu Hằng','Nữ','8/8/1992','Nhân Viên','GDV độc lập','HANGNTT23','7/1/2020'),
  ('13603','Phòng dịch vụ khách hàng',false,'Hoàng Mạnh','Hùng','Hoàng Mạnh Hùng','Nam','11/13/1988','Nhân Viên','Nhân viên vận hành IT','HUNGHM1','3/1/2026'),
  ('13603','Phòng dịch vụ khách hàng',false,'Lê Thị','Thu','Lê Thị Thu','Nữ','8/2/1996','Nhân Viên','GDV độc lập','THULT5','11/8/2018'),
  ('13603','Phòng dịch vụ khách hàng',false,'Nguyễn Thị','Duyên','Nguyễn Thị Duyên','Nữ','1/15/1996','Nhân Viên','GDV độc lập','DUYENNT5','1/1/2025'),
  ('13603','Phòng dịch vụ khách hàng',false,'Nguyễn Thị Cẩm','Ly','Nguyễn Thị Cẩm Ly','Nữ','8/14/1996','Nhân Viên','GDV độc lập','LY.NTC','2/5/2026'),
  ('13603','Phòng dịch vụ khách hàng',false,'Đỗ Thảo','Nguyên','Đỗ Thảo Nguyên','Nữ','11/20/1997','Nhân Viên','GDV độc lập','NGUYENDT2','4/10/2023'),
  ('13605','Phòng KHDN',false,'Ngô Thị Xuân','Linh','Ngô Thị Xuân Linh','Nữ','5/8/1983','Phó Phòng','Phó phòng KHDN','LINHNTX','7/1/2025'),
  ('13605','Phòng KHDN',false,'Khương Minh','Hưng','Khương Minh Hưng','Nam','4/17/1984','Phó Phòng','Phó phòng KHDN','HUNGKM','3/1/2024'),
  ('13605','Phòng KHDN',false,'Lê Thị Minh','Huyền','Lê Thị Minh Huyền','Nữ','9/15/1988','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','HUYENLTM','1/22/2018'),
  ('13605','Phòng KHDN',false,'Lê Thị','Phương','Lê Thị Phương','Nữ','8/17/1987','Nhân Viên','Quan hệ KH Doanh nghiệp Lớn','PHUONGLT280','2/9/2022'),
  ('13605','Phòng KHDN',true,'Nguyễn Thị Thu','Hương','Nguyễn Thị Thu Hương','Nữ','8/4/1981','Trưởng phòng','Trưởng phòng KHDN','HUONGNTT136','5/19/2025'),
  ('13605','Phòng KHDN',false,'Bùi Quang','Tiến','Bùi Quang Tiến','Nam','10/17/1993','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','TIENBQ','4/1/2022'),
  ('13605','Phòng KHDN',false,'Nguyễn Mai','Phượng','Nguyễn Mai Phượng','Nữ','10/27/1991','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','PHUONGNM9','5/10/2016'),
  ('13605','Phòng KHDN',false,'Nguyễn Văn','Hiển','Nguyễn Văn Hiển','Nam','10/16/1989','Phó Phòng','Phó phòng KHDN','HIENNV4','6/6/2025'),
  ('13605','Phòng KHDN',false,'Ngô Thị Hồng','Mến','Ngô Thị Hồng Mến','Nữ','12/28/1992','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','MENNTH','6/5/2023'),
  ('13605','Phòng KHDN',false,'Phạm Hồng','Thắng','Phạm Hồng Thắng','Nam','12/9/1990','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','PH.THANG','4/1/2022'),
  ('13605','Phòng KHDN',false,'Hoàng Ngọc','Hà','Hoàng Ngọc Hà','Nữ','8/23/1993','Nhân Viên','Cán bộ Tài trợ thương mại','HA.HN','1/10/2022'),
  ('13605','Phòng KHDN',false,'Đinh Thị','Tuyến','Đinh Thị Tuyến','Nữ','4/18/1994','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','DT.TUYEN','1/1/2025'),
  ('13605','Phòng KHDN',false,'Trần Thị Thu','Trang','Trần Thị Thu Trang','Nữ','3/13/1994','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','TRANGTTT20','11/15/2025'),
  ('13605','Phòng KHDN',false,'Hoàng Bích','Phương','Hoàng Bích Phương','Nữ','12/31/1995','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','PHUONGHB','6/3/2020'),
  ('13605','Phòng KHDN',false,'Lưu Đức','Long','Lưu Đức Long','Nam','9/2/1996','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','LONG.LD','4/1/2022'),
  ('13605','Phòng KHDN',false,'Đinh Quốc','Huy','Đinh Quốc Huy','Nam','5/19/1994','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','HUYDQ8','11/15/2025'),
  ('13605','Phòng KHDN',false,'Mai Phương','Anh','Mai Phương Anh','Nữ','12/20/1997','Nhân Viên','Cán bộ Tài trợ thương mại','ANHMP','9/12/2019'),
  ('13605','Phòng KHDN',false,'Phạm Thị Thảo','Huyền','Phạm Thị Thảo Huyền','Nữ','11/12/1998','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','HUYENPTT2','10/20/2025'),
  ('13605','Phòng KHDN',false,'Đào Thị','Thảo','Đào Thị Thảo','Nữ','9/23/1998','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','THAODT3','10/3/2022'),
  ('13605','Phòng KHDN',false,'Hà Quỳnh','Nga','Hà Quỳnh Nga','Nữ','8/18/2002','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','NGAHQ','4/1/2025'),
  ('13605','Phòng KHDN',false,'Trần Thị','Loan','Trần Thị Loan','Nữ','9/19/1994','Nhân Viên','Cán bộ Tài trợ thương mại','LOANTT2','4/14/2025'),
  ('13609','Phòng bán lẻ',false,'Bùi Đình','Phú','Bùi Đình Phú','Nam','8/17/1981','Phó Phòng','Phó phòng Bán lẻ','PHUBD','12/1/2025'),
  ('13609','Phòng bán lẻ',true,'Nguyễn Linh','Chi','Nguyễn Linh Chi','Nữ','11/13/1988','Trưởng phòng','Trưởng Phòng Bán lẻ','CHINL','1/1/2024'),
  ('13609','Phòng bán lẻ',false,'Tống Thị','Tâm','Tống Thị Tâm','Nữ','7/20/1981','Phó Phòng','Phó phòng Bán lẻ','TAM.TONGTHI','3/1/2026'),
  ('13609','Phòng bán lẻ',false,'Nguyễn Cao','Sơn','Nguyễn Cao Sơn','Nam','7/5/1980','Phó Phòng','Phó phòng Bán lẻ','NCSON','12/1/2025'),
  ('13609','Phòng bán lẻ',false,'Hồ Thị Hồng','Đăng','Hồ Thị Hồng Đăng','Nữ','9/5/1991','Nhân Viên','CB QHKH bán lẻ','DANGHTH','7/12/2021'),
  ('13609','Phòng bán lẻ',false,'Hoàng Minh','Trung','Hoàng Minh Trung','Nam','7/3/1992','Nhân Viên','NV hỗ trợ bán lẻ','TRUNG.HM','4/3/2025'),
  ('13609','Phòng bán lẻ',false,'Lê Thị Khánh','Ly','Lê Thị Khánh Ly','Nữ','2/13/1994','Nhân Viên','CB QHKH bán lẻ','LY.LTK','6/16/2020'),
  ('13609','Phòng bán lẻ',false,'Nguyễn Thị My','Ly','Nguyễn Thị My Ly','Nữ','7/11/1993','Nhân Viên','NV hỗ trợ bán lẻ','LYNTM5','5/15/2024'),
  ('13609','Phòng bán lẻ',false,'Trần Tuấn','Anh','Trần Tuấn Anh','Nam','10/13/1997','Nhân Viên','CB QHKH bán lẻ','ANHTT13','11/1/2021'),
  ('13609','Phòng bán lẻ',false,'Nguyễn Minh','Hiếu','Nguyễn Minh Hiếu','Nam','5/4/2000','Nhân Viên','CB QHKH bán lẻ','HIEUNM3','7/1/2024'),
  ('13609','Phòng bán lẻ',false,'Đặng Lưu Diệu','Linh','Đặng Lưu Diệu Linh','Nữ','8/30/1999','Nhân Viên','CB QHKH bán lẻ','LINHDLD','6/18/2024'),
  ('13609','Phòng bán lẻ',false,'Phạm Nguyên','Thành','Phạm Nguyên Thành','Nam','3/26/1998','Nhân Viên','CB QHKH bán lẻ','THANHPN4','11/15/2025'),
  ('13609','Phòng bán lẻ',false,'Nguyễn Quang','Minh','Nguyễn Quang Minh','Nam','7/22/2002','Nhân Viên','CB QHKH bán lẻ','MINHNQ6','11/15/2025'),
  ('13618','Phòng Hỗ trợ tín dụng',true,'Lê Chiến','Thắng','Lê Chiến Thắng','Nam','2/13/1973','Trưởng phòng','Trưởng phòng Hỗ trợ tín dụng','THANGLC','8/1/2023'),
  ('13618','Phòng Hỗ trợ tín dụng',false,'Đào Mạnh','Quyền','Đào Mạnh Quyền','Nam','8/4/1984','Nhân Viên','Hỗ trợ tín dụng 1','QUYENDM','8/6/2018'),
  ('13618','Phòng Hỗ trợ tín dụng',false,'Nguyễn Thị Minh','Hoàng','Nguyễn Thị Minh Hoàng','Nữ','12/11/1981','Phó Phòng','Phó phòng Hỗ trợ tín dụng','NTM.HOANG','6/6/2025'),
  ('13618','Phòng Hỗ trợ tín dụng',false,'Phan Xuân','Nguyên','Phan Xuân Nguyên','Nam','6/8/1996','Nhân Viên','Hỗ trợ tín dụng 1','NGUYENPX','1/1/2025'),
  ('13618','Phòng Hỗ trợ tín dụng',false,'Cao Đức','Mạnh','Cao Đức Mạnh','Nam','3/1/1993','Nhân Viên','Hỗ trợ tín dụng 1','MANHCD','10/15/2024'),
  ('13618','Phòng Hỗ trợ tín dụng',false,'Ma Quốc','Anh','Ma Quốc Anh','Nam','2/24/1993','Nhân Viên','Hỗ trợ tín dụng 1','ANHMQ','3/11/2020'),
  ('13630','PGD Minh Khai',false,'Nguyễn Thanh','Hương','Nguyễn Thanh Hương','Nữ','7/7/1983','Phó Phòng','Phó phòng PGD Hỗn hợp','NGUYEN.THANHHUONG','4/1/2026'),
  ('13630','PGD Minh Khai',false,'Nguyễn Huyền','Trang','Nguyễn Huyền Trang','Nữ','1/22/1986','Phó Phòng','Phó phòng PGD Hỗn hợp','NGUYENHUYENTRANG','1/20/2022'),
  ('13630','PGD Minh Khai',false,'Hoàng Minh','Hương','Hoàng Minh Hương','Nữ','3/25/1986','Nhân Viên','GDV độc lập','HUONGHM','12/1/2014'),
  ('13630','PGD Minh Khai',true,'Phạm Nguyệt','Mai','Phạm Nguyệt Mai','Nữ','9/13/1983','Trưởng phòng','Trưởng PGD Hỗn hợp','MAIPN','6/1/2020'),
  ('13630','PGD Minh Khai',false,'Vương Ngọc','Đức','Vương Ngọc Đức','Nam','5/10/1991','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','DUCVN','12/5/2019'),
  ('13630','PGD Minh Khai',false,'Trần Thị Bích','Ngọc','Trần Thị Bích Ngọc','Nữ','5/6/1994','Nhân Viên','GDV độc lập','NGOCTTB1','6/1/2021'),
  ('13630','PGD Minh Khai',false,'Ninh Tiến','Dũng','Ninh Tiến Dũng','Nam','7/29/1994','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','DUNGNT54','4/1/2026'),
  ('13630','PGD Minh Khai',false,'Nguyễn Thị Thu','Trang','Nguyễn Thị Thu Trang','Nữ','9/22/1987','Nhân Viên','CB QHKH bán lẻ','TRANGNTT61','1/1/2025'),
  ('13630','PGD Minh Khai',false,'Nguyễn Tiến','Đạt','Nguyễn Tiến Đạt','Nam','10/29/1995','Nhân Viên','CB QHKH bán lẻ','DATNT17','7/1/2024'),
  ('13632','PGD Nam Hà Nội',false,'Bùi Thị Thu','Hà','Bùi Thị Thu Hà','Nữ','5/7/1971','Phó Phòng','Phó phòng PGD Hỗn hợp','BUITHITHU.HA','5/29/2023'),
  ('13632','PGD Nam Hà Nội',false,'Đỗ Thị Thu','Hiền','Đỗ Thị Thu Hiền','Nữ','5/29/1979','Nhân Viên','GDV độc lập','HIEN.DOTHITHU','6/1/2024'),
  ('13632','PGD Nam Hà Nội',false,'Nguyễn Thị Huyền','Trang','Nguyễn Thị Huyền Trang','Nữ','12/14/1986','Nhân Viên','GDV độc lập','TRANG.NTH','3/26/2020'),
  ('13632','PGD Nam Hà Nội',false,'Trần Diệu','Linh','Trần Diệu Linh','Nữ','1/31/1987','Phó Phòng','Phó phòng PGD Hỗn hợp','LINHTD','1/15/2018'),
  ('13632','PGD Nam Hà Nội',false,'Phạm Thị Biên','Thùy','Phạm Thị Biên Thùy','Nữ','10/6/1983','Nhân Viên','GDV độc lập','THUY.PTB','5/18/2020'),
  ('13632','PGD Nam Hà Nội',false,'Trần Đình','Hoàng','Trần Đình Hoàng','Nam','12/15/1988','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','HOANGTD','7/21/2025'),
  ('13632','PGD Nam Hà Nội',false,'Lê Thị Tuyết','Yến','Lê Thị Tuyết Yến','Nữ','6/1/1990','Nhân Viên','GDV độc lập','YEN.LTT','12/1/2014'),
  ('13632','PGD Nam Hà Nội',true,'Nguyễn Đức','Toàn','Nguyễn Đức Toàn','Nam','7/17/1990','Phó Phòng','Phó phòng PGD Hỗn hợp','TOANND','12/1/2025'),
  ('13632','PGD Nam Hà Nội',false,'Nguyễn Hữu','Đức','Nguyễn Hữu Đức','Nam','2/5/1999','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','DUCNH1','5/10/2024'),
  ('13632','PGD Nam Hà Nội',false,'Nguyễn Thu','Trang','Nguyễn Thu Trang','Nữ','11/16/1998','Nhân Viên','CB QHKH bán lẻ','TRANGNT64','7/1/2024'),
  ('13633','PGD Hào Nam',true,'Bùi Văn','Thắng','Bùi Văn Thắng','Nam','10/18/1982','Trưởng phòng','Trưởng PGD Hỗn hợp','THANGBV','6/1/2020'),
  ('13633','PGD Hào Nam',false,'Nguyễn Thanh','Xuân','Nguyễn Thanh Xuân','Nữ','1/16/1987','Nhân Viên','GDV độc lập','NGUYEN.THANHXUAN','6/5/2015'),
  ('13633','PGD Hào Nam',false,'Vũ Phương','Anh','Vũ Phương Anh','Nữ','3/3/1988','Phó Phòng','Phó phòng PGD Hỗn hợp','VUPHUONGANH','12/1/2025'),
  ('13633','PGD Hào Nam',false,'Đỗ Thị','Hải','Đỗ Thị Hải','Nữ','10/24/1989','Nhân Viên','GDV độc lập','HAIDT5','5/8/2017'),
  ('13633','PGD Hào Nam',false,'Nguyễn Thị Ngọc','Khánh','Nguyễn Thị Ngọc Khánh','Nữ','2/6/1990','Nhân Viên','GDV độc lập','KHANH.NTN','1/25/2016'),
  ('13633','PGD Hào Nam',false,'Hồ Hữu','Quang','Hồ Hữu Quang','Nam','5/8/1992','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','HH.QUANG','5/1/2022'),
  ('13633','PGD Hào Nam',false,'Đinh Ngọc','Linh','Đinh Ngọc Linh','Nam','4/1/1992','Phó Phòng','Phó phòng PGD Hỗn hợp','DNLINH','5/15/2025'),
  ('13633','PGD Hào Nam',false,'Nguyễn Thái','An','Nguyễn Thái An','Nam','10/15/1990','Nhân Viên','CB QHKH bán lẻ','ANNT4','6/21/2021'),
  ('13633','PGD Hào Nam',false,'Lê Hoàng','Đức','Lê Hoàng Đức','Nam','9/25/2000','Nhân Viên','CB QHKH bán lẻ','LH.DUC','6/18/2024'),
  ('13636','PGD Khương Mai',false,'Đỗ Tuấn','Dũng','Đỗ Tuấn Dũng','Nam','8/25/1982','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','DUNG.DOTUAN','8/1/2022'),
  ('13636','PGD Khương Mai',true,'Ngô Thị Thu','Huyền','Ngô Thị Thu Huyền','Nữ','8/29/1981','Phó Phòng','Phó phòng PGD Hỗn hợp','HUYEN.NGOTHITHU','6/6/2025'),
  ('13636','PGD Khương Mai',false,'Hoàng Mạnh','Cường','Hoàng Mạnh Cường','Nam','8/24/1982','Phó Phòng','Phó phòng PGD Hỗn hợp','CUONG.HM','10/1/2023'),
  ('13636','PGD Khương Mai',false,'Vũ Thị','Thu','Vũ Thị Thu','Nữ','5/12/1990','Phó Phòng','Phó phòng PGD Hỗn hợp','THUVT2','6/1/2021'),
  ('13636','PGD Khương Mai',false,'Nguyễn Thủy','Ngân','Nguyễn Thủy Ngân','Nữ','12/10/1984','Nhân Viên','GDV độc lập','NGANNT7','2/10/2017'),
  ('13636','PGD Khương Mai',false,'Vũ Thị Lan','Phương','Vũ Thị Lan Phương','Nữ','9/13/1995','Nhân Viên','GDV độc lập','PHUONG.VTL','5/17/2022'),
  ('13636','PGD Khương Mai',false,'Nguyễn Hoàng Phương','Anh','Nguyễn Hoàng Phương Anh','Nữ','6/17/1994','Nhân Viên','GDV độc lập','ANHNHP','4/8/2019'),
  ('13636','PGD Khương Mai',false,'Nguyễn Thu','Trang','Nguyễn Thu Trang','Nữ','8/17/1996','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','TRANGNT50','4/21/2025'),
  ('13636','PGD Khương Mai',false,'Nguyễn Mỹ','Anh','Nguyễn Mỹ Anh','Nữ','12/17/1999','Nhân Viên','CB QHKH bán lẻ','ANHNM9','9/20/2022'),
  ('13638','PGD Linh Đàm',false,'Trương Thị','Thanh','Trương Thị Thanh','Nữ','4/24/1986','Phó Phòng','Phó phòng PGD Hỗn hợp','THANH.TRUONGTHI','9/15/2020'),
  ('13638','PGD Linh Đàm',false,'Nguyễn Thị Thu','Thủy','Nguyễn Thị Thu Thủy','Nữ','8/20/1983','Nhân Viên','GDV độc lập','NTTHU.THUY','12/1/2014'),
  ('13638','PGD Linh Đàm',false,'Ngô Thị Ngọc','Thu','Ngô Thị Ngọc Thu','Nữ','10/15/1988','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','NGOCTHU.NT','11/15/2025'),
  ('13638','PGD Linh Đàm',true,'Chu Minh','Đức','Chu Minh Đức','Nam','9/23/1990','Phó Phòng','Phó phòng PGD Hỗn hợp','DUCCM','4/1/2023'),
  ('13638','PGD Linh Đàm',false,'Lương Thị','Hòa','Lương Thị Hòa','Nữ','2/4/1988','Nhân Viên','GDV độc lập','HOALT6','11/16/2018'),
  ('13638','PGD Linh Đàm',false,'Phùng Thị Mai','Trang','Phùng Thị Mai Trang','Nữ','10/18/1992','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','TRANGPTM1','8/1/2022'),
  ('13638','PGD Linh Đàm',false,'Hà Như','Linh','Hà Như Linh','Nam','8/7/1992','Phó Phòng','Phó phòng PGD Hỗn hợp','HN.LINH','9/1/2023'),
  ('13638','PGD Linh Đàm',false,'Nguyễn Cửu Trang','Anh','Nguyễn Cửu Trang Anh','Nữ','3/28/1991','Nhân Viên','GDV độc lập','ANHNCT','10/10/2016'),
  ('13638','PGD Linh Đàm',false,'Chu Việt','Hoàng','Chu Việt Hoàng','Nam','8/12/1992','Nhân Viên','CB QHKH bán lẻ','CV.HOANG','4/1/2022'),
  ('13638','PGD Linh Đàm',false,'Đỗ Đức','Anh','Đỗ Đức Anh','Nam','10/17/2000','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','ANHDD2','9/20/2022'),
  ('13638','PGD Linh Đàm',false,'Nguyễn Bảo','Ngọc','Nguyễn Bảo Ngọc','Nữ','6/18/2000','Nhân Viên','CB QHKH bán lẻ','NGOCNB11','6/18/2024'),
  ('13641','PGD Gamuda',false,'Nguyễn Bích','Ngọc','Nguyễn Bích Ngọc','Nữ','8/26/1987','Phó Phòng','Phó phòng PGD Hỗn hợp','NGUYENBICHNGOC','4/1/2019'),
  ('13641','PGD Gamuda',true,'Đặng Ngọc','Cường','Đặng Ngọc Cường','Nam','1/8/1989','Phó Phòng','Phó phòng PGD Hỗn hợp','CUONGDN','5/29/2023'),
  ('13641','PGD Gamuda',false,'Đặng Thị Thu','Lành','Đặng Thị Thu Lành','Nữ','7/6/1989','Nhân Viên','CB QHKH bán lẻ','LANHDTT','10/15/2024'),
  ('13641','PGD Gamuda',false,'Nguyễn Thế','Anh','Nguyễn Thế Anh','Nam','8/4/1990','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','ANHNT18','10/1/2023'),
  ('13641','PGD Gamuda',false,'Phạm Thị','Vân','Phạm Thị Vân','Nữ','10/4/1987','Nhân Viên','GDV độc lập','VANPT5','9/19/2016'),
  ('13641','PGD Gamuda',false,'Nguyễn Tùng','Lâm','Nguyễn Tùng Lâm','Nam','1/29/1994','Nhân Viên','Quan hệ KHDN Vừa & Nhỏ','LAMNT12','4/1/2026'),
  ('13641','PGD Gamuda',false,'Trần Thị Mai','Anh','Trần Thị Mai Anh','Nữ','4/22/1997','Nhân Viên','GDV độc lập','TTM.ANH','9/12/2019'),
  ('13641','PGD Gamuda',false,'Bùi Hồng','Ngọc','Bùi Hồng Ngọc','Nữ','11/1/1993','Nhân Viên','GDV độc lập','BH.NGOC','6/29/2020'),
  ('13641','PGD Gamuda',false,'Bùi Vũ Thanh','Hằng','Bùi Vũ Thanh Hằng','Nữ','4/22/1997','Nhân Viên','GDV độc lập','HANGBVT','7/1/2020'),
  ('13641','PGD Gamuda',false,'Lê Thị','Hậu','Lê Thị Hậu','Nữ','11/23/1996','Nhân Viên','CB QHKH bán lẻ','LTHAU','5/1/2021')
),
departments_to_upsert AS (
  INSERT INTO public.departments (code, name)
  SELECT DISTINCT code, department
  FROM source
  ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code
  RETURNING id, code, name
),
normalized AS (
  SELECT
    s.*,
    lower(s.ad_account) || '@bank.local' AS email,
    CASE
      WHEN lower(s.title) LIKE '%lễ tân%' THEN 'secretary'::user_role
      WHEN lower(s.title) LIKE '%lái xe%' THEN 'driver'::user_role
      WHEN lower(s.title) LIKE '%nhân viên nhân sự tiền lương%' THEN 'hr_officer'::user_role
      WHEN lower(s.position_name) LIKE '%giám đốc%' THEN 'director'::user_role
      WHEN lower(s.position_name) LIKE '%trưởng phòng%' OR lower(s.position_name) LIKE '%phó phòng%' THEN 'manager'::user_role
      ELSE 'staff'::user_role
    END AS app_role
  FROM source s
),
updated_users AS (
  UPDATE auth.users u
  SET
    encrypted_password = crypt('123', gen_salt('bf')),
    raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data = jsonb_build_object('full_name', n.full_name, 'ad_account', n.ad_account, 'role', n.app_role),
    email_confirmed_at = COALESCE(u.email_confirmed_at, now()),
    updated_at = now()
  FROM normalized n
  WHERE u.email = n.email
  RETURNING u.id, u.email
),
inserted_users AS (
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    n.email,
    crypt('123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', n.full_name, 'ad_account', n.ad_account, 'role', n.app_role),
    'authenticated',
    'authenticated',
    now(),
    now()
  FROM normalized n
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.email = n.email
  )
  RETURNING id, email
),
all_users AS (
  SELECT id, email FROM updated_users
  UNION ALL
  SELECT id, email FROM inserted_users
),
upsert_identities AS (
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    u.id,
    u.email,
    jsonb_build_object('sub', u.id::text, 'email', u.email),
    'email',
    now(),
    now(),
    now()
  FROM all_users u
  ON CONFLICT (provider, provider_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    identity_data = EXCLUDED.identity_data,
    updated_at = now()
  RETURNING user_id
)
INSERT INTO public.profiles (
  id,
  full_name,
  role,
  department_id,
  birthday,
  gender,
  ad_account,
  branch_join_date,
  is_department_head,
  title,
  updated_at
)
SELECT
  u.id,
  n.full_name,
  n.app_role,
  d.id,
  to_date(n.birthday, 'MM/DD/YYYY'),
  n.gender,
  n.ad_account,
  to_date(n.branch_join_date, 'MM/DD/YYYY'),
  n.is_department_head,
  n.title,
  now()
FROM normalized n
JOIN all_users u ON u.email = n.email
JOIN departments_to_upsert d ON d.code = n.code
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department_id = EXCLUDED.department_id,
  birthday = EXCLUDED.birthday,
  gender = EXCLUDED.gender,
  ad_account = EXCLUDED.ad_account,
  branch_join_date = EXCLUDED.branch_join_date,
  is_department_head = EXCLUDED.is_department_head,
  title = EXCLUDED.title,
  updated_at = now();



NOTIFY pgrst, 'reload schema';
