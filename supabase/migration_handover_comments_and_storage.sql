-- ==============================================================================
-- WorkFlow Portal — Handover Comments & Storage Policies Migration (2026-05-30)
-- ==============================================================================
-- Mục đích:
--   1. Kích hoạt và cấu hình chính sách RLS cho bucket 'documents' để upload ảnh.
--   2. Tạo bảng 'document_comments' để lưu trữ ý kiến/thảo luận cho hồ sơ.
--   3. Kích hoạt RLS bảo mật cho 'document_comments' thừa hưởng từ bảng documents.
--   4. Thêm index tối ưu và đăng ký realtime.
-- ==============================================================================

-- 1. Cấu hình Supabase Storage cho Documents bucket (Public Read)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Xóa các policy cũ để tránh lỗi trùng lặp
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='storage' AND tablename='objects'
             AND policyname LIKE 'documents_bucket_%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

-- 2. Tạo Storage Policies cho Documents bucket
CREATE POLICY "documents_bucket_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "documents_bucket_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "documents_bucket_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND owner = auth.uid());

CREATE POLICY "documents_bucket_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND owner = auth.uid());


-- 3. Tạo bảng document_comments (Ý kiến & Thảo luận hồ sơ)
CREATE TABLE IF NOT EXISTS document_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kích hoạt RLS bảo mật
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

-- Xóa policy cũ nếu có
DROP POLICY IF EXISTS "document_comments_select" ON document_comments;
DROP POLICY IF EXISTS "document_comments_insert" ON document_comments;
DROP POLICY IF EXISTS "document_comments_delete" ON document_comments;

-- 4. Tạo RLS Policies cho document_comments
-- SELECT: Chỉ người xem được hồ sơ mới xem được thảo luận
CREATE POLICY "document_comments_select" ON document_comments FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = document_id
    )
);

-- INSERT: Chỉ người xem được hồ sơ mới gửi được thảo luận dưới chính tên mình
CREATE POLICY "document_comments_insert" ON document_comments FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
        SELECT 1 FROM documents d
        WHERE d.id = document_id
    )
);

-- DELETE: Chỉ chính chủ hoặc admin mới được xoá
CREATE POLICY "document_comments_delete" ON document_comments FOR DELETE TO authenticated
USING (
    auth.uid() = user_id
    OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
    )
);


-- 5. Tạo Index tối ưu tốc độ truy vấn bình luận theo thứ tự thời gian
CREATE INDEX IF NOT EXISTS idx_document_comments_doc_created ON document_comments(document_id, created_at ASC);


-- 6. Đăng ký realtime sync cho bảng document_comments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'document_comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE document_comments;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

NOTIFY pgrst, 'reload schema';
