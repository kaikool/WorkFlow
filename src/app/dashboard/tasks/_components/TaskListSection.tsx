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
  onSwipeDone?: (taskId: string) => void;
  canSwipeDone?: boolean;
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

export function TaskListSection({ items, onOpen, onOpenBatch, onSwipeDone, canSwipeDone, currentProfile }: Props) {
  const entries = useMemo(() => groupByBatch(items), [items]);

  const grouped = useMemo(() => {
    const map = new Map<DateGroup, typeof entries>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const entry of entries) {
      const ref = entry.kind === 'batch' ? entry.representative : entry.task;
      const g = classifyTask(ref);
      map.get(g)!.push(entry);
    }
    return map;
  }, [entries]);

  return (
    <div className="space-y-6">
      {GROUP_ORDER.map(group => {
        const list = grouped.get(group) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={group} className="space-y-2">
            <h3 className="text-meta font-bold uppercase tracking-wide px-1">
              {DATE_GROUP_LABEL[group]} ({list.length})
            </h3>
            <div className="space-y-2">
              {list.map(entry => entry.kind === 'batch' ? (
                <BatchTaskCard
                  key={entry.batchId}
                  representative={entry.representative}
                  children={entry.children}
                  onOpen={(id) => onOpenBatch?.(id)}
                />
              ) : (
                <TaskCard
                  key={entry.task.id}
                  task={entry.task}
                  onOpen={onOpen}
                  onSwipeDone={onSwipeDone}
                  canSwipeDone={canSwipeDone}
                  currentProfile={currentProfile}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
