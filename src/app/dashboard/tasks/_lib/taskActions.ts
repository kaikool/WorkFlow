// Wrapper cho mọi RPC của module Tasks. Tuân theo pattern handover/_lib/transferActions.ts:
// return { ok: true, data } | { ok: false, error } — caller chỉ cần `if (!res.ok) notifyError(res.error)`.

import { createClient } from '@/utils/supabase/client';
import type { TaskStatus, TaskPriority, TaskType, ActionResult } from './types';

const supabase = createClient();

export async function createTask(input: {
  title: string;
  description?: string | null;
  task_type: TaskType;
  priority?: TaskPriority | null;
  due_date: string;
  dept_id?: string | null;
  assignee_ids: string[] | null;
  metadata?: Record<string, unknown>;
}): Promise<ActionResult<string>> {
  const { data, error } = await supabase.rpc('task_create', {
    p_title: input.title,
    p_description: input.description ?? null,
    p_task_type: input.task_type,
    p_priority: input.priority ?? 'medium',
    p_due_date: input.due_date,
    p_dept_id: input.dept_id ?? null,
    p_assignee_ids: input.assignee_ids,
    p_metadata: (input.metadata ?? {}) as any,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as string };
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: TaskStatus,
  comment?: string,
): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_update_status', {
    p_task_id: taskId,
    p_new_status: newStatus,
    p_comment: comment ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function delegateTask(taskId: string, assigneeIds: string[]): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_delegate', {
    p_task_id: taskId,
    p_assignee_ids: assigneeIds,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function requestExtension(input: {
  task_id: string;
  new_due_date: string;
  reason?: string;
}): Promise<ActionResult<string>> {
  const { data, error } = await supabase.rpc('task_request_extension', {
    p_task_id: input.task_id,
    p_new_due_date: input.new_due_date,
    p_reason: input.reason ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as string };
}

export async function decideExtension(
  extensionId: string,
  approve: boolean,
  comment?: string,
): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_decide_extension', {
    p_extension_id: extensionId,
    p_approve: approve,
    p_comment: comment ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addComment(
  taskId: string,
  body: string,
  attachmentIds?: string[],
): Promise<ActionResult<string>> {
  const { data, error } = await supabase.rpc('task_add_comment', {
    p_task_id: taskId,
    p_body: body,
    p_attachment_ids: attachmentIds ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as string };
}

export async function cancelTask(taskId: string, reason?: string): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_cancel', {
    p_task_id: taskId,
    p_reason: reason ?? null,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function archiveTask(taskId: string, archive = true): Promise<ActionResult> {
  const { error } = await supabase.rpc('task_archive', {
    p_task_id: taskId,
    p_archive: archive,
  } as any);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
