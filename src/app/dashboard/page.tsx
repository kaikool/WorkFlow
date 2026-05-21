'use client'

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useRef } from "react";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Target,
  ArrowRight,
  Briefcase,
  Zap,
  Loader2,
  Plus,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MessageSquare,
  AlertCircle,
  Trophy,
  ArrowUpRight,
  CalendarDays,
  ShieldCheck,
  Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { addDays, endOfDay, endOfWeek, isSameDay, startOfWeek } from "date-fns";
import { canCoordinateSharedResources, canUseDriverWorkspace, canUseHumanResourcesWorkspace } from "@/lib/permissions";
import DriverDashboard from "./schedule/_components/DriverDashboard";
import ResourcesManagerDashboard from "./schedule/_components/ResourcesManagerDashboard";
import DirectorTimeline from "./schedule/_components/DirectorTimeline";
import ScheduleDetailDialog from "./schedule/_components/ScheduleDetailDialog";
import LeaveApprovalDashboard from "./schedule/_components/LeaveApprovalDashboard";
import QuickStats from "./_components/QuickStats";
import TaskOverview from "./_components/TaskOverview";

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

    // Kích hoạt Real-time cho Dashboard
    const channel = supabase
      .channel('dashboard_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recognitions' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_comments' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_participants' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => {
        fetchDashboardData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
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
      .select(`*, creator:profiles!schedules_created_by_fkey(full_name, avatar_url, department_id, role, is_department_head, departments(name)), room:rooms(name), vehicle:vehicles(name, plate_number), driver:profiles!schedules_driver_id_fkey(id, full_name, phone, avatar_url), participants:schedule_participants(profile:profiles(id, full_name, avatar_url, role, is_department_head, departments(name)))`)
      .gte('end_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time');

    const pendingQueueQuery = canSeePendingQueue
      ? supabase
        .from('schedules')
        .select(`*, creator:profiles!schedules_created_by_fkey(full_name, avatar_url, department_id, role, is_department_head, departments(name)), room:rooms(name), vehicle:vehicles(name, plate_number), driver:profiles!schedules_driver_id_fkey(id, full_name, phone, avatar_url), participants:schedule_participants(profile:profiles(id, full_name, avatar_url, role, is_department_head, departments(name)))`)
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
      supabase.from('profiles').select('id, full_name, avatar_url, role, department_id, is_department_head, departments(name, code)'),
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

      // 1. Chuẩn bị tất cả các queries (không await)
      let activeQuery = supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done').neq('task_type', 'kpi');
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
      let assignedCountQuery = supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('task_type', 'kpi');
      let completedVisibleQuery = supabase.from('tasks').select('id', { count: 'exact', head: true }).neq('task_type', 'kpi').eq('status', 'done');
      let lateVisibleQuery = supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .neq('task_type', 'kpi')
        .or(`status.eq.late,and(status.neq.done,due_date.lt.${now.toISOString()})`);

      // Áp dụng bộ lọc RLS/Phòng ban nếu không phải Admin
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

      // 2. Thực thi tất cả cùng lúc với promise.all
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
        supabase.from('tasks').select(`*, creator:profiles!tasks_created_by_fkey(role, department_id), assignee:profiles!tasks_assignee_id_fkey(role, department_id)`).eq('task_type', 'kpi'),
        thisWeekQuery,
        lastWeekQuery,
        recentTasksQuery.limit(5),
        recsQuery.limit(5),
        assignedCountQuery,
        completedVisibleQuery,
        lateVisibleQuery
      ]);

      // Query comments yêu cầu lookup danh sách task_ids trước nếu có filter phòng ban
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

      // 3. Xử lý dữ liệu hiển thị
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

      // 5. Tìm KPI trọng tâm
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

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const schedule = scheduleData.schedules.find(s => s.id === id);
      const { error } = await supabase.from('schedules').update({ status }).eq('id', id);
      if (error) throw error;

      if (schedule?.created_by) {
        await sendNotifications([{
          user_id: schedule.created_by,
          title: status === 'approved' ? "Đơn nghỉ phép đã được phê duyệt" : "Đơn nghỉ phép bị từ chối",
          content: status === 'approved'
            ? `Đơn nghỉ phép "${schedule.title}" đã được phê duyệt.`
            : `Đơn nghỉ phép "${schedule.title}" không được phê duyệt. Vui lòng kiểm tra lại.`,
          link: "/dashboard/schedule"
        }]);
      }

      toast({ title: "Thành công", description: status === 'approved' ? "Đã phê duyệt đơn nghỉ phép." : "Đã từ chối đơn nghỉ phép." });
      fetchDashboardData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    }
  };

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (canUseDriverWorkspace(profile)) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-8 animate-fade-in-up pb-20">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Lịch trình của của tôi</h1>
            <p className="text-[13px] text-slate-500 font-medium">Theo dõi chuyến được gán, cập nhật hành trình.</p>
          </div>
          <Button asChild variant="outline" className="h-11 rounded-xl font-bold">
            <Link href="/dashboard/schedule">
              <CalendarDays className="mr-2 h-4 w-4" /> Xem lịch đầy đủ
            </Link>
          </Button>
        </header>
        <DriverDashboard schedules={scheduleData.schedules} profile={profile} fetchData={fetchDashboardData} toast={toast} />
      </div>
    );
  }

  if (canUseHumanResourcesWorkspace(profile)) {
    const approvedLeaves = scheduleData.schedules.filter(s => s.type === 'leave' && s.status === 'approved');
    const today = new Date();
    const activeLeaves = approvedLeaves.filter(s => new Date(s.start_time) <= today && new Date(s.end_time) >= today);

    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    const thisWeekLeaves = approvedLeaves.filter(s => {
      const sStart = new Date(s.start_time);
      const sEnd = new Date(s.end_time);
      return sStart <= end && sEnd >= start;
    });

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 animate-fade-in-up pb-20">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Bảng nhân sự</h1>
            <p className="text-[13px] text-slate-500 font-medium">Theo dõi nghỉ phép và hồ sơ nhân sự toàn cơ quan.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Button asChild variant="outline" className="h-11 rounded-xl font-semibold w-full sm:w-auto border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40">
              <Link href="/dashboard/schedule?type=leave" className="flex items-center justify-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span>Đăng ký nghỉ phép</span>
              </Link>
            </Button>
            <Button asChild className="h-11 rounded-xl font-semibold w-full sm:w-auto">
              <Link href="/dashboard/team" className="flex items-center justify-center gap-2">
                <Users className="h-4 w-4 shrink-0" />
                <span>Danh sách cán bộ</span>
              </Link>
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="premium-card border border-slate-100 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-xs font-semibold text-slate-500">Nghỉ phép tuần này</p>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{thisWeekLeaves.length}</p>
          </div>
          <div className="premium-card border border-slate-100 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-xs font-semibold text-slate-500">Đang nghỉ hôm nay</p>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{activeLeaves.length}</p>
          </div>
          <div className="premium-card border border-slate-100 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xs font-semibold text-slate-500">Tổng cán bộ</p>
            </div>
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{scheduleData.allProfiles.length}</p>
          </div>
        </section>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 flex items-center gap-2 px-1">
            <CalendarDays className="w-4 h-4 text-primary shrink-0" />
            Lịch nghỉ phép tuần này
            <span className="ml-auto text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-0.5">{thisWeekLeaves.length}</span>
          </h3>

          {thisWeekLeaves.length === 0 ? (
            <div className="premium-card text-center border border-slate-100 bg-white py-12">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <CalendarDays className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Tuần này không có cán bộ nghỉ phép</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {thisWeekLeaves.map((leave) => {
                const startDate = new Date(leave.start_time);
                const endDate = new Date(leave.end_time);
                const isActive = startDate <= today && endDate >= today;

                const leaveUser = leave.participants?.[0]?.profile || leave.creator;
                const userDept = leaveUser?.departments;
                const deptName = userDept ? (Array.isArray(userDept) ? userDept[0]?.name : userDept?.name) : "";

                return (
                  <div key={leave.id} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200">
                    <Avatar className="h-10 w-10 border border-slate-100 shadow-sm shrink-0">
                      <AvatarImage src={leaveUser?.avatar_url} />
                      <AvatarFallback className="font-semibold text-sm bg-slate-100 text-slate-600">
                        {leaveUser?.full_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">{leaveUser?.full_name || "Cán bộ"}</p>
                        {isActive && (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-100">
                            Hôm nay
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{leave.title || "Nghỉ phép"}</p>
                      <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                        {startDate.toLocaleDateString("vi-VN")} – {endDate.toLocaleDateString("vi-VN")}
                        {deptName ? ` · ${deptName}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  const isResourcesManagerDashboard = canCoordinateSharedResources(profile) && profile?.role !== 'admin' && profile?.role !== 'director';
  if (isResourcesManagerDashboard) {
    const pendingSchedules = scheduleData.schedules
      .filter(s => s.status === 'pending' || (s.use_vehicle && !s.vehicle_id))
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 6);
    const busyVehicles = scheduleData.schedules.filter(s =>
      s.vehicle_id && ['approved', 'in_progress'].includes(s.status) && new Date(s.end_time) >= new Date()
    ).length;
    const busyRooms = scheduleData.schedules.filter(s =>
      s.room_id && s.status === 'approved' && new Date(s.end_time) >= new Date()
    ).length;

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 animate-fade-in-up pb-20">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 sm:pt-0">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Bảng điều phối</h1>
            <p className="text-[13px] text-slate-500 font-medium">Duyệt lịch, điều phối xe/phòng và theo dõi lịch Ban Giám đốc.</p>
          </div>
          <Button asChild className="h-11 rounded-xl font-bold">
            <Link href="/dashboard/schedule">
              <CalendarDays className="mr-2 h-4 w-4" /> Mở lịch trình
            </Link>
          </Button>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="premium-card border border-slate-200 lg:col-span-2">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-600" /> Cần xử lý
              </h2>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 rounded-full px-3 py-1.5 border border-amber-100">{pendingSchedules.length}</span>
            </div>
            <div className="space-y-3">
              {pendingSchedules.length === 0 ? (
                <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">Không có lịch chờ điều phối.</p>
              ) : pendingSchedules.map((schedule) => (
                <button
                  key={schedule.id}
                  onClick={() => handleSelectSchedule(schedule)}
                  className="w-full min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900 line-clamp-1">{schedule.title}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                      {schedule.use_vehicle && !schedule.vehicle_id ? "Cần xe" : "Chờ duyệt"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-slate-500 line-clamp-1">
                    {new Date(schedule.start_time).toLocaleString('vi-VN')} - {schedule.creator?.full_name || 'Người tạo'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="premium-card border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <CalendarDays className="h-4 w-4 text-slate-500" /> Tài nguyên hôm nay
            </h2>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-bold text-slate-500">Xe đang có lịch</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{busyVehicles}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-bold text-slate-500">Phòng đang có lịch</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 tabular-nums">{busyRooms}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-xs font-bold text-amber-700">Tổng lịch cần theo dõi</p>
                <p className="mt-1 text-2xl font-extrabold text-amber-700 tabular-nums">{scheduleData.schedules.length}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-700" /> Timeline Ban Giám đốc
          </h2>
          <DirectorTimeline
            allProfiles={scheduleData.allProfiles}
            schedules={scheduleData.schedules}
            selectedDate={selectedDate}
            timelineContainerRef={timelineContainerRef}
            isTodaySelected={isTodaySelected}
            currentTimePercent={currentTimePercent}
            startLimit={startLimit}
            duration={duration}
            onSelectSchedule={handleSelectSchedule}
            currentProfile={profile}
          />
        </section>

        <ResourcesManagerDashboard
          schedules={scheduleData.schedules}
          vehicles={scheduleData.vehicles}
          rooms={scheduleData.rooms}
          selectedDate={selectedDate}
          onSelectSchedule={handleSelectSchedule}
        />

        <ScheduleDetailDialog
          isOpen={isDetailOpen}
          setIsOpen={setIsDetailOpen}
          schedule={selectedSchedule}
          schedules={scheduleData.schedules}
          vehicles={scheduleData.vehicles}
          rooms={scheduleData.rooms}
          isTCTH={true}
          allProfiles={scheduleData.allProfiles}
          departments={scheduleData.departments}
          currentProfile={profile}
          onAssignVehicle={handleAssignVehicle}
          onUpdateEndTime={handleUpdateEndTime}
          onUpdateSchedule={handleUpdateSchedule}
        />
      </div>
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
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-8 rounded-2xl font-bold text-sm shadow-primary-glow active:scale-95 transition-all">
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
