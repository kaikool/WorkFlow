'use client'

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from "react";
import {
  Loader2,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { addDays, endOfDay, endOfWeek, isSameDay, startOfWeek } from "date-fns";
import { canCoordinateSharedResources, canUseDriverWorkspace, canUseHumanResourcesWorkspace } from "@/lib/permissions";
import QuickStats from "./_components/QuickStats";
import TaskOverview from "./_components/TaskOverview";
import DriverDashboardView from "./_components/DriverDashboardView";
import HRDashboardView from "./_components/HRDashboardView";
import TCTHDashboardView from "./_components/TCTHDashboardView";
import { StatsSkeleton, ListSkeleton } from "@/components/ui/list-skeleton";

const INSPIRATIONAL_QUOTES = [
  "Hôm nay là cơ hội để bạn bứt phá chỉ tiêu kinh doanh.",
  "Kiên trì nỗ lực, gặt hái kết quả xứng tầm.",
  "Làm việc chuyên nghiệp, kiến tạo giá trị bền vững.",
  "Mỗi con số đều minh chứng cho sự nỗ lực không ngừng.",
  "Chinh phục kế hoạch, khẳng định vị thế cán bộ.",
  "Năng lượng mới cho những thành công mới hôm nay.",
  "Tập trung tối đa để mang lại giá trị tốt nhất cho khách hàng."
];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [quote, setQuote] = useState("");
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [stats, setStats] = useState({
    productivity: 0,
    productivityChange: 0,
    activeTasks: 0,
    urgentTasks: 0,
    completedTasks: 0,
    kpiProgress: 0,
    kpiCount: 0,
    topKpi: null as any,
    recentTasks: [] as any[],
    totalAssigned: 0,
    totalCompleted: 0,
    totalLate: 0
  });
  const [scheduleData, setScheduleData] = useState({
    schedules: [] as any[],
    vehicles: [] as any[],
    rooms: [] as any[],
    allProfiles: [] as any[],
    departments: [] as any[]
  });
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const selectedDate = new Date();
  const isTodaySelected = isSameDay(selectedDate, new Date());
  const now = new Date();
  const startLimit = 8 * 60;
  const endLimit = 17 * 60;
  const duration = endLimit - startLimit;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimePercent = currentMinutes >= startLimit && currentMinutes <= endLimit
    ? ((currentMinutes - startLimit) / duration) * 100
    : -1;

  useEffect(() => {
    fetchDashboardData();
    setQuote(INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)]);

    // Real-time có debounce để tránh refetch ồ ạt
    let refetchTimer: any = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => { fetchDashboardData(); }, 600);
    };
    const channel = supabase
      .channel('dashboard_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kpis' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recognitions' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_participants' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const sendNotifications = async (rows: any[]) => {
    const uniqueRows = rows.filter((row, index, arr) =>
      row?.user_id && arr.findIndex(item =>
        item.user_id === row.user_id &&
        item.title === row.title &&
        item.content === row.content &&
        item.link === row.link
      ) === index
    );
    if (uniqueRows.length === 0) return;
    const { error } = await supabase.from('notifications').insert(uniqueRows);
    if (error) console.error('Notification insert failed:', error);
  };

  const fetchScheduleDashboardData = async (currentProfile: any) => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = new Date(Math.max(
      endOfWeek(selectedDate, { weekStartsOn: 1 }).getTime(),
      endOfDay(addDays(selectedDate, 3)).getTime()
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
      { data: departments }
    ] = await Promise.all([
      schedulesQuery,
      pendingQueueQuery,
      supabase.from('vehicles').select('*, default_driver:profiles!vehicles_driver_id_fkey(id, full_name, phone)'),
      supabase.from('rooms').select('*'),
      supabase.from('profiles').select('id, full_name, title, avatar_url, role, department_id, is_department_head, departments(name, code)'),
      supabase.from('departments').select('*')
    ]);

    if (scheduleError) throw scheduleError;
    if (pendingError) throw pendingError;

    setScheduleData({
      schedules: [...(scheds || []), ...(pendingQueue || [])].filter((item, index, arr) => (
        arr.findIndex(x => x.id === item.id) === index
      )),
      vehicles: vehicles || [],
      rooms: rooms || [],
      allProfiles: allProfiles || [],
      departments: departments || []
    });
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: currentProfile } = await supabase.from('profiles').select('*, departments(name, code)').eq('id', user.id).single();
      setProfile(currentProfile);

      const isHrDashboard = canUseHumanResourcesWorkspace(currentProfile);
      const isTcthDashboard = canCoordinateSharedResources(currentProfile) && currentProfile?.role !== 'admin' && currentProfile?.role !== 'director';
      if (canUseDriverWorkspace(currentProfile) || isTcthDashboard || isHrDashboard) {
        await fetchScheduleDashboardData(currentProfile);
        setLoading(false);
        return;
      }

      const isPowerUser = currentProfile?.role === 'admin' || currentProfile?.role === 'director';

      let activeQuery = supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done');
      let urgentQuery = supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done').eq('priority', 'high');
      let completedQuery = supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'done');

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

      let thisWeekQuery = supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'done').gte('created_at', sevenDaysAgo);
      let lastWeekQuery = supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'done').gte('created_at', fourteenDaysAgo).lt('created_at', sevenDaysAgo);

      let recentTasksQuery = supabase.from('tasks').select('*').order('created_at', { ascending: false });
      let recsQuery = supabase.from('recognitions').select(`*, sender:profiles!recognitions_sender_id_fkey(full_name, avatar_url), receiver:profiles!recognitions_receiver_id_fkey(full_name, avatar_url)`).order('created_at', { ascending: false });
      let commentsQuery = supabase.from('task_comments').select(`*, user:profiles(full_name, avatar_url), task:tasks(title)`).order('created_at', { ascending: false });
      let assignedCountQuery = supabase.from('tasks').select('id', { count: 'exact', head: true });
      let completedVisibleQuery = supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done');
      let lateVisibleQuery = supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .or(`status.eq.late,and(status.neq.done,due_date.lt.${now.toISOString()})`);

      if (!isPowerUser && currentProfile?.department_id) {
        const filterStr = `department_id.eq.${currentProfile.department_id},created_by.eq.${user.id},assignee_id.eq.${user.id}`;
        activeQuery = activeQuery.or(filterStr);
        urgentQuery = urgentQuery.or(filterStr);
        completedQuery = completedQuery.or(filterStr);
        thisWeekQuery = thisWeekQuery.or(filterStr);
        lastWeekQuery = lastWeekQuery.or(filterStr);
        recentTasksQuery = recentTasksQuery.or(filterStr);
        recsQuery = recsQuery.or(`department_id.eq.${currentProfile.department_id},sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
        assignedCountQuery = assignedCountQuery.or(filterStr);
        completedVisibleQuery = completedVisibleQuery.or(filterStr);
        lateVisibleQuery = lateVisibleQuery.or(filterStr);
      }

      let kpiQuery = supabase
        .from('kpis')
        .select(`*, creator:profiles!kpis_created_by_fkey(role, department_id), assignee:profiles!kpis_assignee_id_fkey(role, department_id)`)
        .eq('is_archived', false);

      if (!isPowerUser && currentProfile?.department_id) {
        kpiQuery = kpiQuery.or(`department_id.eq.${currentProfile.department_id},created_by.eq.${user.id},assignee_id.eq.${user.id}`);
      }

      const [
        { count: activeCount },
        { count: urgentCount },
        { count: completedCount },
        { data: kpis },
        { count: thisWeekCount },
        { count: lastWeekCount },
        { data: recentTasksList },
        { data: recs },
        { count: assignedCount },
        { count: completedVisibleCount },
        { count: lateVisibleCount }
      ] = await Promise.all([
        activeQuery,
        urgentQuery,
        completedQuery,
        kpiQuery,
        thisWeekQuery,
        lastWeekQuery,
        recentTasksQuery.limit(5),
        recsQuery.limit(5),
        assignedCountQuery,
        completedVisibleQuery,
        lateVisibleQuery
      ]);

      let finalComments: any[] = [];
      if (!isPowerUser && currentProfile?.department_id) {
        const { data: deptTasks } = await supabase.from('tasks').select('id').or(`department_id.eq.${currentProfile.department_id},created_by.eq.${user.id},assignee_id.eq.${user.id}`);
        const deptTaskIds = deptTasks?.map((t: any) => t.id) || [];
        if (deptTaskIds.length > 0) {
          commentsQuery = commentsQuery.in('task_id', deptTaskIds);
          const { data: cmts } = await commentsQuery.limit(5);
          finalComments = cmts || [];
        }
      } else {
        const { data: cmts } = await commentsQuery.limit(5);
        finalComments = cmts || [];
      }

      const filteredKpis = (kpis || []).filter((k: any) => {
        const isFromAdminOrDirector = k.creator?.role === 'admin' || k.creator?.role === 'director' || k.assignee?.role === 'admin' || k.assignee?.role === 'director';
        if (isFromAdminOrDirector) return true;
        return k.assignee_id === user.id || k.created_by === user.id || (currentProfile?.department_id && k.department_id === currentProfile.department_id);
      });

      const kpiProg = filteredKpis.length > 0
        ? Math.round(filteredKpis.reduce((acc: number, k: any) => {
          const prog = k.target_value ? Math.round(((k.current_value || 0) / k.target_value) * 100) : (k.progress || 0);
          return acc + prog;
        }, 0) / filteredKpis.length)
        : 0;

      let change = 0;
      if (lastWeekCount && lastWeekCount > 0) {
        change = Math.round((((thisWeekCount || 0) - lastWeekCount) / lastWeekCount) * 100);
      } else if (thisWeekCount && thisWeekCount > 0) {
        change = 100;
      }

      const activityFeed = [
        ...(recentTasksList?.map((t: any) => ({ ...t, type: 'task' })) || []),
        ...(recs?.map((r: any) => ({ ...r, type: 'recognition', rec_type: r.type })) || []),
        ...(finalComments?.map((c: any) => ({ ...c, type: 'comment' })) || [])
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);

      const topKpi = [...filteredKpis].sort((a, b) => {
        if (a.metadata?.is_focal && !b.metadata?.is_focal) return -1;
        if (!a.metadata?.is_focal && b.metadata?.is_focal) return 1;
        const pMap: any = { high: 0, medium: 1, low: 2 };
        if (pMap[a.priority] !== pMap[b.priority]) return pMap[a.priority] - pMap[b.priority];
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })[0] || null;

      setStats({
        productivity: thisWeekCount || 0,
        productivityChange: change,
        activeTasks: activeCount || 0,
        urgentTasks: urgentCount || 0,
        completedTasks: completedCount || 0,
        kpiProgress: kpiProg,
        kpiCount: filteredKpis.length,
        topKpi: topKpi,
        recentTasks: activityFeed,
        totalAssigned: assignedCount || 0,
        totalCompleted: completedVisibleCount || 0,
        totalLate: lateVisibleCount || 0
      });

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSchedule = (schedule: any) => {
    setSelectedSchedule(schedule);
    setIsDetailOpen(true);
  };

  const handleUpdateEndTime = async (id: string, newEndTimeStr: string) => {
    try {
      const { error } = await supabase.from('schedules').update({ end_time: new Date(newEndTimeStr).toISOString() }).eq('id', id);
      if (error) throw error;
      toast({ title: "Thành công", description: "Đã cập nhật thời gian kết thúc." });
      fetchDashboardData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    }
  };

  const handleUpdateSchedule = async (id: string, updates: any) => {
    try {
      const { participant_ids, ...scheduleUpdates } = updates;
      const { error } = await supabase.from('schedules').update(scheduleUpdates).eq('id', id);
      if (error) throw error;

      if (Array.isArray(participant_ids)) {
        const schedule = scheduleData.schedules.find(s => s.id === id);
        const finalParticipantIds = Array.from(new Set([schedule?.created_by, ...participant_ids].filter(Boolean)));
        const { error: deleteError } = await supabase.from('schedule_participants').delete().eq('schedule_id', id);
        if (deleteError) throw deleteError;
        if (finalParticipantIds.length > 0) {
          const { error: insertError } = await supabase.from('schedule_participants').insert(
            finalParticipantIds.map((uid: string) => ({ schedule_id: id, profile_id: uid }))
          );
          if (insertError) throw insertError;
        }
      }

      toast({ title: "Thành công", description: "Đã cập nhật lịch trình." });
      setIsDetailOpen(false);
      fetchDashboardData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
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
          title: "Bạn được phân công lịch chạy xe",
          content: `Bạn được phân công điều khiển xe ${vehicle?.name || ''} (${vehicle?.plate_number || ''}) cho chuyến: "${schedule.title}".`,
          link: "/dashboard/schedule"
        }]);
      }

      toast({ title: "Thành công", description: vehicleId ? "Đã gán xe và tài xế." : "Đã hủy gán xe." });
      setIsDetailOpen(false);
      fetchDashboardData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    }
  };

  if (loading) {
    return (
      <div className="page-container space-y-8 py-6">
        <StatsSkeleton count={4} />
        <ListSkeleton variant="card" rows={3} />
      </div>
    );
  }

  if (canUseDriverWorkspace(profile)) {
    return (
      <DriverDashboardView
        profile={profile}
        schedules={scheduleData.schedules}
        fetchData={fetchDashboardData}
        toast={toast}
      />
    );
  }

  if (canUseHumanResourcesWorkspace(profile)) {
    return (
      <HRDashboardView
        schedules={scheduleData.schedules}
        allProfiles={scheduleData.allProfiles}
      />
    );
  }

  const isResourcesManagerDashboard = canCoordinateSharedResources(profile) && profile?.role !== 'admin' && profile?.role !== 'director';
  if (isResourcesManagerDashboard) {
    return (
      <TCTHDashboardView
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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-10 animate-fade-in-up pb-20">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tabular-nums">Xin chào, {profile?.full_name?.split(' ').pop()}!</h1>
          <div className="flex items-center gap-2 text-slate-500">
            <Sparkles className="w-4 h-4 text-amber-400 animate-float" />
            <p className="text-[13px] font-semibold italic">{quote}</p>
          </div>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 px-5 rounded-2xl font-medium text-sm shadow-primary-glow active:scale-95 transition-all">
          <Link href="/dashboard/tasks">
            Bắt đầu công việc <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </Button>
      </header>

      <QuickStats stats={stats} />
      <TaskOverview
        stats={stats}
        showAllActivities={showAllActivities}
        setShowAllActivities={setShowAllActivities}
      />
    </div>
  );
}
