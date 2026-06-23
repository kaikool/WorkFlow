'use client';

import React, { useMemo } from 'react';
import { TaskCard } from './TaskCard';
import { BatchTaskCard } from './BatchTaskCard';
import { groupByBatch } from '../_lib/batchHelpers';
import type { TaskListItem } from '../_lib/types';
import { DATE_GROUP_LABEL, type DateGroup } from '../_lib/constants';

interface Props {
  items: TaskListItem[];
  onOpen?: (taskId: string) => void;
  onOpenBatch?: (batchId: string) => void;
  currentProfile?: { id: string; role: string; department_id: string | null } | null;
}

function classifyTask(item: TaskListItem): DateGroup {
  if (!item.due_date) return 'no_deadline';
  if (item.is_overdue) return 'overdue';
  const due = new Date(item.due_date);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (dueDay.getTime() === today.getTime()) return 'today';
  const diffDays = (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 0 && diffDays <= 7) return 'this_week';
  return 'later';
}

const GROUP_ORDER: DateGroup[] = ['overdue', 'today', 'this_week', 'later', 'no_deadline'];

export function TaskListSection({ items, onOpen, onOpenBatch, currentProfile }: Props) {
  const entries = useMemo(() => groupByBatch(items), [items]);

  const grouped = useMemo(() => {
    const map = new Map<DateGroup, typeof entries>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const entry of entries) {
      const dateGroup = entry.kind === 'single'
        ? classifyTask(entry.task)
        : classifyTask(entry.representative);
      map.get(dateGroup)?.push(entry);
    }
    return Array.from(map.entries()).filter(([, v]) => v.length > 0);
  }, [entries]);

  return (
    <div className="space-y-6">
      {grouped.map(([group, groupItems]) => (
        <section key={group} className="space-y-3">
          <h3 className="text-[13px] font-bold text-slate-900 px-0.5">{DATE_GROUP_LABEL[group]}</h3>
          <div className="space-y-2">
            {groupItems.map(entry =>
              entry.kind === 'single' ? (
                <TaskCard
                  key={entry.task.id}
                  task={entry.task}
                  onOpen={onOpen}
                  currentProfile={currentProfile}
                />
              ) : (
                <BatchTaskCard
                  key={entry.batchId}
                  representative={entry.representative}
                  children={entry.children}
                  onOpen={onOpenBatch!}
                />
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
