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

const PAGE_SIZE = 50;
const EMPTY_COUNTS: DashboardCounts = {
  todo: 0, doing: 0, submitted: 0, done: 0, canceled: 0,
  overdue: 0, awaiting_approval: 0, extensions_pending: 0,
};

export function useTasksDashboard(opts: UseTasksDashboardOptions = {}) {
  const supabase = useMemo(() => createClient(), []);
  const scope = opts.scope ?? 'mine';
  const enabled = opts.enabled ?? true;

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [counts, setCounts] = useState<DashboardCounts>(EMPTY_COUNTS);
  const [items, setItems] = useState<TaskListItem[]>([]);
  const [resourceView, setResourceView] = useState<ResourceViewItem[]>([]);
  const [role, setRole] = useState<string>('staff');
  const [hasMore, setHasMore] = useState(false);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offsetRef = useRef(0);

  const fetchPage = useCallback(async (reset: boolean) => {
    if (!enabled) return;
    const offset = reset ? 0 : offsetRef.current;
    const { data, error } = await supabase.rpc('tasks_dashboard', {
      p_scope: scope,
      p_filter: {} as any,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    } as any);
    if (error) { console.error('tasks_dashboard error:', error); return; }
    const res = data as unknown as TasksDashboardResult & { has_more: boolean };
    setCounts(res?.counts ?? EMPTY_COUNTS);
    const newItems = (res?.lists ?? []) as TaskListItem[];
    if (reset) {
      setItems(newItems);
    } else {
      setItems(prev => {
        const seen = new Set(prev.map(p => p.id));
        return [...prev, ...newItems.filter(n => !seen.has(n.id))];
      });
    }
    setResourceView((res?.resource_view ?? []) as ResourceViewItem[]);
    setRole(res?.role ?? 'staff');
    setHasMore(!!res?.has_more);
    offsetRef.current = offset + PAGE_SIZE;
  }, [supabase, scope, enabled]);

  const refetch = useCallback(async () => {
    await fetchPage(true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await fetchPage(false);
    setLoadingMore(false);
  }, [fetchPage, loadingMore, hasMore]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(refetch, 300);
  }, [refetch]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      setLoading(true);
      offsetRef.current = 0;
      await fetchPage(true);
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [fetchPage, enabled]);

  useEffect(() => {
    if (!enabled) return;
    // Realtime narrowing: tách INSERT/UPDATE/DELETE — tránh '*' (bao gồm TRUNCATE).
    // task_comments KHÔNG còn invalidate dashboard — comment chỉ ảnh hưởng detail dialog
    // (channel `task_${taskId}` đã tự subscribe). Tiết kiệm refetch khi user comment task khác.
    const channel = supabase
      .channel('tasks_realtime_sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, scheduleRefetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, scheduleRefetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, scheduleRefetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_assignees' }, scheduleRefetch)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'task_assignees' }, scheduleRefetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_extension_requests' }, scheduleRefetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'task_extension_requests' }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, scheduleRefetch, enabled]);

  return {
    loading,
    loadingMore,
    counts,
    items,
    setItems,
    resourceView,
    role,
    refetch,
    loadMore,
    hasMore,
    scope,
  };
}
