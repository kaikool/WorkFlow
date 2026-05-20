-- =========================================================================
-- SIÊU KỊCH BẢN SQL SINH TOÀN BỘ CƠ SỞ DỮ LIỆU ĐẦY ĐỦ VÀ SỐNG ĐỘNG
-- Hướng dẫn: Copy toàn bộ nội dung file này và chạy trong Supabase SQL Editor
-- Mật khẩu đăng nhập của tất cả các tài khoản mới: Workflow123!
-- Kịch bản này sinh:
--   1. 50 nhân sự (1 Giám đốc, 3 Phó Giám đốc, 11 Trưởng phòng, 36 Nhân viên)
--   2. 60 Nhiệm vụ/KPIs/Báo cáo được phân bổ khoa học, tương tác thực tế
--   3. 60 Thảo luận/Bình luận trao đổi qua lại giữa lãnh đạo và nhân viên
--   4. 60 Lịch công tác/Lịch họp (có Ban Giám đốc xin xe 4/7/16 chỗ, họp phòng)
-- =========================================================================

DO $$
DECLARE
    -- Mảng ID các phòng ban chuyên môn thực tế
    dept_ids UUID[] := ARRAY[
        '149fd17f-30fc-4ce0-a814-67249cda5827'::UUID, -- Phòng KHDN
        '210405a7-bef8-4b7e-b431-0e167fd5c085'::UUID, -- Phòng Bán lẻ
        'cff1dc2f-73ca-4fd6-81db-bd2cae222930'::UUID, -- Phòng DVKH
        'bc18715f-b201-45e9-897f-18f02ff21ca5'::UUID, -- PGD Hào Nam
        'b5e64583-ad16-4aff-b78c-a42821d58199'::UUID, -- PGD Minh Khai
        '14d9b04d-01e0-4064-93b3-064c89233141'::UUID, -- PGD Gamuda
        '3c4760f0-802f-46b9-a805-1537548937d4'::UUID, -- PGD Nam Hà Nội
        '9f3a8def-dae8-471f-9304-e2c597ebe68e'::UUID, -- PGD Linh Đàm
        'e95a9a1d-0221-4efc-b74e-d9400fb415c6'::UUID, -- PGD Khương Mai
        '47cde637-ff4a-4382-a65d-bfb3cd751d46'::UUID, -- Phòng HTTD
        '8269c06c-2e77-4e39-90d7-d7d15b81f6af'::UUID  -- Tổ chức Tổng hợp
    ];
    
    director_dept_id UUID := '2aa2782d-0e05-4451-9c58-86403c1495c3'::UUID; -- Ban giám đốc
    
    -- Danh sách Họ và Tên mẫu để sinh ngẫu nhiên cực đẹp
    first_names TEXT[] := ARRAY['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Đặng', 'Bùi'];
    middle_names TEXT[] := ARRAY['Văn', 'Thị', 'Đăng', 'Minh', 'Hải', 'Hữu', 'Quốc', 'Ngọc', 'Thanh', 'Xuân'];
    last_names TEXT[] := ARRAY['An', 'Bình', 'Chi', 'Dũng', 'Anh', 'Giang', 'Hương', 'Khánh', 'Linh', 'Minh', 'Nam', 'Oanh', 'Phương', 'Quân', 'Sơn', 'Trang', 'Vinh', 'Yến', 'Tâm', 'Đức'];
    
    -- Mảng lưu trữ ID để phân phối chéo
    director_ids UUID[] := ARRAY[]::UUID[];
    manager_ids UUID[] := ARRAY[]::UUID[];
    staff_ids UUID[] := ARRAY[]::UUID[];
    all_mock_user_ids UUID[] := ARRAY[]::UUID[];
    task_ids UUID[] := ARRAY[]::UUID[];

    new_user_id UUID;
    new_task_id UUID;
    full_name TEXT;
    email_val TEXT;
    password_hash TEXT;
    dept_id UUID;
    i INT;
    rand_idx INT;
    
    -- Dữ liệu mẫu công việc
    task_titles TEXT[] := ARRAY[
        'Soạn thảo tờ trình tín dụng', 'Đánh giá rủi ro danh mục cho vay', 'Kiểm tra báo cáo tài chính tháng',
        'Nâng cấp hệ thống Core Banking', 'Xử lý khiếu nại giao dịch thẻ', 'Đào tạo kỹ năng bán hàng quầy',
        'Lập phương án xử lý nợ quá hạn', 'Kiểm toán nội bộ quy trình giải ngân', 'Triển khai tính năng quét mã QR',
        'Rà soát hồ sơ tuân thủ eKYC', 'Hội thảo thúc đẩy doanh số thẻ hè', 'Khảo sát nhu cầu khách hàng VIP',
        'Tối ưu hóa tốc độ Mobile Banking', 'Triển khai chiến dịch gửi tiết kiệm', 'Họp chuẩn bị đại hội cổ đông'
    ];
    task_descs TEXT[] := ARRAY[
        'Yêu cầu thẩm định chi tiết khả năng trả nợ, hồ sơ tài sản đảm bảo và phương án kinh doanh.',
        'Phân tích chi tiết biến động thị trường và đưa ra các kịch bản ứng phó rủi ro phù hợp.',
        'Đảm bảo kiểm tra chéo số liệu giữa các phòng ban chuyên môn trước khi ký trình.',
        'Thực hiện nâng cấp vào ban đêm để tránh ảnh hưởng đến các giao dịch trực tuyến của khách hàng.',
        'Thời gian xử lý tối đa không quá 48 giờ làm việc kể từ lúc nhận yêu cầu.',
        'Tập trung đào tạo thái độ phục vụ khách hàng chu đáo và kỹ năng xử lý tình huống khó.',
        'Lên lịch làm việc trực tiếp, đề xuất phương án cơ cấu nợ hoặc tất toán tài sản đảm bảo.',
        'Đánh giá tính độc lập, khách quan và tuân thủ các quy định hiện hành của pháp luật.',
        'Hợp tác chặt chẽ với đơn vị trung gian thanh toán để đảm bảo giao dịch thông suốt.',
        'Rà soát ngẫu nhiên 100 hồ sơ mở tài khoản trực tuyến để đánh giá chất lượng xác thực.'
    ];

    -- Dữ liệu mẫu thảo luận
    comments TEXT[] := ARRAY[
        'Tôi đã hoàn thành phần rà soát ban đầu, gửi báo cáo chi tiết qua email rồi nhé.',
        'Đề nghị kiểm tra lại số liệu doanh số phòng Bán lẻ, hình như có sai lệch nhẹ.',
        'Tiến độ đang được kiểm soát tốt, dự kiến hoàn thành trước thời hạn 1 ngày.',
        'Đang gặp khó khăn ở khâu kết nối API với đối tác, nhờ phòng Công nghệ hỗ trợ.',
        'Đã tiếp thu ý kiến chỉ đạo của Trưởng phòng, tôi sẽ cập nhật lại tờ trình ngay.',
        'Báo cáo rất chi tiết và chất lượng, đề nghị phát huy tinh thần làm việc này.',
        'Lưu ý hạn chót là cuối tuần này, đề nghị đẩy nhanh tiến độ xử lý.',
        'Đã gửi lại bản chỉnh sửa theo góp ý của Ban Giám đốc.',
        'Số liệu đã khớp hoàn toàn, sẵn sàng trình ký Ban Giám đốc.'
    ];

    -- Dữ liệu mẫu lịch trình
    schedule_titles TEXT[] := ARRAY[
        'Họp giao ban tuần Ban Giám đốc và các phòng',
        'Ban Giám đốc đi công tác chỉ đạo chi nhánh tỉnh',
        'Tháp tùng Tổng giám đốc làm việc với Bộ Tài chính',
        'Hội nghị tổng kết hoạt động kinh doanh Quý 2',
        'Họp khẩn Ban Giám đốc duyệt phương án tín dụng',
        'Đoàn Giám đốc đi khảo sát dự án bất động sản tài trợ',
        'Phỏng vấn nhân sự cấp cao cho Sở giao dịch',
        'Lễ ký kết thỏa thuận hợp tác chiến lược',
        'Họp hội đồng quản trị định kỳ tháng',
        'Ban Giám đốc tháp tùng đoàn thanh tra Nhà nước'
    ];

    -- Đặt chỗ
    room_id_val UUID;
    vehicle_id_val UUID;
BEGIN
    -- Tạo mã băm mật khẩu cho 'Workflow123!' bằng pgcrypto
    password_hash := crypt('Workflow123!', gen_salt('bf'));

    RAISE NOTICE '1. BẮT ĐẦU DỌN DẸP TOÀN BỘ DỮ LIỆU THỬ NGHIỆM CŨ...';
    
    DELETE FROM public.task_comments WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@workflow.vn');
    DELETE FROM public.tasks 
    WHERE assignee_id IN (SELECT id FROM auth.users WHERE email LIKE '%@workflow.vn')
       OR created_by IN (SELECT id FROM auth.users WHERE email LIKE '%@workflow.vn');
    DELETE FROM public.schedules WHERE created_by IN (SELECT id FROM auth.users WHERE email LIKE '%@workflow.vn');
    DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@workflow.vn');
    DELETE FROM auth.users u WHERE u.email LIKE '%@workflow.vn';

    RAISE NOTICE '2. BẮT ĐẦU TẠO 50 NHÂN SỰ VỚI VAI TRÒ CHÍNH XÁC...';

    -- 2.1 Giám đốc
    new_user_id := gen_random_uuid();
    full_name := 'Nguyễn Hải Đăng (Giám đốc)';
    email_val := 'giamdoc.danng@workflow.vn';
    
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
    VALUES (
        new_user_id, email_val, password_hash, NOW(), 
        '{"provider":"email","providers":["email"]}'::jsonb, 
        jsonb_build_object('full_name', full_name), 
        'authenticated', 'authenticated'
    );
    
    INSERT INTO public.profiles (id, full_name, role, department_id)
    VALUES (new_user_id, full_name, 'director'::user_role, director_dept_id)
    ON CONFLICT (id) DO UPDATE 
    SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id;
    
    director_ids := array_append(director_ids, new_user_id);
    all_mock_user_ids := array_append(all_mock_user_ids, new_user_id);

    -- 2.2 Ba Phó Giám đốc
    FOR i IN 1..3 LOOP
        new_user_id := gen_random_uuid();
        full_name := first_names[(i * 3) % 10 + 1] || ' ' || middle_names[(i * 7) % 10 + 1] || ' ' || last_names[(i * 11) % 20 + 1] || ' (Phó Giám đốc)';
        email_val := 'phogiamdoc' || i || '@workflow.vn';
        
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
        VALUES (
            new_user_id, email_val, password_hash, NOW(), 
            '{"provider":"email","providers":["email"]}'::jsonb, 
            jsonb_build_object('full_name', full_name), 
            'authenticated', 'authenticated'
        );
        
        INSERT INTO public.profiles (id, full_name, role, department_id)
        VALUES (new_user_id, full_name, 'director'::user_role, director_dept_id)
        ON CONFLICT (id) DO UPDATE 
        SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id;
        
        director_ids := array_append(director_ids, new_user_id);
        all_mock_user_ids := array_append(all_mock_user_ids, new_user_id);
    END LOOP;

    -- 2.3 11 Trưởng phòng
    FOR i IN 1..11 LOOP
        new_user_id := gen_random_uuid();
        dept_id := dept_ids[i];
        full_name := first_names[(i * 2) % 10 + 1] || ' ' || middle_names[(i * 5) % 10 + 1] || ' ' || last_names[(i * 9) % 20 + 1] || ' (Trưởng phòng)';
        email_val := 'truongphong' || i || '@workflow.vn';
        
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
        VALUES (
            new_user_id, email_val, password_hash, NOW(), 
            '{"provider":"email","providers":["email"]}'::jsonb, 
            jsonb_build_object('full_name', full_name), 
            'authenticated', 'authenticated'
        );
        
        INSERT INTO public.profiles (id, full_name, role, department_id)
        VALUES (new_user_id, full_name, 'manager'::user_role, dept_id)
        ON CONFLICT (id) DO UPDATE 
        SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id;
        
        manager_ids := array_append(manager_ids, new_user_id);
        all_mock_user_ids := array_append(all_mock_user_ids, new_user_id);
    END LOOP;

    -- 2.4 36 Nhân viên
    FOR i IN 1..36 LOOP
        new_user_id := gen_random_uuid();
        dept_id := dept_ids[(i % 11) + 1];
        full_name := first_names[(i * 4) % 10 + 1] || ' ' || middle_names[(i * 3) % 10 + 1] || ' ' || last_names[(i * 7) % 20 + 1];
        email_val := 'nhanvien' || i || '@workflow.vn';
        
        INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
        VALUES (
            new_user_id, email_val, password_hash, NOW(), 
            '{"provider":"email","providers":["email"]}'::jsonb, 
            jsonb_build_object('full_name', full_name), 
            'authenticated', 'authenticated'
        );
        
        INSERT INTO public.profiles (id, full_name, role, department_id)
        VALUES (new_user_id, full_name, 'staff'::user_role, dept_id)
        ON CONFLICT (id) DO UPDATE 
        SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, department_id = EXCLUDED.department_id;
        
        staff_ids := array_append(staff_ids, new_user_id);
        all_mock_user_ids := array_append(all_mock_user_ids, new_user_id);
    END LOOP;

    RAISE NOTICE '3. BẮT ĐẦU SINH HÀNG LOẠT 60 CÔNG VIỆC/KPIS/BÁO CÁO...';
    FOR i IN 1..60 LOOP
        -- Chọn vai trò liên kết
        new_task_id := gen_random_uuid();
        
        -- Phân phối xoay vòng loại công việc
        DECLARE
            t_type TEXT := CASE WHEN i % 3 = 0 THEN 'kpi' WHEN i % 3 = 1 THEN 'report' ELSE 'task' END;
            t_status task_status := CASE WHEN i % 4 = 0 THEN 'todo'::task_status WHEN i % 4 = 1 THEN 'doing'::task_status WHEN i % 4 = 2 THEN 'done'::task_status ELSE 'closed'::task_status END;
            t_priority task_priority := CASE WHEN i % 3 = 0 THEN 'low'::task_priority WHEN i % 3 = 1 THEN 'medium'::task_priority ELSE 'high'::task_priority END;
            t_title TEXT := task_titles[(i % 15) + 1] || ' #' || i;
            t_desc TEXT := task_descs[(i % 10) + 1] || ' - Khởi tạo phục vụ kiểm thử hiệu năng #' || i;
            t_progress INT := CASE WHEN t_status = 'done' THEN 100 WHEN t_status = 'todo' THEN 0 ELSE (i % 9 + 1) * 10 END;
            t_assignee UUID := staff_ids[(i % 36) + 1];
            t_creator UUID := manager_ids[(i % 11) + 1];
            t_dept UUID := dept_ids[(i % 11) + 1];
            
            -- KPI
            target_val BIGINT := CASE WHEN t_type = 'kpi' THEN (i % 5 + 1) * 200 ELSE NULL END;
            curr_val BIGINT := CASE WHEN t_type = 'kpi' THEN (target_val * t_progress / 100) ELSE 0 END;
            t_unit TEXT := CASE WHEN t_type = 'kpi' THEN (CASE WHEN i % 2 = 0 THEN 'Khách hàng' ELSE 'VNĐ' END) ELSE NULL END;
        BEGIN
            INSERT INTO public.tasks (id, title, description, status, priority, task_type, progress, assignee_id, created_by, due_date, target_value, current_value, unit, department_id, is_archived)
            VALUES (
                new_task_id, t_title, t_desc, t_status, t_priority, t_type, t_progress, t_assignee, t_creator,
                (NOW() + (i % 15 - 5) * INTERVAL '1 day'), target_val, curr_val, t_unit, t_dept, false
            );
            task_ids := array_append(task_ids, new_task_id);
        END;
    END LOOP;

    RAISE NOTICE '4. BẮT ĐẦU SINH HÀNG LOẠT 60 BÌNH LUẬN TRAO ĐỔI...';
    FOR i IN 1..60 LOOP
        DECLARE
            c_task UUID := task_ids[(i % 60) + 1];
            c_user UUID := all_mock_user_ids[(i % 50) + 1]; -- Cả nhân viên và sếp đều có thể comment
            c_content TEXT := comments[(i % 9) + 1] || ' (Ghi nhận đợt kiểm thử #' || i || ')';
        BEGIN
            INSERT INTO public.task_comments (task_id, user_id, content, created_at)
            VALUES (c_task, c_user, c_content, NOW() - (i % 24) * INTERVAL '1 hour');
        END;
    END LOOP;

    -- Lấy xe và phòng đầu tiên có trong hệ thống để đặt lịch họp mẫu
    SELECT id INTO room_id_val FROM public.rooms LIMIT 1;
    SELECT id INTO vehicle_id_val FROM public.vehicles LIMIT 1;

    RAISE NOTICE '5. BẮT ĐẦU SINH HÀNG LOẠT 60 LỊCH TRÌNH BAN GIÁM ĐỐC XIN XE VÀ HỌP PHÒNG...';
    FOR i IN 1..60 LOOP
        DECLARE
            s_title TEXT;
            s_desc TEXT := 'Cuộc họp thảo luận chỉ đạo từ cấp điều hành cao nhất. Lần làm việc thứ #' || i;
            s_start TIMESTAMPTZ := NOW() + (i * 12) * INTERVAL '1 hour';
            s_end TIMESTAMPTZ := s_start + INTERVAL '2 hours';
            s_creator UUID;
            s_dept UUID;
            s_use_vehicle BOOLEAN := false;
            s_vehicle UUID := NULL;
            s_vehicle_type TEXT := NULL;
            s_use_room BOOLEAN := false;
            s_room UUID := NULL;
        BEGIN
            -- 30 Lịch đầu tiên là của BAN GIÁM ĐỐC (có xin xe đi công tác)
            IF i <= 30 THEN
                s_title := schedule_titles[(i % 10) + 1] || ' (BGĐ Đi Công Tác #' || i || ')';
                s_creator := director_ids[(i % 4) + 1]; -- Khởi tạo bởi Giám đốc hoặc Phó Giám đốc
                s_dept := director_dept_id; -- Phòng ban: Ban giám đốc
                s_use_vehicle := true;
                s_vehicle := vehicle_id_val;
                s_vehicle_type := CASE WHEN i % 3 = 0 THEN '4 chỗ' WHEN i % 3 = 1 THEN '7 chỗ' ELSE '16 chỗ' END;
            ELSE
                -- 30 Lịch sau là của các PHÒNG BAN (có đặt phòng họp)
                s_title := 'Họp chuyên đề nghiệp vụ phòng ban #' || i;
                s_creator := manager_ids[(i % 11) + 1]; -- Khởi tạo bởi các Trưởng phòng
                s_dept := dept_ids[(i % 11) + 1];
                s_use_room := true;
                s_room := room_id_val;
            END IF;

            INSERT INTO public.schedules (title, description, start_time, end_time, location, room_id, use_room, vehicle_id, use_vehicle, requested_vehicle_type, status, created_by, department_id)
            VALUES (
                s_title, s_desc, s_start, s_end, 'Phòng giao dịch hoặc hiện trường công tác #' || i, 
                s_room, s_use_room, s_vehicle, s_use_vehicle, s_vehicle_type, 'approved', s_creator, s_dept
            );
        END;
    END LOOP;

    RAISE NOTICE '=========================================================================';
    RAISE NOTICE 'SIÊU KỊCH BẢN THÀNH CÔNG RỰC RỠ: 50 NHÂN SỰ VÀ 180 BẢN GHI ĐÃ ĐƯỢC THIẾT LẬP!';
    RAISE NOTICE '=========================================================================';
END $$;
