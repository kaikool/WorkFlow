'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Building2, Calendar, Users, Pencil, Trash2,
  CheckCircle2, Loader2, Play, Send, Undo2, Clock, RotateCcw,
  ChevronRight, Flag, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  STATUS_LABEL, STATUS_BADGE_CLASS,
  PRIORITY_LABEL, PRIORITY_BADGE_CLASS,
} from '../_lib/constants';
import { batchProgress } from '../_lib/batchHelpers';
import { deleteTask, updateTaskStatus } from '../_lib/taskActions';
import {
  canEditTask, canDeleteTask, canForceCompleteTask,
  canApproveTaskResult, canDelegateTask, canRejectSubmission, canReopenDone,
  canArchiveTask, canComposeTaskComment,
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
import type { TaskListItem } from '../_lib/types';

interface Props {
  isOpen: boolean; setIsOpen: (v: boolean) => void;
  taskId?: string | null; batchId?: string | null; children?: TaskListItem[];
  currentProfile: { id: string; role: string; department_id: string | null } | null;
  onChanged?: () => void; onOpenTask?: (taskId: string) => void;
}

const STATUS_ORDER: Record<string, number> = { todo: 0, doing: 1, submitted: 2, done: 3, canceled: 4 };

export function TaskDetailDialog(props: Props) {
  const { isOpen, setIsOpen, taskId, batchId, children = [], currentProfile, onChanged } = props;
  const isBatch = batchId != null && children.length > 0;
  const [childId, setChildId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false); const [busy, setBusy] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelegate, setOpenDelegate] = useState(false); const [openExt, setOpenExt] = useState(false);
  const [openSub, setOpenSub] = useState(false); const [openRet, setOpenRet] = useState(false);
  const [openReo, setOpenReo] = useState(false); const [openApp, setOpenApp] = useState(false);
  const [openAppExt, setOpenAppExt] = useState<any>(null);

  const activeId = childId ?? taskId ?? null;
  const { loading, task, refetch } = useTaskDetail(isOpen ? activeId : null);
  useEffect(() => { if (task && onChanged) onChanged(); }, [task?.status, task?.updated_at]);
  useEffect(() => { if (isOpen && !isBatch) setChildId(null); }, [isOpen, isBatch]);

  const [cache, setCache] = useState<TaskListItem[]>([]);
  useEffect(() => { if (isOpen && isBatch && children.length > 0) setCache(children); }, [isOpen, isBatch, children]);
  const dc = isOpen ? children : cache; const rep = dc[0]; const bp = batchProgress(dc);
  const sorted = useMemo(() => [...dc].sort((a, b) => {
    if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
    const sa = STATUS_ORDER[a.status] ?? 99, sb = STATUS_ORDER[b.status] ?? 99;
    return sa - sb || (a.department?.name ?? '').localeCompare(b.department?.name ?? '');
  }), [dc]);

  // Permissions
  const isAss = task && (task.assignees ?? []).some((a: any) => a.id === currentProfile?.id);
  const isSelfApprove = task?.requires_approval && task.assignees?.some((a: any) => a.id === task.created_by);
  const dueOver = !!(task?.due_date && new Date(task.due_date) < new Date() && !['done', 'canceled'].includes(task?.status ?? ''));
  const ro = task && (task.is_archived || task.status === 'canceled' || task.status === 'done');
  const canS = isAss && task?.status === 'todo';
  const canD = isAss && task?.status === 'doing' && (!task.requires_approval || isSelfApprove);
  const canSub = isAss && task?.status === 'doing' && task.requires_approval && !isSelfApprove;
  const canAp = task && canApproveTaskResult(currentProfile, task) && task?.status === 'submitted';
  const canRj = task && canRejectSubmission(currentProfile, task);
  const canRp = task && canReopenDone(currentProfile, task);
  const canRq = isAss && task?.status !== 'done' && task?.status !== 'canceled';
  const canDl = task && canDelegateTask(currentProfile, task) && task?.status !== 'done' && task?.status !== 'canceled';
  const canFC = task && canForceCompleteTask(currentProfile, task);
  const canEd = task && canEditTask(currentProfile, task);
  const canDe = task && canDeleteTask(currentProfile, task);
  const bCanEd = rep && canEditTask(currentProfile, rep as any);
  const bCanDe = rep && canDeleteTask(currentProfile, rep as any);
  const bCanFC = rep && canForceCompleteTask(currentProfile, rep as any);
  const pendC = children.filter(c => c.status !== 'done' && c.status !== 'canceled');

  // Handlers
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
    if (!await confirmDialog({ title: 'Ghi nhận lô?', confirmText: 'Xác nhận', description: `Đóng ${pendC.length} việc chưa nộp.` })) return;
    setDeleting(true); let ok = 0, fe: string | undefined;
    for (const c of pendC) { const r = await updateTaskStatus(c.id, 'done', '[sys] Đã hoàn thành.'); if (r.ok) ok++; else if (!fe) fe = r.error; }
    setDeleting(false);
    if (ok === 0) { notifyError(fe ?? 'Lỗi', 'Lỗi'); return; }
    notifySuccess(`Đã ghi nhận ${ok}/${pendC.length}`); setIsOpen(false); onChanged?.();
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

  const ov = isBatch && !childId;
  const detail = !ov;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent hideCloseButton className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl flex flex-col p-0 gap-0 bg-white">

        {/* ─── Navbar ─── */}
        <div className="flex items-center justify-between px-5 h-12 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-1">
            {childId && (
              <button onClick={() => setChildId(null)}
                className="h-9 px-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all -ml-2 inline-flex items-center gap-1">
                ← Quay lại
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {(ov ? bCanEd : canEd) && (
              <button onClick={() => setOpenEdit(true)}
                className="h-9 w-9 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-all">
                <Pencil className="w-[18px] h-[18px] text-slate-500" />
              </button>
            )}
            {(ov ? bCanDe : canDe) && (
              <button onClick={ov ? delb : del} disabled={ov ? deleting : busy !== null}
                className="h-9 w-9 rounded-lg hover:bg-red-50 flex items-center justify-center transition-all">
                <Trash2 className="w-[18px] h-[18px] text-red-500" />
              </button>
            )}
            <button onClick={() => setIsOpen(false)}
              className="h-9 w-9 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-all">
              <X className="w-[18px] h-[18px] text-slate-400" />
            </button>
          </div>
        </div>

        {/* ─── Body ─── */}
        <ScrollArea className="app-dialog-sheet-body">
          <div className="px-5 py-5 space-y-6">

            {/* ─── Header: Title + Meta ─── */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold',
                  ov ? 'bg-slate-100 text-slate-600' : STATUS_BADGE_CLASS[task?.status ?? ''],
                )}>
                  {ov ? `${children.length} phòng` : STATUS_LABEL[task?.status ?? '']}
                </span>
                {detail && task?.priority !== 'medium' && (
                  <span className={cn('inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold', PRIORITY_BADGE_CLASS[task.priority])}>
                    <Flag className="w-3 h-3 mr-1" />{PRIORITY_LABEL[task.priority]}
                  </span>
                )}
                {detail && dueOver && (
                  <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[12px] font-semibold bg-red-50 text-red-600">
                    Quá hạn
                  </span>
                )}
              </div>
              <h2 className="text-[17px] font-semibold text-slate-900 leading-snug">
                {ov ? rep?.title : task?.title ?? 'Đang tải…'}
              </h2>
              <p className="text-[13px] text-slate-500">
                {ov
                  ? `${rep?.creator?.full_name ?? '—'} giao${rep?.due_date ? ` · Hạn ${format(new Date(rep.due_date), 'dd/MM/yyyy', { locale: vi })}` : ''}`
                  : task
                    ? `${task.creator?.full_name ?? '—'} giao${task.due_date ? ` · Hạn ${format(new Date(task.due_date), 'dd/MM/yyyy HH:mm', { locale: vi })}` : ''}`
                    : ''}
              </p>
            </div>

            {/* ─── Progress ─── */}
            {ov ? (
              <div className="space-y-2">
                <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
                  {bp.done > 0 && <div className="bg-emerald-500" style={{ width: `${(bp.done / bp.total) * 100}%` }} />}
                  {bp.submitted > 0 && <div className="bg-blue-400" style={{ width: `${(bp.submitted / bp.total) * 100}%` }} />}
                  {bp.doing > 0 && <div className="bg-amber-400" style={{ width: `${(bp.doing / bp.total) * 100}%` }} />}
                </div>
                <p className="text-[13px] text-slate-500">
                  {bp.done + bp.submitted}/{bp.total} hoàn thành{bp.doing > 0 ? ` · ${bp.doing} đang làm` : ''}{bp.todo > 0 ? ` · ${bp.todo} chưa làm` : ''}
                </p>
              </div>
            ) : task && (
              <div className="space-y-2">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={cn(
                    'h-full rounded-full transition-all',
                    task.status === 'done' ? 'bg-emerald-500 w-full' :
                    task.status === 'submitted' ? 'bg-blue-400 w-3/4' :
                    task.status === 'doing' ? 'bg-amber-400 w-1/2' : 'w-0',
                  )} />
                </div>
                <p className="text-[13px] text-slate-500">
                  {STATUS_LABEL[task.status]} · Hạn {task.due_date ? format(new Date(task.due_date), 'dd/MM', { locale: vi }) : '—'}
                </p>
              </div>
            )}

            {/* ─── People ─── */}
            <div className="space-y-1">
              <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">Người thực hiện</p>
              {ov ? sorted.map(c => (
                <button key={c.id} type="button" onClick={() => setChildId(c.id)}
                  className={cn(
                    'w-full flex items-center gap-3 py-2.5 px-3 -mx-3 rounded-xl transition-all active:scale-[0.99]',
                    c.is_overdue ? 'hover:bg-red-50' : 'hover:bg-slate-50',
                  )}>
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <Building2 className={cn('w-[16px] h-[16px]', c.is_overdue ? 'text-red-500' : 'text-slate-500')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-slate-900 truncate">{c.department?.name ?? '—'}</p>
                    <p className="text-[13px] text-slate-500 truncate">
                      {c.assignees?.map((a: any) => a.full_name).filter(Boolean).join(', ') || 'Chưa phân công'}
                    </p>
                  </div>
                  <span className="text-[12px] font-medium text-slate-500">{STATUS_LABEL[c.status]}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              )) : detail && task?.assignees && task.assignees.length > 0 && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex -space-x-1">
                    {task.assignees.slice(0, 4).map((a: any) => (
                      <Avatar key={a.id} className="w-8 h-8 border-2 border-white">
                        <AvatarImage src={a.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[11px] font-semibold bg-slate-200 text-slate-600">{a.full_name?.[0] ?? '?'}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <div>
                    <p className="text-[15px] font-medium text-slate-900">{task.assignees.map((a: any) => a.full_name).filter(Boolean).join(', ')}</p>
                    {task.department && <p className="text-[13px] text-slate-500">{task.department.name}</p>}
                  </div>
                  {task.requires_approval && (
                    <span className="ml-auto text-[12px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Cần duyệt</span>
                  )}
                </div>
              )}
            </div>

            {/* ─── Description ─── */}
            {detail && task?.description && (
              <p className="text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
            )}

            {/* ─── Info Grid ─── */}
            {detail && task && (
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                {task.department && (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Building2 className="w-4 h-4 text-amber-500" />
                    <span>{task.department.name}</span>
                  </div>
                )}
                <div className={cn('flex items-center gap-1.5', dueOver ? 'text-red-600 font-medium' : 'text-slate-500')}>
                  <Calendar className="w-4 h-4" />
                  <span>Hạn {task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy', { locale: vi }) : '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={task.creator?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px] font-semibold bg-slate-200 text-slate-500">{task.creator?.full_name?.[0] ?? '?'}</AvatarFallback>
                  </Avatar>
                  <span>{task.creator?.full_name ?? '—'} giao</span>
                </div>
              </div>
            )}

            {/* ─── Actions ─── */}
            <div className="flex flex-wrap gap-2 pt-1">
              {ov ? (
                <>
                  {bCanFC && pendC.length > 0 && <ABtn label="Ghi nhận lô" icon={deleting ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <CheckCircle2 className="w-[18px] h-[18px]" />} onClick={fcb} disabled={deleting} />}
                </>
              ) : task && !ro && (
                <>
                  {canSub && <ABtn label="Gửi kết quả" icon={<Send className="w-[18px] h-[18px]" />} onClick={() => setOpenSub(true)} disabled={busy !== null} />}
                  {canAp && <ABtn label="Duyệt" icon={<CheckCircle2 className="w-[18px] h-[18px]" />} onClick={() => setOpenApp(true)} disabled={busy !== null} amber />}
                  {canS && !canSub && !canAp && <ABtn label="Bắt đầu" icon={busy === 'start' ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Play className="w-[18px] h-[18px]" />} onClick={() => st('doing', 'start', 'Lỗi')} disabled={busy !== null} />}
                  {canD && !canSub && !canAp && <ABtn label="Hoàn thành" icon={busy === 'done' ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <CheckCircle2 className="w-[18px] h-[18px]" />} onClick={() => st('done', 'done', 'Lỗi')} disabled={busy !== null} />}
                  {canFC && <ABtn label="Đã nhận" icon={busy === 'fc' ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <CheckCircle2 className="w-[18px] h-[18px]" />} onClick={fc} disabled={busy !== null} />}
                  {canAp && <SBtn label="Trả về sửa" icon={<Undo2 className="w-[18px] h-[18px]" />} onClick={() => setOpenRet(true)} disabled={busy !== null} />}
                  {!canAp && canRj && <SBtn label="Trả về" icon={<Undo2 className="w-[18px] h-[18px]" />} onClick={() => setOpenRet(true)} disabled={busy !== null} />}
                  {canDl && <SBtn label={(task.assignees?.length ?? 0) === 0 ? 'Phân công' : 'Phân công lại'} icon={<Users className="w-[18px] h-[18px]" />} onClick={() => setOpenDelegate(true)} disabled={busy !== null} />}
                  {canRq && <SBtn label="Gia hạn" icon={<Clock className="w-[18px] h-[18px]" />} onClick={() => setOpenExt(true)} disabled={busy !== null} />}
                </>
              )}
              {detail && task && !task.is_archived && task.status === 'done' && canRp && (
                <SBtn label="Mở lại" icon={<RotateCcw className="w-[18px] h-[18px]" />} onClick={() => setOpenReo(true)} disabled={busy !== null} />
              )}
            </div>

            {/* ─── Comments ─── */}
            {detail && task && (
              <div className="space-y-3 pt-2">
                <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">Bình luận</p>
                <div className="-mx-5">
                  <TaskCommentList
                    taskId={task.id}
                    comments={task.comments.filter(c => {
                      const p = [/đã hoàn thành\.?$/, /trả lại\. Lý do:/, /trả về để sửa\. Lý do:/, /đã sửa:/, /^Đã hủy/, /^Đã hoàn thành\.?$/];
                      return !c.content.startsWith('[Hệ thống]') && !c.content.startsWith('[sys]') && !p.some(r => r.test(c.content));
                    })}
                    canCompose={!!currentProfile && canComposeTaskComment(currentProfile, task) && !ro}
                    onAdded={() => { refetch(); onChanged?.(); }}
                  />
                </div>
              </div>
            )}

            {/* ─── Timeline ─── */}
            {detail && task && (task.extension_requests?.length > 0 || task.comments.some(c => c.content.startsWith('[Hệ thống]') || c.content.startsWith('[sys]'))) && (
              <div className="space-y-3 pt-1">
                <p className="text-[12px] font-medium text-slate-400 uppercase tracking-wide">Lịch sử</p>
                <TaskTimeline task={task} />
              </div>
            )}

          </div>
        </ScrollArea>

        {/* Sub-dialogs */}
        {openEdit && (ov ? rep : task) && (
          <TaskEditDialog task={{
            id: (ov ? rep! : task!).id, title: (ov ? rep! : task!).title,
            description: (ov ? rep! : task!).description ?? null, priority: (ov ? rep! : task!).priority,
            due_date: (ov ? rep! : task!).due_date ?? null, batch_id: (ov ? rep! : task!).batch_id ?? null,
          }} onClose={() => setOpenEdit(false)} onChanged={() => { setOpenEdit(false); onChanged?.(); }} />
        )}
        {openDelegate && task && <TaskDelegateDialog task={task} onClose={() => setOpenDelegate(false)} onChanged={() => { setOpenDelegate(false); onChanged?.(); }} />}
        {openExt && task && <TaskRequestExtensionDialog task={task} onClose={() => setOpenExt(false)} onChanged={() => { setOpenExt(false); onChanged?.(); }} />}
        {openSub && task && <TaskSubmitResultDialog task={task} onClose={() => setOpenSub(false)} onChanged={() => { setOpenSub(false); onChanged?.(); }} />}
        {openRet && task && <TaskReturnDialog task={task} onClose={() => setOpenRet(false)} onChanged={() => { setOpenRet(false); onChanged?.(); }} />}
        {openReo && task && <TaskReopenDialog task={task} onClose={() => setOpenReo(false)} onChanged={() => { setOpenReo(false); onChanged?.(); }} />}
        {openApp && task && <TaskApproveDialog task={task} onClose={() => setOpenApp(false)} onChanged={() => { setOpenApp(false); onChanged?.(); }} />}
        {openAppExt && task && <TaskApproveExtensionDialog task={task} request={openAppExt} onClose={() => setOpenAppExt(null)} onChanged={() => { setOpenAppExt(null); onChanged?.(); }} />}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ───
function ABtn({ label, icon, onClick, disabled, amber }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; amber?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      'inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
      amber ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-slate-900 text-white hover:bg-slate-800',
    )}>{icon}{label}</button>
  );
}
function SBtn({ label, icon, onClick, disabled }: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      'inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    )}>{icon}{label}</button>
  );
}
