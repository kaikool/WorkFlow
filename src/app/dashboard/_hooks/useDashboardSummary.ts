'use client';

// Hook gọi RPC dashboard_summary() — gộp 13 round-trip cũ về 1.
// Realtime hẹp: chỉ subscribe tasks + documents + document_handovers (3 bảng).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import type { DashboardSummary, DashboardCounts } from '../_lib/types';

const EMPTY_COUNTS: DashboardCounts = {
  active: 0,
  urgent: 0,
  overdue: 0,
  done_today: 0,
};

const EMPTY_DATA: DashboardSummary = {
  counts: EMPTY_COUNTS,
  today_tasks: [],
  pending_docs: [],
  role: 'staff',
};

export interface UseDashboardSummaryOptions {
  enabled?: boolean;
}

export function useDashboardSummary(opts: UseDashboardSummaryOptions = {}) {
  const supabase = useMemo(() => createClient(), []);
  const enabled = opts.enabled ?? true;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardSummary>(EMPTY_DATA);

  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!enabled) return;
    const { data: res, error } = await supabase.rpc('dashboard_summary');
    if (error) {
      console.error('dashboard_summary error:', error);
      return;
    }
    const r = res as unknown as DashboardSummary;
    setData({
      counts: r?.counts ?? EMPTY_COUNTS,
      today_tasks: r?.today_tasks ?? [],
      pending_docs: r?.pending_docs ?? [],
      role: r?.role ?? 'staff',
    });
  }, [supabase, enabled]);

  const refetch = useCallback(async () => {
    await fetchSummary();
  }, [fetchSummary]);

  const scheduleRefetch = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(fetchSummary, 300);
  }, [fetchSummary]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    (async () => {
      setLoading(true);
      await fetchSummary();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [fetchSummary, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel('dashboard_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_handovers' }, scheduleRefetch)
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [supabase, scheduleRefetch, enabled]);

  return { loading, data, refetch };
}
