-- =====================================================================
-- MIGRATION: TASK ATTACHMENTS (P2)
-- =====================================================================
-- Bảng + RPC + RLS cho file đính kèm task / comment.
-- Bucket Storage `task-attachments` phải tạo thủ công trên Supabase Dashboard:
--   Dashboard → Storage → New bucket → name=task-attachments, public=FALSE
--   (private bucket — chỉ download qua createSignedUrl).
-- =====================================================================

CREATE TABLE IF NOT EXISTS task_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  comment_id    UUID REFERENCES task_comments(id) ON DELETE SET NULL,
  uploaded_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  storage_path  TEXT NOT NULL,
  filename      TEXT NOT NULL,
  mime_type     TEXT,
  size_bytes    INTEGER,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task
  ON task_attachments(task_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_task_attachments_comment
  ON task_attachments(comment_id) WHERE comment_id IS NOT NULL;

ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='public' AND tablename='task_attachments' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON task_attachments', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "task_attachments_select" ON task_attachments FOR SELECT TO authenticated
USING (user_can_see_task(task_id) AND is_deleted = FALSE);

CREATE POLICY "task_attachments_no_direct_write" ON task_attachments
  FOR ALL TO authenticated USING (FALSE) WITH CHECK (FALSE);


-- =====================================================================
-- RPCs
-- =====================================================================

CREATE OR REPLACE FUNCTION task_attachment_register(
  p_task_id       UUID,
  p_storage_path  TEXT,
  p_filename      TEXT,
  p_mime_type     TEXT,
  p_size_bytes    INTEGER,
  p_comment_id    UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  IF NOT user_can_see_task(p_task_id, v_uid) THEN
    RAISE EXCEPTION 'Bạn không có quyền đính kèm vào công việc này';
  END IF;
  IF p_size_bytes IS NOT NULL AND p_size_bytes > 20 * 1024 * 1024 THEN
    RAISE EXCEPTION 'File vượt quá 20MB';
  END IF;

  INSERT INTO task_attachments (
    task_id, comment_id, uploaded_by, storage_path, filename, mime_type, size_bytes
  ) VALUES (
    p_task_id, p_comment_id, v_uid, p_storage_path, p_filename, p_mime_type, p_size_bytes
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

GRANT EXECUTE ON FUNCTION task_attachment_register(UUID, TEXT, TEXT, TEXT, INTEGER, UUID) TO authenticated;


CREATE OR REPLACE FUNCTION task_attachment_remove(p_attachment_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
  v_dept UUID;
  v_att  task_attachments%ROWTYPE;
  v_task tasks%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Chưa đăng nhập'; END IF;
  SELECT role, department_id INTO v_role, v_dept FROM profiles WHERE id = v_uid;

  SELECT * INTO v_att FROM task_attachments WHERE id = p_attachment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy file đính kèm'; END IF;

  SELECT * INTO v_task FROM tasks WHERE id = v_att.task_id;

  IF NOT (
    v_att.uploaded_by = v_uid
    OR v_role IN ('admin', 'director')
    OR (v_role = 'manager' AND v_task.department_id = v_dept)
  ) THEN
    RAISE EXCEPTION 'Bạn không có quyền xoá file đính kèm này';
  END IF;

  UPDATE task_attachments SET is_deleted = TRUE WHERE id = p_attachment_id;
END $$;

GRANT EXECUTE ON FUNCTION task_attachment_remove(UUID) TO authenticated;


-- =====================================================================
-- Storage policies — bucket 'task-attachments' (private)
-- =====================================================================
-- Lưu ý: Tạo bucket trước qua Dashboard. Sau đó chạy 4 policy dưới.

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname='storage' AND tablename='objects'
             AND policyname LIKE 'task_attachments_%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "task_attachments_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "task_attachments_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'task-attachments' AND owner = auth.uid());

CREATE POLICY "task_attachments_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments' AND owner = auth.uid());


NOTIFY pgrst, 'reload schema';
