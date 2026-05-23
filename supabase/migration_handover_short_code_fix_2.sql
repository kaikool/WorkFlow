-- ============================================================================
-- FIX: Lỗi "documents_short_code_key" duplicate key
-- ----------------------------------------------------------------------------
-- Nguyên nhân: Hàm sinh mã short_code `generate_document_short_code` chạy
-- dưới quyền của user đang đăng nhập (caller). Do bảng `documents` có RLS
-- (chỉ cho phép user nhìn thấy hồ sơ của mình), khi hàm thực hiện câu lệnh
-- `SELECT MAX(...) FROM documents`, nó sẽ KHÔNG nhìn thấy các hồ sơ do
-- người khác tạo trong cùng ngày.
-- Kết quả là `MAX` trả về 0, và hàm tiếp tục sinh mã `HS-YYYYMMDD-001`,
-- dẫn đến đụng độ (duplicate key) với mã `001` đã được người khác tạo.
--
-- Cách fix: Thêm `SECURITY DEFINER` vào hàm `generate_document_short_code`
-- để hàm luôn chạy dưới quyền của người tạo hàm (admin/postgres), qua đó
-- bypass RLS và đếm được chính xác số lượng hồ sơ thực tế trong toàn hệ thống.
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_document_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_date_part TEXT;
    v_seq INTEGER;
    v_code TEXT;
BEGIN
    IF NEW.short_code IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Lấy lock theo ngày để tránh race condition khi insert đồng thời
    PERFORM pg_advisory_xact_lock(hashtext('document_short_code_' || to_char(NOW(), 'YYYYMMDD')));

    v_date_part := to_char(NOW(), 'YYYYMMDD');

    SELECT COALESCE(MAX(SUBSTRING(short_code FROM 13 FOR 3)::INTEGER), 0) + 1
    INTO v_seq
    FROM documents
    WHERE short_code LIKE 'HS-' || v_date_part || '-%';

    v_code := 'HS-' || v_date_part || '-' || lpad(v_seq::TEXT, 3, '0');
    NEW.short_code := v_code;
    RETURN NEW;
END;
$$;
