'use client'

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
 ChevronLeft, 
 Loader2, 
 Calendar, 
 MessageSquare,
 Clock,
 CheckCircle2,
 Trash2,
 Send,
 Flag,
 Target,
 PlayCircle,
 AlertCircle,
 TrendingUp,
 History,
 Minus,
 Plus as PlusIcon,
 Star,
 Zap,
 User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 AlertDialog,
 AlertDialogAction,
 AlertDialogCancel,
 AlertDialogContent,
 AlertDialogDescription,
 AlertDialogFooter,
 AlertDialogHeader,
 AlertDialogTitle,
 AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";

export default function TaskDetailPage() {
 const { id } = useParams();
 const router = useRouter();
 const { toast } = useToast();
 const supabase = createClient();
 
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [posting, setPosting] = useState(false);
 const [task, setTask] = useState<any>(null);
 const [assignees, setAssignees] = useState<any[]>([]);
 const [profile, setProfile] = useState<any>(null);
 const [comments, setComments] = useState<any[]>([]);
 const [newComment, setNewComment] = useState("");
 const [currentValue, setCurrentValue] = useState("");
 const [isEditingTask, setIsEditingTask] = useState(false);
 const [editData, setEditData] = useState<any>({});
 const [deptProfiles, setDeptProfiles] = useState<any[]>([]);
 const [delegationOpen, setDelegationOpen] = useState(false);
 const [selectedDelegate, setSelectedDelegate] = useState('');

 useEffect(() => {
 const fetchData = async () => {
 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 let p = null;
 if (user) {
 const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
 p = profileData;
 setProfile(profileData);
 }
 
 const { data, error } = await supabase
 .from('tasks')
 .select(`
 *, 
 creator:profiles!tasks_created_by_fkey(full_name, avatar_url, department_id, departments(name)),
 assignee:profiles!tasks_assignee_id_fkey(id, full_name, avatar_url),
 task_assignees(user_id, profile:profiles(full_name, avatar_url, role))
 `)
 .eq('id', id)
 .single();
 
 if (error) throw error;
 
 // KIỂM TRA QUYỀN TRUY CẬP (Rule: Phòng nào thấy việc phòng đó)
 const isOwner = data.created_by === user?.id;
 const isAssignee = data.assignee_id === user?.id || data.task_assignees?.some((a: any) => a.user_id === user?.id);
 
 // Nếu task chưa có department_id, lấy department_id của người tạo
 const taskDeptId = data.department_id || data.creator?.department_id;
 const isSameDept = taskDeptId === p?.department_id;
 const isAdmin = p?.role === 'admin';

 if (!isAdmin && !isOwner && !isAssignee && !isSameDept) {
 toast({
 variant: "destructive",
 title: "Truy cập bị từ chối",
 description: "Bạn không có quyền xem công việc này của đơn vị khác."
 });
 router.push('/dashboard/tasks');
 return;
 }

 setTask(data);

 // Gộp người đảm nhiệm chính và danh sách phụ
 const allAssignees = [...(data.task_assignees || [])];
 if (data.assignee_id && !allAssignees.find(a => a.user_id === data.assignee_id)) {
 allAssignees.push({
 user_id: data.assignee_id,
 profile: data.assignee
 });
 }
 setAssignees(allAssignees);

 } catch (error: any) {
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const fetchComments = async () => {
 const { data } = await supabase
 .from('task_comments')
 .select(`*, user:profiles(full_name, avatar_url)`)
 .eq('task_id', id)
 .order('created_at', { ascending: true });
 setComments(data || []);
 };

 fetchData();
 fetchComments();

 // Kích hoạt Real-time để đồng bộ dữ liệu ngay lập tức giữa các máy tính
 const channel = supabase
 .channel(`task_changes_${id}`)
 .on('postgres_changes', { 
 event: 'UPDATE', 
 schema: 'public', 
 table: 'tasks',
 filter: `id=eq.${id}` 
 }, (payload) => {
 setTask(payload.new);
 })
 .subscribe();

 return () => {
 supabase.removeChannel(channel);
 };
 }, [id, supabase, router, toast]);

 useEffect(() => {
 if (task && profile) {
 const myContribution = task.metadata?.contributions?.[profile.id] || 0;
 setCurrentValue(myContribution.toString());
 }
 }, [task, profile]);

 useEffect(() => {
  if (profile?.department_id) {
     supabase.from('profiles').select('*').eq('department_id', profile.department_id).neq('role', 'manager').then(({ data }) => setDeptProfiles(data || []));
  }
 }, [profile, supabase]);

 const handleDelegate = async () => {
   if (!selectedDelegate) return;
   setSaving(true);
   try {
     const isAlreadyAssigned = assignees.some(a => a.user_id === selectedDelegate);
     if (!isAlreadyAssigned) {
       await supabase.from('task_assignees').insert({ task_id: id, user_id: selectedDelegate });
       await supabase.from('tasks').update({ assignee_id: selectedDelegate }).eq('id', id);
       
       await supabase.from('notifications').insert({
         user_id: selectedDelegate,
         title: task.task_type === 'report' ? 'Báo cáo được phân công' : 'Công việc được phân công',
         content: `${profile?.full_name} đã phân công ${task.task_type === 'report' ? 'báo cáo' : 'công việc'}: ${task.title}`,
         link: `/dashboard/tasks/${id}`
       });
       
       toast({ title: "Đã phân công công việc" });
       setDelegationOpen(false);
       
       const selectedProfile = deptProfiles.find(p => p.id === selectedDelegate);
       if (selectedProfile) {
         setAssignees([...assignees, { user_id: selectedDelegate, profile: selectedProfile }]);
       }
     } else {
       toast({ title: "Cán bộ này đã có trong danh sách." });
     }
   } catch (err: any) {
     toast({ variant: "destructive", title: "Lỗi", description: err.message });
   } finally {
     setSaving(false);
   }
 };
 
 const handleUpdateTaskInfo = async () => {
  setSaving(true);
  try {
   const { error } = await supabase.from('tasks').update({
    title: editData.title,
    description: editData.description
   }).eq('id', id);
   if (error) throw error;
   setTask({ ...task, title: editData.title, description: editData.description });
   setIsEditingTask(false);
   toast({ title: "Thành công", description: "Cập nhật thông tin thành công." });
  } catch (error: any) {
   toast({ variant: "destructive", title: "Lỗi", description: error.message });
  } finally {
   setSaving(false);
  }
 };

 const handlePostComment = async (e: React.FormEvent) => {
  e.preventDefault();
 if (!newComment.trim() || !task) return;
 setPosting(true);
 try {
 const { error } = await supabase.from('task_comments').insert({
 task_id: id,
 user_id: profile.id,
 content: newComment
 });
 if (error) throw error;
 
 // Thông báo cho các thành viên khác
 const notifyUsers = assignees.filter(a => a.user_id !== profile?.id).map(a => ({
 user_id: a.user_id,
 title: `Thảo luận: ${task.title}`,
 content: `${profile.full_name}: "${newComment.length > 60 ? newComment.substring(0, 60) + '...' : newComment}"`,
 link: `/dashboard/tasks/${id}`
 }));
 if (notifyUsers.length > 0) {
 await supabase.from('notifications').insert(notifyUsers);
 }

 setNewComment("");
 
 const { data } = await supabase
 .from('task_comments')
 .select(`*, user:profiles(full_name, avatar_url)`)
 .eq('task_id', id)
 .order('created_at', { ascending: true });
 setComments(data || []);
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setPosting(false);
 }
 };

 const updateProgress = async (val: number) => {
 try {
 const { error } = await supabase.from('tasks').update({ progress: val }).eq('id', id);
 if (error) throw error;
 
 const notificationTitle = `Tiến độ mới: ${task.title}`;
 const notificationContent = `${profile?.full_name} đã cập nhật tiến độ lên ${val}%`;

 // 1. Nếu nhân viên cập nhật -> Báo cho Lãnh đạo (Người tạo)
 if (task.created_by !== profile?.id) {
 await supabase.from('notifications').insert({
 user_id: task.created_by,
 title: notificationTitle,
 content: notificationContent,
 link: `/dashboard/tasks/${id}`
 });
 }

 // 2. Nếu Lãnh đạo cập nhật -> Báo cho tất cả nhân viên tham gia
 const notifyAssignees = assignees.filter(a => a.user_id !== profile?.id).map(a => ({
 user_id: a.user_id,
 title: notificationTitle,
 content: notificationContent,
 link: `/dashboard/tasks/${id}`
 }));

 if (notifyAssignees.length > 0) {
 await supabase.from('notifications').insert(notifyAssignees);
 }

 setTask({ ...task, progress: val });
 toast({ title: `Cập nhật: ${val}%` });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 }
 };

 const handleUpdateStatus = async (newStatus: string) => {
  setSaving(true);
  try {
  const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
  if (error) throw error;
  
  const statusText = newStatus === 'done' ? 'Hoàn thành' : newStatus === 'closed' ? 'Đã đóng' : newStatus === 'late' ? 'Trễ hạn' : newStatus === 'doing' ? 'Đang thực hiện' : 'Đang chờ';
  const notificationTitle = `Trạng thái mới: ${task.title}`;
  const notificationContent = `${profile?.full_name} đã chuyển trạng thái sang: ${statusText}`;

 // 1. Nếu người sửa KHÔNG PHẢI người tạo -> Báo cho người tạo (Lãnh đạo)
 if (task.created_by !== profile?.id) {
 await supabase.from('notifications').insert({
 user_id: task.created_by,
 title: notificationTitle,
 content: notificationContent,
 link: `/dashboard/tasks/${id}`
 });
 }

 // 2. Nếu người sửa là Lãnh đạo hoặc Người tạo -> Báo cho tất cả nhân viên tham gia
 const notifyAssignees = assignees.filter(a => a.user_id !== profile?.id).map(a => ({
 user_id: a.user_id,
 title: notificationTitle,
 content: notificationContent,
 link: `/dashboard/tasks/${id}`
 }));

 if (notifyAssignees.length > 0) {
 await supabase.from('notifications').insert(notifyAssignees);
 }

 setTask({ ...task, status: newStatus });
 toast({ title: "Đã cập nhật trạng thái" });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setSaving(false);
 }
 };

 const handleLeaderUpdateContribution = async (userId: string, newValue: number) => {
 setSaving(true);
 const newMetadata = {
 ...task.metadata,
 contributions: {
 ...(task.metadata?.contributions || {}),
 [userId]: newValue
 }
 };
 
 const contributionsSum = Object.values(newMetadata.contributions || {}).reduce((a: any, b: any) => a + (parseInt(b) || 0), 0) as number;
 const generalAdj = parseInt(newMetadata.general_adjustment) || 0;
 const newTotal = contributionsSum + generalAdj;

 const prog = task.target_value ? Math.round((newTotal / task.target_value) * 100) : 0;

 try {
 const { error } = await supabase.from('tasks').update({ 
 current_value: newTotal,
 progress: prog,
 metadata: newMetadata
 }).eq('id', id);
 if (error) throw error;
 
 // Tạo thông báo cho nhân viên
 if (userId !== profile?.id) {
 await supabase.from('notifications').insert({
 user_id: userId,
 title: `Cập nhật đóng góp: ${task.title}`,
 content: `Lãnh đạo đã điều chỉnh số liệu của bạn thành: ${newValue} ${task.unit || ''}`,
 link: `/dashboard/tasks/${id}`
 });
 }

 setTask({ ...task, current_value: newTotal, progress: prog, metadata: newMetadata });
 toast({ title: "Đã điều chỉnh đóng góp" });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setSaving(false);
 }
 };

 const handleGeneralAdjustment = async (delta: number) => {
 setSaving(true);
 const oldAdj = task.metadata?.general_adjustment || 0;
 const newAdj = oldAdj + delta;
 
 const newMetadata = {
 ...task.metadata,
 general_adjustment: newAdj
 };

 const contributionsSum = Object.values(newMetadata.contributions || {}).reduce((a: any, b: any) => a + (parseInt(b) || 0), 0) as number;
 const newTotal = contributionsSum + newAdj;
 
 const prog = task.target_value ? Math.round((newTotal / task.target_value) * 100) : 0;

 try {
 const { error } = await supabase.from('tasks').update({ 
 current_value: newTotal,
 progress: prog,
 metadata: newMetadata
 }).eq('id', id);
 if (error) throw error;

 // Thông báo cho tất cả cán bộ tham gia (trừ chính người sửa)
 const notifyUsers = assignees.filter(a => a.user_id !== profile?.id).map(a => ({
 user_id: a.user_id,
 title: `Hiệu chỉnh phòng: ${task.title}`,
 content: `Số liệu chung của phòng đã được điều chỉnh ${delta > 0 ? '+' : ''}${delta} ${task.unit || ''}`,
 link: `/dashboard/tasks/${id}`
 }));
 
 if (notifyUsers.length > 0) {
 await supabase.from('notifications').insert(notifyUsers);
 }

 setTask({ ...task, current_value: newTotal, progress: prog, metadata: newMetadata });
 toast({ title: "Đã điều chỉnh thực tế phòng" });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setSaving(false);
 }
 };

 const handleUpdateAchievement = async () => {
 setSaving(true);
 const newContribution = parseInt(currentValue) || 0;
 
 const newMetadata = {
 ...task.metadata,
 contributions: {
 ...(task.metadata?.contributions || {}),
 [profile.id]: newContribution
 }
 };

 const contributionsSum = Object.values(newMetadata.contributions || {}).reduce((a: any, b: any) => a + (parseInt(b) || 0), 0) as number;
 const generalAdj = parseInt(newMetadata.general_adjustment) || 0;
 const newTotal = contributionsSum + generalAdj;

 const prog = task.target_value ? Math.round((newTotal / task.target_value) * 100) : 0;
 
 try {
 const { error } = await supabase.from('tasks').update({ 
 current_value: newTotal,
 progress: prog,
 metadata: newMetadata,
 status: prog >= 100 ? 'done' : task.status
 }).eq('id', id);
 
 if (error) throw error;

 // THÊM: Thông báo cho người tạo khi đạt 100% (Done)
 if (prog >= 100 && task.status !== 'done' && task.created_by !== profile?.id) {
 await supabase.from('notifications').insert({
 user_id: task.created_by,
 title: `Đạt mục tiêu: ${task.title}`,
 content: `${profile?.full_name} đã hoàn thành 100% chỉ tiêu được giao.`,
 link: `/dashboard/tasks/${id}`
 });
 }

 setTask({ 
 ...task, 
 current_value: newTotal, 
 progress: prog, 
 metadata: newMetadata,
 status: prog >= 100 ? 'done' : task.status 
 });
 toast({ title: "Đã ghi nhận đóng góp", description: `Bạn đã đóng góp ${newContribution} ${task.unit || ''}` });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setSaving(false);
 }
 };

 const handleToggleFocal = async () => {
 if (!canEdit) return;
 setSaving(true);
 const newIsFocal = !task.metadata?.is_focal;
 try {
 const { error } = await supabase.from('tasks').update({ 
 metadata: { ...task.metadata, is_focal: newIsFocal } 
 }).eq('id', id);
 
 if (error) throw error;
 setTask({ ...task, metadata: { ...task.metadata, is_focal: newIsFocal } });
 toast({ 
 title: newIsFocal ? "Đã thiết lập Kế hoạch trọng tâm" : "Đã bỏ ghim Kế hoạch",
 description: newIsFocal ? "Chỉ tiêu này sẽ được ưu tiên hiển thị trên Dashboard." : "" 
 });
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setSaving(false);
 }
 };

 const adjustValue = (delta: number) => {
 setCurrentValue(prev => (Math.max(0, (parseInt(prev) || 0) + delta)).toString());
 };

 const isAssignee = assignees.some(a => a.user_id === profile?.id) || task?.assignee_id === profile?.id;
 const isInDepartment = task?.department_id === profile?.department_id;
 const isAdminOrDirector = profile?.role === 'admin' || profile?.role === 'director';
 const isManagerInDept = profile?.role === 'manager' && isInDepartment;
 const isMyTask = isAssignee || task?.created_by === profile?.id;
 const isClosed = task?.status === 'closed';
 const canEdit = (!isClosed) && (isAdminOrDirector || isManagerInDept || isMyTask);
 
 const statusMap: Record<string, { label: string, color: string, bg: string, icon: any }> = {
 todo: { label: 'Đang chờ', color: 'text-slate-600', bg: 'bg-slate-100', icon: Clock },
 doing: { label: 'Đang làm', color: 'text-primary', bg: 'bg-primary/5', icon: PlayCircle },
 done: { label: 'Hoàn thành', color: 'text-emerald-700', bg: 'bg-emerald-50', icon: CheckCircle2 },
 late: { label: 'Trễ hạn', color: 'text-red-700', bg: 'bg-red-50', icon: AlertCircle },
 closed: { label: 'Đã đóng', color: 'text-slate-700', bg: 'bg-slate-200', icon: CheckCircle2 },
 }
 
 const currentStatus = task ? (statusMap[task.status] || statusMap.todo) : statusMap.todo;

 if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
 if (!task) return <div className="p-20 text-center font-bold text-slate-500">Không tìm thấy dữ liệu.</div>;

 const isStrategicPlan = task.task_type === 'kpi';
 
 const displayProgress = isStrategicPlan 
 ? (task.target_value ? Math.round(((task.current_value || 0) / task.target_value) * 100) : 0)
 : (task.progress || 0);

 return (
 <div className="max-w-6xl mx-auto px-0 sm:px-6 space-y-6 animate-fade-in-up pb-20">
 <div className="flex items-center justify-between px-4 sm:px-0">
 <Button variant="ghost" asChild className="p-0 hover:bg-transparent text-slate-500 hover:text-primary transition-colors group">
 <Link href={isStrategicPlan ? "/dashboard/kpi" : "/dashboard/tasks"} className="flex items-center gap-2">
 <div className="p-2 rounded-xl group-hover:bg-primary/5 transition-colors">
 <ChevronLeft className="w-4 h-4" />
 </div>
 <span className="text-[13px] font-medium">Quay lại danh sách</span>
 </Link>
 </Button>
 
 <AlertDialog>
 <AlertDialogTrigger asChild>
 <Button variant="ghost" className="text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl px-4 h-10 text-[13px] font-medium">
 <Trash2 className="w-4 h-4 mr-2" /> Xóa {isStrategicPlan ? 'Kế hoạch KPIs' : 'Công việc'}
 </Button>
 </AlertDialogTrigger>
 <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
 <AlertDialogHeader>
 <AlertDialogTitle className="text-[17px] font-semibold">Xác nhận xóa?</AlertDialogTitle>
 <AlertDialogDescription className="text-slate-500 font-medium">Dữ liệu sẽ được gỡ khỏi hệ thống vĩnh viễn.</AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter className="mt-4 gap-3">
 <AlertDialogCancel className="rounded-xl h-10 font-medium">Quay lại</AlertDialogCancel>
 <AlertDialogAction onClick={async () => { await supabase.from('tasks').delete().eq('id', id); router.push(isStrategicPlan ? '/dashboard/kpi' : '/dashboard/tasks'); }} className="rounded-xl h-10 bg-red-600 font-medium hover:bg-red-700 shadow-sm text-white border-none">Xác nhận xóa</AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
 <div className="lg:col-span-8 space-y-6">
 {/* Header Card */}
 <div className="premium-card p-6 md:p-8 border-none space-y-6 relative overflow-hidden">
 <div className="absolute -top-12 -right-12 p-8 text-primary/5 opacity-5 pointer-events-none">
 <Target className="w-48 h-48 rotate-12" />
 </div>

 <div className="flex items-center gap-2 relative z-10 flex-wrap">
 <Badge className={cn(
 "px-3 py-1 text-[11px] font-medium rounded-full border-none",
 isStrategicPlan ? "bg-primary text-white shadow-primary-glow" : (task?.task_type === 'report' ? "bg-indigo-500 text-white shadow-sm" : "bg-slate-100 text-slate-500")
 )}>
 {task?.task_type === 'report' ? 'Yêu cầu báo cáo' : isStrategicPlan ? 'Kế hoạch KPIs' : 'Công việc nghiệp vụ'}
 </Badge>
 {task.priority === 'high' && <Badge className="bg-red-50 text-red-600 border-none text-[11px] font-medium px-3 py-1 rounded-full">Khẩn cấp</Badge>}
 </div>
 
  {isEditingTask ? (
   <div className="relative z-10 space-y-4">
    <Input value={editData.title || ''} onChange={e => setEditData({...editData, title: e.target.value})} className="text-xl md:text-2xl font-semibold text-slate-900 bg-white" />
    <Input value={editData.description || ''} onChange={e => setEditData({...editData, description: e.target.value})} className="text-sm text-slate-500 font-medium bg-white" placeholder="Mô tả" />
    <div className="flex gap-2">
     <Button onClick={handleUpdateTaskInfo} disabled={saving} className="bg-primary text-white">Lưu</Button>
     <Button variant="outline" onClick={() => setIsEditingTask(false)}>Hủy</Button>
    </div>
   </div>
  ) : (
   <>
    <div className="flex justify-between items-start relative z-10">
     <h1 className="text-xl md:text-2xl font-semibold text-slate-900 tracking-tight leading-tight">{task.title}</h1>
     {((task.created_by === profile?.id || profile?.role === 'admin') || (task.task_type !== 'report' && canEdit)) && !isClosed && <Button variant="ghost" size="sm" onClick={() => { setEditData(task); setIsEditingTask(true); }}>Sửa</Button>}
    </div>
    <div className="bg-slate-50/50 p-4 md:p-5 rounded-2xl border border-slate-100/50 relative z-10">
     <p className="text-sm text-slate-500 font-medium leading-relaxed italic">"{task.description || (isStrategicPlan ? 'Chưa có mô tả chi tiết cho chỉ tiêu này.' : 'Chưa có mô tả chi tiết cho nhiệm vụ này.')}"</p>
    </div>
   </>
  )}

 </div>

 {/* Progress / Quantitative Card */}
 {task.task_type !== 'report' && (
 <div className="premium-card p-6 md:p-8 border-none space-y-6 md:space-y-8">
 <div className="flex items-center justify-between">
 <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 truncate whitespace-nowrap">
 <TrendingUp className="w-4 h-4 text-primary" />
 {isStrategicPlan ? 'TIẾN ĐỘ KẾ HOẠCH' : 'TIẾN ĐỘ THỰC HIỆN'}
 </h3>
 <div className="flex flex-col items-end">
 <span className="text-3xl font-bold text-primary tracking-tighter tabular-nums">{displayProgress}%</span>
 <div className="flex gap-1 mt-1">
 {[1,2,3,4,5].map(i => (
 <div key={i} className={cn("w-6 h-1 rounded-full", displayProgress >= i*20 ? "bg-primary" : "bg-slate-100")} />
 ))}
 </div>
 </div>
 </div>
 
 {isStrategicPlan ? (
 <div className="space-y-8">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="p-4 md:p-5 bg-slate-50 rounded-2xl space-y-1 border border-slate-100 shadow-sm transition-all hover:bg-white hover:shadow-premium group">
 <p className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 truncate whitespace-nowrap">
 <Target className="w-3 h-3 group-hover:text-primary transition-colors" /> Mục tiêu cần đạt
 </p>
 <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tighter">{task.target_value?.toLocaleString('vi-VN')} <span className="text-[11px] font-medium text-slate-500">{task.unit}</span></p>
 </div>
 <div className="p-4 md:p-5 bg-primary/5 rounded-2xl space-y-1 border border-primary/10 shadow-sm transition-all hover:bg-white hover:shadow-primary-glow group">
 <p className="text-xs font-bold text-primary uppercase flex items-center gap-2 truncate whitespace-nowrap">
 <Zap className="w-3 h-3 fill-primary/20" /> Thực tế ghi nhận
 </p>
 <p className="text-2xl font-bold text-primary tabular-nums tracking-tighter">{task.current_value?.toLocaleString('vi-VN') || 0} <span className="text-[11px] opacity-60">{task.unit}</span></p>
 </div>
 </div>
 
 <Progress value={Math.min(100, displayProgress)} className="h-2 bg-slate-50 shadow-inner" />
 
 {canEdit && (
 <div className="pt-6 border-t border-slate-50 space-y-4">
 <p className="text-[13px] font-medium text-primary">Cá nhân tôi đóng góp</p>
 <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
 <div className="flex items-center gap-2 bg-primary/5 p-1.5 rounded-xl border border-primary/10 w-full md:max-w-xs transition-all hover:bg-white hover:shadow-sm">
 <Button 
 type="button" 
 variant="ghost" 
 onClick={() => adjustValue(-1)}
 className="h-11 w-11 rounded-lg hover:bg-white hover:shadow-sm text-primary"
 >
 <Minus className="w-4 h-4" />
 </Button>
 <div className="flex-1 relative">
 <Input 
 type="number" 
 value={currentValue} 
 onChange={(e) => setCurrentValue(e.target.value)}
 className="h-10 bg-transparent border-none shadow-none text-center font-bold text-xl px-2 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-primary tabular-nums tracking-tighter" 
 />
 <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-primary/30 uppercase pointer-events-none">{task.unit}</span>
 </div>
 <Button 
 type="button" 
 variant="ghost" 
 onClick={() => adjustValue(1)}
 className="h-11 w-11 rounded-lg hover:bg-white hover:shadow-sm text-primary"
 >
 <PlusIcon className="w-4 h-4" />
 </Button>
 </div>
 <Button 
 onClick={handleUpdateAchievement} 
 disabled={saving} 
 className="bg-primary hover:bg-primary/90 h-10 px-5 rounded-xl font-medium w-full md:w-auto"
 >
 {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
 Cập nhật đóng góp
 </Button>
 </div>
 </div>
 )}

 <div className="pt-6 border-t border-slate-50 space-y-4">
 <div className="flex items-center justify-between px-1">
 <h4 className="text-[13px] font-medium text-slate-500">Tổng hợp đóng góp thực tế</h4>
 </div>
 <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
 {assignees.map((a, idx) => {
 const contrib = task.metadata?.contributions?.[a.user_id] || 0;
 const weight = task.current_value > 0 ? Math.min(100, Math.round((contrib / task.current_value) * 100)) : 0;
 const isMe = a.user_id === profile?.id;
 const isLeader = profile?.role === 'admin' || profile?.role === 'manager';

 return (
 <div key={a.user_id} className={cn(
 "flex flex-col p-4 sm:p-5 transition-all gap-3",
 idx !== 0 && "border-t border-slate-50",
 isMe && "bg-primary/[0.02]"
 )}>
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-3 min-w-0 flex-1">
 <Avatar className="h-8 w-8 shrink-0 border border-white shadow-sm ring-1 ring-slate-100">
 <AvatarImage src={a.profile?.avatar_url} className="object-cover" />
 <AvatarFallback className="text-[9px] font-bold bg-slate-100 text-slate-500">{a.profile?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <span className={cn("text-xs font-bold truncate", isMe ? "text-primary" : "text-slate-700")}>
 {a.profile?.full_name}
 </span>
 </div>
 
 <div className="flex items-center gap-4 shrink-0">
 {isLeader ? (
 <div className="relative group/input max-w-[110px]">
 <input 
 type="number"
 value={contrib}
 onChange={(e) => {
 const val = parseInt(e.target.value) || 0;
 handleLeaderUpdateContribution(a.user_id, val);
 }}
 className="w-full h-10 md:h-8 bg-slate-50/50 border border-slate-100 rounded-lg text-right text-base md:text-[11px] font-bold px-2 pr-14 focus:outline-none focus:bg-white focus:border-primary/30 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
 />
 <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] md:text-[7px] font-bold text-slate-500 uppercase pointer-events-none truncate max-w-[45px] whitespace-nowrap">{task.unit}</span>
 </div>
 ) : (
 <p className="font-bold text-slate-900 text-[11px]">
 {contrib.toLocaleString('vi-VN')} <span className="text-[8px] text-slate-500 font-bold uppercase">{task.unit}</span>
 </p>
 )}
 <span className="text-[10px] md:text-xs font-bold text-primary min-w-[30px] text-right">{weight}%</span>
 </div>
 </div>
 
 <div className="w-full h-1.5 bg-slate-50 rounded-full overflow-hidden shadow-inner">
 <div className="h-full bg-primary/40 transition-all duration-1000 rounded-full" style={{ width: `${weight}%` }} />
 </div>
 </div>
 );
 })}
 
 {(profile?.role === 'admin' || profile?.role === 'manager') && (
 <div className="bg-slate-50/50 border-t border-slate-100 p-4 sm:p-5 flex items-center justify-between">
 <div className="flex items-center gap-2 text-primary/60">
 <TrendingUp className="w-4 h-4" />
 <span className="text-[12px] font-medium text-primary/60">Hiệu chỉnh phòng</span>
 </div>
 <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200/60 shadow-sm shrink-0">
 <Button 
 variant="ghost" 
 size="icon" 
 className="h-8 w-8 md:h-8 md:w-8 rounded-lg text-primary hover:bg-primary/5"
 onClick={() => handleGeneralAdjustment(-1)}
 >
 <Minus className="w-4 h-4" />
 </Button>
 <span className="min-w-[40px] text-center font-bold text-sm text-slate-900">
 {(task.metadata?.general_adjustment || 0).toLocaleString('vi-VN')}
 </span>
 <Button 
 variant="ghost" 
 size="icon" 
 className="h-8 w-8 md:h-8 md:w-8 rounded-lg text-primary hover:bg-primary/5"
 onClick={() => handleGeneralAdjustment(1)}
 >
 <PlusIcon className="w-4 h-4" />
 </Button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 ) : (
 <div className="space-y-6">
 <div className="flex gap-2 h-2">
 {[25, 50, 75, 100].map((val) => (
 <button 
 key={val} 
 onClick={() => canEdit && updateProgress(val)}
 className={cn(
 "flex-1 rounded-full transition-all duration-300",
 (task.progress || 0) >= val ? "bg-primary" : "bg-slate-100",
 !canEdit && "cursor-default"
 )}
 />
 ))}
 </div>
 <div className="flex justify-between px-1">
 {["Tiếp nhận", "Thực hiện", "Kiểm soát", "Hoàn tất"].map((label, i) => (
 <span key={i} className={cn(
 "text-[11px] font-medium transition-colors",
 (task.progress || 0) >= (i+1)*25 ? "text-primary" : "text-slate-500"
 )}>{label}</span>
 ))}
 </div>
 </div>
 )}
 </div>
 )}

 {/* Discussion */}
 {task.task_type !== 'report' && (
 <div className="space-y-6 pt-4">
 <h3 className="text-xs font-bold text-slate-500 uppercase pl-2 flex items-center gap-2 truncate whitespace-nowrap">
 <MessageSquare className="w-4 h-4 text-primary" /> LUỒNG THẢO LUẬN
 </h3>
 <div className="space-y-4">
 {comments.map((c) => (
 <div key={c.id} className="flex gap-4 p-4 md:p-5 premium-card border-none">
 <Avatar className="h-11 w-11 shrink-0 border shadow-sm ring-1 ring-slate-100">
 <AvatarImage src={c.user?.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-slate-100 text-slate-500 font-bold">{c.user?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <div className="space-y-2 flex-1 min-w-0">
 <div className="flex items-center justify-between">
 <span className="text-sm font-bold text-slate-900">{c.user?.full_name}</span>
 <span className="text-[11px] text-slate-500 font-medium">{new Date(c.created_at).toLocaleDateString('vi-VN')}</span>
 </div>
 <p className="text-[13px] text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-3 rounded-2xl rounded-tl-none">{c.content}</p>
 </div>
 </div>
 ))}
 </div>
 <form onSubmit={handlePostComment} className="flex gap-3 pt-2 group">
 <Input 
 placeholder="Nhập nội dung trao đổi..." 
 className="finance-input flex-1 h-10 text-[14px] font-medium" 
 value={newComment}
 onChange={(e) => setNewComment(e.target.value)}
 disabled={posting}
 />
 <Button type="submit" disabled={posting || !newComment.trim()} className="h-10 w-10 rounded-xl bg-slate-900 hover:bg-black shadow-sm shrink-0 p-0">
 <Send className="w-5 h-5 text-white" />
 </Button>
 </form>
 </div>
 )}
 </div>

 {/* Sidebar */}
 <div className="lg:col-span-4 space-y-6">
 <div className="premium-card p-5 md:p-6 border-none space-y-8">
 <div className="space-y-4">
 <p className="text-[13px] font-medium text-slate-500">Trạng thái hiện tại</p>
 <Select disabled={(!canEdit && task.created_by !== profile?.id) || saving} value={task.status} onValueChange={handleUpdateStatus}>
 <SelectTrigger className={cn(
 "h-11 rounded-xl border-none shadow-sm flex items-center justify-between px-4 font-medium text-[14px] transition-all",
 currentStatus.bg,
 currentStatus.color
 )}>
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-xl border border-slate-200 shadow-lg p-1.5 min-w-[200px]">
 {Object.entries(statusMap).map(([key, value]) => {
   if (key === 'closed' && task.created_by !== profile?.id && profile?.role !== 'admin' && profile?.role !== 'director') return null;
   return (
     <SelectItem key={key} value={key} className="rounded-lg py-2 font-medium text-[13px] cursor-pointer">
     <div className="flex items-center gap-3">
     <div className={cn("w-2 h-2 rounded-full", key === 'done' ? 'bg-emerald-500' : key === 'doing' ? 'bg-primary' : key === 'late' ? 'bg-red-500' : key === 'closed' ? 'bg-slate-600' : 'bg-slate-300')} />
     {value.label}
     </div>
     </SelectItem>
   );
 })}
 </SelectContent>
 </Select>
 </div>

 {isStrategicPlan && (profile?.role === 'admin' || profile?.role === 'manager') && (
 <div className="pt-2">
 <Button 
 onClick={handleToggleFocal}
 variant={task.metadata?.is_focal ? "default" : "outline"}
 className={cn(
 "w-full h-10 rounded-xl font-medium text-[13px] transition-all gap-2",
 task.metadata?.is_focal ? "bg-amber-400 hover:bg-amber-500 text-white border-none shadow-lg shadow-amber-200" : "bg-slate-50 border-none text-slate-500 hover:bg-slate-100"
 )}
 >
 <Star className={cn("w-4 h-4", task.metadata?.is_focal && "fill-current")} />
 {task.metadata?.is_focal ? "Kế hoạch KPIs trọng tâm" : "Ghim làm Kế hoạch trọng tâm"}
 </Button>
 </div>
 )}

 <div className="space-y-3">
 <div className="flex items-center justify-between">
   <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Cán bộ tiếp nhận</p>
   {(profile?.role === 'manager' || profile?.role === 'admin') && !isClosed && (
      <Popover open={delegationOpen} onOpenChange={setDelegationOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-[11px] font-bold text-primary hover:bg-primary/5">Phân công</Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-3 rounded-xl shadow-xl border-slate-200" align="end">
          <div className="space-y-3">
            <h4 className="font-bold text-[13px] text-slate-900">Phân công cho cán bộ</h4>
            <Select value={selectedDelegate} onValueChange={setSelectedDelegate}>
              <SelectTrigger className="w-full h-9 text-[12px] rounded-lg bg-slate-50 border-slate-200">
                <SelectValue placeholder="Chọn cán bộ..." />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {deptProfiles.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-[12px]">{p.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleDelegate} disabled={saving} className="w-full h-9 rounded-lg text-[12px] bg-primary">Xác nhận</Button>
          </div>
        </PopoverContent>
      </Popover>
   )}
 </div>
 <div className="space-y-2">
 {assignees.length > 0 ? assignees.map((a) => (
 <div key={a.user_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
 <Avatar className="h-8 w-8 border border-white shadow-sm">
 <AvatarImage src={a.profile?.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-white text-[9px] font-bold">{a.profile?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <div className="flex flex-col">
 <span className="text-xs font-bold text-slate-900">{a.profile?.full_name}</span>
 <span className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">Cán bộ</span>
 </div>
 </div>
 )) : (
 task.assignee ? (
 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
 <Avatar className="h-8 w-8 border border-white shadow-sm">
 <AvatarImage src={task.assignee?.avatar_url} className="object-cover" />
 <AvatarFallback className="bg-primary text-white text-[9px] font-bold">{task.assignee?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <div className="flex flex-col">
 <span className="text-xs font-bold text-slate-900">{task.assignee?.full_name}</span>
 <span className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">Cán bộ tiếp nhận</span>
 </div>
 </div>
 ) : (
 <div className="p-4 bg-primary/5/50 rounded-xl border border-primary/10 text-center">
 <p className="text-xs font-bold text-primary uppercase truncate whitespace-nowrap">
 {task.department?.name ? task.department.name.toUpperCase() : "PHÒNG NGHIỆP VỤ"}
 </p>
 </div>
 )
 )}
 </div>
 </div>

 <div className="pt-4 border-t border-slate-50 grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Hạn chót</p>
 <div className="flex items-center gap-2 text-xs font-bold text-slate-900 p-3 bg-slate-50 rounded-xl border border-slate-100">
 <Calendar className="w-3.5 h-3.5 text-primary" />
 {new Date(task.due_date).toLocaleDateString('vi-VN')}
 </div>
 </div>
 <div className="space-y-2">
 <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Mức độ</p>
 <div className="flex items-center gap-2 text-xs font-bold text-slate-900 p-3 bg-slate-50 rounded-xl border border-slate-100">
 <Flag className={cn("w-3.5 h-3.5", task.priority === 'high' ? "text-red-500" : "text-primary")} />
 {task.priority === 'high' ? 'KHẨN' : 'THƯỜNG'}
 </div>
 </div>
 </div>

 <div className="pt-6 border-t border-slate-50 space-y-3">
 <p className="text-xs font-bold text-slate-500 uppercase pl-1 truncate whitespace-nowrap">Khởi tạo bởi</p>
 <div className="flex items-center gap-3 px-1">
 <Avatar className="h-7 w-7 border border-white shadow-sm">
 <AvatarImage src={task.creator?.avatar_url} className="object-cover" />
 <AvatarFallback className="text-[8px] font-bold">{task.creator?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <div className="flex flex-col">
 <span className="text-xs font-bold text-slate-900 leading-none">{task.creator?.full_name}</span>
 <span className="text-[9px] font-medium text-slate-500">{task.creator?.departments?.name}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
