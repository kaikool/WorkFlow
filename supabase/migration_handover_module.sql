-- ============================================================================
-- MODULE: LUÂN CHUYỂN & TRUY VẾT HỒ SƠ VẬT LÝ ("Sổ giao nhận điện tử")
-- ----------------------------------------------------------------------------
-- Theo dõi vị trí và thời gian luân chuyển của hồ sơ bản cứng giữa các phòng
-- ban. Khởi tạo mã ngắn → ghi tay lên bìa hồ sơ → "Chuyển" / "Nhận" trên UI.
-- Cung cấp Timeline truy vết realtime cho Ban Giám đốc.
-- ============================================================================

-- 1) Enums --------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE document_status AS ENUM (
        'DRAFT',
        'PENDING_RECEIPT',
        'IN_REVIEW',
        'RETURNED',
        'COMPLETED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE handover_status AS ENUM (
        'PENDING',
        'ACCEPTED',
        'REJECTED'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2) Bảng document_categories (Nhóm hồ sơ — chỉ admin quản lý) ----------------

CREATE TABLE IF NOT EXISTS document_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    sla_hours INTEGER NOT NULL DEFAULT 24 CHECK (sla_hours > 0),
    color TEXT NOT NULL DEFAULT 'slate' CHECK (color IN ('slate','blue','amber','emerald','red')),
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE document_categories IS 'Nhóm hồ sơ với SLA giữ trên bàn (giờ). Admin tạo, người dùng chỉ chọn.';


-- 3) Bảng documents (Hồ sơ vật lý) -------------------------------------------

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_code TEXT UNIQUE,                                         -- HS-YYYYMMDD-NNN (gen bằng trigger)
    title TEXT NOT NULL,
    customer_name TEXT,
    category_id UUID REFERENCES document_categories(id) ON DELETE SET NULL,
    attached_image_urls TEXT[] NOT NULL DEFAULT '{}',
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    current_assignee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status document_status NOT NULL DEFAULT 'DRAFT',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE documents IS 'Hồ sơ vật lý đang luân chuyển. current_assignee_id = người đang giữ bản cứng.';

CREATE INDEX IF NOT EXISTS idx_documents_current_assignee ON documents(current_assignee_id);
CREATE INDEX IF NOT EXISTS idx_documents_creator ON documents(creator_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);


-- 4) Bảng document_handovers (Log lịch sử chuyển/nhận) -----------------------

CREATE TABLE IF NOT EXISTS document_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    status handover_status NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE document_handovers IS 'Log mỗi lần "Chuyển" hoặc "Trả về" — dùng để vẽ timeline truy vết.';

CREATE INDEX IF NOT EXISTS idx_handovers_doc_sent ON document_handovers(document_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_handovers_receiver_pending
    ON document_handovers(receiver_id) WHERE status = 'PENDING';


-- 5) Trigger: tự sinh short_code dạng HS-YYYYMMDD-NNN -----------------------

CREATE OR REPLACE FUNCTION generate_document_short_code()
RETURNS TRIGGER
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_documents_short_code ON documents;
CREATE TRIGGER trg_documents_short_code
    BEFORE INSERT ON documents
    FOR EACH ROW EXECUTE FUNCTION generate_document_short_code();


-- 6) Trigger: tự cập nhật updated_at -----------------------------------------

CREATE OR REPLACE FUNCTION touch_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_touch_updated ON documents;
CREATE TRIGGER trg_documents_touch_updated
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION touch_documents_updated_at();


-- 7) RPC: transfer_document — chuyển bản cứng cho người khác -----------------

CREATE OR REPLACE FUNCTION transfer_document(
    p_document_id UUID,
    p_receiver_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS UUID                                                        -- handover id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_doc documents%ROWTYPE;
    v_sender UUID := auth.uid();
    v_handover_id UUID;
    v_receiver_name TEXT;
BEGIN
    IF v_sender IS NULL THEN
        RAISE EXCEPTION 'Phiên đăng nhập đã hết hạn';
    END IF;

    IF p_receiver_id = v_sender THEN
        RAISE EXCEPTION 'Không thể chuyển hồ sơ cho chính mình';
    END IF;

    SELECT * INTO v_doc FROM documents WHERE id = p_document_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ';
    END IF;

    -- Chỉ người đang giữ (hoặc creator nếu chưa chuyển lần nào) mới được "Chuyển"
    IF v_doc.current_assignee_id IS NULL THEN
        IF v_doc.creator_id <> v_sender THEN
            RAISE EXCEPTION 'Bạn không có quyền chuyển hồ sơ này';
        END IF;
    ELSIF v_doc.current_assignee_id <> v_sender THEN
        RAISE EXCEPTION 'Hồ sơ đang ở bàn người khác, bạn không thể chuyển';
    END IF;

    -- Không cho phép chuyển khi đang chờ người trước đó nhận hoặc đã hoàn thành
    IF v_doc.status NOT IN ('DRAFT', 'IN_REVIEW', 'RETURNED') THEN
        RAISE EXCEPTION 'Trạng thái hiện tại không cho phép chuyển tiếp (%)', v_doc.status;
    END IF;

    INSERT INTO document_handovers (document_id, sender_id, receiver_id, status, sent_at, note)
    VALUES (p_document_id, v_sender, p_receiver_id, 'PENDING', NOW(), p_note)
    RETURNING id INTO v_handover_id;

    UPDATE documents
       SET status = 'PENDING_RECEIPT'
     WHERE id = p_document_id;

    -- Notification cho người nhận (push-notification edge function tự fire qua webhook)
    SELECT full_name INTO v_receiver_name FROM profiles WHERE id = v_sender;
    INSERT INTO notifications (user_id, title, content, type, link)
    VALUES (
        p_receiver_id,
        'Có hồ sơ mới chờ nhận',
        COALESCE(v_receiver_name, 'Đồng nghiệp') || ' chuyển hồ sơ ' || v_doc.short_code || ' — ' || v_doc.title,
        'document_handover',
        '/dashboard/handover?id=' || p_document_id::TEXT
    );

    RETURN v_handover_id;
END;
$$;


-- 8) RPC: acknowledge_document — người nhận xác nhận "Đã nhận" --------------

CREATE OR REPLACE FUNCTION acknowledge_document(
    p_handover_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_handover document_handovers%ROWTYPE;
    v_doc_short TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Phiên đăng nhập đã hết hạn';
    END IF;

    SELECT * INTO v_handover FROM document_handovers WHERE id = p_handover_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy phiếu giao nhận';
    END IF;

    IF v_handover.receiver_id <> auth.uid() THEN
        RAISE EXCEPTION 'Chỉ người nhận mới được xác nhận';
    END IF;

    IF v_handover.status <> 'PENDING' THEN
        RAISE EXCEPTION 'Phiếu giao nhận đã được xử lý';
    END IF;

    UPDATE document_handovers
       SET status = 'ACCEPTED',
           received_at = NOW()
     WHERE id = p_handover_id;

    UPDATE documents
       SET current_assignee_id = v_handover.receiver_id,
           status = 'IN_REVIEW'
     WHERE id = v_handover.document_id;

    -- Thông báo cho người gửi (đã nhận)
    SELECT short_code INTO v_doc_short FROM documents WHERE id = v_handover.document_id;
    INSERT INTO notifications (user_id, title, content, type, link)
    VALUES (
        v_handover.sender_id,
        'Hồ sơ đã được nhận',
        'Hồ sơ ' || v_doc_short || ' đã được người nhận xác nhận',
        'document_handover',
        '/dashboard/handover?id=' || v_handover.document_id::TEXT
    );
END;
$$;


-- 9) RPC: reject_document — trả về kèm lý do --------------------------------

CREATE OR REPLACE FUNCTION reject_document(
    p_handover_id UUID,
    p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_handover document_handovers%ROWTYPE;
    v_doc_short TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Phiên đăng nhập đã hết hạn';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'Vui lòng nhập lý do trả về';
    END IF;

    SELECT * INTO v_handover FROM document_handovers WHERE id = p_handover_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy phiếu giao nhận';
    END IF;

    -- Cho phép: người nhận chưa "Đã nhận" có quyền từ chối, hoặc người đang giữ bản cứng muốn trả về người gửi
    IF v_handover.receiver_id <> auth.uid() THEN
        RAISE EXCEPTION 'Chỉ người nhận mới được trả về';
    END IF;

    IF v_handover.status = 'REJECTED' THEN
        RAISE EXCEPTION 'Phiếu giao nhận đã bị từ chối trước đó';
    END IF;

    UPDATE document_handovers
       SET status = 'REJECTED',
           received_at = NOW(),
           note = p_reason
     WHERE id = p_handover_id;

    -- Trả bản cứng về cho người gửi
    UPDATE documents
       SET current_assignee_id = v_handover.sender_id,
           status = 'RETURNED'
     WHERE id = v_handover.document_id;

    SELECT short_code INTO v_doc_short FROM documents WHERE id = v_handover.document_id;
    INSERT INTO notifications (user_id, title, content, type, link)
    VALUES (
        v_handover.sender_id,
        'Hồ sơ bị trả về',
        'Hồ sơ ' || v_doc_short || ' bị trả về với lý do: ' || p_reason,
        'document_handover',
        '/dashboard/handover?id=' || v_handover.document_id::TEXT
    );
END;
$$;


-- 10) RPC: complete_document — đóng luồng luân chuyển -----------------------

CREATE OR REPLACE FUNCTION complete_document(
    p_document_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_doc documents%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Phiên đăng nhập đã hết hạn';
    END IF;

    SELECT * INTO v_doc FROM documents WHERE id = p_document_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ';
    END IF;

    IF v_doc.current_assignee_id <> auth.uid() THEN
        RAISE EXCEPTION 'Chỉ người đang giữ bản cứng mới được hoàn thành';
    END IF;

    IF v_doc.status = 'COMPLETED' THEN
        RAISE EXCEPTION 'Hồ sơ đã được hoàn thành';
    END IF;

    UPDATE documents
       SET status = 'COMPLETED',
           completed_at = NOW()
     WHERE id = p_document_id;

    -- Báo cho creator nếu họ không phải người đóng luồng
    IF v_doc.creator_id <> auth.uid() THEN
        INSERT INTO notifications (user_id, title, content, type, link)
        VALUES (
            v_doc.creator_id,
            'Hồ sơ đã hoàn thành',
            'Hồ sơ ' || v_doc.short_code || ' đã được đóng luồng luân chuyển',
            'document_handover',
            '/dashboard/handover?id=' || p_document_id::TEXT
        );
    END IF;
END;
$$;


-- 11) Row Level Security ----------------------------------------------------

ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_handovers ENABLE ROW LEVEL SECURITY;

-- 11a) Helper SECURITY DEFINER — bẻ vòng lặp RLS giữa documents <-> handovers.
--      Hai bảng này có quan hệ chéo: documents.SELECT cần kiểm tra handovers,
--      và handovers.SELECT cần kiểm tra documents. Nếu policy gọi EXISTS trực
--      tiếp sẽ trigger RLS của bảng kia → infinite recursion (error 42P17).
--      Helper SECURITY DEFINER bỏ qua RLS, an toàn để dùng trong policy.
CREATE OR REPLACE FUNCTION user_is_in_document_handovers(p_doc_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM document_handovers
    WHERE document_id = p_doc_id
      AND (sender_id = p_user_id OR receiver_id = p_user_id)
  );
$$;

CREATE OR REPLACE FUNCTION user_is_document_creator(p_doc_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM documents
    WHERE id = p_doc_id AND creator_id = p_user_id
  );
$$;

-- document_categories: SELECT mọi user đã đăng nhập, CUD chỉ admin
DROP POLICY IF EXISTS "Categories read all" ON document_categories;
DROP POLICY IF EXISTS "Categories admin write" ON document_categories;
DROP POLICY IF EXISTS "Categories admin update" ON document_categories;
DROP POLICY IF EXISTS "Categories admin delete" ON document_categories;

CREATE POLICY "Categories read all" ON document_categories FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Categories admin write" ON document_categories FOR INSERT
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Categories admin update" ON document_categories FOR UPDATE
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "Categories admin delete" ON document_categories FOR DELETE
USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- documents: SELECT theo quan hệ; INSERT cho mọi authenticated; UPDATE qua RPC (security definer bypass RLS)
DROP POLICY IF EXISTS "Documents read access" ON documents;
DROP POLICY IF EXISTS "Documents insert access" ON documents;
DROP POLICY IF EXISTS "Documents owner update images" ON documents;

CREATE POLICY "Documents read access" ON documents FOR SELECT
USING (
    creator_id = auth.uid()
    OR current_assignee_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR user_is_in_document_handovers(id, auth.uid())
);

CREATE POLICY "Documents insert access" ON documents FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND creator_id = auth.uid());

-- UPDATE: chỉ creator hoặc người đang giữ mới được cập nhật attached_image_urls;
-- các trường khác (status, current_assignee_id, completed_at) chỉ đi qua RPC SECURITY DEFINER.
CREATE POLICY "Documents owner update images" ON documents FOR UPDATE
USING (
    creator_id = auth.uid()
    OR current_assignee_id = auth.uid()
);

-- document_handovers: SELECT theo quan hệ; INSERT/UPDATE chỉ qua RPC
DROP POLICY IF EXISTS "Handovers read access" ON document_handovers;
DROP POLICY IF EXISTS "Handovers no direct insert" ON document_handovers;

CREATE POLICY "Handovers read access" ON document_handovers FOR SELECT
USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'director')
    OR user_is_document_creator(document_id, auth.uid())
);

-- Direct INSERT bị chặn — buộc đi qua transfer_document() để validate trạng thái
CREATE POLICY "Handovers no direct insert" ON document_handovers FOR INSERT
WITH CHECK (false);


-- 12) Seed các nhóm hồ sơ mặc định ------------------------------------------

INSERT INTO document_categories (name, sla_hours, color)
VALUES
    ('Hồ sơ tín dụng',  24, 'amber'),
    ('Hồ sơ kế toán',    8, 'blue'),
    ('Hồ sơ tổng hợp',  48, 'slate'),
    ('Hồ sơ nhân sự',   24, 'emerald')
ON CONFLICT (name) DO NOTHING;


-- 13) Storage bucket ---------------------------------------------------------
-- Bucket "documents" lưu ảnh đính kèm. Tạo bằng Dashboard hoặc câu lệnh:
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
-- ON CONFLICT (id) DO NOTHING;
--
-- Khuyến nghị giữ public=true cho đơn giản (intranet) và dựa vào tên file UUID
-- không đoán được. Nếu cần private + RLS, bổ sung policy storage.objects sau.


-- ============================================================================
-- Kết thúc migration.
-- ============================================================================
