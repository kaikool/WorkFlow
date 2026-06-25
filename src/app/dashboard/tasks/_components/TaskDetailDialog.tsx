'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Users, Pencil, Trash2,
  CheckCircle2, Loader2, Play, Send, Undo2, Clock, RotateCcw,
  ChevronRight, Flag, X, FileText,
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
  canComposeTaskComment,
} from '@/lib/permissions';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { notifyError, notifySuccess } from '@/lib/notify';
import { TaskDueProgress } from './TaskDueProgress';
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
import type { TaskListItem, TaskStatus } from '../_lib/types';

interface Props {
  isOpen: boolean; setIsOpen: (v: boolean) => void;
  taskId?: string | null; batchId?: string | null; children?: TaskListItem[];
  currentProfile: { id: string; role: string; department_id: string | null } | null;
  onChanged?: () => void; onOpenTask?: (taskId: string) => void;
}

const STATUS_ORDER: Record<string, number> = { todo: 0, doing: 1, submitted: 2, done: 3, canceled: 4 };

// ─── Sub-components (Schedule-style) ───
function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
    </div>
  );
}

function ActionBtn({ label, icon, onClick, disabled, amber }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; amber?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      'inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm',
      amber ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-primary text-white hover:bg-primary/90',
    )}>{icon}{label}</button>
  );
}

function SecondaryBtn({ label, icon, onClick, disabled }: {
  label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button onClick={onClick} disabled={disabled} className={cn(
      'inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100',
    )}>{icon}{label}</button>
  );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════
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
  const st = async (n: TaskStatus, k: string, e: string) => {
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

  // Header decoration
  // Dept label: nếu cùng phòng → hiện tên phòng, khác → "X phòng"
  const uniqueDepts = [...new Set(dc.map(c => c.department?.name).filter(Boolean))];
  const deptLabel = uniqueDepts.length === 1 && uniqueDepts[0] ? uniqueDepts[0] : `${dc.length} phòng`;

  const hBadge = ov
    ? <Badge className="bg-white/60 backdrop-blur-md shadow-sm font-bold text-xs px-3 py-1 w-fit text-slate-600">Công việc · {deptLabel}</Badge>
    : task?.status
      ? <Badge className={cn("bg-white/60 backdrop-blur-md shadow-sm font-bold text-xs px-3 py-1 w-fit", STATUS_BADGE_CLASS[task.status])}>{STATUS_LABEL[task.status]}</Badge>
      : null;

  const hTitle = ov ? rep?.title : task?.title ?? 'Đang tải…';
  const hMeta = ov
    ? [{ icon: null, text: deptLabel },
       rep?.creator ? { icon: null, text: rep.creator.full_name } : null,
       rep?.due_date ? { icon: null, text: format(new Date(rep.due_date), 'dd/MM/yyyy', { locale: vi }) } : null,
      ].filter(Boolean)
    : task
      ? [{ icon: null, text: task.creator?.full_name },
         task.due_date ? { icon: null, text: `Hạn ${format(new Date(task.due_date), 'dd/MM/yyyy HH:mm', { locale: vi })}` } : null,
         dueOver ? { icon: null, text: 'Quá hạn', cls: 'text-red-600 font-semibold' } : null,
        ].filter(Boolean)
      : [];

  const canEditAny = ov ? bCanEd : canEd;
  const canDeleteAny = ov ? bCanDe : canDe;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent hideCloseButton className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl flex flex-col p-0 gap-0">
        {/* ═══ HEADER (Schedule-style: tinted bg + blur circle) ═══ */}
        <div className="px-[var(--app-page-x)] py-5 sm:p-6 relative backdrop-blur-xl border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white/60">
          <div className="relative z-10 space-y-2.5 max-w-full">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">{hBadge}</div>
              <div className="flex items-center gap-1">
                {childId && (
                  <button onClick={() => setChildId(null)}
                    className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-600 bg-white/60 backdrop-blur-md hover:bg-white transition-all active:scale-95">
                    ← Quay lại
                  </button>
                )}
                <button onClick={() => setIsOpen(false)}
                  className="h-8 w-8 rounded-lg bg-white/60 backdrop-blur-md hover:bg-white flex items-center justify-center transition-all active:scale-95">
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
            <DialogTitle className="text-lg sm:text-xl font-bold leading-tight text-slate-900 tabular-nums">
              {hTitle}
            </DialogTitle>
            {hMeta.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {hMeta.map((m: any, i: number) => (
                  <span key={i} className={cn("text-sm font-semibold", m.cls ?? 'text-slate-500')}>
                    {m.text}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Blur decoration */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/60 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* ═══ BODY ═══ */}
        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 space-y-5">

            {/* ─── 1. Tiến độ ─── */}
            {!loading && (ov || task) && (
              <div className="space-y-2">
                <SectionLabel icon={<Flag className="w-4 h-4" />} label="Tiến độ" />
                {ov ? (
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <div className="flex h-2 rounded-full overflow-hidden bg-white">
                      {bp.done > 0 && <div className="bg-emerald-500" style={{ width: `${(bp.done / bp.total) * 100}%` }} />}
                      {bp.submitted > 0 && <div className="bg-blue-400" style={{ width: `${(bp.submitted / bp.total) * 100}%` }} />}
                      {bp.doing > 0 && <div className="bg-amber-400" style={{ width: `${(bp.doing / bp.total) * 100}%` }} />}
                    </div>
                    <p className="text-xs font-semibold text-slate-500">
                      {bp.done + bp.submitted}/{bp.total} hoàn thành{bp.doing > 0 ? ` · ${bp.doing} đang làm` : ''}{bp.todo > 0 ? ` · ${bp.todo} chưa làm` : ''}
                    </p>
                  </div>
                ) : task && (
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                    <TaskDueProgress createdAt={task.created_at} dueDate={task.due_date} status={task.status} />
                    {task.priority !== 'medium' && (
                      <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", PRIORITY_BADGE_CLASS[task.priority])}>
                        <Flag className="w-3 h-3" />{PRIORITY_LABEL[task.priority]}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ─── 2. Người thực hiện ─── */}
            <div className="space-y-2">
              <SectionLabel icon={<Users className="w-4 h-4" />} label="Người thực hiện" />
              {ov ? (
                <div className="space-y-1.5">
                  {sorted.map(c => {
                    const noAs = !c.assignees || c.assignees.length === 0;
                    const canFC = canForceCompleteTask(currentProfile, c as any);
                    const canApprove = canApproveTaskResult(currentProfile, c as any);
                    const isTodo = c.status === 'todo';
                    const isDoing = c.status === 'doing';
                    const isSubmitted = c.status === 'submitted';
                    const showQuick = (canFC && (isTodo || isDoing)) || (canApprove && isSubmitted);
                    return (
                      <div key={c.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all',
                          c.is_overdue ? 'border-red-100 bg-red-50/40' : 'border-slate-100 bg-slate-50/40',
                        )}>
                        <button type="button" onClick={() => setChildId(c.id)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <div className="p-2 bg-white rounded-xl shadow-sm shrink-0">
                            <Building2 className={cn('w-4 h-4', c.is_overdue ? 'text-red-500' : 'text-slate-500')} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 truncate">{c.department?.name ?? '—'}</p>
                            <p className={cn('text-xs font-medium', c.is_overdue ? 'text-red-600' : 'text-slate-500')}>
                              {noAs ? 'Chưa phân công' : c.assignees!.map((a: any) => a.full_name).filter(Boolean).join(', ')}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 rounded-full border-slate-200 bg-white shrink-0">
                            {STATUS_LABEL[c.status]}
                          </Badge>
                        </button>
                        {showQuick && (
                          <button
                            onClick={async () => {
                              setBusy(c.id);
                              // todo → phải start trước, rồi mới complete
                              if (isTodo) {
                                const r1 = await updateTaskStatus(c.id, 'doing', '');
                                if (!r1.ok) { setBusy(null); notifyError(r1.error ?? 'Lỗi', 'Lỗi'); return; }
                              }
                              const res = await updateTaskStatus(c.id, 'done', '[sys] Đã hoàn thành.');
                              setBusy(null);
                              if (res.ok) { notifySuccess(`Đã ghi nhận ${c.assignees?.[0]?.full_name ?? ''}`); onChanged?.(); }
                              else notifyError(res.error ?? 'Lỗi', 'Lỗi');
                            }}
                            disabled={busy === c.id}
                            className="shrink-0 w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 flex items-center justify-center transition-all active:scale-90 disabled:opacity-50"
                            title={isSubmitted ? 'Duyệt' : 'Ghi nhận hoàn thành'}
                          >
                            {busy === c.id ? <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : task?.assignees && task.assignees.length > 0 && (
                <div className="bg-slate-50/40 rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-1.5">
                      {task.assignees.slice(0, 5).map((a: any) => (
                        <Avatar key={a.id} className="w-8 h-8 border-2 border-white">
                          <AvatarImage src={a.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px] font-bold bg-slate-200 text-slate-600">{a.full_name?.[0] ?? '?'}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {task.assignees.length > 3
                          ? `${task.assignees.length} người`
                          : task.department?.id === currentProfile?.department_id
                            ? task.assignees.map((a: any) => a.full_name).filter(Boolean).join(', ')
                            : `${task.assignees.map((a: any) => a.full_name).filter(Boolean).join(', ')} · ${task.department?.name ?? ''}`
                        }
                      </p>
                    </div>
                    {task.requires_approval && (
                      <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2 py-0.5">Cần duyệt</Badge>
                    )}
                  </div>
                </div>
              )}
              {!ov && loading && (
                <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              )}
            </div>

            {/* ─── 3. Mô tả ─── */}
            {!ov && task?.description && (
              <div className="space-y-2">
                <SectionLabel icon={<FileText className="w-4 h-4" />} label="Mô tả" />
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-4">
                  {task.description}
                </p>
              </div>
            )}

            {/* ─── 4. Thao tác ─── */}
            {ov ? (
              <div className="flex flex-wrap gap-2">
                {bCanFC && pendC.length > 0 && <ActionBtn label="Ghi nhận hoàn thành lô" icon={deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} onClick={fcb} disabled={deleting} />}
              </div>
            ) : task && !ro && (
              <div className="flex flex-wrap gap-2">
                {canSub && <ActionBtn label="Gửi kết quả" icon={<Send className="w-4 h-4" />} onClick={() => setOpenSub(true)} disabled={busy !== null} />}
                {canAp && <ActionBtn label="Duyệt" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => setOpenApp(true)} disabled={busy !== null} amber />}
                {canS && !canSub && !canAp && <ActionBtn label="Bắt đầu" icon={busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} onClick={() => st('doing', 'start', 'Lỗi')} disabled={busy !== null} />}
                {canD && !canSub && !canAp && <ActionBtn label="Hoàn thành" icon={busy === 'done' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} onClick={() => st('done', 'done', 'Lỗi')} disabled={busy !== null} />}
                {canFC && <ActionBtn label="Đã nhận" icon={busy === 'fc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} onClick={fc} disabled={busy !== null} />}
                {canAp && <SecondaryBtn label="Trả về sửa" icon={<Undo2 className="w-4 h-4" />} onClick={() => setOpenRet(true)} disabled={busy !== null} />}
                {!canAp && canRj && <SecondaryBtn label="Trả về" icon={<Undo2 className="w-4 h-4" />} onClick={() => setOpenRet(true)} disabled={busy !== null} />}
                {canDl && <SecondaryBtn label={(task.assignees?.length ?? 0) === 0 ? 'Phân công' : 'Phân công lại'} icon={<Users className="w-4 h-4" />} onClick={() => setOpenDelegate(true)} disabled={busy !== null} />}
                {canRq && <SecondaryBtn label="Gia hạn" icon={<Clock className="w-4 h-4" />} onClick={() => setOpenExt(true)} disabled={busy !== null} />}
              </div>
            )}
            {!ov && task && !task.is_archived && task.status === 'done' && canRp && (
              <div className="flex flex-wrap gap-2">
                <SecondaryBtn label="Mở lại" icon={<RotateCcw className="w-4 h-4" />} onClick={() => setOpenReo(true)} disabled={busy !== null} />
              </div>
            )}

            {/* ─── 6. Bình luận ─── */}
            {!ov && task && (
              <div className="space-y-2 pt-1">
                <SectionLabel icon={<FileText className="w-4 h-4" />} label="Bình luận" />
                <div>
                  <TaskCommentList
                    taskId={task.id}
                    comments={task.comments.filter(c => {
                      const p = [/đã hoàn thành\.?$/, /trả lại\. Lý do:/, /trả về để sửa\. Lý do:/, /đã sửa:/, /^Đã hủy/, /^Đã hoàn thành\.?$/];
                      return !c.content.startsWith('[Hệ thống]') && !c.content.startsWith('[sys]') && !p.some(r => r.test(c.content));
                    })}
                    canCompose={!!currentProfile && canComposeTaskComment(currentProfile) && !ro}
                    onAdded={() => { refetch(); onChanged?.(); }}
                  />
                </div>
              </div>
            )}

            {/* ─── 7. Lịch sử ─── */}
            {!ov && task && (task.extension_requests?.length > 0 || task.comments.some(c => c.content.startsWith('[Hệ thống]') || c.content.startsWith('[sys]'))) && (
              <div className="space-y-2 pt-1">
                <SectionLabel icon={<Clock className="w-4 h-4" />} label="Lịch sử thay đổi" />
                <TaskTimeline task={task} />
              </div>
            )}

          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <DialogFooter className="app-dialog-sheet-footer flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {canEditAny && (
              <button onClick={() => setOpenEdit(true)}
                className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 flex items-center justify-center transition-all active:scale-95">
                <Pencil className="w-4 h-4 text-slate-500" />
              </button>
            )}
            {canDeleteAny && (
              <button onClick={ov ? delb : del} disabled={ov ? deleting : busy !== null}
                className="h-9 w-9 rounded-xl bg-red-50 border border-red-100 hover:bg-red-100 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50">
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsOpen(false)}
              className="min-h-11 px-5 rounded-xl font-semibold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95 whitespace-nowrap">Đóng cửa sổ</button>
          </div>
        </DialogFooter>

        {/* ─── Sub-dialogs ─── */}
        {openEdit && (ov ? rep : task) && (
          <TaskEditDialog task={{
            id: (ov ? rep! : task!).id, title: (ov ? rep! : task!).title,
            description: (ov ? rep! : task!).description ?? null, priority: (ov ? rep! : task!).priority,
            due_date: (ov ? rep! : task!).due_date ?? null, batch_id: (ov ? rep! : task!).batch_id ?? null,
          }} onClose={() => setOpenEdit(false)} onChanged={() => { setOpenEdit(false); onChanged?.(); }} />
        )}
        {openDelegate && task && <TaskDelegateDialog task={task} currentAssigneeIds={task.assignees?.map((a: any) => a.id) ?? []} onClose={() => setOpenDelegate(false)} onChanged={() => { setOpenDelegate(false); onChanged?.(); }} />}
        {openExt && task && <TaskRequestExtensionDialog task={task} onClose={() => setOpenExt(false)} onChanged={() => { setOpenExt(false); onChanged?.(); }} />}
        {openSub && task && <TaskSubmitResultDialog task={task} onClose={() => setOpenSub(false)} onChanged={() => { setOpenSub(false); onChanged?.(); }} />}
        {openRet && task && <TaskReturnDialog task={task} onClose={() => setOpenRet(false)} onChanged={() => { setOpenRet(false); onChanged?.(); }} />}
        {openReo && task && <TaskReopenDialog task={task} onClose={() => setOpenReo(false)} onChanged={() => { setOpenReo(false); onChanged?.(); }} />}
        {openApp && task && <TaskApproveDialog task={task} onClose={() => setOpenApp(false)} onChanged={() => { setOpenApp(false); onChanged?.(); }} />}
        {openAppExt && task && <TaskApproveExtensionDialog extension={openAppExt} onClose={() => setOpenAppExt(null)} onChanged={() => { setOpenAppExt(null); onChanged?.(); }} />}
      </DialogContent>
    </Dialog>
  );
}
