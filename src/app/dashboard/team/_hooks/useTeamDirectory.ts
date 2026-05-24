import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { notifyError } from "@/lib/notify";
import { sortProfilesByHierarchy } from "@/lib/utils";

// Hook chính cho /dashboard/team — fetch profiles + schedules hôm nay + OOO active
// để Card có thể compute badge trạng thái. Realtime channel team_realtime_sync
// đẩy refetch nhẹ khi profiles/schedules/out_of_office thay đổi.
export function useTeamDirectory() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<any[]>([]);
  const [oooList, setOooList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(null);
        setMembers([]);
        return;
      }

      const { data: me } = await supabase.from('profiles').select('*, departments (id, name, code)').eq('id', user.id).single();
      setProfile(me);

      // Admin xem được admin khác (debug). Người thường ẩn admin.
      let query = supabase.from('profiles').select('*, departments (id, name, code)').eq('is_active', true);
      if (me?.role !== 'admin') query = query.neq('role', 'admin');
      const { data: profiles, error } = await query;
      if (error) throw error;
      setMembers(sortProfilesByHierarchy(profiles || []));

      // Lịch active hôm nay — để compute badge on_leave/on_trip
      const now = new Date();
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
      const { data: scheds } = await supabase
        .from('schedules')
        .select('id, type, status, created_by, start_time, end_time')
        .in('status', ['approved', 'in_progress'])
        .lte('start_time', endOfDay.toISOString())
        .gte('end_time', startOfDay.toISOString());
      setTodaySchedules(scheds || []);

      // OOO đang active — table có thể chưa tồn tại (pre-Phase 2 migration). Bọc try.
      try {
        const { data: ooos } = await supabase
          .from('out_of_office')
          .select('*')
          .gte('ends_at', now.toISOString());
        setOooList(ooos || []);
      } catch {
        setOooList([]);
      }
    } catch (error) {
      notifyError(error, "Không tải được danh bạ");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchAll();

    let refetchTimer: any = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => fetchAll(), 600);
    };

    const channel = supabase
      .channel('team_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'out_of_office' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchAll, supabase]);

  const oooByUser = useMemo(() => {
    const map = new Map<string, any>();
    for (const o of oooList) map.set(o.user_id, o);
    return map;
  }, [oooList]);

  return { profile, members, todaySchedules, oooByUser, loading, refetch: fetchAll };
}
