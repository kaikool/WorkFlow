'use client';

// TaskCard — list item mobile-first. Click → mở dialog detail.
// Công việc đang chờ duyệt hiển thị dot đỏ "Chờ bạn duyệt" cho TP/BGĐ.

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar, Flag, Users, AlertTriangle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { canApproveTaskResult } from '@/lib/permissions';
import {
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
  PRIORITY_LABEL,
  PRIORITY_BADGE_CLASS,
} from '../_lib/constants';
import type { TaskListItem } from '../_lib/types';
import { TaskDueProgress } from './TaskDueProgress';

interface Props {
  task: TaskListItem;
  // Click card → mở dialog detail
  onOpen?: (taskId: string) => void;
  // Để chấm dot "Chờ bạn duyệt"
  currentProfile?: { id: string; role: string; department_id: string | null } | null;
}

export const TaskCard = React.memo(function TaskCard({ task, onOpen, currentProfile }: Props) {
  const isPending = !!task._pending;

  // Công việc đang chờ user (TP/BGĐ) duyệt — show dot đỏ + label nhỏ
  const isPendingApprove =
    task.status === 'submitted'
    && task.requires_approval
    && canApproveTaskResult(currentProfile ?? null, task);

  const handleClick = () => {
    onOpen?.(task.id);
  };

  const dueLabel = task.due_date ? format(new Date(task.due_date), 'dd/MM', { locale: vi }) : null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full text-left bg-white border border-slate-100 rounded-2xl shadow-sm transition-all',
        'hover:border-slate-300 hover:shadow-md active:scale-[0.99]',
        isPending && 'opacity-70',
      )}
    >
      <div className="p-4 item-stack">
        <div className="flex items-start gap-2">
          <div className="relative shrink-0">
            <FileText className="icon-sm text-slate-500 mt-0.5" />
            {isPendingApprove && (
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"
                aria-label="Chờ bạn duyệt"
              />
            )}
          </div>
          <p className="text-sm font-semibold text-slate-900 leading-snug flex-1 line-clamp-2">
            {task.title}
          </p>
          {isPending && (
            <span className="text-xs font-medium text-slate-500 animate-pulse shrink-0">
              Đang đồng bộ…
            </span>
          )}
        </div>

        {isPendingApprove && (
          <p className="text-xs font-semibold text-red-600">
            Chờ bạn duyệt
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn('px-2 py-0.5 text-xs font-medium rounded-full', STATUS_BADGE_CLASS[task.status])}
          >
            {STATUS_LABEL[task.status]}
          </Badge>

          {task.priority !== 'medium' && (
            <Badge
              variant="outline"
              className={cn('px-2 py-0.5 text-xs font-medium rounded-full', PRIORITY_BADGE_CLASS[task.priority])}
            >
              <Flag className="icon-sm mr-0.5" />
              {PRIORITY_LABEL[task.priority]}
            </Badge>
          )}

          {dueLabel && (
            <Badge
              variant="outline"
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full',
                task.is_overdue ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-600',
              )}
            >
              {task.is_overdue && <AlertTriangle className="icon-sm mr-0.5" />}
              <Calendar className="icon-sm mr-0.5" />
              {dueLabel}
            </Badge>
          )}

          {task.assignees && task.assignees.length > 0 && (
            <Badge
              variant="outline"
              className="px-2 py-0.5 text-xs font-medium rounded-full bg-white border-slate-200 text-slate-600"
            >
              <Users className="icon-sm mr-0.5" />
              {task.assignees.length}
            </Badge>
          )}
        </div>

        <TaskDueProgress
          createdAt={task.created_at}
          dueDate={task.due_date}
          status={task.status}
        />

        <div className="flex items-center justify-between text-label">
          <span className="truncate">{task.department?.name ?? '—'}</span>
          <span className="truncate">{task.creator?.full_name ?? ''}</span>
        </div>
      </div>
    </button>
  );
});
