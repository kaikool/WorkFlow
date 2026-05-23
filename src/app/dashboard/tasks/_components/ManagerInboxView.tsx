'use client';

// ManagerInboxView — "Chờ tôi duyệt" cho Manager/Director/Admin.
// 1. Báo cáo trạng thái 'submitted' (chờ duyệt) — ghi nhận chủ thể là PHÒNG.
// 2. Yêu cầu gia hạn (task_extension_requests.status = 'pending').

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { FileText, Clock, Check, X, ArrowRight, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { TaskApproveExtensionDialog } from './TaskApproveExtensionDialog';
import { TaskReturnDialog } from './TaskReturnDialog';
import { notifySuccess, notifyError } from '@/lib/notify';
import { updateTaskStatus } from '../_lib/taskActions';
import type { TaskListItem } from '../_lib/types';

interface ExtensionWithRefs {
  id: string;
  task_id: string;
  reason: string | null;
  old_due_date: string | null;
  new_due_date: string;
  created_at: string;
  task: { id: string; title: string; department_id: string | null } | null;
  requester: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface Props {
  items: TaskListItem[];
  onOpen: (taskId: string) => void;
  onChanged: () => void;
}

export function ManagerInboxView({ items, onOpen, onChanged }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [extensions, setExtensions] = useState<ExtensionWithRefs[]>([]);
  const [extensionTarget, setExtensionTarget] = useState<ExtensionWithRefs | null>(null);
  const [returnTarget, setReturnTarget] = useState<TaskListItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const submittedReports = items.filter(t => t.status === 'submitted' && t.task_type === 'report');

  const loadExtensions = async () => {
    const { data, error } = await supabase
      .from('task_extension_requests')
      .select(`
        id, task_id, reason, old_due_date, new_due_date, created_at,
        task:tasks ( id, title, department_id ),
        requester:profiles!task_extension_requests_requested_by_fkey ( id, full_name, avatar_url )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) { console.error('loadExtensions error:', error); return; }
    setExtensions((data as any) ?? []);
  };

  useEffect(() => {
    loadExtensions();
    const channel = supabase
      .channel('manager_inbox_extensions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_extension_requests' }, loadExtensions)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const handleApprove = async (task: TaskListItem) => {
    setBusyId(task.id);
    const res = await updateTaskStatus(task.id, 'done');
    setBusyId(null);
    if (!res.ok) { notifyError(res.error, 'Không duyệt được'); return; }
    notifySuccess('Đã duyệt báo cáo');
    onChanged();
  };

  if (submittedReports.length === 0 && extensions.length === 0) {
    return (
      <div className="premium-card p-10 border-none text-center">
        <Check className="icon-lg mx-auto text-emerald-500 mb-2" />
        <p className="text-[14px] font-medium text-slate-600">Không có việc chờ bạn xử lý</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submittedReports.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-slate-500 px-1">
            Báo cáo chờ duyệt ({submittedReports.length})
          </h3>
          <div className="space-y-2">
            {submittedReports.map(task => (
              <div key={task.id} className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
                <button
                  type="button"
                  onClick={() => onOpen(task.id)}
                  className="flex items-start gap-2 text-left w-full hover:opacity-80 transition-opacity"
                >
                  <FileText className="icon-sm text-blue-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900 truncate">
                      {task.title}
                    </p>
                    {/* Chủ thể chính: PHÒNG (theo nghiệp vụ ghi nhận báo cáo cấp phòng) */}
                    <div className="flex items-center gap-1.5 mt-1">
                      <Building2 className="icon-sm text-amber-600" />
                      <span className="text-[12px] font-semibold text-slate-700">
                        {task.department?.name ?? '—'}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-[12px] text-slate-500 truncate">
                        {task.assignees?.map(a => a.full_name).filter(Boolean).join(', ') || 'chưa rõ ai nộp'}
                      </span>
                    </div>
                    {task.due_date && (
                      <p className="text-[12px] text-slate-500 mt-0.5">
                        Hạn {format(new Date(task.due_date), 'dd/MM', { locale: vi })}
                      </p>
                    )}
                  </div>
                </button>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setReturnTarget(task)}
                    disabled={busyId === task.id}
                    className="min-h-9 rounded-xl text-[13px] font-medium"
                  >
                    Trả về
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(task)}
                    disabled={busyId === task.id}
                    className="min-h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[13px] font-semibold"
                  >
                    <Check className="icon-sm mr-1" /> Duyệt
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {extensions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-slate-500 px-1">
            Xin gia hạn ({extensions.length})
          </h3>
          <div className="space-y-2">
            {extensions.map(ext => (
              <div key={ext.id} className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-sm">
                <button
                  type="button"
                  onClick={() => ext.task_id && onOpen(ext.task_id)}
                  className="flex items-start gap-2 text-left w-full hover:opacity-80 transition-opacity"
                >
                  <Clock className="icon-sm text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900 truncate">
                      {ext.task?.title ?? '—'}
                    </p>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      {ext.requester?.full_name ?? '—'} xin dời:{' '}
                      {ext.old_due_date && format(new Date(ext.old_due_date), 'dd/MM', { locale: vi })}
                      <ArrowRight className="inline icon-sm mx-1" />
                      {format(new Date(ext.new_due_date), 'dd/MM', { locale: vi })}
                    </p>
                    {ext.reason && (
                      <p className="text-[13px] text-slate-600 mt-1 italic line-clamp-2">
                        "{ext.reason}"
                      </p>
                    )}
                  </div>
                </button>
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExtensionTarget(ext)}
                    className="min-h-9 rounded-xl text-[13px] font-medium"
                  >
                    <X className="icon-sm mr-1" /> Từ chối
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setExtensionTarget(ext)}
                    className="min-h-9 rounded-xl bg-primary hover:bg-primary/90 text-white text-[13px] font-semibold"
                  >
                    <Check className="icon-sm mr-1" /> Cho dời
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {extensionTarget && (
        <TaskApproveExtensionDialog
          extension={extensionTarget}
          onClose={() => setExtensionTarget(null)}
          onChanged={() => { setExtensionTarget(null); loadExtensions(); onChanged(); }}
        />
      )}

      {returnTarget && (
        <TaskReturnDialog
          task={returnTarget}
          onClose={() => setReturnTarget(null)}
          onChanged={() => { setReturnTarget(null); onChanged(); }}
        />
      )}
    </div>
  );
}
