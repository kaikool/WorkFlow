'use client';

import React, { useMemo } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Building2, AlertTriangle, Calendar, UserPlus } from 'lucide-react';
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
}

const BADGE_BASE = 'px-2 py-0.5 rounded-full';

const STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  doing: 1,
  submitted: 2,
  done: 3,
  canceled: 4,
};

export function BatchTaskDetailDialog({ isOpen, setIsOpen, batchId, children, onOpenTask }: Props) {
  if (!isOpen || !batchId || children.length === 0) return null;
  const representative = children[0];
  const p = batchProgress(children);

  const sortedChildren = useMemo(() => {
    return [...children].sort((a, b) => {
      if (a.is_overdue !== b.is_overdue) return a.is_overdue ? -1 : 1;
      const sa = STATUS_ORDER[a.status] ?? 99;
      const sb = STATUS_ORDER[b.status] ?? 99;
      if (sa !== sb) return sa - sb;
      return (a.department?.name ?? '').localeCompare(b.department?.name ?? '');
    });
  }, [children]);

  const dueLabel = representative.due_date
    ? format(new Date(representative.due_date), 'dd/MM/yyyy', { locale: vi })
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section pr-8">{representative.title}</DialogTitle>
          <DialogDescription className="text-subtitle">
            Báo cáo giao {children.length} phòng
            {representative.creator?.full_name && ` · ${representative.creator.full_name} giao`}
            {dueLabel && ` · hạn ${dueLabel}`}
          </DialogDescription>
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
                        onClick={() => { setIsOpen(false); onOpenTask(child.id); }}
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
