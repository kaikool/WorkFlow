'use client'

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from "react";
import { 
 TrendingUp, 
 CheckCircle2, 
 Clock, 
 Target,
 ArrowRight,
 Briefcase,
 Zap,
 Loader2,
 Plus,
 ChevronRight,
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
 const [stats, setStats] = useState({
 productivity: 0,
 productivityChange: 0,
 activeTasks: 0,
 urgentTasks: 0,
 completedTasks: 0,
 kpiProgress: 0,
 kpiCount: 0,
 topKpi: null as any,
 recentTasks: [] as any[]
 });
 
 const supabase = createClient();

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

 // 1. Đếm các chỉ số công việc (Tận dụng RLS, không cần fetch hết)
 const { count: activeCount } = await supabase
 .from('tasks')
 .select('*', { count: 'exact', head: true })
 .neq('status', 'done')
 .neq('task_type', 'kpi');

 const { count: urgentCount } = await supabase
 .from('tasks')
 .select('*', { count: 'exact', head: true })
 .neq('status', 'done')
 .eq('priority', 'high');

 const { count: completedCount } = await supabase
 .from('tasks')
 .select('*', { count: 'exact', head: true })
 .eq('status', 'done');

  // 2. Lấy dữ liệu KPI
  const { data: kpis } = await supabase
  .from('tasks')
  .select(`
    *,
    creator:profiles!tasks_created_by_fkey(role, department_id),
    assignee:profiles!tasks_assignee_id_fkey(role, department_id)
  `)
  .eq('task_type', 'kpi');

  // Phân quyền ưu tiên hàng đầu:
  // - Mọi thành viên đều nhìn thấy ưu tiên của Admin và Ban giám đốc (director)
  // - Cán bộ trong phòng (bao gồm cả LDP và cán bộ) chỉ nhìn thấy ưu tiên của chính mình
  const filteredKpis = (kpis || []).filter((k: any) => {
    const isFromAdminOrDirector = 
      k.creator?.role === 'admin' || 
      k.creator?.role === 'director' || 
      k.assignee?.role === 'admin' || 
      k.assignee?.role === 'director';
      
    if (isFromAdminOrDirector) return true;

    return k.assignee_id === user.id || k.created_by === user.id;
  });

  const kpiProg = filteredKpis.length > 0 
  ? Math.round(filteredKpis.reduce((acc, k) => {
  const prog = k.target_value ? Math.round(((k.current_value || 0) / k.target_value) * 100) : (k.progress || 0);
  return acc + prog;
  }, 0) / filteredKpis.length)
  : 0;

 // 3. Tính toán năng suất (7 ngày gần nhất)
 const now = new Date();
 const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
 const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

 const { count: thisWeekCount } = await supabase
 .from('tasks')
 .select('*', { count: 'exact', head: true })
 .eq('status', 'done')
 .gte('created_at', sevenDaysAgo);

 const { count: lastWeekCount } = await supabase
 .from('tasks')
 .select('*', { count: 'exact', head: true })
 .eq('status', 'done')
 .gte('created_at', fourteenDaysAgo)
 .lt('created_at', sevenDaysAgo);
 
 let change = 0;
 if (lastWeekCount && lastWeekCount > 0) {
 change = Math.round((( (thisWeekCount || 0) - lastWeekCount) / lastWeekCount) * 100);
 } else if (thisWeekCount && thisWeekCount > 0) {
 change = 100;
 }

 // 4. Luồng hoạt động gần đây (Chỉ lấy top 5 mỗi loại để ghép)
 const { data: recentTasksList } = await supabase
 .from('tasks')
 .select('*')
 .order('created_at', { ascending: false })
 .limit(5);

 const { data: recs } = await supabase
 .from('recognitions')
 .select(`*, sender:profiles!recognitions_sender_id_fkey(full_name, avatar_url), receiver:profiles!recognitions_receiver_id_fkey(full_name, avatar_url)`)
 .order('created_at', { ascending: false })
 .limit(5);

 const { data: comments } = await supabase
 .from('task_comments')
 .select(`*, user:profiles(full_name, avatar_url), task:tasks(title)`)
 .order('created_at', { ascending: false })
 .limit(5);

 const activityFeed = [
 ...(recentTasksList?.map(t => ({ ...t, type: 'task' })) || []),
 ...(recs?.map(r => ({ ...r, type: 'recognition' })) || []),
 ...(comments?.map(c => ({ ...c, type: 'comment' })) || [])
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
 recentTasks: activityFeed
 });

 } catch (error) {
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

 return (
 <div className="max-w-6xl mx-auto space-y-6 md:space-y-10 animate-fade-in-up pb-20">
 <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-4 sm:px-0 pt-4 sm:pt-0">
 <div className="space-y-1">
 <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight tabular-nums">Xin chào, {profile?.full_name?.split(' ').pop()}!</h1>
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
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 px-4 sm:px-0">
 {/* Productivity Card */}
 <div className="premium-card p-5 md:p-6 border-none flex flex-col justify-between min-h-[150px] md:min-h-[160px] group transition-all hover:scale-[1.02]">
 <div className="flex items-center justify-between">
 <div className="p-3 bg-primary/10 rounded-2xl text-primary shadow-sm group-hover:rotate-12 transition-transform">
 <Trophy className="w-5 h-5" />
 </div>
 <div className={cn(
 "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ",
 stats.productivityChange >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
 )}>
 {stats.productivityChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
 {Math.abs(stats.productivityChange)}%
 </div>
 </div>
 <div className="space-y-1 mt-4 md:mt-0">
 <p className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">NĂNG SUẤT TUẦN</p>
 <div className="flex items-baseline gap-2">
 <p className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight tabular-nums">{stats.productivity}</p>
 <span className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">Hoàn tất</span>
 </div>
 </div>
 </div>

 {/* Active Tasks Card */}
 <div className="premium-card p-5 md:p-6 border-none flex flex-col justify-between min-h-[150px] md:min-h-[160px] group transition-all hover:scale-[1.02]">
 <div className="flex items-center justify-between">
 <div className="p-3 bg-slate-100 rounded-2xl text-slate-600 shadow-sm group-hover:rotate-12 transition-transform">
 <Clock className="w-5 h-5" />
 </div>
 {stats.urgentTasks > 0 && (
 <Badge className="bg-red-500 text-white border-none text-[9px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-lg shadow-red-200">
 {stats.urgentTasks} KHẨN
 </Badge>
 )}
 </div>
 <div className="space-y-1 mt-4 md:mt-0">
 <p className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">ĐANG XỬ LÝ</p>
 <div className="flex items-baseline gap-2">
 <p className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight tabular-nums">{stats.activeTasks}</p>
 <span className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">Công việc</span>
 </div>
 </div>
 </div>

 {/* KPI Progress Card */}
 <div className="premium-card p-5 md:p-6 border-none flex flex-col justify-between min-h-[150px] md:min-h-[160px] group transition-all hover:scale-[1.02] bg-slate-900 shadow-slate-900/20">
 <div className="flex items-center justify-between">
 <div className="p-3 bg-primary/20 rounded-2xl text-primary shadow-sm group-hover:rotate-12 transition-transform">
 <Target className="w-5 h-5" />
 </div>
 <div className="text-[10px] md:text-xs font-bold text-primary uppercase bg-primary/10 px-2.5 py-1 rounded-full whitespace-nowrap truncate">
 LỘ TRÌNH: {stats.kpiCount} CHỈ TIÊU
 </div>
 </div>
 <div className="space-y-3 mt-4 md:mt-0">
 <div className="space-y-1">
 <p className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">TIẾN ĐỘ KẾ HOẠCH</p>
 <p className="text-2xl md:text-3xl font-bold text-white tracking-tight tabular-nums">{stats.kpiProgress}%</p>
 </div>
 <div className="flex gap-1.5">
 {[1, 2, 3, 4, 5, 6].map((i) => (
 <div 
 key={i} 
 className={cn(
 "h-1 flex-1 rounded-full transition-all duration-700", 
 stats.kpiProgress >= (i * 16.6) ? "bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-slate-800"
 )} 
 />
 ))}
 </div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 px-4 sm:px-0">
 {/* Feed Section */}
 <div className="lg:col-span-8 space-y-6">
 <div className="flex items-center justify-between px-2 mb-4">
 <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 truncate whitespace-nowrap">
 <Zap className="w-4 h-4 text-primary fill-primary/10" /> LUỒNG HOẠT ĐỘNG
 </h3>
 <Button variant="ghost" asChild className="text-xs font-bold text-primary uppercase h-10 md:h-8 hover:bg-primary/5 rounded-full px-4 truncate whitespace-nowrap">
 <Link href="/dashboard/tasks">Tất cả <ChevronRight className="ml-1 w-3 h-3" /></Link>
 </Button>
 </div>

 <div className="space-y-3">
 {stats.recentTasks.map((t) => (
 <Link 
 key={`${t.type}-${t.id}`} 
 href={t.type === 'recognition' ? `/dashboard/team` : `/dashboard/tasks/${t.type === 'comment' ? t.task_id : t.id}`} 
 className="block group"
 >
 <div className={cn(
 "flex items-center justify-between p-4 transition-all duration-300 rounded-[24px] group border border-transparent",
 t.type === 'recognition' 
 ? "bg-amber-50/50 border-amber-100/50" 
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
 <Avatar className="h-11 w-11 border-2 border-amber-200 shadow-sm">
 <AvatarImage src={t.type === 'recognition' ? t.receiver?.avatar_url : t.user?.avatar_url} />
 <AvatarFallback className="font-bold text-xs bg-amber-100 text-amber-700">{(t.type === 'recognition' ? t.receiver?.full_name : t.user?.full_name)?.[0]}</AvatarFallback>
 </Avatar>
 </div>
 )}
 </div>
 <div className="flex-1 min-w-0 space-y-1 ml-4">
 <div className="flex items-center justify-between gap-2">
 <p className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
 {t.type === 'task' ? t.title : (t.type === 'comment' ? `"${t.content}"` : `Vinh danh: ${t.content}`)}
 </p>
 <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase shrink-0 truncate whitespace-nowrap">
 {new Date(t.created_at).toLocaleDateString('vi-VN')}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <p className={cn(
 "text-xs font-bold uppercase tracking-tight flex items-center gap-1.5 line-clamp-1",
 t.type === 'recognition' ? "text-amber-600" : "text-slate-500"
 )}>
 {t.type === 'recognition' && <Trophy className="w-3 h-3 fill-amber-500 shrink-0" />}
 {t.type === 'task' ? (t.task_type === 'kpi' ? 'CHỈ TIÊU MỚI' : 'CÔNG VIỆC MỚI') : (t.type === 'comment' ? `PHẢN HỒI: ${t.task?.title}` : `VINH DANH: ${t.receiver?.full_name}`)}
 </p>
 </div>
 </div>
 <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-primary group-hover:translate-x-1 transition-all" />
 </div>
 </Link>
 ))}
 </div>
 </div>

 {/* Focus Section */}
 <div className="lg:col-span-4 space-y-6">
 <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 px-2 truncate whitespace-nowrap">
 <AlertCircle className="w-4 h-4 text-primary" /> ƯU TIÊN HÀNG ĐẦU
 </h3>
 <div className="premium-card p-5 md:p-6 border-none relative overflow-hidden group">
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
 <div className="flex items-center justify-between text-[10px] md:text-xs font-bold uppercase truncate whitespace-nowrap">
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
 <Button asChild className="w-full bg-slate-900 hover:bg-black text-white h-11 md:h-12 rounded-xl font-bold text-xs uppercase mt-2 truncate whitespace-nowrap">
 <Link href={`/dashboard/tasks/${stats.topKpi.id}`}>Chi tiết lộ trình</Link>
 </Button>
 </div>
 ) : (
 <div className="py-12 text-center space-y-4">
 <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-500">
 <Target className="w-6 h-6" />
 </div>
 <p className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">Chưa có chỉ tiêu trọng tâm</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
