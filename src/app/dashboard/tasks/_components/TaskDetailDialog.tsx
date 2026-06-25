'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Building2, Calendar, Users, Pencil, Trash2,
  CheckCircle2, Loader2, Play, Send, Undo2, Clock, RotateCcw,
  ChevronRight, Flag, FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  STATUS_LABEL, STATUS_BADGE_CLASS,
  PRIORITY_LABEL, PRIORITY_BADGE_CLASS,
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
import { TaskDueProgress } from './TaskDueProgress';
import type { TaskListItem, TaskStatus } from '../_lib/types';

interface Props {
  isOpen: boolean; setIsOpen: (v: boolean) => void;
  taskId?: string | null; batchId?: string | null; children?: TaskListItem[];
  currentProfile: { id: string; role: string; department_id: string | null } | null;
  onChanged?: () => void; onOpenTask?: (taskId: string) => void;
}

export function TaskDetailDialog(props: Props) {
  const { isOpen, setIsOpen, taskId, batchId, children = [], currentProfile, onChanged, onOpenTask } = props;
  const isBatch = batchId != null && children.length > 0;
  const [childId, setChildId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false); const [busy, setBusy] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelegate, setOpenDelegate] = useState(false); const [openExtension, setOpenExtension] = useState(false);
  const [openSubmit, setOpenSubmit] = useState(false); const [openReturn, setOpenReturn] = useState(false);
  const [openReopen, setOpenReopen] = useState(false); const [openApprove, setOpenApprove] = useState(false);
  const [openApproveExtension, setOpenApproveExtension] = useState<any>(null);

  const activeId = childId ?? taskId ?? null;
  const { loading, task, refetch } = useTaskDetail(isOpen ? activeId : null);
  useEffect(() => { if (task && onChanged) onChanged(); }, [task?.status, task?.updated_at]);
  useEffect(() => { if (isOpen && !isBatch) setChildId(null); }, [isOpen, isBatch]);

  const [cacheCh, setCacheCh] = useState<TaskListItem[]>([]);
  useEffect(() => { if (isOpen && isBatch && children.length > 0) setCacheCh(children); }, [isOpen, isBatch, children]);
  const dc = isOpen ? children : cacheCh; const rep = dc[0]; const p = batchProgress(dc);
  const sorted = useMemo(() => [...dc].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    const sa = ({ todo: 0, doing: 1, submitted: 2, done: 3, canceled: 4 } as any)[a.status] ?? 99;
    const sb = ({ todo: 0, doing: 1, submitted: 2, done: 3, canceled: 4 } as any)[b.status] ?? 99;
    return sa - sb || (a.department?.name ?? '').localeCompare(b.department?.name ?? '');
  }), [dc]);

  // ─── Permissions ───
  const isAss = task && (task.assignees ?? []).some((a: any) => a.id === currentProfile?.id);
  const isSelfApprove = task?.requires_approval && task.assignees?.some((a: any) => a.id === task.created_by);
  const dueOver = !!(task?.due_date && new Date(task.due_date) < new Date() && !['done', 'canceled'].includes(task?.status ?? ''));
  const readOnly = task && (task.is_archived || task.status === 'canceled' || task.status === 'done');
  const canS = isAss && task?.status === 'todo';
  const canD = isAss && task?.status === 'doing' && (!task.requires_approval || isSelfApprove);
  const canSub = isAss && task?.status === 'doing' && task.requires_approval && !isSelfApprove;
  const canApp = task && canApproveTaskResult(currentProfile, task) && task?.status === 'submitted';
  const canRej = task && canRejectSubmission(currentProfile, task);
  const canReop = task && canReopenDone(currentProfile, task);
  const canReq = isAss && task?.status !== 'done' && task?.status !== 'canceled';
  const canDel = task && canDelegateTask(currentProfile, task) && task?.status !== 'done' && task?.status !== 'canceled';
  const canFC = task && canForceCompleteTask(currentProfile, task);
  const canEd = task && canEditTask(currentProfile, task);
  const canDe = task && canDeleteTask(currentProfile, task);
  const bCanEd = rep && canEditTask(currentProfile, rep as any);
  const bCanDe = rep && canDeleteTask(currentProfile, rep as any);
  const bCanFC = rep && canForceCompleteTask(currentProfile, rep as any);
  const pendingC = children.filter(c => c.status !== 'done' && c.status !== 'canceled');

  // ─── Handlers ───
  const st = async (n: string, k: string, e: string) => {
    if (!task) return; setBusy(k); const r = await updateTaskStatus(task.id, n); setBusy(null);
    if (!r.ok) { notifyError(r.error, e); return; } notifySuccess('Đã cập nhật'); onChanged?.();
  };
  const fc = async () => {
    if (!task) return;
    if (!await confirmDialog({ title: 'Ghi nhận hoàn thành?', confirmText: 'Xác nhận', description: 'Đóng công việc dù chưa nộp.' })) return;
    setBusy('fc'); const r = await updateTaskStatus(task.id, 'done', '[sys] Đã hoàn thành.'); setBusy(null);
    if (!r.ok) { notifyError(r.error, 'Lỗi'); return; } notifySuccess('Đã cập nhật'); onChanged?.();
  };
  const del = async () => {
    if (!task) return;
    if (!await confirmDialog({ title: 'Xoá công việc?', confirmText: 'Xoá', danger: true, description: `Xoá "${task.title}"?` })) return;
    setBusy('del'); const r = await deleteTask(task.id); setBusy(null);
    if (!r.ok) { notifyError(r.error, 'Lỗi'); return; } notifySuccess('Đã xoá'); onChanged?.(); setTimeout(() => setIsOpen(false), 100);
  };
  const fcb = async () => {
    if (!await confirmDialog({ title: 'Ghi nhận hoàn thành lô?', confirmText: 'Xác nhận', description: `Đóng ${pendingC.length} việc chưa nộp.` })) return;
    setDeleting(true); let ok = 0, fe: string | undefined;
    for (const c of pendingC) { const r = await updateTaskStatus(c.id, 'done', '[sys] Đã hoàn thành.'); if (r.ok) ok++; else if (!fe) fe = r.error; }
    setDeleting(false);
    if (ok === 0) { notifyError(fe ?? 'Lỗi', 'Lỗi'); return; }
    notifySuccess(`Đã ghi nhận ${ok}/${pendingC.length}`); setIsOpen(false); onChanged?.();
    setTimeout(() => document.body.style.pointerEvents = '', 500);
  };
  const delb = async () => {
    if (!await confirmDialog({ title: 'Xoá lô?', confirmText: 'Xoá lô', danger: true, description: `Xoá ${children.length} việc?` })) return;
    setDeleting(true); let ok = 0, fe: string | undefined;
    for (const c of children) { const r = await deleteTask(c.id); if (r.ok) ok++; else if (!fe) fe = r.error; }
    setDeleting(false);
    if (ok === 0) { notifyError(fe ?? 'Lỗi', 'Lỗi'); return; }
    notifySuccess(`Đã xoá ${ok}/${children.length}`); setIsOpen(false); onChanged?.();
    setTimeout(() => document.body.style.pointerEvents = '', 500);
  };

  if (!isOpen) return null;

  // ─── MODE ───
  const overview = isBatch && !childId;
  const detail = !overview;

  // ─── Header data (giống hệt cho overview và detail) ───
  const hTitle = overview ? (rep?.title ?? '') : (task?.title ?? 'Đang tải…');
  const hBadge = overview
    ? <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-slate-100 text-[13px] font-semibold text-slate-600"><Users className="w-3.5 h-3.5" />{children.length} phòng</span>
    : task?.status
      ? <span className={cn('inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[13px] font-semibold', STATUS_BADGE_CLASS[task.status])}>{STATUS_LABEL[task.status]}</span>
      : null;
  const hMeta = overview
    ? `${rep?.creator?.full_name ?? '—'} giao${rep?.due_date ? ` · Hạn ${format(new Date(rep.due_date), 'dd/MM/yyyy', { locale: vi })}` : ''}`
    : task
      ? `${task.creator?.full_name ?? '—'} giao${task.due_date ? ` · Hạn ${format(new Date(task.due_date), 'dd/MM/yyyy HH:mm', { locale: vi })}` : ''}${dueOver ? ' · Quá hạn' : ''}`
      : '';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent hideCloseButton className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl flex flex-col p-0 gap-0">

        {/* ═══ HEADER ═══ */}
        <DialogHeader className="app-dialog-sheet-header border-b border-slate-100 px-5 py-4 space-y-1.5">
          <div className="flex items-center gap-2">{hBadge}</div>
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="text-[17px] font-bold text-slate-900 leading-tight line-clamp-2">{hTitle}</DialogTitle>
            {((overview && bCanEd) || (detail && canEd)) && (
              <button onClick={() => setOpenEdit(true)}
                className="shrink-0 w-9 h-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-all active:scale-95">
                <Pencil className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>
          {hMeta && <DialogDescription className="text-[13px] text-slate-500">{hMeta}</DialogDescription>}
        </DialogHeader>

        {/* ═══ BODY ═══ */}
        <ScrollArea className="app-dialog-sheet-body">
          <div className="px-5 py-4 space-y-5">

            {/* ─── 1. TIẾN ĐỘ (luôn hiển thị, cùng component) ─── */}
            {overview ? (
              <div className="space-y-3">
                <SectionTitle icon={<Users className="w-4 h-4" />} label="Tiến độ chung" />
                <SegBar done={p.done} sub={p.submitted} doing={p.doing} total={p.total} />
                <div className="grid grid-cols-4 gap-2">
                  <Tile label="Hoàn thành" value={p.done} c="text-emerald-700 bg-emerald-50" />
                  <Tile label="Đã nộp" value={p.submitted} c="text-blue-700 bg-blue-50" />
                  <Tile label="Đang làm" value={p.doing} c="text-amber-700 bg-amber-50" />
                  <Tile label="Chưa làm" value={p.todo} c="text-slate-700 bg-slate-50" />
                </div>
              </div>
            ) : task ? (
              <div className="space-y-3">
                <SectionTitle icon={<Flag className="w-4 h-4" />} label="Tiến độ" />
                <TaskDueProgress createdAt={task.created_at} dueDate={task.due_date} status={task.status} />
                <div className="grid grid-cols-4 gap-2">
                  <Tile label="Hoàn thành" value={task.status === 'done' ? 1 : 0} c={task.status === 'done' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-400 bg-slate-50'} />
                  <Tile label="Đã nộp" value={task.status === 'submitted' ? 1 : 0} c={task.status === 'submitted' ? 'text-blue-700 bg-blue-50' : 'text-slate-400 bg-slate-50'} />
                  <Tile label="Đang làm" value={task.status === 'doing' ? 1 : 0} c={task.status === 'doing' ? 'text-amber-700 bg-amber-50' : 'text-slate-400 bg-slate-50'} />
                  <Tile label="Chưa làm" value={task.status === 'todo' || task.status === 'pending' ? 1 : 0} c={(task.status === 'todo' || task.status === 'pending') ? 'text-slate-700 bg-slate-50' : 'text-slate-400 bg-slate-50'} />
                </div>
              </div>
            ) : loading && <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />}

            {/* ─── 2. NGƯỜI THỰC HIỆN (luôn hiển thị, cùng component) ─── */}
            <div className="space-y-3">
              <SectionTitle icon={<Users className="w-4 h-4" />} label="Người thực hiện" />
              <div className="space-y-1.5">
                {overview ? (
                  sorted.map(c => (
                    <button key={c.id} type="button" onClick={() => setChildId(c.id)}
                      className={cn(
                        'w-full flex items-center gap-3 min-h-[44px] px-3.5 py-2 rounded-xl border transition-all active:scale-[0.99]',
                        c.is_overdue ? 'border-red-100 bg-red-50/40 hover:bg-red-50' : 'border-slate-100 bg-white hover:bg-slate-50',
                      )}>
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Building2 className={cn('w-4 h-4', c.is_overdue ? 'text-red-500' : 'text-slate-500')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{c.department?.name ?? '—'}</p>
                        <p className={cn('text-[13px] truncate', c.is_overdue ? 'text-red-600' : 'text-slate-500')}>
                          {c.assignees?.map((a: any) => a.full_name).filter(Boolean).join(', ') || 'Chưa phân công'}
                        </p>
                      </div>
                      <span className={cn('text-[12px] font-semibold px-2.5 py-0.5 rounded-full border', STATUS_BADGE_CLASS[c.status])}>
                        {STATUS_LABEL[c.status]}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                    </button>
                  ))
                ) : task?.assignees && task.assignees.length > 0 && (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex -space-x-1.5">
                      {task.assignees.slice(0, 4).map((a: any) => (
                        <Avatar key={a.id} className="w-8 h-8 border-2 border-white">
                          <AvatarImage src={a.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[11px] font-semibold bg-slate-200">{a.full_name?.[0] ?? '?'}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {task.assignees.map((a: any) => a.full_name).filter(Boolean).join(', ')}
                      </p>
                      {task.department && <p className="text-[13px] text-slate-500">{task.department.name}</p>}
                    </div>
                    {task.requires_approval && <span className="text-[12px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Cần duyệt</span>}
                  </div>
                )}
              </div>
            </div>

            {/* ─── 3. CHI TIẾT (chỉ hiển thị ở detail mode) ─── */}
            {detail && task && (
              <div className="space-y-3">
                <SectionTitle icon={<FileText className="w-4 h-4" />} label="Chi tiết" />
                {task.description && (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{task.description}</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <InfoCard icon={<Building2 className="w-4 h-4 text-amber-500" />} label="Phòng nhận" value={task.department?.name ?? '—'} />
                  <InfoCard icon={<Calendar className={cn('w-4 h-4', dueOver ? 'text-red-500' : 'text-slate-500')} />} label="Hạn hoàn thành" value={task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy', { locale: vi }) : '—'} />
                  <InfoCard icon={<Avatar className="w-5 h-5"><AvatarImage src={task.creator?.avatar_url ?? undefined} /><AvatarFallback className="text-[9px] font-semibold bg-slate-200">{task.creator?.full_name?.[0] ?? '?'}</AvatarFallback></Avatar>} label="Người giao" value={task.creator?.full_name ?? '—'} />
                </div>
              </div>
            )}

            {/* ─── 4. THAO TÁC (luôn hiển thị, cùng style button) ─── */}
            <div className="flex flex-wrap gap-2 pt-1">
              {overview ? (
                <>
                  {bCanFC && pendingC.length > 0 && <Btn label="Ghi nhận lô" icon={deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} onClick={fcb} disabled={deleting} />}
                  {bCanDe && <Btn label="Xoá lô" icon={<Trash2 className="w-4 h-4" />} onClick={delb} disabled={deleting} secondary />}
                </>
              ) : task && !readOnly && (
                <>
                  {canSub && <Btn label="Gửi kết quả" icon={<Send className="w-4 h-4" />} onClick={() => setOpenSubmit(true)} disabled={busy !== null} />}
                  {canApp && <Btn label="Duyệt" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setOpenApprove(true)} disabled={busy !== null} amber />}
                  {canS && !canSub && !canApp && <Btn label="Bắt đầu" icon={busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} onClick={() => st('doing', 'start', 'Lỗi')} disabled={busy !== null} />}
                  {canD && !canSub && !canApp && <Btn label="Hoàn thành" icon={busy === 'done' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} onClick={() => st('done', 'done', 'Lỗi')} disabled={busy !== null} />}
                  {canFC && <Btn label="Đã nhận" icon={busy === 'fc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} onClick={fc} disabled={busy !== null} />}
                  {canApp && <Btn label="Trả về sửa" icon={<Undo2 className="w-4 h-4" />} onClick={() => setOpenReturn(true)} disabled={busy !== null} secondary />}
                  {!canApp && canRej && <Btn label="Trả về" icon={<Undo2 className="w-4 h-4" />} onClick={() => setOpenReturn(true)} disabled={busy !== null} secondary />}
                  {canDel && <Btn label={(task.assignees?.length ?? 0) === 0 ? 'Phân công' : 'Phân công lại'} icon={<Users className="w-4 h-4" />} onClick={() => setOpenDelegate(true)} disabled={busy !== null} secondary />}
                  {canReq && <Btn label="Xin gia hạn" icon={<Clock className="w-4 h-4" />} onClick={() => setOpenExtension(true)} disabled={busy !== null} secondary />}
                </>
              )}
              {task && !task.is_archived && task.status === 'done' && canReop && (
                <Btn label="Mở lại" icon={<RotateCcw className="w-4 h-4" />} onClick={() => setOpenReopen(true)} disabled={busy !== null} secondary />
              )}
            </div>

            {/* ─── 5. BÌNH LUẬN (chỉ detail mode) ─── */}
            {detail && task && (
              <div className="space-y-3 pt-1">
                <SectionTitle icon={<Calendar className="w-4 h-4" />} label="Bình luận" />
                <TaskCommentList
                  taskId={task.id}
                  comments={task.comments.filter(c => {
                    const p = [/đã hoàn thành\.?$/, /trả lại\. Lý do:/, /trả về để sửa\. Lý do:/, /đã sửa:/, /^Đã hủy/, /^Đã hoàn thành\.?$/];
                    return !c.content.startsWith('[Hệ thống]') && !c.content.startsWith('[sys]') && !p.some(r => r.test(c.content));
                  })}
                  canCompose={!!currentProfile && canComposeTaskComment(currentProfile, task) && !readOnly}
                  onAdded={() => { refetch(); onChanged?.(); }}
                />
              </div>
            )}

            {/* ─── 6. LỊCH SỬ (chỉ detail mode) ─── */}
            {detail && task && (task.extension_requests?.length > 0 || task.comments.some(c => c.content.startsWith('[Hệ thống]') || c.content.startsWith('[sys]'))) && (
              <div className="space-y-3 pt-1">
                <SectionTitle icon={<Clock className="w-4 h-4" />} label="Lịch sử thay đổi" />
                <TaskTimeline task={task} />
              </div>
            )}

          </div>
        </ScrollArea>

        {/* ═══ FOOTER ═══ */}
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {overview && bCanDe && (
              <IconBtn icon={<Trash2 className="w-4 h-4" />} title="Xoá lô" onClick={delb} disabled={deleting} danger />
            )}
            {detail && canDe && (
              <IconBtn icon={<Trash2 className="w-4 h-4" />} title="Xoá" onClick={del} disabled={busy !== null} danger />
            )}
          </div>
          <div className="flex items-center gap-2">
            {overview && (
              <span className="text-[13px] text-slate-400 font-medium tabular-nums">{p.done + p.submitted}/{p.total} hoàn thành</span>
            )}
            {childId && (
              <button onClick={() => setChildId(null)}
                className="h-9 px-3.5 rounded-xl text-[13px] font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all active:scale-95 inline-flex items-center gap-1">
                ← Về danh sách
              </button>
            )}
            <button onClick={() => setIsOpen(false)}
              className="min-h-9 px-4 rounded-xl text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95">Đóng</button>
          </div>
        </div>

        {/* ─── Sub-dialogs ─── */}
        {openEdit && (overview ? rep : task) && (
          <TaskEditDialog task={{
            id: (overview ? rep! : task!).id, title: (overview ? rep! : task!).title,
            description: (overview ? rep! : task!).description ?? null, priority: (overview ? rep! : task!).priority,
            due_date: (overview ? rep! : task!).due_date ?? null, batch_id: (overview ? rep! : task!).batch_id ?? null,
          }} onClose={() => setOpenEdit(false)} onChanged={() => { setOpenEdit(false); onChanged?.(); }} />
        )}
        {openDelegate && task && <TaskDelegateDialog task={task} onClose={() => setOpenDelegate(false)} onChanged={() => { setOpenDelegate(false); onChanged?.(); }} />}
        {openExtension && task && <TaskRequestExtensionDialog task={task} onClose={() => setOpenExtension(false)} onChanged={() => { setOpenExtension(false); onChanged?.(); }} />}
        {openSubmit && task && <TaskSubmitResultDialog task={task} onClose={() => setOpenSubmit(false)} onChanged={() => { setOpenSubmit(false); onChanged?.(); }} />}
        {openReturn && task && <TaskReturnDialog task={task} onClose={() => setOpenReturn(false)} onChanged={() => { setOpenReturn(false); onChanged?.(); }} />}
        {openReopen && task && <TaskReopenDialog task={task} onClose={() => setOpenReopen(false)} onChanged={() => { setOpenReopen(false); onChanged?.(); }} />}
        {openApprove && task && <TaskApproveDialog task={task} onClose={() => setOpenApprove(false)} onChanged={() => { setOpenApprove(false); onChanged?.(); }} />}
        {openApproveExtension && task && <TaskApproveExtensionDialog task={task} request={openApproveExtension} onClose={() => setOpenApproveExtension(null)} onChanged={() => { setOpenApproveExtension(null); onChanged?.(); }} />}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components (dùng chung cho cả dialog) ───
function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h3 className="text-[13px] font-semibold text-slate-500 flex items-center gap-1.5">
      {icon}{label}
    </h3>
  );
}
function Tile({ label, value, c }: { label: string; value: number; c: string }) {
  return <div className={cn('rounded-xl border border-slate-100 px-3 py-2', c.replace(/text-\S+/, '').trim())}>
    <p className={cn('text-lg font-bold tabular-nums', c.match(/text-\S+/g)?.[0])}>{value}</p>
    <p className={cn('text-[12px] font-medium', c.match(/text-\S+/g)?.[1] ?? 'text-slate-500')}>{label}</p>
  </div>;
}
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 truncate">{value}</p>
      </div>
    </div>
  );
}
function SegBar({ done, sub, doing, total }: { done: number; sub: number; doing: number; total: number }) {
  const s = (n: number) => total > 0 ? (n / total) * 100 : 0;
  if (total === 0) return null;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
      {done > 0 && <div className="bg-emerald-500" style={{ width: `${s(done)}%` }} />}
      {sub > 0 && <div className="bg-blue-400" style={{ width: `${s(sub)}%` }} />}
      {doing > 0 && <div className="bg-amber-400" style={{ width: `${s(doing)}%` }} />}
    </div>
  );
}
function Btn({ label, icon, onClick, disabled, secondary, amber }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; secondary?: boolean; amber?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      'inline-flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
      amber ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-sm' : secondary ? 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm',
    )}>{icon}{label}</button>
  );
}
function IconBtn({ icon, title, onClick, disabled, danger }: { icon: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={cn('w-9 h-9 rounded-xl border flex items-center justify-center transition-all active:scale-95 disabled:opacity-50',
        danger ? 'text-red-600 bg-red-50 border-red-100 hover:bg-red-100' : 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100')}>
      {icon}
    </button>
  );
}
