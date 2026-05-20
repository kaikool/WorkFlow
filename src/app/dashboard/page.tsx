'use client'

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from "react";
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
 ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SchedulePage from "./schedule/page";

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

 const supabase = createClient();
 const router = useRouter();

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
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, []);

   const fetchDashboardData = async () => {
  setLoading(true);
  try {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: currentProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  setProfile(currentProfile);

  if (currentProfile?.role === 'driver' || currentProfile?.role === 'secretary') {
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
    change = Math.round((( (thisWeekCount || 0) - lastWeekCount) / lastWeekCount) * 100);
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

  if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (profile?.role === 'driver' || profile?.role === 'secretary') {
    return <SchedulePage />;
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

  {/* Modern Stats Grid */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
     {/* Productivity Card */}
     <div className="premium-card p-6 border border-indigo-100/40 bg-gradient-to-br from-indigo-50/40 via-white to-violet-50/20 flex items-center gap-5 group transition-all hover:scale-[1.02] hover:shadow-premium-hover">
       <div className="p-3.5 bg-gradient-to-tr from-indigo-500 to-violet-500 text-white rounded-2xl shrink-0 shadow-[0_6px_20px_rgba(99,102,241,0.25)] group-hover:rotate-6 transition-transform">
         <Trophy className="w-5.5 h-5.5" />
       </div>
       <div className="space-y-1.5 min-w-0 flex-1">
         <p className="text-[11px] font-bold text-indigo-500/80">Năng suất tuần</p>
         <div className="flex items-center justify-between gap-3">
           <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{stats.productivity}</p>
           <span className={cn(
             "flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold shrink-0 select-none",
             stats.productivityChange >= 0 ? "bg-emerald-50 text-emerald-600 border border-emerald-200/40" : "bg-red-50 text-red-600 border border-red-200/40"
           )}>
             {stats.productivityChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
             {Math.abs(stats.productivityChange)}%
           </span>
         </div>
         <p className="text-[9.5px] font-medium text-slate-400 truncate">
           {stats.productivityChange >= 0 ? "Tăng trưởng tốt so với tuần trước" : "Cần đẩy mạnh tiến độ hoàn thành"}
         </p>
       </div>
     </div>

     {/* Active Tasks Card */}
     <div className="premium-card p-6 border border-sky-100/40 bg-gradient-to-br from-sky-50/40 via-white to-blue-50/20 flex items-center gap-5 group transition-all hover:scale-[1.02] hover:shadow-premium-hover">
       <div className="p-3.5 bg-gradient-to-tr from-sky-500 to-blue-500 text-white rounded-2xl shrink-0 shadow-[0_6px_20px_rgba(14,165,233,0.25)] group-hover:rotate-6 transition-transform">
         <Clock className="w-5.5 h-5.5" />
       </div>
       <div className="space-y-1.5 min-w-0 flex-1">
         <p className="text-[11px] font-bold text-sky-500/80">Đang xử lý</p>
         <div className="flex items-center gap-2 flex-wrap">
           <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{stats.activeTasks}</p>
           {stats.urgentTasks > 0 && (
             <Badge className="bg-rose-500/10 hover:bg-rose-500/10 text-rose-600 border border-rose-200/30 text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
               {stats.urgentTasks} khẩn
             </Badge>
           )}
         </div>
         <p className="text-[9.5px] font-medium text-slate-400 truncate">
           {stats.urgentTasks > 0 ? `Có ${stats.urgentTasks} việc khẩn cần xử lý khẩn cấp` : "Các công việc đang đúng tiến độ"}
         </p>
       </div>
     </div>

     {/* Task & Report Summary Card */}
     <div className="premium-card p-6 border border-emerald-100/30 bg-gradient-to-br from-emerald-50/20 via-white to-slate-50/30 flex items-center gap-5 group transition-all hover:scale-[1.02] hover:shadow-premium-hover">
       <div className="p-3.5 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-2xl shrink-0 shadow-[0_6px_20px_rgba(10,185,129,0.25)] group-hover:rotate-6 transition-transform">
         <Briefcase className="w-5.5 h-5.5" />
       </div>
       <div className="space-y-2 min-w-0 flex-1">
         <div className="flex items-center justify-between gap-1">
           <p className="text-[11px] font-bold text-emerald-600/80">Thống kê Nhiệm vụ</p>
           <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/40 shrink-0 select-none">
             Xong {stats.totalAssigned > 0 ? Math.round((stats.totalCompleted / stats.totalAssigned) * 100) : 0}%
           </span>
         </div>
         <div className="grid grid-cols-3 gap-1.5 text-center pt-0.5">
           <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100/50 shadow-sm">
             <p className="text-[8px] font-bold text-slate-400">Giao</p>
             <p className="text-sm font-extrabold text-slate-700 tabular-nums">{stats.totalAssigned}</p>
           </div>
           <div className="bg-emerald-50/60 p-1.5 rounded-xl border border-emerald-100/40 shadow-sm">
             <p className="text-[8px] font-bold text-emerald-600">Xong</p>
             <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{stats.totalCompleted}</p>
           </div>
           <div className="bg-red-50/60 p-1.5 rounded-xl border border-red-100/40 shadow-sm">
             <p className="text-[8px] font-bold text-red-600">Trễ</p>
             <p className="text-sm font-extrabold text-red-600 tabular-nums">{stats.totalLate}</p>
           </div>
         </div>
       </div>
     </div>

     {/* KPI Progress Card */}
     <div className="premium-card p-6 border border-slate-800 bg-slate-900 shadow-[0_15px_35px_rgba(15,23,42,0.2)] flex items-center gap-5 group transition-all hover:scale-[1.02] hover:shadow-slate-950/40">
       <div className="p-3.5 bg-gradient-to-tr from-amber-400 to-orange-500 text-white rounded-2xl shrink-0 shadow-[0_6px_20px_rgba(245,158,11,0.3)] group-hover:rotate-6 transition-transform">
         <Target className="w-5.5 h-5.5" />
       </div>
       <div className="space-y-2 min-w-0 flex-1">
         <p className="text-[11px] font-bold text-amber-400/80">Tiến độ kế hoạch</p>
         <div className="flex items-center justify-between gap-3">
           <p className="text-2xl font-extrabold bg-gradient-to-r from-amber-200 to-orange-300 bg-clip-text text-transparent tabular-nums">{stats.kpiProgress}%</p>
           <span className="text-[9px] font-extrabold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full whitespace-nowrap truncate shrink-0 select-none">
             {stats.kpiCount} chỉ tiêu
           </span>
         </div>
         <div className="flex gap-1.5 pt-0.5">
           {[1, 2, 3, 4, 5, 6].map((i) => (
             <div
               key={i}
               className={cn(
                 "h-1 flex-1 rounded-full transition-all duration-700",
                 stats.kpiProgress >= (i * 16.6) ? "bg-gradient-to-r from-amber-400 to-orange-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" : "bg-slate-800"
               )}
             />
           ))}
         </div>
         {stats.topKpi && (
           <p className="text-[9.5px] font-medium text-slate-400 truncate pt-1 border-t border-slate-800/60 mt-1 select-none">
             Trọng tâm: <span className="text-amber-300 font-bold">{stats.topKpi.title}</span> ({stats.topKpi.current_value || 0}{" / "}{stats.topKpi.target_value} {stats.topKpi.unit || ""})
           </p>
         )}
        </div>
      </div>
  </div>

  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
 {/* Feed Section */}
 <div className="lg:col-span-8 space-y-6">
 <div className="flex items-center justify-between px-2 mb-4">
 <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 truncate whitespace-nowrap">
 <Zap className="w-4 h-4 text-primary fill-primary/10" /> Luồng hoạt động
 </h3>
 <Button variant="ghost" asChild className="text-sm font-medium text-primary h-10 md:h-8 hover:bg-primary/5 rounded-full px-4 truncate whitespace-nowrap">
 <Link href="/dashboard/tasks">Tất cả <ChevronRight className="ml-1 w-3 h-3" /></Link>
 </Button>
 </div>

  <div className="space-y-3">
    {(showAllActivities ? stats.recentTasks : stats.recentTasks.slice(0, 4)).map((t) => (
      <Link
        key={`${t.type}-${t.id}`}
        href={t.type === 'recognition' ? `/dashboard/team` : `/dashboard/tasks/${t.type === 'comment' ? t.task_id : t.id}`}
        className="block group"
      >
        <div className={cn(
          "flex items-center justify-between p-4 transition-all duration-300 rounded-[24px] group border border-transparent",
          t.type === 'recognition'
            ? (t.rec_type === 'remind' ? "bg-slate-50 border-slate-100 hover:bg-slate-100 hover:shadow-sm" : "bg-amber-50/50 border-amber-100/50")
            : "bg-white hover:bg-slate-50 hover:border-slate-100 hover:shadow-sm"
        )}>
          <div className="shrink-0 relative">
            {t.type === 'task' ? (
              <div className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center shadow-sm",
                t.task_type === 'kpi' ? "bg-primary text-white" : "bg-slate-50 text-slate-500"
              )}>
                {t.task_type === 'kpi' ? <Target className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
              </div>
            ) : (
              <div className="relative">
                <Avatar className={cn(
                  "h-11 w-11 border-2 shadow-sm",
                  t.type === 'recognition'
                    ? (t.rec_type === 'remind' ? "border-slate-200" : "border-amber-200")
                    : "border-transparent"
                )}>
                  <AvatarImage src={t.type === 'recognition' ? t.receiver?.avatar_url : t.user?.avatar_url} />
                  <AvatarFallback className={cn(
                    "font-medium text-sm",
                    t.type === 'recognition'
                      ? (t.rec_type === 'remind' ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-700")
                      : "bg-slate-100 text-slate-700"
                  )}>
                    {(t.type === 'recognition' ? t.receiver?.full_name : t.user?.full_name)?.[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 space-y-1 ml-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                {t.type === 'task' ? t.title : (t.type === 'comment' ? `"${t.content}"` : (t.rec_type === 'remind' ? `Nhắc nhở: ${t.content}` : `Vinh danh: ${t.content}`))}
              </p>
              <span className="hidden sm:inline-block text-[10px] md:text-sm font-medium text-slate-500 shrink-0 truncate whitespace-nowrap">
                {new Date(t.created_at).toLocaleDateString('vi-VN')}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className={cn(
                "text-sm font-medium flex items-center gap-1.5 line-clamp-1",
                t.type === 'recognition'
                  ? (t.rec_type === 'remind' ? "text-slate-500" : "text-amber-600")
                  : "text-slate-500"
              )}>
                {t.type === 'recognition' && (
                  t.rec_type === 'remind'
                    ? <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                    : <Trophy className="w-3 h-3 fill-amber-500 shrink-0" />
                )}
                {t.type === 'task'
                  ? (t.task_type === 'kpi' ? 'Chỉ tiêu mới' : 'Công việc mới')
                  : (t.type === 'comment'
                      ? `Phản hồi: ${t.task?.title}`
                      : (t.rec_type === 'remind'
                          ? `Chấn chỉnh: ${t.receiver?.full_name}`
                          : `Vinh danh: ${t.receiver?.full_name}`
                        )
                    )}
              </p>
              <span className="inline-block sm:hidden text-sm font-medium text-slate-400">
                • {new Date(t.created_at).toLocaleDateString('vi-VN')}
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </Link>
    ))}

    {stats.recentTasks.length > 4 && (
      <div className="flex justify-center pt-2">
        <Button
          variant="ghost"
          onClick={() => setShowAllActivities(!showAllActivities)}
          className="text-sm font-medium text-primary hover:bg-primary/5 rounded-full px-6 py-2 flex items-center gap-1.5"
        >
          {showAllActivities ? (
            <>Thu gọn <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>Xem thêm {stats.recentTasks.length - 4} hoạt động <ChevronDown className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    )}
  </div>
</div>

 {/* Focus Section */}
 <div className="lg:col-span-4 space-y-6">
 <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 px-2 truncate whitespace-nowrap">
 <AlertCircle className="w-4 h-4 text-primary" /> Ưu tiên hàng đầu
 </h3>
 <div className="premium-card p-6 border-none relative overflow-hidden group">
 {stats.topKpi ? (
 <div className="space-y-6">
 <div className="p-4 bg-primary/5 text-primary w-fit rounded-2xl shadow-sm transition-transform duration-500 group-hover:scale-110">
 <Target className="w-8 h-8" />
 </div>
 <div className="space-y-3">
 <h4 className="text-base md:text-lg font-bold text-slate-900 leading-tight line-clamp-2">{stats.topKpi.title}</h4>
 <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed line-clamp-3">
 {stats.topKpi.description || "Nỗ lực hoàn thành chỉ tiêu đề ra."}
 </p>
 </div>
 <div className="space-y-4 pt-2">
 <div className="flex items-center justify-between text-[10px] md:text-sm font-medium truncate whitespace-nowrap">
 <span className="text-slate-500">Tiến độ nhiệm vụ</span>
 <span className="text-primary">
 {stats.topKpi.target_value
 ? Math.round(((stats.topKpi.current_value || 0) / stats.topKpi.target_value) * 100)
 : (stats.topKpi.progress || 0)}%
 </span>
 </div>
 <Progress
 value={Math.min(100, stats.topKpi.target_value
 ? Math.round(((stats.topKpi.current_value || 0) / stats.topKpi.target_value) * 100)
 : (stats.topKpi.progress || 0))}
 className="h-1.5 bg-white"
 />
 </div>
 <Button asChild className="w-full bg-slate-900 hover:bg-black text-white h-11 md:h-12 rounded-xl font-medium text-sm mt-2 truncate whitespace-nowrap">
 <Link href={`/dashboard/tasks/${stats.topKpi.id}`}>Chi tiết lộ trình</Link>
 </Button>
 </div>
 ) : (
 <div className="py-12 text-center space-y-4">
 <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-500">
 <Target className="w-6 h-6" />
 </div>
 <p className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">Chưa có chỉ tiêu trọng tâm</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
