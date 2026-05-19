'use client'

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from "react";
import {
 Plus,
 Target,
 Loader2,
 Trophy,
 TrendingUp,
 ChevronRight,
 Award,
 Search,
 ListChecks,
 CheckCircle2,
 TrendingDown,
 Activity,
 Zap,
 CreditCard,
 Building2,
 Sparkles,
 ArrowRight,
 Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
 Dialog,
 DialogContent,
 DialogTitle,
 DialogTrigger
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 Table,
 TableBody,
 TableCell,
 TableHead,
 TableHeader,
 TableRow
} from '@/components/ui/table'
import { useToast } from "@/hooks/use-toast";
import { cn, sortProfilesByHierarchy } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

const KPI_CATEGORIES = [
 { id: 'lending', label: "Tín dụng", icon: TrendingUp, color: "text-primary", bg: "bg-primary/5", activeBg: "bg-primary/10" },
 { id: 'saving', label: "Huy động", icon: Award, color: "text-emerald-600", bg: "bg-emerald-50", activeBg: "bg-emerald-100" },
 { id: 'card', label: "Thẻ & Phí", icon: CreditCard, color: "text-purple-600", bg: "bg-purple-50", activeBg: "bg-purple-100" },
 { id: 'digital', label: "Dịch vụ số", icon: Zap, color: "text-amber-600", bg: "bg-amber-50", activeBg: "bg-amber-100" },
 { id: 'other', label: "Khác", icon: Activity, color: "text-slate-600", bg: "bg-slate-50", activeBg: "bg-slate-200" },
];

const KPI_TEMPLATES = [
 { category: 'lending', title: "Dư nợ cho vay bán lẻ", description: "Tăng trưởng dư nợ cho vay khách hàng cá nhân và hộ kinh doanh.", unit: "Tỷ đồng" },
 { category: 'lending', title: "Phát triển khách hàng mới", description: "Tìm kiếm và giải ngân cho khách hàng lần đầu giao dịch tại chi nhánh.", unit: "Khách hàng" },
 { category: 'lending', title: "Giải ngân kế hoạch", description: "Thực hiện giải ngân theo hạn mức đã phê duyệt cho các dự án điểm.", unit: "Tỷ đồng" },
 { category: 'lending', title: "Thu hồi nợ quá hạn", description: "Tập trung đôn đốc và thu hồi các khoản nợ nhóm 2 trở lên.", unit: "Triệu đồng" },

 { category: 'saving', title: "Huy động vốn dân cư", description: "Tăng trưởng tiền gửi tiết kiệm và tiền gửi có kỳ hạn từ dân cư.", unit: "Tỷ đồng" },
 { category: 'saving', title: "Phát triển CASA (Tiền gửi không kỳ hạn)", description: "Mở tài khoản thanh toán và duy trì số dư bình quân cao.", unit: "Tài khoản" },
 { category: 'saving', title: "Chứng chỉ tiền gửi", description: "Triển khai bán các gói chứng chỉ tiền gửi đợt mới.", unit: "Tỷ đồng" },

 { category: 'card', title: "Phát hành thẻ tín dụng mới", description: "Khai thác và phát hành mới thẻ tín dụng các hạng chuẩn/vàng/platinum.", unit: "Thẻ" },
 { category: 'card', title: "Doanh số chi tiêu thẻ", description: "Thúc đẩy khách hàng hiện hữu chi tiêu qua thẻ để tăng phí dịch vụ.", unit: "Triệu đồng" },
 { category: 'card', title: "Cài đặt ứng dụng thẻ", description: "Hướng dẫn khách hàng cài đặt và kích hoạt ứng dụng quản lý thẻ.", unit: "Khách hàng" },

 { category: 'digital', title: "Đăng ký Mobile Banking", description: "Phát triển số lượng người dùng ứng dụng ngân hàng số mới.", unit: "Người dùng" },
 { category: 'digital', title: "Giao dịch số bình quân", description: "Thúc đẩy khách hàng thực hiện giao dịch chuyển tiền/thanh toán trên App.", unit: "Giao dịch" },
 { category: 'digital', title: "Thanh toán QR Code", description: "Mở rộng mạng lưới đơn vị chấp nhận thanh toán bằng mã QR.", unit: "Điểm chấp nhận" },

 { category: 'other', title: "Doanh thu phí bảo hiểm", description: "Triển khai bán các gói bảo hiểm nhân thọ và phi nhân thọ.", unit: "Triệu đồng" },
 { category: 'other', title: "Bán chéo dịch vụ", description: "Thực hiện bán kèm các dịch vụ tiện ích cho khách hàng vay vốn.", unit: "Dịch vụ" },
 { category: 'other', title: "Tự nhập nội dung...", description: "Thiết lập chỉ tiêu tùy chỉnh theo nhu cầu riêng.", unit: "" }
];

export default function GoalsPage() {
 const router = useRouter();
 const [goals, setGoals] = useState<any[]>([]);
 const [team, setTeam] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [isCreateOpen, setIsCreateOpen] = useState(false);
 const [isSuccess, setIsSuccess] = useState(false);
 const [profile, setProfile] = useState<any>(null);
 const [searchQuery, setSearchQuery] = useState("");

 const [selectedCategory, setSelectedCategory] = useState<string>('lending');
 const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
 const [targetType, setTargetType] = useState<'department' | 'individual'>('department');
 const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
 const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
 const [unitValue, setUnitValue] = useState("");
 const [customTitle, setCustomTitle] = useState("");
 const [customDescription, setCustomDescription] = useState("");

 const { toast } = useToast();
 const supabase = createClient();

 useEffect(() => {
 fetchInitialData();
 }, []);

 const fetchInitialData = async () => {
 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) return;

 const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
 setProfile(p);

 if (p?.department_id) {
 const { data: members } = await supabase
 .from('profiles')
 .select('id, full_name, avatar_url, role, is_department_head')
 .eq('department_id', p.department_id)
 .order('full_name');
 setTeam(sortProfilesByHierarchy(members || []));
 }

 await fetchGoals(p);
 } catch (error: any) {
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const fetchGoals = async (p?: any) => {
 const userProfile = p || profile;
 let query = supabase
 .from('tasks')
 .select(`*, assignee:profiles!tasks_assignee_id_fkey(full_name, avatar_url)`)
 .eq('task_type', 'kpi');

 // Phân quyền: Lọc theo phòng ban nếu không phải admin hoặc director
 if (userProfile && userProfile.role !== 'admin' && userProfile.role !== 'director' && userProfile.department_id) {
 query = query.or(`department_id.eq.${userProfile.department_id},created_by.eq.${userProfile.id},assignee_id.eq.${userProfile.id}`);
 }

 const { data, error } = await query.order('created_at', { ascending: false });
 if (error) throw error;
 setGoals(data || []);
 };

 const toggleMember = (id: string) => {
 setSelectedMemberIds(prev =>
 prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
 );
 };

 const handleCreateGoal = async (e: React.FormEvent<HTMLFormElement>) => {
 e.preventDefault();
 const formData = new FormData(e.currentTarget);

 const targetValue = parseInt(formData.get('target_value') as string);
 const unit = formData.get('unit') as string;
 const title = customTitle || formData.get('title') as string;
 const description = customDescription || formData.get('description') as string;

 const baseTask = {
 title,
 description,
 target_value: targetValue,
 unit,
 task_type: 'kpi',
 created_by: profile?.id,
 department_id: profile?.department_id,
 due_date: new Date(Date.now() + (timeframe === 'week' ? 7 : timeframe === 'month' ? 30 : timeframe === 'quarter' ? 90 : 365) * 24 * 60 * 60 * 1000).toISOString(),
 metadata: {
 category: selectedCategory,
 timeframe: timeframe,
 target_type: targetType
 }
 };

 try {
 if (targetType === 'department') {
 const { data: newTask, error } = await supabase.from('tasks').insert(baseTask).select().single();
 if (error) throw error;

 // THÊM: Thông báo cho tất cả thành viên trong phòng
 if (team.length > 0) {
 const deptNotifications = team.map(member => ({
 user_id: member.id,
 title: "Chỉ tiêu phòng mới",
 content: `Lãnh đạo đã giao chỉ tiêu chung cho phòng: "${title}". Mục tiêu: ${targetValue} ${unit}.`,
 link: `/dashboard/tasks/${newTask.id}`
 }));
 await supabase.from('notifications').insert(deptNotifications);
 }
 } else {
 if (selectedMemberIds.length === 0) {
 toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng chọn ít nhất một cán bộ." });
 return;
 }

 const tasks = selectedMemberIds.map(memberId => ({
 ...baseTask,
 assignee_id: memberId,
 }));
 const { error } = await supabase.from('tasks').insert(tasks);
 if (error) throw error;

 const notifications = selectedMemberIds.map(memberId => ({
 user_id: memberId,
 title: "Chỉ tiêu KPIs mới",
 content: `Lãnh đạo đã giao chỉ tiêu: "${title}". Mục tiêu cần đạt: ${targetValue} ${unit}.`,
 link: '/dashboard/kpi'
 }));
 await supabase.from('notifications').insert(notifications);
 }

 setIsSuccess(true);
 fetchGoals();
 setTimeout(() => {
 setIsSuccess(false);
 setIsCreateOpen(false);
 setSelectedTemplate(null);
 setCustomTitle("");
 setCustomDescription("");
 setSelectedMemberIds([]);
 }, 2000);
 } catch (error: any) {
 toast({
 title: "Lỗi",
 description: error.message,
 variant: "destructive"
 });
 }
 };

 const filteredGoals = goals.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));

 const avgProgress = goals.length > 0
 ? Math.round(goals.reduce((acc, g) => acc + (g.progress || 0), 0) / goals.length)
 : 0;

 if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

 return (
 <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 animate-fade-in-up pb-20">
 {/* Header Section */}
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 sm:pt-0">
 <div className="space-y-1">
 <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
 Mục tiêu
 </h1>
 <p className="text-[13px] text-slate-500 font-medium">Quản trị KPIs & chỉ tiêu kinh doanh</p>
 </div>

 {(profile?.role === 'manager' || profile?.role === 'admin') && (
 <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { setIsSuccess(false); setSelectedTemplate(null); } }}>
 <DialogTrigger asChild>
 <Button className="bg-primary hover:bg-primary/90 h-10 px-5 rounded-xl font-medium">
 <Plus className="w-5 h-5 mr-2" /> Giao chỉ tiêu mới
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-2xl border-none p-0 overflow-hidden max-w-2xl w-[95vw] max-h-[90vh] flex flex-col shadow-2xl bg-white">
 {!isSuccess ? (
 <>
 <div className="p-6 sm:p-8 border-b border-slate-50 shrink-0">
 <DialogTitle className="text-[17px] font-semibold text-slate-900">Thiết lập chỉ tiêu mới</DialogTitle>
 </div>

 <form onSubmit={handleCreateGoal} className="p-5 sm:p-8 space-y-6 sm:space-y-10 overflow-y-auto">
 <div className="space-y-4 px-1">
 <Label className="text-[13px] font-medium text-slate-500">1. Nhóm nghiệp vụ</Label>
 <div className="flex items-center justify-between gap-2">
 {KPI_CATEGORIES.map((cat) => {
 const Icon = cat.icon;
 const isActive = selectedCategory === cat.id;
 return (
 <button
 key={cat.id}
 type="button"
 onClick={() => {
 setSelectedCategory(cat.id);
 setSelectedTemplate(null);
 setCustomTitle("");
 setCustomDescription("");
 }}
 className="flex flex-col items-center gap-2 group outline-none shrink-0"
 >
 <div className={cn(
 "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200",
 isActive
 ? cn(cat.activeBg, cat.color, "shadow-sm")
 : "bg-primary/5 text-slate-500 hover:bg-primary/10"
 )}>
 <Icon className="w-4 h-4" />
 </div>
 <span className={cn(
 "text-[12px] font-medium transition-colors",
 isActive ? "text-slate-900" : "text-slate-500"
 )}>
 {cat.label}
 </span>
 </button>
 );
 })}
 </div>
 </div>

 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">2. Nội dung kế hoạch</Label>
 <Select onValueChange={(val) => {
 const template = KPI_TEMPLATES.find(t => t.title === val);
 setSelectedTemplate(template);
 setCustomTitle(template?.title === "Tự nhập nội dung..." ? "" : template?.title || "");
 setCustomDescription(template?.title === "Tự nhập nội dung..." ? "" : template?.description || "");
 setUnitValue(template?.unit || "");
 }}>
 <SelectTrigger className="h-10 bg-primary/5 border-none rounded-xl font-medium px-4 transition-all focus:ring-0 text-[14px]">
 <SelectValue placeholder="Chọn mẫu hoặc tự nhập..." />
 </SelectTrigger>
 <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
 {KPI_TEMPLATES.filter(t => t.category === selectedCategory).map((t) => (
 <SelectItem key={t.title} value={t.title} className="rounded-lg font-medium">{t.title}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {selectedTemplate !== null && (
 <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500 pb-8">
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">3. Đối tượng nhận</Label>
 <div className="flex bg-primary/5 p-1 rounded-xl">
 <button
 type="button"
 onClick={() => setTargetType('department')}
 className={cn("flex-1 py-2 md:py-1.5 text-xs md:text-[10px] font-bold rounded-lg transition-all", targetType === 'department' ? "bg-white shadow-sm text-primary" : "text-primary/40")}
 >Cả phòng</button>
 <button
 type="button"
 onClick={() => setTargetType('individual')}
 className={cn("flex-1 py-2 md:py-1.5 text-xs md:text-[10px] font-bold rounded-lg transition-all", targetType === 'individual' ? "bg-white shadow-sm text-primary" : "text-primary/40")}
 >Nhóm cán bộ</button>
 </div>
 {targetType === 'individual' && (
 <div className="space-y-2 mt-2">
 <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-1 scrollbar-hide">
 {team.filter(m => m.id !== profile?.id).map((m) => {
 const isSelected = selectedMemberIds.includes(m.id);
 return (
 <button
 key={m.id}
 type="button"
 onClick={() => toggleMember(m.id)}
 className={cn(
 "flex items-center gap-2 p-1.5 rounded-lg border-2 transition-all text-left",
 isSelected ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-slate-50 hover:border-slate-100"
 )}
 >
 <Avatar className="h-5 w-5 shrink-0">
 <AvatarImage src={m.avatar_url} />
 <AvatarFallback className="text-[8px] font-bold">{m.full_name[0]}</AvatarFallback>
 </Avatar>
 <span className="text-[10px] font-bold truncate">{m.full_name}</span>
 </button>
 );
 })}
 </div>
 </div>
 )}
 </div>
 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">4. Chu kỳ</Label>
 <div className="grid grid-cols-2 gap-2">
 {['week', 'month', 'quarter', 'year'].map((t) => (
 <button
 key={t}
 type="button"
 onClick={() => setTimeframe(t as any)}
 className={cn(
 "py-2 md:py-1.5 text-xs md:text-[10px] font-bold rounded-lg border-2 transition-all uppercase",
 timeframe === t ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-slate-50 text-slate-500"
 )}
 >
 {t === 'week' ? 'Tuần' : t === 'month' ? 'Tháng' : t === 'quarter' ? 'Quý' : 'Năm'}
 </button>
 ))}
 </div>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">5. Con số mục tiêu</Label>
 <Input name="target_value" type="number" required placeholder="0" className="finance-input font-bold text-lg text-slate-900 focus:ring-primary/20" />
 </div>
 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">Đơn vị tính</Label>
 <Input name="unit" value={unitValue || ""} onChange={(e) => setUnitValue(e.target.value)} required className="finance-input font-bold text-base md:text-sm focus:ring-primary/20" />
 </div>
 </div>

 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">6. Chi tiết kế hoạch</Label>
 <Input name="title" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Nhập tên kế hoạch..." required className="finance-input font-bold text-base md:text-sm" />
 <Textarea name="description" value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="Nhập mô tả chi tiết..." rows={2} className="bg-primary/5 border-none rounded-xl font-medium resize-none text-base md:text-sm p-4 focus:ring-1 focus:ring-primary/20 transition-all" />
 </div>

 <div className="pt-2">
 <Button type="submit" className="w-full bg-primary hover:bg-primary/90 h-12 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
 PHÁT HÀNH CHỈ TIÊU
 </Button>
 </div>
 </div>
 )}
 </form>
 </>
 ) : (
 <div className="p-12 text-center space-y-6">
 <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto rotate-12">
 <CheckCircle2 className="w-10 h-10" />
 </div>
 <div className="space-y-1">
 <h3 className="text-[17px] font-semibold text-slate-900">Thành công!</h3>
 <p className="text-[13px] text-slate-500 font-medium">Chỉ tiêu đã được phân bổ</p>
 </div>
 <Button onClick={() => setIsCreateOpen(false)} className="w-full bg-primary h-10 rounded-xl font-medium text-[14px]">Xác nhận</Button>
 </div>
 )}
 </DialogContent>
 </Dialog>
 )}
 </div>

  {/* KPI Stats Overview - Single Unified Card */}
  <div className="premium-card p-6 border-none">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      {/* Left side: Overall progress tracker with large font */}
      <div className="flex items-center gap-5 flex-1 min-w-0">
        <div className="bg-primary/10 p-4 rounded-xl text-primary shrink-0 shadow-sm">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tiến độ chung hệ thống chỉ tiêu</p>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">{avgProgress}%</p>
            <div className="flex-1 h-2 max-w-[200px] bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${avgProgress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Detailed counters divided by vertical border on desktop */}
      <div className="flex items-center gap-8 md:border-l md:border-slate-100 md:pl-8 shrink-0">
        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Đang chạy
          </p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">{goals.length}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Hoàn thành
          </p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">
              {goals.filter(g => g.progress >= 100).length}
            </p>
            <span className="text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full">
              100%
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

   {/* KPI List */}
  <div className="space-y-6 pt-2">
  {/* Unified Search & Filter Bar */}
  <div className="flex items-center gap-2 bg-slate-50/60 p-1.5 rounded-2xl border border-slate-100/80 shadow-sm w-full h-13 sm:h-14">
    <div className="flex items-center gap-2 px-2 shrink-0">
      <Target className="w-4 h-4 text-primary shrink-0" />
      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider hidden sm:inline">Danh sách chỉ tiêu ({filteredGoals.length})</span>
      <span className="text-xs font-bold text-slate-600 tracking-wider inline sm:hidden">({filteredGoals.length})</span>
    </div>
    <div className="relative flex-1 group">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within:text-primary transition-colors" />
      <Input 
        placeholder="Tìm kiếm chỉ tiêu..." 
        className="w-full pl-9 pr-3 h-10 text-xs font-semibold bg-white border-slate-200/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all" 
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  </div>

 <div className="hidden md:block premium-card border-none overflow-hidden p-0 rounded-[2rem]">
 <Table>
 <TableHeader>
 <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100 h-14">
 <TableHead className="w-[400px] font-medium text-[11px] text-slate-500 pl-8">Chỉ tiêu / Nghiệp vụ</TableHead>
 <TableHead className="w-[180px] font-medium text-[11px] text-slate-500">Người thực thi</TableHead>
 <TableHead className="w-[200px] font-medium text-[11px] text-slate-500 text-center">Tiến độ thực hiện</TableHead>
 <TableHead className="w-[120px] font-medium text-[11px] text-slate-500 text-right pr-8">Thời hạn</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredGoals.map((goal) => {
 const category = KPI_CATEGORIES.find(c => c.id === goal.metadata?.category) || KPI_CATEGORIES[4];
 const CatIcon = category.icon;
 return (
 <TableRow key={goal.id} className="group hover:bg-slate-50/50 transition-all cursor-pointer border-b border-slate-50 h-16" onClick={() => router.push(`/dashboard/tasks/${goal.id}`)}>
 <TableCell className="pl-8">
 <div className="flex items-center gap-4">
 <div className={cn("p-2.5 rounded-lg shrink-0 shadow-sm border border-white/50", category.bg, category.color)}>
 <CatIcon className="w-4.5 h-4.5" />
 </div>
 <div className="space-y-1">
 <p className="text-[14px] font-bold text-slate-900 group-hover:text-primary transition-colors leading-tight">{goal.title}</p>
 <div className="flex items-center gap-2">
 <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ", category.bg, category.color)}>
 {category.label}
 </span>
 </div>
 </div>
 </div>
 </TableCell>
 <TableCell>
 {goal.assignee ? (
 <div className="flex items-center gap-3">
 <Avatar className="h-8 w-8 border-2 border-white shadow-sm ring-1 ring-slate-100">
 <AvatarImage src={goal.assignee.avatar_url} />
 <AvatarFallback className="bg-slate-100 text-[10px] font-bold">{goal.assignee.full_name[0]}</AvatarFallback>
 </Avatar>
 <span className="text-xs font-bold text-slate-700">{goal.assignee.full_name}</span>
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <div className="p-1.5 bg-slate-100 rounded-lg">
 <Building2 className="w-3.5 h-3.5 text-slate-500" />
 </div>
 <span className="text-[10px] font-bold text-slate-500 uppercase truncate whitespace-nowrap">PHÒNG</span>
 </div>
 )}
 </TableCell>
 <TableCell>
 <div className="flex flex-col gap-2 items-center px-4">
 <div className="flex justify-between w-full text-[10px] font-bold">
 <span className="text-slate-500 tracking-tight">{goal.current_value || 0} / {goal.target_value} <span className="text-[9px] opacity-60">{goal.unit}</span></span>
 <span className="text-primary font-bold">{goal.progress || 0}%</span>
 </div>
 <Progress value={goal.progress} className="h-1.5 w-full bg-slate-50 shadow-inner" />
 </div>
 </TableCell>
 <TableCell className="text-right pr-8">
 <span className="text-[11px] font-bold text-slate-600">{new Date(goal.due_date).toLocaleDateString('vi-VN')}</span>
 </TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
 </div>

 <div className="grid grid-cols-1 gap-4 md:hidden">
 {filteredGoals.map((goal) => {
 const category = KPI_CATEGORIES.find(c => c.id === goal.metadata?.category) || KPI_CATEGORIES[4];
 const CatIcon = category.icon;
 return (
 <div key={goal.id} className="premium-card p-6 border-none space-y-5 active:scale-[0.98] transition-all" onClick={() => router.push(`/dashboard/tasks/${goal.id}`)}>
 <div className="flex justify-between items-start">
 <div className="flex gap-4">
 <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-white/50", category.bg, category.color)}>
 <CatIcon className="w-6 h-6" />
 </div>
 <div className="space-y-1">
 <h4 className="text-[15px] md:text-base font-bold text-slate-900 leading-tight line-clamp-2">{goal.title}</h4>
 <p className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">{category.label}</p>
 </div>
 </div>
 {goal.assignee ? (
 <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-1 ring-slate-100">
 <AvatarImage src={goal.assignee.avatar_url} />
 <AvatarFallback className="text-xs font-bold">{goal.assignee.full_name[0]}</AvatarFallback>
 </Avatar>
 ) : (
 <div className="p-2 bg-slate-50 rounded-xl">
 <Building2 className="w-4 h-4 text-slate-500" />
 </div>
 )}
 </div>
 <div className="space-y-3">
 <div className="flex justify-between items-end text-xs md:text-sm font-bold">
 <p className="text-slate-900 tracking-tight">{goal.current_value || 0} / {goal.target_value} <span className="text-[10px] md:text-[11px] opacity-50 uppercase truncate whitespace-nowrap">{goal.unit}</span></p>
 <span className="text-primary font-bold">{goal.progress || 0}%</span>
 </div>
 <Progress value={goal.progress} className="h-2 bg-slate-50 shadow-inner" />
 </div>
 <div className="flex justify-between items-center pt-4 border-t border-slate-50">
 <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">
 <Clock className="w-3.5 h-3.5" />
 {new Date(goal.due_date).toLocaleDateString('vi-VN')}
 </div>
 <div className="p-1.5 bg-slate-50 rounded-lg">
 <ChevronRight className="w-4 h-4 text-slate-500" />
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 );
}
