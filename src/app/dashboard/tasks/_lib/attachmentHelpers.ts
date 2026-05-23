import { createClient } from '@/utils/supabase/client';
import type { ActionResult } from './types';

const supabase = createClient();
const BUCKET = 'task-attachments';

const ALLOWED_MIME = new Set<string>([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/pdf',
  'image/jpeg',
  'image/png',
]);

export const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export interface TaskAttachment {
  id: string;
  task_id: string;
  comment_id: string | null;
  uploaded_by: string | null;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  is_deleted: boolean;
  created_at: string;
}

export function isAllowedMime(mime: string | null | undefined) {
  if (!mime) return true;
  return ALLOWED_MIME.has(mime);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function uploadAttachment(
  taskId: string,
  file: File,
  commentId?: string | null,
): Promise<ActionResult<TaskAttachment>> {
  if (file.size > MAX_SIZE_BYTES) {
    return { ok: false, error: 'File vượt quá 20MB' };
  }
  if (!isAllowedMime(file.type)) {
    return { ok: false, error: 'Định dạng file không được hỗ trợ' };
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const path = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { data, error } = await supabase.rpc('task_attachment_register', {
    p_task_id: taskId,
    p_storage_path: path,
    p_filename: file.name,
    p_mime_type: file.type || null,
    p_size_bytes: file.size,
    p_comment_id: commentId ?? null,
  } as any);
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }

  return {
    ok: true,
    data: {
      id: data as string,
      task_id: taskId,
      comment_id: commentId ?? null,
      uploaded_by: null,
      storage_path: path,
      filename: file.name,
      mime_type: file.type || null,
      size_bytes: file.size,
      is_deleted: false,
      created_at: new Date().toISOString(),
    },
  };
}

export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function removeAttachment(attachmentId: string): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_attachment_remove', {
    p_attachment_id: attachmentId,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function fetchTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const { data, error } = await supabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchTaskAttachments error:', error);
    return [];
  }
  return (data ?? []) as TaskAttachment[];
}
