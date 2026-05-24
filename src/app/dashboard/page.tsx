'use client';

// Dashboard page — chỉ là dispatcher 4 view:
//   - DriverDashboardView (lái xe)
//   - HRDashboardView (nhân sự)
//   - CoordinatorDashboardView (bộ phận điều phối tài nguyên chi nhánh)
//   - DefaultDashboardView (admin/director/manager/staff thường — 90% người dùng)
// Default view gọi RPC dashboard_summary() qua hook nội bộ.
// Legacy schedule data chỉ fetch khi role thực sự cần — KHÔNG còn chạy cho default user.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfDay, endOfWeek, isSameDay, startOfWeek } from 'date-fns';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  canCoordinateSharedResources,
  canUseDriverWorkspace,
  canUseHumanResourcesWorkspace,
} from '@/lib/permissions';
import { fetchCurrentProfile } from '@/lib/fetch-profile';
import DriverDashboardView from './_components/DriverDashboardView';
import HRDashboardView from './_components/HRDashboardView';
import CoordinatorDashboardView from './_components/CoordinatorDashboardView';
import DefaultDashboardView from './_components/DefaultDashboardView';
import { StatsSkeleton, ListSkeleton } from '@/components/ui/list-skeleton';

interface LegacyScheduleState {
  schedules: any[];
  vehicles: any[];
  rooms: any[];
  allProfiles: any[];
  departments: any[];
}

const EMPTY_SCHEDULE: LegacyScheduleState = {
  schedules: [],
  vehicles: [],
  rooms: [],
  allProfiles: [],
  departments: [],
};

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Legacy state — chỉ dùng cho Driver/HR/Coordinator.
  const [scheduleData, setScheduleData] = useState<LegacyScheduleState>(EMPTY_SCHEDULE);
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const selectedDate = new Date();
  const isTodaySelected = isSameDay(selectedDate, new Date());
  const now = new Date();
  const startLimit = 8 * 60;
  const endLimit = 17 * 60;
  const duration = endLimit - startLimit;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimePercent =
    currentMinutes >= startLimit && currentMinutes <= endLimit
      ? ((currentMinutes - startLimit) / duration) * 100
      : -1;

  const needsLegacySchedule = profile
    ? canUseDriverWorkspace(profile)
      || canUseHumanResourcesWorkspace(profile)
      || (canCoordinateSharedResources(profile) && profile.role !== 'admin' && profile.role !== 'director')
    : false;

  // Step 1: fetch profile mỏng.
  useEffect(() => {
    let active = true;
    (async () => {
      const p = await fetchCurrentProfile(supabase);
      if (!active) return;
      setProfile(p);
      setProfileLoading(false);
    })();
    return () => { active = false; };
  }, [supabase]);

  // Step 2: legacy schedule fetch — chỉ chạy khi profile yêu cầu.
  const fetchScheduleDashboardData = async (currentProfile: any) => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = new Date(Math.max(
      endOfWeek(selectedDate, { weekStartsOn: 1 }).getTime(),
      endOfDay(addDays(selectedDate, 3)).getTime(),
    ));
    const canSeePendingQueue = canCoordinateSharedResources(currentProfile);

    const schedulesQuery = supabase
      .from('schedules')
      .select(`*, creator:profiles!schedules_created_by_fkey(full_name, title, avatar_url, department_id, role, is_department_head, departments(name)), room:rooms(name), vehicle:vehicles(name, plate_number), driver:profiles!schedules_driver_id_fkey(id, full_name, title, phone, avatar_url), participants:schedule_participants(profile:profiles(id, full_name, title, avatar_url, role, is_department_head, departments(name)))`)
      .gte('end_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time');

    const pendingQueueQuery = canSeePendingQueue
      ? supabase
          .from('schedules')
          .select(`*, creator:profiles!schedules_created_by_fkey(full_name, title, avatar_url, department_id, role, is_department_head, departments(name)), room:rooms(name), vehicle:vehicles(name, plate_number), driver:profiles!schedules_driver_id_fkey(id, full_name, title, phone, avatar_url), participants:schedule_participants(profile:profiles(id, full_name, title, avatar_url, role, is_department_head, departments(name)))`)
          .or('status.eq.pending,and(use_vehicle.eq.true,vehicle_id.is.null)')
          .order('start_time')
      : Promise.resolve({ data: [] as any[], error: null });

    const [
      { data: scheds, error: scheduleError },
      { data: pendingQueue, error: pendingError },
      { data: vehicles },
      { data: rooms },
      { data: allProfiles },
      { data: departments },
    ] = await Promise.all([
      schedulesQuery,
      pendingQueueQuery,
      supabase.from('vehicles').select('*, default_driver:profiles!vehicles_driver_id_fkey(id, full_name, phone)'),
      supabase.from('rooms').select('*'),
      supabase.from('profiles').select('id, full_name, title, avatar_url, role, department_id, is_department_head, departments(name, code)').neq('role', 'admin'),
      supabase.from('departments').select('*'),
    ]);

    if (scheduleError) throw scheduleError;
    if (pendingError) throw pendingError;

    setScheduleData({
      schedules: [...(scheds || []), ...(pendingQueue || [])].filter((item, index, arr) => (
        arr.findIndex((x: any) => x.id === item.id) === index
      )),
      vehicles: vehicles || [],
      rooms: rooms || [],
      allProfiles: allProfiles || [],
      departments: departments || [],
    });
  };

  useEffect(() => {
    if (!profile || !needsLegacySchedule) return;
    let active = true;
    (async () => {
      setLegacyLoading(true);
      try {
        await fetchScheduleDashboardData(profile);
      } catch (e) {
        console.error('legacy schedule fetch error:', e);
      } finally {
        if (active) setLegacyLoading(false);
      }
    })();

    // Realtime hẹp cho legacy view — chỉ subscribe các bảng liên quan schedule.
    let refetchTimer: any = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => {
        if (active) fetchScheduleDashboardData(profile);
      }, 600);
    };
    const channel = supabase
      .channel('dashboard_legacy_schedule_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_participants' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, scheduleRefetch)
      .subscribe();

    return () => {
      active = false;
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, needsLegacySchedule, supabase]);

  const refetchLegacy = async () => {
    if (!profile) return;
    try {
      await fetchScheduleDashboardData(profile);
    } catch (e) {
      console.error(e);
    }
  };

  const sendNotifications = async (rows: any[]) => {
    const uniqueRows = rows.filter((row, index, arr) =>
      row?.user_id && arr.findIndex(item =>
        item.user_id === row.user_id
        && item.title === row.title
        && item.content === row.content
        && item.link === row.link,
      ) === index,
    );
    if (uniqueRows.length === 0) return;
    const { error } = await supabase.from('notifications').insert(uniqueRows);
    if (error) console.error('Notification insert failed:', error);
  };

  const handleSelectSchedule = (schedule: any) => {
    setSelectedSchedule(schedule);
    setIsDetailOpen(true);
  };

  const handleUpdateEndTime = async (id: string, newEndTimeStr: string) => {
    try {
      const { error } = await supabase
        .from('schedules')
        .update({ end_time: new Date(newEndTimeStr).toISOString() })
        .eq('id', id);
      if (error) throw error;
      notifySuccess('Đã cập nhật thời gian kết thúc');
      refetchLegacy();
    } catch (error) {
      notifyError(error, 'Không cập nhật được thời gian kết thúc');
    }
  };

  const handleUpdateSchedule = async (id: string, updates: any) => {
    try {
      const { participant_ids, ...scheduleUpdates } = updates;
      const { error } = await supabase.from('schedules').update(scheduleUpdates).eq('id', id);
      if (error) throw error;

      if (Array.isArray(participant_ids)) {
        const schedule = scheduleData.schedules.find(s => s.id === id);
        const finalParticipantIds = Array.from(
          new Set([schedule?.created_by, ...participant_ids].filter(Boolean)),
        );
        const { error: deleteError } = await supabase
          .from('schedule_participants')
          .delete()
          .eq('schedule_id', id);
        if (deleteError) throw deleteError;
        if (finalParticipantIds.length > 0) {
          const { error: insertError } = await supabase.from('schedule_participants').insert(
            finalParticipantIds.map((uid: string) => ({ schedule_id: id, profile_id: uid })),
          );
          if (insertError) throw insertError;
        }
      }

      notifySuccess('Đã cập nhật lịch trình');
      setIsDetailOpen(false);
      refetchLegacy();
    } catch (error) {
      notifyError(error, 'Không cập nhật được lịch trình');
    }
  };

  const handleAssignVehicle = async (id: string, vehicleId: string | null, driverId: string | null) => {
    try {
      const schedule = scheduleData.schedules.find(s => s.id === id);
      const { error } = await supabase
        .from('schedules')
        .update({ vehicle_id: vehicleId, driver_id: driverId, status: vehicleId ? 'approved' : 'pending' })
        .eq('id', id);
      if (error) throw error;

      if (vehicleId && driverId && schedule) {
        const vehicle = scheduleData.vehicles.find(v => v.id === vehicleId);
        await sendNotifications([{
          user_id: driverId,
          title: 'Bạn được phân công lịch chạy xe',
          content: `Bạn được phân công điều khiển xe ${vehicle?.name || ''} (${vehicle?.plate_number || ''}) cho chuyến: "${schedule.title}".`,
          link: '/dashboard/schedule',
        }]);
      }

      notifySuccess(vehicleId ? 'Đã gán xe và tài xế' : 'Đã huỷ gán xe');
      setIsDetailOpen(false);
      refetchLegacy();
    } catch (error) {
      notifyError(error, 'Không gán được xe');
    }
  };

  // Render: chờ profile xong rồi mới quyết định view.
  if (profileLoading) {
    return (
      <div className="page-container section-stack py-6">
        <StatsSkeleton count={3} />
        <ListSkeleton variant="card" rows={3} />
      </div>
    );
  }

  if (canUseDriverWorkspace(profile)) {
    if (legacyLoading) {
      return (
        <div className="page-container section-stack py-6">
          <StatsSkeleton count={3} />
          <ListSkeleton variant="card" rows={3} />
        </div>
      );
    }
    return (
      <DriverDashboardView
        profile={profile}
        schedules={scheduleData.schedules}
        fetchData={refetchLegacy}
        toast={toast}
      />
    );
  }

  if (canUseHumanResourcesWorkspace(profile)) {
    if (legacyLoading) {
      return (
        <div className="page-container section-stack py-6">
          <StatsSkeleton count={3} />
          <ListSkeleton variant="card" rows={3} />
        </div>
      );
    }
    return (
      <HRDashboardView
        schedules={scheduleData.schedules}
        allProfiles={scheduleData.allProfiles}
      />
    );
  }

  const isResourcesManagerDashboard =
    canCoordinateSharedResources(profile)
    && profile?.role !== 'admin'
    && profile?.role !== 'director';
  if (isResourcesManagerDashboard) {
    if (legacyLoading) {
      return (
        <div className="page-container section-stack py-6">
          <StatsSkeleton count={3} />
          <ListSkeleton variant="card" rows={3} />
        </div>
      );
    }
    return (
      <CoordinatorDashboardView
        profile={profile}
        schedules={scheduleData.schedules}
        vehicles={scheduleData.vehicles}
        rooms={scheduleData.rooms}
        allProfiles={scheduleData.allProfiles}
        departments={scheduleData.departments}
        selectedDate={selectedDate}
        isTodaySelected={isTodaySelected}
        currentTimePercent={currentTimePercent}
        startLimit={startLimit}
        duration={duration}
        timelineContainerRef={timelineContainerRef}
        selectedSchedule={selectedSchedule}
        isDetailOpen={isDetailOpen}
        setIsDetailOpen={setIsDetailOpen}
        handleSelectSchedule={handleSelectSchedule}
        handleAssignVehicle={handleAssignVehicle}
        handleUpdateEndTime={handleUpdateEndTime}
        handleUpdateSchedule={handleUpdateSchedule}
      />
    );
  }

  // Default view cho admin/director/manager/staff thường — KHÔNG fetch legacy schedule.
  return <DefaultDashboardView profile={profile} />;
}
