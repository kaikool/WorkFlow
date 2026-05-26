'use client';

import React, { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Building2, AlertTriangle, Calendar, UserPlus, Pencil, Trash2, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { TaskEditDialog } from './TaskEditDialog';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { deleteTask, updateTaskStatus } from '../_lib/taskActions';
import { notifyError, notifySuccess } from '@/lib/notify';
import { canEditTask, canDeleteTask, canForceCompleteTask } from '@/lib/permissions';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
} from '../_lib/constants';
import { batchProgress } from '../_lib/batchHelpers';
import type { TaskListItem, TaskStatus } from '../_lib/types';

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  batchId: string | null;
  children: TaskListItem[];
  onOpenTask: (taskId: string) => void;
  currentProfile?: any;
  onChanged?: () => void;
}

const BADGE_BASE = 'px-2 py-0.5 rounded-full';

const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  doing: 1,
  submitted: 2,
  done: 3,
  canceled: 4,
};

export function BatchTaskDetailDialog({ isOpen, setIsOpen, batchId, children, onOpenTask, currentProfile, onChanged }: Props) {
  const [openEdit, setOpenEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);



  const [cachedChildren, setCachedChildren] = React.useState(children);
  const [cachedBatchId, setCachedBatchId] = React.useState(batchId);

  React.useEffect(() => {
    if (isOpen && children.length > 0) {
      setCachedChildren(children);
      setCachedBatchId(batchId);
    }
  }, [isOpen, children, batchId]);

  const displayChildren = isOpen ? children : cachedChildren;
  const displayBatchId = isOpen ? batchId : cachedBatchId;

  const sortedChildren = useMemo(() => {
    return [...displayChildren].sort((a, b) => {
      if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
      const sa = STATUS_ORDER[a.status] ?? 99;
      const sb = STATUS_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return (a.department?.name ?? '').localeCompare(b.department?.name ?? '');
    });
  }, [displayChildren]);

  if (!displayBatchId || displayChildren.length === 0) return null;
  const representative = displayChildren[0];
  const p = batchProgress(displayChildren);

  const canEdit = currentProfile && representative && canEditTask(currentProfile, representative as any);
  const canDelete = currentProfile && representative && canDeleteTask(currentProfile, representative as any);
  const canForceComplete = currentProfile && representative && canForceCompleteTask(currentProfile, representative as any);

  const pendingChildren = children.filter(c => c.status !== 'done' && c.status !== 'canceled');
  const hasPending = pendingChildren.length > 0;

  const runForceCompleteBatch = async () => {
    const ok = await confirmDialog({
      title: 'Xác nhận ghi nhận hoàn thành lô công việc/báo cáo?',
      description: `Bạn có chắc chắn muốn chủ động ghi nhận hoàn thành cho ${pendingChildren.length} công việc chưa nộp trong lô này? Việc này sẽ đóng tất cả công việc.`,
      confirmText: 'Xác nhận',
      variant: 'default',
    });
    if (!ok) return;

    setDeleting(true); // dùng chung state busy cho nhanh
    let okCount = 0;
    let firstError: string | null = null;
    for (const child of pendingChildren) {
      const res = await updateTaskStatus(child.id, 'done', '[Hệ thống] Đã ghi nhận hoàn thành.');
      if (res.ok) okCount += 1;
      else if (!firstError) firstError = res.error;
    }
    setDeleting(false);

    if (okCount === 0) {
      notifyError(firstError ?? 'Lỗi không xác định', 'Không thể ghi nhận hoàn thành');
      return;
    }
    notifySuccess(`Đã ghi nhận hoàn thành ${okCount}/${pendingChildren.length} công việc`);
    setIsOpen(false);
    onChanged?.();
    setTimeout(() => { document.body.style.pointerEvents = ''; }, 500);
  };

  const runDelete = async () => {
    const ok = await confirmDialog({
      title: 'Xoá lô công việc?',
      description: `Bạn có chắc chắn muốn xoá hoàn toàn ${children.length} công việc trong lô này không? Thao tác này không thể hoàn tác.`,
      confirmText: 'Xoá lô',
      variant: 'destructive',
    });
    if (!ok) return;

    setDeleting(true);
    let okCount = 0;
    let firstError: string | null = null;
    for (const child of children) {
      const res = await deleteTask(child.id);
      if (res.ok) okCount += 1;
      else if (!firstError) firstError = res.error;
    }
    setDeleting(false);

    if (okCount === 0) {
      notifyError(firstError ?? 'Lỗi không xác định', 'Không xoá được');
      return;
    }
    notifySuccess(`Đã xoá ${okCount}/${children.length} công việc trong lô`);
    setIsOpen(false);
    onChanged?.();
    
    // Fallback: Xoá khoá màn hình do lỗi Radix Dialog unmount đồng thời với DropdownMenu
    setTimeout(() => { document.body.style.pointerEvents = ''; }, 500);
  };



  const dueLabel = representative.due_date
    ? format(new Date(representative.due_date), 'dd/MM/yyyy', { locale: vi })
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <div className="flex items-start justify-between gap-4 pr-8">
            <div>
              <DialogTitle className="heading-section">{representative.title}</DialogTitle>
              <DialogDescription className="text-subtitle">
                Báo cáo giao {children.length} phòng
                {representative.creator?.full_name && ` · ${representative.creator.full_name} giao`}
                {dueLabel && ` · hạn ${dueLabel}`}
              </DialogDescription>
            </div>
            {(canEdit || canDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full shrink-0 -mt-1 -mr-1" disabled={deleting}>
                    <MoreHorizontal className="icon-md text-slate-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border border-slate-100 z-[9999]">
                  {canEdit && (
                    <DropdownMenuItem onClick={() => setOpenEdit(true)} className="gap-2 py-2 cursor-pointer font-medium">
                      <Pencil className="icon-sm text-slate-500" /> Sửa thông tin lô
                    </DropdownMenuItem>
                  )}
                  {canForceComplete && hasPending && (
                    <DropdownMenuItem onClick={runForceCompleteBatch} className="gap-2 py-2 cursor-pointer font-medium text-primary">
                      <CheckCircle2 className="icon-sm" /> Đã nhận lô
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <DropdownMenuItem 
                      onClick={runDelete} 
                      className="gap-2 py-2 cursor-pointer font-medium text-red-600 focus:text-red-700 focus:bg-red-50"
                    >
                      <Trash2 className="icon-sm" /> Xoá toàn bộ lô
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">

            {/* Hero progress + KPI tiles */}
            <div className="tight-stack">
              <SegmentedProgressBar progress={p} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatTile label="Hoàn thành" value={p.done} tone="emerald" />
                <StatTile label="Đã nộp" value={p.submitted} tone="blue" />
                <StatTile label="Đang làm" value={p.doing} tone="amber" />
                <StatTile label="Chưa làm" value={p.todo} tone="slate" />
              </div>
            </div>

            {/* Overdue callout */}
            {p.overdue > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                <AlertTriangle className="icon-md text-red-600 shrink-0" />
                <p className="text-subtitle font-semibold text-red-700">
                  {p.overdue}/{p.total} phòng đang quá hạn
                </p>
              </div>
            )}

            {/* List theo phòng ban */}
            <div className="tight-stack">
              <p className="text-label text-slate-500 px-1">Theo phòng ban</p>
              <ul className="item-stack">
                {sortedChildren.map(child => {
                  const noAssignee = !child.assignees || child.assignees.length === 0;
                  return (
                    <li key={child.id}>
                      <button
                        type="button"
                        onClick={() => { onOpenTask(child.id); }}
                        className={cn(
                          'w-full text-left flex items-center gap-3 min-h-14 px-3 py-2 rounded-xl border transition-colors',
                          child.is_overdue
                            ? 'border-red-100 bg-red-50/50 hover:bg-red-50'
                            : 'border-slate-100 bg-white hover:bg-slate-50',
                        )}
                      >
                        <Building2 className={cn(
                          'icon-md shrink-0',
                          child.is_overdue ? 'text-red-500' : 'text-slate-400',
                        )} />

                        <div className="min-w-0 flex-1">
                          <p className="heading-card text-slate-900 truncate">
                            {child.department?.name ?? '—'}
                          </p>
                          <p className={cn(
                            'text-meta truncate flex items-center gap-1',
                            noAssignee ? 'text-amber-600 font-medium' : 'text-slate-500',
                          )}>
                            {noAssignee && <UserPlus className="icon-sm shrink-0" />}
                            {noAssignee
                              ? 'Chưa phân công cán bộ'
                              : child.assignees!.map(a => a.full_name).filter(Boolean).join(', ')}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={cn(BADGE_BASE, STATUS_BADGE_CLASS[child.status])}>
                            {STATUS_LABEL[child.status]}
                          </Badge>
                          {child.due_date && (
                            <span className={cn(
                              'text-meta inline-flex items-center gap-1',
                              child.is_overdue ? 'text-red-600 font-semibold' : 'text-slate-500',
                            )}>
                              <Calendar className="icon-sm" />
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
          </div>
        </ScrollArea>
        {openEdit && representative && (
          <TaskEditDialog
            task={{
              id: representative.id,
              title: representative.title,
              description: representative.description,
              priority: representative.priority,
              due_date: representative.due_date,
              batch_id: representative.batch_id,
            }}
            onClose={() => setOpenEdit(false)}
            onChanged={() => { setOpenEdit(false); onChanged?.(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SegmentedProgressBar({ progress }: { progress: ReturnType<typeof batchProgress> }) {
  const { total, done, submitted, doing } = progress;
  const seg = (n: number) => (n / total) * 100;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
      {done > 0 && <div className="bg-emerald-500" style={{ width: `${seg(done)}%` }} />}
      {submitted > 0 && <div className="bg-blue-400" style={{ width: `${seg(submitted)}%` }} />}
      {doing > 0 && <div className="bg-amber-400" style={{ width: `${seg(doing)}%` }} />}
    </div>
  );
}

type Tone = 'emerald' | 'blue' | 'amber' | 'slate';
const TONE_CLASS: Record<Tone, { bg: string; fg: string; label: string }> = {
  emerald: { bg: 'bg-emerald-50 border-emerald-100', fg: 'text-emerald-700', label: 'text-emerald-600' },
  blue:    { bg: 'bg-blue-50 border-blue-100',       fg: 'text-blue-700',    label: 'text-blue-600' },
  amber:   { bg: 'bg-amber-50 border-amber-100',     fg: 'text-amber-700',   label: 'text-amber-600' },
  slate:   { bg: 'bg-slate-50 border-slate-100',     fg: 'text-slate-700',   label: 'text-slate-500' },
};

function StatTile({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  const c = TONE_CLASS[tone];
  return (
    <div className={cn('rounded-xl border px-3 py-2', c.bg)}>
      <p className={cn('heading-section', c.fg)}>{value}</p>
      <p className={cn('text-meta', c.label)}>{label}</p>
    </div>
  );
}
