// Fetch detail 1 task — gọi trực tiếp (không qua RPC) vì cần join phong phú cho timeline + comments.
import { createClient } from '@/utils/supabase/client';
import type { TaskDetail } from './types';

const supabase = createClient();

const DETAIL_SELECT = `
  *,
  department:departments ( id, name ),
  creator:profiles!tasks_created_by_fkey ( id, full_name, avatar_url ),
  assignees:task_assignees (
    user:profiles ( id, full_name, avatar_url )
  ),
  comments:task_comments (
    id, task_id, user_id, content, created_at,
    user:profiles ( id, full_name, avatar_url )
  ),
  extension_requests:task_extension_requests (
    *, requester:profiles!task_extension_requests_requested_by_fkey ( id, full_name, avatar_url )
  )
`;

export async function fetchTaskDetail(taskId: string): Promise<TaskDetail | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select(DETAIL_SELECT)
    .eq('id', taskId)
    .single();
  if (error) {
    console.error('fetchTaskDetail error:', error);
    return null;
  }
  const raw = data as any;
  const detail: TaskDetail = {
    ...raw,
    assignees: (raw.assignees ?? []).map((a: any) => a.user).filter(Boolean),
    comments: (raw.comments ?? []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
    extension_requests: raw.extension_requests ?? [],
  };
  return detail;
}

export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('id, name, code')
    .order('code', { ascending: true, nullsFirst: false });
  if (error) {
    console.error('fetchDepartments error:', error);
    return [];
  }
  return data ?? [];
}

interface CallerProfile {
  id: string;
  role: string | null;
  department_id: string | null;
}

export type AssignContext = 'create-task' | 'create-report' | 'delegate';

interface AssignOpts {
  context: AssignContext;
  caller: CallerProfile;
  // Bắt buộc với context = 'delegate' — phòng của task đang được phân công
  taskDepartmentId?: string | null;
}

/**
 * Fetch profiles có thể được giao việc, đã filter sẵn ở DB theo phân quyền:
 *
 *   - Staff: chỉ thấy chính mình (cho mục tự ghi chú).
 *   - Manager: chỉ thấy người TRONG phòng mình, loại admin/director.
 *   - Admin/Director: toàn nhánh, loại admin/director khác + chính mình.
 *   - Delegate context: luôn scope theo phòng của task, loại admin/director.
 *
 * Sort sẵn ở DB: Trưởng phòng → Phó phòng → Cán bộ → alphabet.
 * Trả về list KHÔ — KHÔNG fetch toàn bộ profiles rồi filter client.
 */
export async function fetchAssignableProfiles(opts: AssignOpts) {
  const { context, caller, taskDepartmentId } = opts;

  // Staff: tự giao mình
  if (caller.role === 'staff' && context === 'create-task') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, title, department_id, is_department_head, is_active, departments(name, code)')
      .eq('id', caller.id)
      .single();
    return data ? [data] : [];
  }

  let q = supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, title, department_id, is_department_head, is_active, departments(name, code)')
    .eq('is_active', true)
    .not('role', 'in', '(admin,director,driver)');

  if (context === 'delegate') {
    if (!taskDepartmentId) return [];
    q = q.eq('department_id', taskDepartmentId);
  } else if (caller.role === 'manager') {
    // Manager chỉ giao việc cho phòng mình
    if (!caller.department_id) return [];
    q = q.eq('department_id', caller.department_id);
  }
  // admin/director: không thêm filter dept (toàn nhánh)

  // Sort: TP (head=true) → PP (manager) → NV (staff) → alphabet
  q = q
    .order('is_department_head', { ascending: false, nullsFirst: false })
    .order('role', { ascending: true })
    .order('full_name', { ascending: true });

  const { data, error } = await q;
  if (error) {
    console.error('fetchAssignableProfiles error:', error);
    return [];
  }
  return data ?? [];
}

