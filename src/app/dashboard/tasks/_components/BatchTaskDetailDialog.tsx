'use client';

import React from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Building2, AlertTriangle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
} from '../_lib/constants';
import { batchProgress } from '../_lib/batchHelpers';
import type { TaskListItem } from '../_lib/types';

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  batchId: string | null;
  children: TaskListItem[];
  onOpenTask: (taskId: string) => void;
}

export function BatchTaskDetailDialog({ isOpen, setIsOpen, batchId, children, onOpenTask }: Props) {
  if (!isOpen || !batchId || children.length === 0) return null;
  const representative = children[0];
  const p = batchProgress(children);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section pr-8">{representative.title}</DialogTitle>
          <DialogDescription className="text-subtitle">
            {children.length} phòng/người · {p.done} xong · {p.submitted} đã nộp · {p.doing} đang làm · {p.todo} chưa làm
            {p.overdue > 0 && ` · ${p.overdue} quá hạn`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4">
            <ul className="item-stack">
              {children.map(child => (
                <li key={child.id}>
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); onOpenTask(child.id); }}
                    className={cn(
                      'w-full text-left flex items-center gap-3 min-h-14 px-3 py-2 rounded-xl border transition-all',
                      child.is_overdue
                        ? 'border-red-200 bg-red-50/40 hover:bg-red-50'
                        : 'border-slate-100 bg-white hover:bg-slate-50',
                    )}
                  >
                    <Building2 className={cn('icon-md shrink-0',
                      child.is_overdue ? 'text-red-500' : 'text-slate-400')} />
                    <div className="min-w-0 flex-1">
                      <p className="text-subtitle font-semibold text-slate-900 truncate">
                        {child.department?.name ?? '—'}
                      </p>
                      <p className="text-meta truncate">
                        {child.assignees && child.assignees.length > 0
                          ? child.assignees.map(a => a.full_name).filter(Boolean).join(', ')
                          : 'Chưa phân công'}
                      </p>
                    </div>

                    {child.is_overdue && (
                      <Badge className="rounded-full px-2 py-0.5 font-semibold bg-red-100 text-red-700 border-red-200 shrink-0">
                        <AlertTriangle className="icon-sm mr-1" />
                        Quá hạn
                      </Badge>
                    )}
                    <Badge variant="outline" className={cn(
                      'rounded-full px-2 py-0.5 font-medium shrink-0',
                      STATUS_BADGE_CLASS[child.status],
                    )}>
                      {STATUS_LABEL[child.status]}
                    </Badge>

                    {child.due_date && (
                      <span className="text-meta inline-flex items-center gap-1 shrink-0">
                        <Calendar className="icon-sm" />
                        {format(new Date(child.due_date), 'dd/MM', { locale: vi })}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
