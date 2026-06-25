'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Building2, AlertTriangle, Calendar, UserPlus, Pencil, Trash2,
  CheckCircle2, Loader2, Play, Send, Undo2, Clock, Users, RotateCcw,
  ChevronLeft, Flag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
  PRIORITY_LABEL,
  PRIORITY_BADGE_CLASS,
} from '../_lib/constants';
import { batchProgress } from '../_lib/batchHelpers';
import { deleteTask, updateTaskStatus, archiveTask } from '../_lib/taskActions';
import {
  canEditTask, canDeleteTask, canForceCompleteTask,
  canApproveTaskResult, canDelegateTask, canRejectSubmission, canReopenDone,
  canApproveExtension, canArchiveTask, canComposeTaskComment,
} from '@/lib/permissions';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { notifyError, notifySuccess } from '@/lib/notify';
import { useTaskDetail } from '../_hooks/useTaskDetail';
import { TaskEditDialog } from './TaskEditDialog';
import { TaskDelegateDialog } from './TaskDelegateDialog';
import { TaskApproveExtensionDialog } from './TaskApproveExtensionDialog';
import { TaskRequestExtensionDialog } from './TaskRequestExtensionDialog';
import { TaskSubmitResultDialog } from './TaskSubmitResultDialog';
import { TaskReturnDialog } from './TaskReturnDialog';
import { TaskReopenDialog } from './TaskReopenDialog';
import { TaskApproveDialog } from './TaskApproveDialog';
import { TaskCommentList } from './TaskCommentList';
import { TaskTimeline } from './TaskTimeline';
import { SelectionPill } from '@/components/ui/people-picker';
import type { TaskListItem, TaskStatus, TaskDetail } from '../_lib/types';

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  taskId?: string | null;
  batchId?: string | null;
  children?: TaskListItem[];
  currentProfile: { id: string; role: string; department_id: string | null } | null;
  onChanged?: () => void;
  onOpenTask?: (taskId: string) => void;
}

const BADGE_BASE = 'px-2.5 py-1 rounded-full';
const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0, doing: 1, submitted: 2, done: 3, canceled: 4,
};

// ─── Phụ: nút action chính/phụ ───
function PrimaryAction({ label, icon, onClick, disabled, tone = 'primary' }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; tone?: 'primary' | 'amber';
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className={cn(
        'inline-flex items-center gap-2 min-h-11 px-5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
        tone === 'primary'
          ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
          : 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm',
      )}
    >
      {icon} {label}
    </button>
  );
}
function SecondaryAction({ label, icon, onClick, disabled }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-2 min-h-10 px-4 rounded-xl font-medium text-sm text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon} {label}
    </button>
  );
}

// ─── Phụ: MetaRow ───
function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white shadow-sm shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <div className="text-sm font-semibold text-slate-900 truncate">{value}</div>
      </div>
    </div>
  );
}

// ─── Phụ: SegmentedProgressBar ───
function SegmentedProgressBar({ progress }: { progress: ReturnType<typeof batchProgress> }) {
  const { total, done, submitted, doing } = progress;
  const seg = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  if (total === 0) return null;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
      {done > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${seg(done)}%` }} />}
      {submitted > 0 && <div className="bg-blue-400 transition-all" style={{ width: `${seg(submitted)}%` }} />}
      {doing > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${seg(doing)}%` }} />}
    </div>
  );
}

// ─── Phụ: StatTile ───
type Tone = 'emerald' | 'blue' | 'amber' | 'slate' | 'red';
const TONE_CLASS: Record<Tone, { bg: string; fg: string; label: string }> = {
  emerald: { bg: 'bg-emerald-50 border-emerald-100', fg: 'text-emerald-700', label: 'text-emerald-600' },
  blue:    { bg: 'bg-blue-50 border-blue-100',       fg: 'text-blue-700',    label: 'text-blue-600' },
  amber:   { bg: 'bg-amber-50 border-amber-100',     fg: 'text-amber-700',   label: 'text-amber-600' },
  slate:   { bg: 'bg-slate-50 border-slate-100',     fg: 'text-slate-700',   label: 'text-slate-500' },
  red:     { bg: 'bg-red-50 border-red-100',          fg: 'text-red-700',    label: 'text-red-600' },
};
function StatTile({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const c = TONE_CLASS[tone];
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', c.bg)}>
      <p className={cn('text-xl font-bold tabular-nums', c.fg)}>{value}</p>
      <p className={cn('text-[13px] font-medium', c.label)}>{label}</p>
    </div>
  );
}

// ─── Component chính ───
export function TaskDetailDialog({
  isOpen, setIsOpen, taskId, batchId, children = [],
  currentProfile, onChanged, onOpenTask,
}: Props) {
  const isBatch = batchId != null && children.length > 0;
  // currentChildId: null = batch overview, set = xem detail 1 task con (hoặc single task)
  const [currentChildId, setCurrentChildId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Sub-dialog state (kế thừa từ TaskDetailPanel)
  const [openDelegate, setOpenDelegate] = useState(false);
  const [openExtension, setOpenExtension] = useState(false);
  const [openSubmit, setOpenSubmit] = useState(false);
  const [openReturn, setOpenReturn] = useState(false);
  const [openReopen, setOpenReopen] = useState(false);
  const [openApprove, setOpenApprove] = useState(false);
  const [openApproveExtension, setOpenApproveExtension] = useState<any>(null);

  // Fetch detail cho task đang xem
  const activeTaskId = currentChildId ?? taskId ?? null;
  const { loading, task, refetch } = useTaskDetail(isOpen ? activeTaskId : null);

  useEffect(() => {
    if (task && onChanged) onChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status, task?.updated_at]);

  // Reset child khi mở dialog mới
  useEffect(() => {
    if (isOpen && !isBatch) setCurrentChildId(null);
  }, [isOpen, isBatch]);

  // Batch children cache
  const [cachedChildren, setCachedChildren] = useState<TaskListItem[]>([]);
  useEffect(() => {
    if (isOpen && isBatch && children.length > 0) setCachedChildren(children);
  }, [isOpen, isBatch, children]);

  const displayChildren = isOpen ? children : cachedChildren;
  const rep = displayChildren[0];
  const p = batchProgress(displayChildren);

  const sortedChildren = useMemo(() => {
    return [...displayChildren].sort((a, b) => {
      if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
      const sa = STATUS_ORDER[a.status] ?? 99;
      const sb = STATUS_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return (a.department?.name ?? '').localeCompare(b.department?.name ?? '');
    });
  }, [displayChildren]);

  // ─── Permissions cho task hiện tại ───
  const canEdit = task && canEditTask(currentProfile, task);
  const canDelete = task && canDeleteTask(currentProfile, task);
  const canForceComplete = task && canForceCompleteTask(currentProfile, task);
  const isAssignee = task && (task.assignees ?? []).some(a => a.id === currentProfile?.id);
  const isCreator = task?.created_by === currentProfile?.id;
  const isManagerOfTask = task && canDelegateTask(currentProfile, task);
  const isManagerApprove = task && canApproveTaskResult(currentProfile, task);
  const isReadOnly = task && (task.is_archived || task.status === 'canceled' || task.status === 'done');
  const dueOverdue = !!(task?.due_date && new Date(task.due_date) < new Date() && !['done', 'canceled'].includes(task?.status ?? ''));
  const isSelfApprove = task && task.requires_approval && task.assignees?.some(a => a.id === task.created_by);
  const canMarkDone = isAssignee && task?.status === 'doing' && (!task.requires_approval || isSelfApprove);
  const canSubmit = isAssignee && task?.status === 'doing' && task.requires_approval && !isSelfApprove;
  const canStart = isAssignee && task?.status === 'todo';
  const canApproveSubmission = isManagerApprove && task?.status === 'submitted';
  const canReject = task && canRejectSubmission(currentProfile, task);
  const canReopen = task && canReopenDone(currentProfile, task);
  const canRequestExtension = isAssignee && task?.status !== 'done' && task?.status !== 'canceled';
  const canDelegate = isManagerOfTask && task?.status !== 'done' && task?.status !== 'canceled';
  const canArchive = task && canArchiveTask(currentProfile);

  // ─── Batch-level permissions ───
  const batchCanEdit = rep && canEditTask(currentProfile, rep as any);
  const batchCanDelete = rep && canDeleteTask(currentProfile, rep as any);
  const batchCanForceComplete = rep && canForceCompleteTask(currentProfile, rep as any);
  const pendingChildren = children.filter(c => c.status !== 'done' && c.status !== 'canceled');
  const hasPending = pendingChildren.length > 0;

  // ─── Handlers ───
  const runStatus = async (next: string, key: string, errorTitle: string) => {
    if (!task) return;
    setBusy(key);
    const res = await updateTaskStatus(task.id, next);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, errorTitle); return; }
    notifySuccess('Đã cập nhật trạng thái');
    onChanged?.();
  };

  const runArchive = async () => {
    if (!task) return;
    setBusy('archive');
    const res = await archiveTask(task.id, !task.is_archived);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Không lưu trữ được'); return; }
    notifySuccess(task.is_archived ? 'Đã đưa khỏi lưu trữ' : 'Đã lưu trữ');
    onChanged?.();
  };

  const runForceComplete = async () => {
    if (!task) return;
    const ok = await confirmDialog({
      title: 'Xác nhận ghi nhận hoàn thành?',
      description: 'Việc này sẽ đóng công việc dù người nhận chưa nộp.',
      confirmText: 'Xác nhận',
    });
    if (!ok) return;
    setBusy('forceComplete');
    const res = await updateTaskStatus(task.id, 'done', '[sys] Đã hoàn thành.');
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Không thể ghi nhận hoàn thành'); return; }
    notifySuccess('Đã cập nhật trạng thái');
    onChanged?.();
  };

  const runDelete = async () => {
    if (!task) return;
    const ok = await confirmDialog({
      title: 'Xoá công việc?',
      description: `Xoá "${task.title}"? Không thể hoàn tác.`,
      confirmText: 'Xoá', danger: true,
    });
    if (!ok) return;
    setBusy('delete');
    const res = await deleteTask(task.id);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Không xoá được'); return; }
    notifySuccess('Đã xoá công việc');
    onChanged?.();
    setTimeout(() => setIsOpen(false), 100);
  };

  const runForceCompleteBatch = async () => {
    const ok = await confirmDialog({
      title: 'Ghi nhận hoàn thành lô?',
      description: `Đóng ${pendingChildren.length} công việc chưa nộp trong lô.`,
      confirmText: 'Xác nhận',
    });
    if (!ok) return;
    setDeleting(true);
    let okCount = 0;
    let firstError: string | undefined;
    for (const child of pendingChildren) {
      const res = await updateTaskStatus(child.id, 'done', '[sys] Đã hoàn thành.');
      if (res.ok) okCount += 1;
      else if (!firstError) firstError = res.error;
    }
    setDeleting(false);
    if (okCount === 0) { notifyError(firstError ?? 'Lỗi', 'Không ghi nhận được'); return; }
    notifySuccess(`Đã ghi nhận ${okCount}/${pendingChildren.length} công việc`);
    setIsOpen(false);
    onChanged?.();
    setTimeout(() => { document.body.style.pointerEvents = ''; }, 500);
  };

  const runDeleteBatch = async () => {
    const ok = await confirmDialog({
      title: 'Xoá lô công việc?', confirmText: 'Xoá lô', danger: true,
      description: `Xoá ${children.length} công việc trong lô?`,
    });
    if (!ok) return;
    setDeleting(true);
    let okCount = 0;
    let firstError: string | undefined;
    for (const child of children) {
      const res = await deleteTask(child.id);
      if (res.ok) okCount += 1;
      else if (!firstError) firstError = res.error;
    }
    setDeleting(false);
    if (okCount === 0) { notifyError(firstError ?? 'Lỗi', 'Không xoá được'); return; }
    notifySuccess(`Đã xoá ${okCount}/${children.length} công việc`);
    setIsOpen(false);
    onChanged?.();
    setTimeout(() => { document.body.style.pointerEvents = ''; }, 500);
  };

  // ─── Render ───
  if (!isOpen) return null;

  const isDetailMode = !!currentChildId || !isBatch;  // batch overview vs detail mode
  const displayTitle = isBatch && !currentChildId
    ? (rep?.title ?? 'Chi tiết')
    : (task?.title ?? 'Đang tải…');
  const isOverallView = isBatch && !currentChildId;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent hideCloseButton className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl flex flex-col p-0">
        {/* ===== HEADER ===== */}
        <DialogHeader className="app-dialog-sheet-header border-b border-slate-100">
          {isOverallView && batchCanEdit && (
            <button
              onClick={() => setOpenEdit(true)}
              className="absolute right-14 top-4 h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-all active:scale-95"
              title="Sửa thông tin lô"
            >
              <Pencil className="w-4 h-4 text-slate-500" />
            </button>
          )}
          <div className="flex items-center gap-2">
            {isOverallView && (
              <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg bg-slate-100 text-[13px] font-semibold text-slate-600">
                <Users className="w-3.5 h-3.5" />
                {children.length} phòng
              </span>
            )}
            {task?.status && !isOverallView && (
              <Badge variant="outline" className={cn(BADGE_BASE, STATUS_BADGE_CLASS[task.status])}>
                {STATUS_LABEL[task.status]}
              </Badge>
            )}
          </div>
          <DialogTitle className="text-[17px] font-bold text-slate-900 leading-tight pr-12 line-clamp-2">
            {displayTitle}
          </DialogTitle>
          {(isOverallView || task) && (
            <DialogDescription className="text-[13px] text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
              {isOverallView && rep?.creator?.full_name && (
                <span>{rep.creator.full_name} giao</span>
              )}
              {isOverallView && rep?.due_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Hạn {format(new Date(rep.due_date), 'dd/MM/yyyy', { locale: vi })}
                </span>
              )}
              {!isOverallView && task?.creator?.full_name && (
                <span>{task.creator.full_name} giao</span>
              )}
              {!isOverallView && task?.due_date && (
                <span className={cn('inline-flex items-center gap-1', dueOverdue && 'text-red-600 font-semibold')}>
                  <Calendar className="w-3.5 h-3.5" />
                  Hạn {format(new Date(task.due_date), 'EEEE, dd/MM/yyyy HH:mm', { locale: vi })}
                </span>
              )}
              {!isOverallView && task?.department && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" />
                  {task.department.name}
                </span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* ===== BODY ===== */}
        <ScrollArea className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 space-y-5">

            {/* ─── 1. Progress ─── */}
            {isOverallView ? (
              <div className="space-y-2">
                <SegmentedProgressBar progress={p} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatTile label="Hoàn thành" value={p.done} tone="emerald" />
                  <StatTile label="Đã nộp" value={p.submitted} tone="blue" />
                  <StatTile label="Đang làm" value={p.doing} tone="amber" />
                  <StatTile label="Chưa làm" value={p.todo} tone="slate" />
                </div>
              </div>
            ) : task && (
              <div className="flex items-center gap-2 flex-wrap">
                {task.priority !== 'medium' && (
                  <Badge variant="outline" className={cn(BADGE_BASE, PRIORITY_BADGE_CLASS[task.priority])}>
                    <Flag className="w-3 h-3 mr-1" />
                    {PRIORITY_LABEL[task.priority]}
                  </Badge>
                )}
                {dueOverdue && (
                  <Badge className={cn(BADGE_BASE, 'bg-red-50 text-red-700 border border-red-200 font-semibold')}>
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                    Quá hạn
                  </Badge>
                )}
                {task.is_archived && (
                  <Badge variant="outline" className={cn(BADGE_BASE, 'bg-slate-100 text-slate-500 border-slate-200')}>
                    Lưu trữ
                  </Badge>
                )}
                {canArchive && (task.status === 'done' || task.status === 'canceled') && (
                  <button
                    onClick={runArchive} disabled={busy !== null}
                    className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-[13px] font-medium text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all active:scale-95"
                  >
                    {task.is_archived ? 'Khôi phục' : 'Lưu trữ'}
                  </button>
                )}
              </div>
            )}

            {/* ─── 2. People List ─── */}
            {isOverallView ? (
              <div className="space-y-2">
                <h3 className="text-[13px] font-semibold text-slate-500 flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  Người thực hiện
                </h3>
                <ul className="space-y-1.5">
                  {sortedChildren.map(child => {
                    const noAssignee = !child.assignees || child.assignees.length === 0;
                    return (
                      <li key={child.id}>
                        <button
                          type="button"
                          onClick={() => { setCurrentChildId(child.id); }}
                          className={cn(
                            'w-full text-left flex items-center gap-3 min-h-12 px-3.5 py-2 rounded-xl border transition-all active:scale-[0.99]',
                            child.is_overdue
                              ? 'border-red-100 bg-red-50/40 hover:bg-red-50'
                              : 'border-slate-100 bg-white hover:bg-slate-50',
                          )}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 shrink-0">
                            <Building2 className={cn('w-4 h-4', child.is_overdue ? 'text-red-500' : 'text-slate-500')} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {child.department?.name ?? '—'}
                            </p>
                            <p className={cn(
                              'text-[13px] truncate flex items-center gap-1',
                              noAssignee ? 'text-amber-600 font-medium' : 'text-slate-500',
                            )}>
                              {noAssignee && <UserPlus className="w-3.5 h-3.5 shrink-0" />}
                              {noAssignee ? 'Chưa phân công' : child.assignees!.map(a => a.full_name).filter(Boolean).join(', ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="px-2.5 py-0.5 text-[12px] font-medium rounded-full border-slate-200">
                              {STATUS_LABEL[child.status]}
                            </Badge>
                            {child.due_date && (
                              <span className={cn(
                                'text-[12px] font-medium inline-flex items-center gap-1',
                                child.is_overdue ? 'text-red-600' : 'text-slate-400',
                              )}>
                                <Calendar className="w-3 h-3" />
                                {format(new Date(child.due_date), 'dd/MM', { locale: vi })}
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : task && task.assignees && task.assignees.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <SelectionPill
                  avatars={task.assignees}
                  countLabel={
                    task.assignees.length === 1
                      ? task.assignees[0].full_name ?? '1 người'
                      : `${task.assignees.length} người`
                  }
                />
                {task.requires_approval && (
                  <span className="text-[13px] text-slate-500 italic ml-auto">
                    Cần duyệt kết quả
                  </span>
                )}
              </div>
            )}

            {/* ─── 3. Info ─── */}
            {!isOverallView && task && (
              <>
                {task.description && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed px-0.5">
                    {task.description}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl">
                  {task.department && (
                    <MetaRow
                      icon={<Building2 className="w-4 h-4 text-amber-500" />}
                      label="Phòng nhận việc"
                      value={task.department.name}
                    />
                  )}
                  <MetaRow
                    icon={<Calendar className={cn('w-4 h-4', dueOverdue ? 'text-red-500' : 'text-slate-500')} />}
                    label="Hạn hoàn thành"
                    value={task.due_date ? format(new Date(task.due_date), 'EEEE, dd/MM/yyyy HH:mm', { locale: vi }) : '—'}
                  />
                  <MetaRow
                    icon={
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={task.creator?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-slate-100 text-[12px] font-semibold">
                          {task.creator?.full_name?.[0] ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                    }
                    label="Người giao"
                    value={task.creator?.full_name ?? '—'}
                  />
                </div>
              </>
            )}

            {/* ─── 4. Actions ─── */}
            {isOverallView ? (
              <div className="flex flex-wrap gap-2">
                {batchCanForceComplete && hasPending && (
                  <PrimaryAction
                    label="Ghi nhận hoàn thành lô"
                    icon={deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    onClick={runForceCompleteBatch} disabled={deleting}
                  />
                )}
                {batchCanDelete && (
                  <SecondaryAction
                    label="Xoá lô"
                    icon={deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    onClick={runDeleteBatch} disabled={deleting}
                  />
                )}
              </div>
            ) : task && !isReadOnly && (
              <div className="flex flex-wrap gap-2">
                {canSubmit && (
                  <PrimaryAction
                    label="Gửi kết quả" tone="primary"
                    icon={<Send className="w-4 h-4" />}
                    onClick={() => setOpenSubmit(true)} disabled={busy !== null}
                  />
                )}
                {canApproveSubmission && (
                  <PrimaryAction
                    label="Duyệt" tone="amber"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    onClick={() => setOpenApprove(true)} disabled={busy !== null}
                  />
                )}
                {canStart && !canSubmit && !canApproveSubmission && (
                  <PrimaryAction
                    label="Bắt đầu" tone="primary"
                    icon={busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    onClick={() => runStatus('doing', 'start', 'Không bắt đầu được')} disabled={busy !== null}
                  />
                )}
                {canMarkDone && !canSubmit && !canApproveSubmission && (
                  <PrimaryAction
                    label="Hoàn thành" tone="primary"
                    icon={busy === 'done' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    onClick={() => runStatus('done', 'done', 'Không hoàn thành được')} disabled={busy !== null}
                  />
                )}
                {canForceComplete && (
                  <PrimaryAction
                    label="Đã nhận" tone="primary"
                    icon={busy === 'forceComplete' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    onClick={runForceComplete} disabled={busy !== null}
                  />
                )}
                {canApproveSubmission && (
                  <SecondaryAction
                    label="Trả về sửa" icon={<Undo2 className="w-4 h-4" />}
                    onClick={() => setOpenReturn(true)} disabled={busy !== null}
                  />
                )}
                {!canApproveSubmission && canReject && (
                  <SecondaryAction
                    label="Trả về" icon={<Undo2 className="w-4 h-4" />}
                    onClick={() => setOpenReturn(true)} disabled={busy !== null}
                  />
                )}
                {canDelegate && (
                  <SecondaryAction
                    label={(task.assignees?.length ?? 0) === 0 ? 'Phân công' : 'Phân công lại'}
                    icon={<UserPlus className="w-4 h-4" />}
                    onClick={() => setOpenDelegate(true)} disabled={busy !== null}
                  />
                )}
                {canRequestExtension && (
                  <SecondaryAction
                    label="Xin gia hạn" icon={<Clock className="w-4 h-4" />}
                    onClick={() => setOpenExtension(true)} disabled={busy !== null}
                  />
                )}
              </div>
            )}

            {/* Done - reopen */}
            {!isOverallView && task && !task.is_archived && task.status === 'done' && canReopen && (
              <div className="flex flex-wrap gap-2">
                <SecondaryAction
                  label="Mở lại để sửa" icon={<RotateCcw className="w-4 h-4" />}
                  onClick={() => setOpenReopen(true)} disabled={busy !== null}
                />
              </div>
            )}

            {/* ─── 5. Comments (detail mode) ─── */}
            {!isOverallView && task && (
              <div className="space-y-3 pt-2">
                <h3 className="text-[13px] font-semibold text-slate-500">Bình luận</h3>
                <TaskCommentList
                  taskId={task.id}
                  comments={task.comments.filter(c => {
                    const systemPatterns = [
                      /đã hoàn thành\.?$/,
                      /trả lại công việc đã hoàn thành\. Lý do:/,
                      /trả về công việc để sửa\. Lý do:/,
                      /đã sửa:/,
                      /^Đã hủy công việc/,
                      /^Đã hoàn thành\.?$/,
                    ];
                    return !c.content.startsWith('[Hệ thống]') && !c.content.startsWith('[sys]')
                      && !systemPatterns.some(r => r.test(c.content));
                  })}
                  canComment={
                    !!currentProfile && canComposeTaskComment(currentProfile, task)
                    && !isReadOnly
                  }
                  task={task}
                />
              </div>
            )}

            {/* ─── 6. Timeline (detail mode) ─── */}
            {!isOverallView && task && (task.extension_requests?.length > 0 || task.comments.some(c =>
              c.content.startsWith('[Hệ thống]') || c.content.startsWith('[sys]')
            )) && (
              <div className="space-y-3 pt-2">
                <h3 className="text-[13px] font-semibold text-slate-500">Lịch sử thay đổi</h3>
                <TaskTimeline task={task} />
              </div>
            )}

          </div>
        </ScrollArea>

        {/* ===== FOOTER ===== */}
        <div className="app-dialog-sheet-footer flex flex-row justify-between items-center gap-3 border-t border-slate-100 p-4">
          <div className="flex items-center gap-1.5">
            {isOverallView && batchCanEdit && (
              <button
                onClick={() => setOpenEdit(true)} disabled={deleting}
                className="h-10 w-10 rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-all active:scale-95"
                title="Sửa lô"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {!isOverallView && canEdit && (
              <button
                onClick={() => setOpenEdit(true)} disabled={busy !== null}
                className="h-10 w-10 rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition-all active:scale-95"
                title="Sửa"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {!isOverallView && canDelete && (
              <button
                onClick={runDelete} disabled={busy !== null}
                className="h-10 w-10 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 flex items-center justify-center transition-all active:scale-95"
                title="Xoá"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOverallView && currentChildId === null && (
              <span className="text-[13px] text-slate-400 font-medium tabular-nums">
                {p.done + p.submitted}/{p.total} hoàn thành
              </span>
            )}
            {!isOverallView && currentChildId && (
              <button
                onClick={() => setCurrentChildId(null)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-[13px] font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                Về danh sách
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="min-h-10 px-5 rounded-xl font-medium text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Sub-dialogs */}
        {openEdit && task && (
          <TaskEditDialog
            task={{ id: task.id, title: task.title, description: task.description, priority: task.priority, due_date: task.due_date, batch_id: task.batch_id }}
            onClose={() => setOpenEdit(false)}
            onChanged={() => { setOpenEdit(false); onChanged?.(); }}
          />
        )}
        {isOverallView && openEdit && rep && (
          <TaskEditDialog
            task={{ id: rep.id, title: rep.title, description: rep.description, priority: rep.priority, due_date: rep.due_date, batch_id: rep.batch_id }}
            onClose={() => setOpenEdit(false)}
            onChanged={() => { setOpenEdit(false); onChanged?.(); }}
          />
        )}
        {openDelegate && task && (
          <TaskDelegateDialog task={task} onClose={() => setOpenDelegate(false)} onChanged={() => { setOpenDelegate(false); onChanged?.(); }} />
        )}
        {openExtension && task && (
          <TaskRequestExtensionDialog task={task} onClose={() => setOpenExtension(false)} onChanged={() => { setOpenExtension(false); onChanged?.(); }} />
        )}
        {openSubmit && task && (
          <TaskSubmitResultDialog task={task} onClose={() => setOpenSubmit(false)} onChanged={() => { setOpenSubmit(false); onChanged?.(); }} />
        )}
        {openReturn && task && (
          <TaskReturnDialog task={task} onClose={() => setOpenReturn(false)} onChanged={() => { setOpenReturn(false); onChanged?.(); }} />
        )}
        {openReopen && task && (
          <TaskReopenDialog task={task} onClose={() => setOpenReopen(false)} onChanged={() => { setOpenReopen(false); onChanged?.(); }} />
        )}
        {openApprove && task && (
          <TaskApproveDialog task={task} onClose={() => setOpenApprove(false)} onChanged={() => { setOpenApprove(false); onChanged?.(); }} />
        )}
        {openApproveExtension && task && (
          <TaskApproveExtensionDialog
            task={task}
            request={openApproveExtension}
            onClose={() => setOpenApproveExtension(null)}
            onChanged={() => { setOpenApproveExtension(null); onChanged?.(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
