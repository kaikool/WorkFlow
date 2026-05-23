// Hook chính module Tasks — gọi RPC tasks_dashboard 1 lần, subscribe realtime, debounce refetch.
// Pattern theo handover/_hooks/useHandover.ts + schedule/_hooks/useSchedule.ts.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type {
  TaskListItem,
  TasksDashboardResult,
  TaskScope,
  DashboardCounts,
  ResourceViewItem,
} from '../_lib/types';

export interface UseTasksDashboardOptions {
  scope?: TaskScope;
  enabled?: boolean;
}

const EMPTY_COUNTS: DashboardCounts = {
  todo: 0,
  doing: 0,
  submitted: 0,
  done: 0,
  canceled: 0,
  overdue: 0,
  awaiting_approval: 0,
  extensions_pending: 0,
};

export function useTasksDashboard(opts: UseTasksDashboardOptions = {}) {
  const supabase = useMemo(() => createClient(), []);
  const scope = opts.scope ?? 'mine';
  const enabled = opts.enabled ?? true;

  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [items, setItems] = useState<TaskListItem[]>([]);
  const [resourceView, setResourceView] = useState<ResourceViewItem[]>([]);
  const [role, setRole] = useState<string>('staff');

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    const { data, error } = await supabase.rpc('tasks_dashboard', {
      p_scope: scope,
      p_filter: {} as any,
    } as any);
    if (error) {
      console.error('tasks_dashboard error:', error);
      return;
    }
    const res = data as unknown as TasksDashboardResult;
    setCounts(res?.counts ?? EMPTY_COUNTS);
    setItems((res?.lists ?? []) as TaskListItem[]);
    setResourceView((res?.resource_view ?? []) as ResourceViewItem[]);
    setRole(res?.role ?? 'staff');
  }, [supabase, scope, enabled]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(refetch, 300);
  }, [refetch]);

  // Initial load
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      setLoading(true);
      await refetch();
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refetch, enabled]);

  // Realtime subscribe — channel chuẩn `tasks_realtime_sync`
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('tasks_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_extension_requests' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, scheduleRefetch, enabled]);

  return {
    loading,
    counts,
    items,
    setItems,
    resourceView,
    role,
    refetch,
    scope,
  };
}
