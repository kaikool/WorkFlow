'use client'

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
 ChevronLeft, 
 Building2, 
 Loader2, 
 CheckCircle2, 
 Clock, 
 Briefcase,
 Target,
 ArrowUpRight,
 Award,
 Star,
 Send,
 Calendar,
 Mail,
 Globe,
 Users as UsersIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
 DialogTrigger
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { 
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

export default function MemberDetailPage() {
 const { id } = useParams();
 const router = useRouter();
 const { toast } = useToast();
 const supabase = createClient();
 
 const [loading, setLoading] = useState(true);
 const [recognizing, setRecognizing] = useState(false);
 const [isRecognizeOpen, setIsRecognizeOpen] = useState(false);
 const [recognitionText, setRecognitionText] = useState("");
 const [recognitionScope, setRecognitionScope] = useState("department");
 const [member, setMember] = useState<any>(null);
 const [memberTasks, setMemberTasks] = useState<any[]>([]);
 const [stats, setStats] = useState({ done: 0, pending: 0, total: 0, avgProgress: 0 });
 const [currentUser, setCurrentUser] = useState<any>(null);

 useEffect(() => {
 const fetchAllData = async () => {
 if (!id || id === 'undefined') {
 router.push('/dashboard/team');
 return;
 }

 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 let myProfileData = null;
 if (user) {
 const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
 myProfileData = p;
 setCurrentUser(p);
 }

 const { data: profile, error: pError } = await supabase
 .from('profiles')
 .select(`*, departments (name)`)
 .eq('id', id)
 .single();
 
 if (pError || !profile) throw new Error("Không tìm thấy thông tin cán bộ.");

 // KIỂM TRA QUYỀN TRUY CẬP
 const isSameDept = profile.department_id === myProfileData?.department_id;
 const isAdmin = myProfileData?.role === 'admin';
 const isSelf = profile.id === myProfileData?.id;

 if (!isAdmin && !isSameDept && !isSelf) {
 toast({
 variant: "destructive",
 title: "Truy cập bị từ chối",
 description: "Bạn không có quyền xem thông tin cán bộ thuộc đơn vị khác."
 });
 router.push('/dashboard/team');
 return;
 }

 setMember(profile);

 // Chỉ lấy tasks liên quan đến member này (bao gồm cả giao trực tiếp và qua bảng phụ)
 const { data: directTasks } = await supabase
 .from('tasks')
 .select('id')
 .eq('assignee_id', id);
 
 const directTaskIds = directTasks?.map(t => t.id) || [];

 const { data: assignments } = await supabase
 .from('task_assignees')
 .select('task_id')
 .eq('user_id', id);
 
 const assigneeTaskIds = assignments?.map(a => a.task_id) || [];
 
 // Gộp và loại bỏ trùng lặp
 const allTaskIds = Array.from(new Set([...directTaskIds, ...assigneeTaskIds]));
 
 if (allTaskIds.length > 0) {
 const { data: fetchedTasks, error: tError } = await supabase
 .from('tasks')
 .select('*')
 .in('id', allTaskIds)
 .order('created_at', { ascending: false });
 
 if (tError) throw tError;
 const filteredTasks = fetchedTasks || [];
 setMemberTasks(filteredTasks);

 const done = filteredTasks.filter(t => t.status === 'done').length;
 const pending = filteredTasks.filter(t => t.status !== 'done').length;
 const total = filteredTasks.length;
 const progressSum = filteredTasks.reduce((acc, t) => acc + (t.progress || 0), 0);
 const avgProgress = total > 0 ? Math.round(progressSum / total) : 0;
 setStats({ done, pending, total, avgProgress });
 } else {
 setMemberTasks([]);
 setStats({ done: 0, pending: 0, total: 0, avgProgress: 0 });
 }
 } catch (error) {
 console.error(error);
 router.push('/dashboard/team');
 } finally {
 setLoading(false);
 }
 };

 fetchAllData();
 }, [id, supabase, router]);

 const handleRecognize = async () => {
 if (!recognitionText.trim() || !member || !currentUser) return;
 setRecognizing(true);
 try {
 await supabase.from('recognitions').insert({
 sender_id: currentUser.id,
 receiver_id: id,
 content: recognitionText,
 department_id: member.department_id,
 scope: recognitionScope
 });

 // Lấy danh sách những người cần nhận thông báo
 let targetUserIds: string[] = [];
 if (recognitionScope === 'branch') {
 const { data: allProfiles } = await supabase.from('profiles').select('id');
 targetUserIds = allProfiles?.map(p => p.id) || [];
 } else if (recognitionScope === 'department') {
 const { data: deptProfiles } = await supabase.from('profiles').select('id').eq('department_id', member.department_id);
 targetUserIds = deptProfiles?.map(p => p.id) || [];
 } else {
 targetUserIds = [id]; // Mặc định chỉ gửi cho người nhận
 }

 if (targetUserIds.length > 0) {
 const notifications = targetUserIds.map(userId => ({
 user_id: userId,
 title: recognitionScope === 'branch' ? "VINH DANH TOÀN CHI NHÁNH" : "Vinh danh nội bộ phòng",
 content: `${member.full_name} đã được vinh danh: "${recognitionText}"`,
 link: `/dashboard/team/${id}`
 }));
 await supabase.from('notifications').insert(notifications);
 }

 toast({ title: "Đã vinh danh nhân sự" });
 setIsRecognizeOpen(false);
 setRecognitionText("");
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setRecognizing(false);
 }
 };

 const getPerf = (prog: number) => {
 if (prog >= 80) return { label: "Vượt trội", color: "text-emerald-600" };
 if (prog >= 50) return { label: "Tốt", color: "text-primary" };
 return { label: "Cần cải thiện", color: "text-amber-600" };
 };
 const perf = getPerf(stats.avgProgress);

 return (
 <div className="max-w-6xl mx-auto px-0 sm:px-6 animate-fade-in-up pb-20">
 <div className="flex items-center justify-between mb-8 px-4 sm:px-0 pt-4 sm:pt-0">
 <Button variant="ghost" asChild className="p-0 hover:bg-transparent text-slate-500 hover:text-primary transition-colors group">
 <Link href="/dashboard/team" className="flex items-center gap-2">
 <div className="p-2 rounded-xl group-hover:bg-primary/5 transition-colors">
 <ChevronLeft className="w-4 h-4" />
 </div>
 <span className="text-xs font-bold uppercase truncate whitespace-nowrap">Danh sách cán bộ</span>
 </Link>
 </Button>
 </div>

 {loading ? (
 <div className="flex h-96 items-center justify-center">
 <Loader2 className="h-6 w-6 animate-spin text-primary" />
 </div>
 ) : !member ? (
 <div className="flex h-96 items-center justify-center text-slate-500 font-bold">
 Không tìm thấy dữ liệu nhân sự.
 </div>
 ) : (
 <>
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-8 px-4 sm:px-0">
 <div className="flex items-center gap-8">
 <div className="relative">
 <Avatar className="h-24 w-24 border-4 border-white shadow-premium ring-1 ring-slate-100">
 <AvatarImage src={member.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-white text-3xl font-bold tabular-nums tracking-tighter">
 {member.full_name?.[0]?.toUpperCase()}
 </AvatarFallback>
 </Avatar>
 <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-full border-4 border-white shadow-sm">
 <CheckCircle2 className="w-4 h-4 text-white" />
 </div>
 </div>
 <div className="space-y-1">
 <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none tabular-nums">{member.full_name}</h1>
 <div className="flex items-center gap-3 text-[11px] font-bold uppercase pt-2 truncate whitespace-nowrap">
 <div className="flex items-center gap-1.5 text-primary">
 <Building2 className="w-3.5 h-3.5" />
 <span>{member.departments?.name || "Hội sở / Chi nhánh"}</span>
 </div>
 <span className="text-slate-200">|</span>
 <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-bold px-2 py-0">
 {member.role === 'admin' ? "Quản trị" : member.role === 'manager' ? "Lãnh đạo đơn vị" : "Cán bộ"}
 </Badge>
 </div>
 </div>
 </div>
 
 {currentUser?.id !== member.id && (currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
 <Dialog open={isRecognizeOpen} onOpenChange={setIsRecognizeOpen}>
 <DialogTrigger asChild>
 <Button className="bg-amber-400 hover:bg-amber-500 text-white rounded-2xl font-bold px-8 h-12 shadow-lg shadow-amber-200 active:scale-95 transition-all gap-2">
 <Award className="w-5 h-5" /> VINH DANH CÁN BỘ
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-[40px] border-none p-0 overflow-hidden max-w-sm shadow-2xl">
 <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-10 text-white text-center relative">
 <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
 <Star className="w-32 h-32 -ml-16 -mt-8 rotate-12" />
 </div>
 <Star className="w-12 h-12 fill-white mx-auto mb-4 drop-shadow-lg" />
 <DialogTitle className="text-2xl font-bold uppercase tracking-tight tabular-nums">Khen tặng cán bộ</DialogTitle>
 <p className="text-[10px] font-bold text-amber-100 uppercase mt-2 opacity-90 truncate whitespace-nowrap">Ghi nhận cống hiến xuất sắc</p>
 </div>
 <div className="p-8 space-y-6">
 <div className="space-y-3">
 <label className="text-[10px] font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Phạm vi công bố</label>
 <Select value={recognitionScope} onValueChange={setRecognitionScope}>
 <SelectTrigger className="h-12 rounded-2xl border-none bg-slate-50 font-bold text-slate-600 shadow-inner px-5">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
 <SelectItem value="department" className="rounded-xl py-3 font-bold cursor-pointer">
 <div className="flex items-center gap-3 text-slate-600">
 <UsersIcon className="w-4 h-4" /> NỘI BỘ PHÒNG
 </div>
 </SelectItem>
 <SelectItem value="branch" className="rounded-xl py-3 font-bold cursor-pointer">
 <div className="flex items-center gap-3 text-amber-600">
 <Globe className="w-4 h-4" /> TOÀN CHI NHÁNH
 </div>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-3">
 <label className="text-[10px] font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Nội dung ghi nhận</label>
 <Textarea 
 placeholder="Nhập lời khen ngợi cho những đóng góp của cán bộ..." 
 className="rounded-[24px] bg-slate-50 border-none focus-visible:ring-amber-400 text-sm p-5 shadow-inner placeholder:text-slate-500 min-h-[120px]"
 value={recognitionText}
 onChange={(e) => setRecognitionText(e.target.value)}
 />
 </div>

 <Button onClick={handleRecognize} disabled={recognizing || !recognitionText.trim()} className="w-full bg-slate-900 hover:bg-black h-14 rounded-2xl font-bold text-white shadow-xl shadow-slate-900/20 active:scale-95 transition-all">
 {recognizing ? <Loader2 className="w-5 h-5 animate-spin" /> : "XÁC NHẬN VINH DANH"}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 )}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4 sm:px-0">
 <div className="lg:col-span-8 space-y-8">
 <div className="flex items-center justify-between pl-1">
 <h3 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 truncate whitespace-nowrap">
 <Briefcase className="w-4 h-4 text-primary" /> HÀNH TRÌNH CÔNG VIỆC ({memberTasks.length})
 </h3>
 </div>
 <div className="flex flex-col gap-3">
 {memberTasks.length > 0 ? (
 memberTasks.map((t) => (
 <Link key={t.id} href={`/dashboard/tasks/${t.id}`} className="block">
 <div className="premium-card p-4 flex items-center justify-between group border-none active:scale-[0.99] transition-all">
 <div className="space-y-1.5 flex-1 min-w-0">
 <p className="text-[14px] font-bold text-slate-900 group-hover:text-primary transition-colors leading-tight truncate">{t.title}</p>
 <div className="flex items-center gap-3 text-[9px] text-slate-500 font-bold uppercase ">
 <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg text-primary/70"><Calendar className="w-3 h-3" /> {new Date(t.due_date).toLocaleDateString('vi-VN')}</span>
 <span className={cn("px-2 py-0.5 rounded-lg", t.priority === 'high' ? "bg-red-50 text-red-500" : "bg-slate-50 text-slate-500")}>
 {t.priority === 'high' ? 'KHẨN CẤP' : 'THƯỜNG'}
 </span>
 </div>
 </div>
 <div className="flex items-center gap-4 shrink-0">
 <div className="text-right flex flex-col items-end gap-1">
 <span className="text-[10px] font-bold text-primary uppercase truncate whitespace-nowrap">{t.progress}%</span>
 <Progress value={t.progress} className="h-0.5 w-12 bg-slate-100 shadow-none" />
 </div>
 <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-primary/5 transition-colors">
 <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-primary transition-all" />
 </div>
 </div>
 </div>
 </Link>
 ))
 ) : (
 <div className="py-20 bg-slate-50/50 rounded-[40px] text-center text-slate-500 italic text-sm border-2 border-dashed border-slate-100/50">
 Cán bộ chưa tham gia hành trình nào.
 </div>
 )}
 </div>
 </div>

 <div className="lg:col-span-4 space-y-10">
 <div className="premium-card p-8 border-none space-y-8">
 <div className="space-y-2">
 <p className="text-[10px] font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Đánh giá năng lực</p>
 <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100/50 text-center">
 <span className={cn("text-3xl font-bold tracking-tight block", perf.color)}>{perf.label.toUpperCase()}</span>
 <p className="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Hiệu suất tháng này</p>
 </div>
 </div>

 <div className="pt-6 border-t border-slate-50/80 space-y-6">
 <div className="space-y-6">
 <div className="space-y-3">
 <div className="flex justify-between text-[11px] font-bold uppercase truncate whitespace-nowrap">
 <span className="text-slate-500">Tiến độ bình quân</span>
 <span className="text-primary">{stats.avgProgress}%</span>
 </div>
 <Progress value={stats.avgProgress} className="h-2.5 bg-slate-50 shadow-inner" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2 p-5 bg-emerald-50/30 rounded-[24px] border border-emerald-50 text-center">
 <p className="text-[10px] font-bold text-emerald-600 uppercase truncate whitespace-nowrap">Hoàn thành</p>
 <p className="text-3xl font-bold text-emerald-700 tabular-nums tracking-tighter">{stats.done}</p>
 </div>
 <div className="space-y-2 p-5 bg-amber-50/30 rounded-[24px] border border-amber-50 text-center">
 <p className="text-[10px] font-bold text-amber-600 uppercase truncate whitespace-nowrap">Đang chờ</p>
 <p className="text-3xl font-bold text-amber-700 tabular-nums tracking-tighter">{stats.pending}</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </>
 )}
 </div>
 );
}
