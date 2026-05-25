'use client';

// TaskCard — list item mobile-first. Click → mở dialog detail.
// Hỗ trợ swipe-right để bấm "Done" (optimistic). _pending = đang đồng bộ.

import React, { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar, Flag, Users, CheckCircle2, AlertTriangle, FileText, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
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
  // Swipe-done callback
  onSwipeDone?: (taskId: string) => void;
  canSwipeDone?: boolean;
}

const SWIPE_THRESHOLD = 0.4;

export function TaskCard({ task, onOpen, onSwipeDone, canSwipeDone }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [width, setWidth] = useState(0);
  const draggedRef = useRef(false);

  const isPending = !!task._pending;
  const canSwipe = canSwipeDone && !isPending && !['done', 'canceled'].includes(task.status);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!canSwipe) return;
    startXRef.current = e.touches[0].clientX;
    setWidth(cardRef.current?.offsetWidth ?? 0);
    draggedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current === null) return;
    const delta = e.touches[0].clientX - startXRef.current;
    if (delta > 8) draggedRef.current = true;
    if (delta > 0) setDragOffset(Math.min(delta, width * 0.6));
  };

  const handleTouchEnd = () => {
    if (startXRef.current === null) return;
    const triggered = dragOffset > width * SWIPE_THRESHOLD;
    startXRef.current = null;
    setDragOffset(0);
    if (triggered && onSwipeDone) onSwipeDone(task.id);
  };

  const handleClick = () => {
    // Bỏ qua click nếu vừa swipe (touch end fires click sau)
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    onOpen?.(task.id);
  };

  const TypeIcon = task.task_type === 'report' ? FileText : ListTodo;
  const dueLabel = task.due_date ? format(new Date(task.due_date), 'dd/MM', { locale: vi }) : null;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {canSwipe && dragOffset > 0 && (
        <div
          className="absolute inset-y-0 left-0 flex items-center px-6 bg-emerald-500/90 text-white"
          style={{ width: dragOffset }}
        >
          <CheckCircle2 className="icon-md mr-2" />
          <span className="text-[14px] font-semibold">Hoàn thành</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'w-full text-left bg-white border border-slate-100 rounded-2xl shadow-sm transition-all',
          'hover:border-slate-300 hover:shadow-md active:scale-[0.99]',
          isPending && 'opacity-70',
        )}
      >
        <div
          ref={cardRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="p-4 space-y-3"
          style={{
            transform: `translateX(${dragOffset}px)`,
            transition: dragOffset === 0 ? 'transform 0.2s' : 'none',
          }}
        >
          <div className="flex items-start gap-2">
            <TypeIcon className="icon-sm text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[14px] font-semibold text-slate-900 leading-snug flex-1 line-clamp-2">
              {task.title}
            </p>
            {isPending && (
              <span className="text-[11px] font-medium text-slate-400 animate-pulse shrink-0">
                Đang đồng bộ…
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className={cn('px-2 py-0.5 text-[12px] font-medium rounded-full', STATUS_BADGE_CLASS[task.status])}
            >
              {STATUS_LABEL[task.status]}
            </Badge>

            {task.priority !== 'medium' && (
              <Badge
                variant="outline"
                className={cn('px-2 py-0.5 text-[12px] font-medium rounded-full', PRIORITY_BADGE_CLASS[task.priority])}
              >
                <Flag className="icon-sm mr-0.5" />
                {PRIORITY_LABEL[task.priority]}
              </Badge>
            )}

            {dueLabel && (
              <Badge
                variant="outline"
                className={cn(
                  'px-2 py-0.5 text-[12px] font-medium rounded-full',
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
                className="px-2 py-0.5 text-[12px] font-medium rounded-full bg-white border-slate-200 text-slate-600"
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

          <div className="flex items-center justify-between text-[12px] text-slate-500 font-medium">
            <span className="truncate">{task.department?.name ?? '—'}</span>
            <span className="truncate">{task.creator?.full_name ?? ''}</span>
          </div>
        </div>
      </button>
    </div>
  );
}

