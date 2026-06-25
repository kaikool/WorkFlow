'use client';

import React from 'react';
import { FileText, AlertTriangle, Calendar, Users } from 'lucide-react';
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
import { TaskDueProgress } from './TaskDueProgress';

interface Props {
  representative: TaskListItem;
  children: TaskListItem[];
  onOpen: () => void;
  currentProfile?: { id: string; role: string; department_id: string | null } | null;
}

const BADGE_BASE = 'px-2 py-0.5 rounded-full';

export const TaskCard = React.memo(function TaskCard({ representative, children, onOpen }: Props) {
  const p = batchProgress(children);
  const multi = children.length > 1;
  const dueLabel = representative.due_date
    ? format(new Date(representative.due_date), 'dd/MM', { locale: vi })
    : null;

  const completed = p.done + p.submitted;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-300 hover:shadow-md active:scale-[0.99] transition-all"
    >
      <div className="p-4 space-y-3">
        {/* Hàng 1: Icon + Title + Badge */}
        <div className="flex items-start gap-2">
          <FileText className="icon-sm text-slate-500 shrink-0 mt-0.5" />
          <p className="heading-card leading-snug flex-1 line-clamp-2">
            {representative.title}
          </p>
          {multi ? (
            <Badge variant="outline" className={cn(BADGE_BASE, 'bg-slate-50 border-slate-200 text-slate-600 shrink-0')}>
              <Users className="icon-sm mr-0.5" />
              {children.length}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={cn(BADGE_BASE, 'shrink-0', STATUS_BADGE_CLASS[representative.status])}
            >
              {STATUS_LABEL[representative.status]}
            </Badge>
          )}
        </div>

        {/* Hàng 2: Progress bar */}
        {multi ? (
          <SegmentedProgressBar progress={p} />
        ) : (
          <TaskDueProgress
            createdAt={representative.created_at}
            dueDate={representative.due_date}
            status={representative.status}
          />
        )}

        {/* Hàng 3: Thông tin batch / single */}
        <div className="flex items-center justify-between text-meta">
          {multi ? (
            <>
              <span className="font-semibold text-slate-700">
                {completed}/{p.total} đã nộp
              </span>
              <span className="text-slate-500">
                {p.doing > 0 && `${p.doing} đang làm`}
                {p.doing > 0 && p.todo > 0 && ' · '}
                {p.todo > 0 && `${p.todo} chưa làm`}
              </span>
            </>
          ) : (
            <>
              <span className="truncate text-slate-600">
                {representative.department?.name ?? '—'}
              </span>
              <span className="truncate text-slate-500">
                {representative.creator?.full_name ?? ''}
              </span>
            </>
          )}
        </div>

        {/* Hàng 4: Badge phụ (overdue, priority) */}
        {(p.overdue > 0 || representative.priority !== 'medium') && (
          <div className="flex flex-wrap items-center gap-1.5">
            {p.overdue > 0 && (
              <Badge className={cn(BADGE_BASE, 'font-semibold bg-red-50 text-red-700 border border-red-200')}>
                <AlertTriangle className="icon-sm mr-1" />
                {p.overdue} quá hạn
              </Badge>
            )}
            {representative.priority !== 'medium' && (
              <Badge variant="outline" className={cn(BADGE_BASE, PRIORITY_BADGE_CLASS[representative.priority])}>
                {PRIORITY_LABEL[representative.priority]}
              </Badge>
            )}
          </div>
        )}

        {/* Hàng 5: Due date */}
        {dueLabel && (
          <div className="flex items-center gap-1 text-meta text-slate-500">
            <Calendar className="icon-sm" />
            <span>Hạn {dueLabel}</span>
          </div>
        )}
      </div>
    </button>
  );
});

function SegmentedProgressBar({ progress }: { progress: ReturnType<typeof batchProgress> }) {
  const { total, done, submitted, doing } = progress;
  const seg = (n: number) => (n / total) * 100;
  if (total === 0) return null;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
      {done > 0 && <div className="bg-emerald-500" style={{ width: `${seg(done)}%` }} />}
      {submitted > 0 && <div className="bg-blue-400" style={{ width: `${seg(submitted)}%` }} />}
      {doing > 0 && <div className="bg-amber-400" style={{ width: `${seg(doing)}%` }} />}
    </div>
  );
}
