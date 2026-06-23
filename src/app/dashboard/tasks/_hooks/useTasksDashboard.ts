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
  todo: 0, doing: 0, submitted: 0, done: 0, canceled: 0,
  overdue: 0, awaiting_approval: 0, extensions_pending: 0,
};

export function useTasksDashboard(opts: UseTasksDashboardOptions = {}) {
  const supabase = useMemo(() => createClient(), []);
  const scope = opts.scope ?? 'mine';
  const enabled = opts.enabled ?? true;

  // loading = lần đầu (show skeleton). refreshing = tab switch (giữ data cũ, refresh ngầm)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [items, setItems] = useState<TaskListItem[]>([]);
  const [resourceView, setResourceView] = useState<ResourceViewItem[]>([]);
  const [role, setRole] = useState<string>('staff');
  const [hasMore, setHasMore] = useState(false);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async (reset: boolean) => {
    if (!enabled) return;
    const { data, error } = await supabase.rpc('tasks_dashboard', {
      p_scope: scope,
    } as any);
    if (error) { console.error('tasks_dashboard error:', error?.message ?? error); setLoading(false); return; }
    const res = data as unknown as TasksDashboardResult;
    setCounts(res?.counts ?? EMPTY_COUNTS);
    const newItems = (res?.lists ?? []) as TaskListItem[];
    setItems(newItems);
    setResourceView((res?.resource_view ?? []) as ResourceViewItem[]);
    setRole(res?.role ?? 'staff');
    setHasMore(false);
  }, [supabase, scope, enabled]);

  const refetch = useCallback(async () => {
    await fetchPage(true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {}, []);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(refetch, 300);
  }, [refetch]);

  // Initial load
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      await fetchPage(true);
      if (active) setLoading(false);
    })().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [enabled]); // eslint-disable-next-line react-hooks/exhaustive-deps

  // Scope change → refresh ngầm, giữ data cũ
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      setRefreshing(true);
      await fetchPage(true);
      if (active) setRefreshing(false);
    })();
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, enabled]);

  // Realtime — gộp event, bỏ extension_requests (detail channel tự xử lý)
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('tasks_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_assignees' }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, scheduleRefetch, enabled]);

  return {
    loading,
    refreshing,
    loadingMore,
    counts,
    items,
    resourceView,
    role,
    refetch,
    loadMore,
    hasMore,
    scope,
  };
}
