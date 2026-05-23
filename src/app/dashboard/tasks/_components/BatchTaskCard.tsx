'use client';

import React from 'react';
import { FileText, ListTodo, AlertTriangle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import type { TaskListItem } from '../_lib/types';

interface Props {
  representative: TaskListItem;
  children: TaskListItem[];
  onOpen: (batchId: string) => void;
}

export function BatchTaskCard({ representative, children, onOpen }: Props) {
  const p = batchProgress(children);
  const TypeIcon = representative.task_type === 'report' ? FileText : ListTodo;
  const dueLabel = representative.due_date
    ? format(new Date(representative.due_date), 'dd/MM', { locale: vi })
    : null;

  return (
    <button
      type="button"
      onClick={() => representative.batch_id && onOpen(representative.batch_id)}
      className="w-full text-left bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-300 hover:shadow-md active:scale-[0.99] transition-all"
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <TypeIcon className="icon-sm text-slate-400 shrink-0 mt-0.5" />
          <p className="text-subtitle font-semibold text-slate-900 leading-snug flex-1 line-clamp-2">
            {representative.title}
          </p>
          <Badge variant="outline" className="rounded-full px-2 py-0.5 font-medium bg-slate-50 border-slate-200 text-slate-600 shrink-0">
            {children.length} phòng
          </Badge>
        </div>

        <SegmentedProgressBar progress={p} />

        <div className="flex flex-wrap items-center gap-1.5">
          {p.done > 0 && (
            <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_BADGE_CLASS.done)}>
              {p.done} {STATUS_LABEL.done}
            </Badge>
          )}
          {p.submitted > 0 && (
            <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_BADGE_CLASS.submitted)}>
              {p.submitted} {STATUS_LABEL.submitted}
            </Badge>
          )}
          {p.doing > 0 && (
            <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_BADGE_CLASS.doing)}>
              {p.doing} {STATUS_LABEL.doing}
            </Badge>
          )}
          {p.todo > 0 && (
            <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_BADGE_CLASS.todo)}>
              {p.todo} chưa làm
            </Badge>
          )}
          {representative.priority !== 'medium' && (
            <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 font-medium', PRIORITY_BADGE_CLASS[representative.priority])}>
              {PRIORITY_LABEL[representative.priority]}
            </Badge>
          )}
          {p.overdue > 0 && (
            <Badge className="rounded-full px-2 py-0.5 font-semibold bg-red-50 text-red-700 border border-red-200">
              <AlertTriangle className="icon-sm mr-1" />
              {p.overdue} quá hạn
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-meta font-medium">
          <span className="truncate">
            {representative.creator?.full_name ?? '—'} giao
          </span>
          {dueLabel && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="icon-sm" />
              {dueLabel}
            </span>
          )}
        </div>
      </div>
    </button>
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
