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
 Users as UsersIcon,
 Phone
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
 const [recognitionType, setRecognitionType] = useState("praise");
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

 // Kiểm tra quyền truy cập
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
 
 const directTaskIds = directTasks?.map((t: any) => t.id) || [];

 const { data: assignments } = await supabase
 .from('task_assignees')
 .select('task_id')
 .eq('user_id', id);
 
 const assigneeTaskIds = assignments?.map((a: any) => a.task_id) || [];
 
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

  const done = filteredTasks.filter((t: any) => t.status === 'done').length;
  const pending = filteredTasks.filter((t: any) => t.status !== 'done').length;
  const total = filteredTasks.length;
  const progressSum = filteredTasks.reduce((acc: number, t: any) => acc + (t.progress || 0), 0);
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
 scope: recognitionScope, type: recognitionType
 });

 // Lấy danh sách những người cần nhận thông báo
 let targetUserIds: string[] = [];
 if (recognitionScope === 'branch') {
 const { data: allProfiles } = await supabase.from('profiles').select('id');
  targetUserIds = allProfiles?.map((p: any) => p.id) || [];
 } else if (recognitionScope === 'department') {
 const { data: deptProfiles } = await supabase.from('profiles').select('id').eq('department_id', member.department_id);
  targetUserIds = deptProfiles?.map((p: any) => p.id) || [];
 } else {
 targetUserIds = [id as string]; // Mặc định chỉ gửi cho người nhận
 }

 if (targetUserIds.length > 0) {
 const notifications = targetUserIds.map(userId => ({
 user_id: userId,
 title: recognitionType === 'remind' ? (recognitionScope === 'branch' ? "Nhắc nhở toàn chi nhánh" : "Nhắc nhở nội bộ phòng") : (recognitionScope === 'branch' ? "Vinh danh toàn chi nhánh" : "Vinh danh nội bộ phòng"),
  content: recognitionType === 'remind' ? `Cán bộ ${member.full_name} đã được góp ý: "${recognitionText}"` : `${member.full_name} đã được vinh danh: "${recognitionText}"`,
 link: `/dashboard/team/${id}`
 }));
 await supabase.from('notifications').insert(notifications);
 }

 toast({ title: recognitionType === "remind" ? "Đã gửi ý kiến nhắc nhở" : "Đã vinh danh nhân sự" });
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
 <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-8 animate-fade-in-up pb-20">
 <div className="flex items-center justify-between pt-4 sm:pt-0">
 <Button variant="ghost" asChild className="p-0 hover:bg-transparent text-slate-500 hover:text-primary transition-colors group">
 <Link href="/dashboard/team" className="flex items-center gap-2">
 <div className="p-2 rounded-xl group-hover:bg-primary/5 transition-colors">
 <ChevronLeft className="w-4 h-4" />
 </div>
 <span className="text-sm font-medium truncate whitespace-nowrap">Danh sách cán bộ</span>
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
 {/* Profile Header - Wrapped in premium-card */}
 <div className="premium-card p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
 <div className="flex flex-col sm:flex-row sm:items-center gap-6 min-w-0 flex-1">
 <div className="relative shrink-0 w-24">
 <Avatar className="h-24 w-24 border-4 border-white shadow-premium ring-1 ring-slate-100">
 <AvatarImage src={member.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-white text-3xl font-bold tabular-nums">
 {member.full_name?.[0]}
 </AvatarFallback>
 </Avatar>
 <div className="absolute -bottom-1 -right-1 bg-emerald-500 p-1.5 rounded-full border-4 border-white shadow-sm">
 <CheckCircle2 className="w-4 h-4 text-white" />
 </div>
 </div>
 <div className="space-y-1.5 min-w-0 flex-1">
 <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight tabular-nums truncate">{member.full_name}</h1>
 <div className="flex flex-wrap items-center gap-3 text-[12px] font-bold pt-1">
 <div className="flex items-center gap-1.5 text-primary bg-primary/5 px-2.5 py-1 rounded-lg">
 <Building2 className="w-3.5 h-3.5" />
 <span className="truncate max-w-[200px]">{member.departments?.name || "Hội sở / Chi nhánh"}</span>
 </div>
 <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-bold px-2.5 py-1">
 {member.role === 'admin' ? "Quản trị" : member.role === 'manager' ? "Lãnh đạo đơn vị" : "Cán bộ"}
 </Badge>
 </div>
 </div>
 </div>
 
 {currentUser?.id !== member.id && (currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'director') && (
 <div className="shrink-0">
 <Dialog open={isRecognizeOpen} onOpenChange={setIsRecognizeOpen}>
 <DialogTrigger asChild>
 <Button className="w-full sm:w-auto bg-amber-400 hover:bg-amber-500 text-white rounded-2xl font-bold px-8 h-12 shadow-lg shadow-amber-200/50 active:scale-95 transition-all gap-2">
 <Award className="w-5 h-5" /> Vinh danh & chấn chỉnh
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-[2rem] border-none p-0 overflow-hidden max-w-sm shadow-2xl">
 <div className={cn("p-10 text-white text-center relative transition-all duration-500", recognitionType === 'praise' ? "bg-gradient-to-br from-amber-400 to-amber-600" : "bg-gradient-to-br from-slate-700 to-slate-800")}>
 <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
 <Star className="w-32 h-32 -ml-16 -mt-8 rotate-12" />
 </div>
 <Star className="w-12 h-12 fill-white mx-auto mb-4 drop-shadow-lg" />
 <DialogTitle className="text-2xl font-bold tabular-nums">{recognitionType === 'praise' ? "Khen tặng cán bộ" : "Góp ý & Nhắc nhở"}</DialogTitle>
 <p className="text-sm font-medium text-amber-100 mt-2 opacity-90 truncate whitespace-nowrap">{recognitionType === 'praise' ? "Ghi nhận cống hiến xuất sắc" : "Chấn chỉnh & tạo động lực"}</p>
 </div>
 <div className="p-8 space-y-6">
 <div className="space-y-3">
  <label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Loại ghi nhận</label>
  <Select value={recognitionType} onValueChange={setRecognitionType}>
  <SelectTrigger className="h-12 rounded-2xl border-none bg-slate-50 font-bold text-slate-600 shadow-inner px-5">
  <SelectValue />
  </SelectTrigger>
  <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
  <SelectItem value="praise" className="rounded-xl py-3 font-bold cursor-pointer">
  <div className="flex items-center gap-3 text-amber-600">
  <Award className="w-4 h-4" /> Vinh danh / khen thưởng
  </div>
  </SelectItem>
  <SelectItem value="remind" className="rounded-xl py-3 font-bold cursor-pointer">
  <div className="flex items-center gap-3 text-slate-600">
  <Clock className="w-4 h-4" /> GÓP Ý / Nhắc nhở
  </div>
  </SelectItem>
  </SelectContent>
  </Select>
  </div>

  <div className="space-y-3">
  <label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Phạm vi công bố</label>
 <Select value={recognitionScope} onValueChange={setRecognitionScope}>
 <SelectTrigger className="h-12 rounded-2xl border-none bg-slate-50 font-bold text-slate-600 shadow-inner px-5">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
 <SelectItem value="department" className="rounded-xl py-3 font-bold cursor-pointer">
 <div className="flex items-center gap-3 text-slate-600">
 <UsersIcon className="w-4 h-4" /> Nội bộ phòng
 </div>
 </SelectItem>
 <SelectItem value="branch" className="rounded-xl py-3 font-bold cursor-pointer">
 <div className="flex items-center gap-3 text-amber-600">
 <Globe className="w-4 h-4" /> Toàn chi nhánh
 </div>
 </SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-3">
 <label className="text-sm font-medium text-slate-500 pl-1 truncate whitespace-nowrap">Nội dung ghi nhận</label>
 <Textarea 
 placeholder={recognitionType === 'praise' ? "Nhập lời khen ngợi cho những đóng góp của cán bộ..." : "Nhập ý kiến nhắc nhở, chấn chỉnh tế nhị mang tính xây dựng..."} 
 className="rounded-[24px] bg-slate-50 border-none focus-visible:ring-amber-400 text-sm p-5 shadow-inner placeholder:text-slate-500 min-h-[120px] resize-none"
 value={recognitionText}
 onChange={(e) => setRecognitionText(e.target.value)}
 />
 </div>

 <Button onClick={handleRecognize} disabled={recognizing || !recognitionText.trim()} className="w-full bg-slate-900 hover:bg-black h-14 rounded-2xl font-bold text-white shadow-xl shadow-slate-900/20 active:scale-95 transition-all">
 {recognizing ? <Loader2 className="w-5 h-5 animate-spin" /> : (recognitionType === 'praise' ? "Xác nhận vinh danh" : "Xác nhận nhắc nhở")}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 )}
 </div>

 <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
 <div className="xl:col-span-8 space-y-6">
 <div className="premium-card p-6 md:p-8 border-none space-y-6">
 <div className="flex items-center justify-between">
 <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
 <Briefcase className="w-4 h-4 text-primary" /> 
 <span>Hành trình công việc <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary">{memberTasks.length}</Badge></span>
 </h3>
 </div>
 
 <div className="flex flex-col gap-3">
 {memberTasks.length > 0 ? (
 memberTasks.map((t) => (
 <Link key={t.id} href={`/dashboard/tasks/${t.id}`} className="block">
 <div className="bg-slate-50/50 hover:bg-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 group border border-slate-100 hover:border-primary/20 hover:shadow-md transition-all active:scale-[0.99]">
 <div className="space-y-2 flex-1 min-w-0">
 <p className="text-[14px] font-bold text-slate-900 group-hover:text-primary transition-colors leading-tight truncate">{t.title}</p>
 <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-medium">
 <span className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200/60 shadow-sm"><Calendar className="w-3.5 h-3.5 text-primary/70" /> {new Date(t.due_date).toLocaleDateString('vi-VN')}</span>
 <span className={cn("px-2 py-1 rounded-lg border shadow-sm", t.priority === 'high' ? "bg-red-50 text-red-600 border-red-100" : "bg-white text-slate-500 border-slate-200/60")}>
 {t.priority === 'high' ? 'Khẩn cấp' : 'Thường'}
 </span>
 </div>
 </div>
 <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
 <div className="text-right flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-24">
 <span className="text-sm font-bold text-primary">{t.progress}%</span>
 <Progress value={t.progress} className="h-1.5 w-full sm:w-20 bg-slate-200/60 shadow-inner" />
 </div>
 <div className="hidden sm:flex p-2 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:bg-primary group-hover:border-primary transition-all">
 <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
 </div>
 </div>
 </div>
 </Link>
 ))
 ) : (
 <div className="py-16 bg-slate-50 rounded-3xl text-center border-2 border-dashed border-slate-200/60">
 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100">
 <Briefcase className="w-6 h-6 text-slate-400" />
 </div>
 <p className="text-slate-500 font-medium text-sm">Cán bộ chưa có nhiệm vụ nào</p>
 </div>
 )}
 </div>
 </div>
 </div>

 <div className="xl:col-span-4 space-y-8">
 {(member.phone || member.birthday) && (
 <div className="premium-card p-6 md:p-8 border-none space-y-6">
 <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
 <Mail className="w-4 h-4 text-primary" /> Thông tin liên hệ
 </h3>
 <div className="space-y-4">
 {member.phone && (
 <div className="flex items-center gap-4">
 <div className="p-3 bg-blue-50/80 text-blue-500 rounded-[14px] border border-blue-100/50">
 <Phone className="h-[18px] w-[18px]" />
 </div>
 <div className="flex-1 min-w-0 space-y-0.5">
 <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Điện thoại</p>
 <a href={`tel:${member.phone}`} className="text-[14px] font-bold text-slate-900 truncate hover:text-blue-600 hover:underline block">{member.phone}</a>
 </div>
 </div>
 )}
 {member.birthday && (
 <div className="flex items-center gap-4">
 <div className="p-3 bg-amber-50/80 text-amber-500 rounded-[14px] border border-amber-100/50">
 <Calendar className="h-[18px] w-[18px]" />
 </div>
 <div className="flex-1 min-w-0 space-y-0.5">
 <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Ngày sinh</p>
 <p className="text-[14px] font-bold text-slate-900 truncate">{new Date(member.birthday).toLocaleDateString('vi-VN')}</p>
 </div>
 </div>
 )}
 </div>
 </div>
 )}

 <div className="premium-card p-6 md:p-8 border-none space-y-8">
 <h3 className="text-[13px] font-bold text-slate-900 flex items-center gap-2">
 <Target className="w-4 h-4 text-primary" /> Đánh giá năng lực
 </h3>
 <div className="space-y-6">
 <div className="p-6 bg-slate-50/80 rounded-3xl border border-slate-100 text-center shadow-sm">
 <span className={cn("text-4xl font-extrabold block tracking-tight", perf.color)}>{perf.label}</span>
 <p className="text-[11px] font-bold text-slate-500 mt-2 uppercase tracking-widest">Hiệu suất tháng này</p>
 </div>

 <div className="space-y-5">
 <div className="space-y-2">
 <div className="flex justify-between text-[12px] font-bold">
 <span className="text-slate-500">Tiến độ bình quân</span>
 <span className="text-primary">{stats.avgProgress}%</span>
 </div>
 <Progress value={stats.avgProgress} className="h-2.5 bg-slate-100 shadow-inner" />
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1.5 p-4 bg-emerald-50/50 rounded-[20px] border border-emerald-100 text-center">
 <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Hoàn thành</p>
 <p className="text-3xl font-extrabold text-emerald-700 tabular-nums">{stats.done}</p>
 </div>
 <div className="space-y-1.5 p-4 bg-amber-50/50 rounded-[20px] border border-amber-100 text-center">
 <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Đang chờ</p>
 <p className="text-3xl font-extrabold text-amber-700 tabular-nums">{stats.pending}</p>
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
