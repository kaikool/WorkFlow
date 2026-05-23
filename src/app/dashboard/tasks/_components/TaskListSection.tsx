'use client';

// TaskListSection — group tasks theo nhóm thời gian (Quá hạn / Hôm nay / Tuần này / Sau / Không hạn).
// Render heading + list TaskCard.

import React, { useMemo } from 'react';
import { TaskCard } from './TaskCard';
import type { TaskListItem } from '../_lib/types';
import { DATE_GROUP_LABEL, type DateGroup } from '../_lib/constants';

interface Props {
  items: TaskListItem[];
  onOpen?: (taskId: string) => void;
  onSwipeDone?: (taskId: string) => void;
  canSwipeDone?: boolean;
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

export function TaskListSection({ items, onOpen, onSwipeDone, canSwipeDone }: Props) {
  const grouped = useMemo(() => {
    const map = new Map<DateGroup, TaskListItem[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const item of items) {
      const g = classifyTask(item);
      map.get(g)!.push(item);
    }
    return map;
  }, [items]);

  return (
    <div className="space-y-6">
      {GROUP_ORDER.map(group => {
        const list = grouped.get(group) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={group} className="space-y-2">
            <h3 className="text-[12px] font-bold uppercase tracking-wide text-slate-500 px-1">
              {DATE_GROUP_LABEL[group]} ({list.length})
            </h3>
            <div className="space-y-2">
              {list.map(item => (
                <TaskCard
                  key={item.id}
                  task={item}
                  onOpen={onOpen}
                  onSwipeDone={onSwipeDone}
                  canSwipeDone={canSwipeDone}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
