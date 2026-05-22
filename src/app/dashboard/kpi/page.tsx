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
 DropdownMenu,
 DropdownMenuCheckboxItem,
 DropdownMenuContent,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const KPI_CATEGORIES = [
 { id: 'lending', label: "Tín dụng", icon: TrendingUp, color: "text-primary", bg: "bg-primary/5", activeBg: "bg-primary/10" },
 { id: 'saving', label: "Huy động", icon: Award, color: "text-emerald-600", bg: "bg-emerald-50", activeBg: "bg-emerald-100" },
 { id: 'card', label: "Thẻ & Phí", icon: CreditCard, color: "text-blue-600", bg: "bg-blue-50/80", activeBg: "bg-blue-100" },
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

import { useKPI } from "./_hooks/useKPI";

export default function GoalsPage() {
  const kpiProps = useKPI(KPI_CATEGORIES, KPI_TEMPLATES);
  const {
    router, goals, team, loading, isCreateOpen, setIsCreateOpen,
    isSuccess, setIsSuccess, profile, searchQuery, setSearchQuery,
    selectedCategory, setSelectedCategory, selectedTemplate, setSelectedTemplate,
    targetType, setTargetType, selectedMemberIds, setSelectedMemberIds,
    timeframe, setTimeframe, unitValue, setUnitValue, customTitle, setCustomTitle,
    customDescription, setCustomDescription,
    toggleMember, handleCreateGoal, filteredGoals, avgProgress
  } = kpiProps;

 if (loading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

 return (
 <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 animate-fade-in-up pb-20">
 {/* Header Section */}
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 sm:pt-0">
 <div className="hidden lg:block space-y-1">
 <h1 className="text-2xl font-semibold text-slate-900">
 Mục tiêu
 </h1>
 <p className="text-[13px] text-slate-500 font-medium">Quản trị KPIs & chỉ tiêu kinh doanh</p>
 </div>

 {(profile?.role === 'manager' || profile?.role === 'admin') && (
 <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) { setIsSuccess(false); setSelectedTemplate(null); } }}>
 <DialogTrigger asChild>
 <Button className="bg-primary hover:bg-primary/90 px-5 font-medium">
 <Plus className="w-5 h-5 mr-2" /> Giao chỉ tiêu mới
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-2xl border-none p-0 overflow-hidden max-w-2xl w-[95vw] max-h-[90vh] flex flex-col shadow-2xl bg-white">
 {!isSuccess ? (
 <>
 <div className="p-6 sm:p-8 border-b border-slate-50 shrink-0">
 <DialogTitle className="text-[17px] font-semibold text-slate-900">Thiết lập chỉ tiêu mới</DialogTitle>
 </div>

 <form onSubmit={handleCreateGoal} className="min-h-0">
 <ScrollArea className="max-h-[calc(90vh-96px)]">
 <div className="space-y-6 p-5 sm:space-y-10 sm:p-8">
 <div className="space-y-4 px-1">
 <Label className="text-[13px] font-medium text-slate-500">1. Nhóm nghiệp vụ</Label>
 <Tabs value={selectedCategory} onValueChange={(value) => {
 setSelectedCategory(value);
 setSelectedTemplate(null);
 setCustomTitle("");
 setCustomDescription("");
 }}>
 <TabsList className="grid h-auto grid-cols-4">
 {KPI_CATEGORIES.map((cat) => {
 const Icon = cat.icon;
 return (
 <TabsTrigger key={cat.id} value={cat.id} className="flex min-h-9 flex-col gap-0.5 rounded-lg px-1 py-1.5 text-[12px] font-medium">
 <Icon className="h-4 w-4" />
 <span className="truncate">{cat.label}</span>
 </TabsTrigger>
 );
 })}
 </TabsList>
 </Tabs>
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
 <Tabs value={targetType} onValueChange={(value) => setTargetType(value as 'department' | 'individual')}>
 <TabsList className="grid grid-cols-2">
 <TabsTrigger value="department" className="rounded-lg text-xs font-medium md:text-sm">Cả phòng</TabsTrigger>
 <TabsTrigger value="individual" className="rounded-lg text-xs font-medium md:text-sm">Nhóm cán bộ</TabsTrigger>
 </TabsList>
 </Tabs>
 {targetType === 'individual' && (
 <div className="space-y-2 mt-2">
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button type="button" variant="outline" className="w-full justify-between rounded-xl bg-primary/5 px-3 text-[13px] font-medium">
 <span className="truncate">{selectedMemberIds.length ? `Đã chọn ${selectedMemberIds.length} cán bộ` : "Chọn cán bộ"}</span>
 <ChevronRight className="h-4 w-4 rotate-90 text-slate-400" />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="start" className="w-[300px] rounded-xl border border-slate-200 p-2 shadow-lg">
 <ScrollArea className="h-[min(14rem,var(--radix-dropdown-menu-content-available-height))]">
 <div className="space-y-1 pr-2">
 {team.filter(m => m.id !== profile?.id).map((m) => (
 <DropdownMenuCheckboxItem
 key={m.id}
 checked={selectedMemberIds.includes(m.id)}
 onCheckedChange={() => toggleMember(m.id)}
 onSelect={(event) => event.preventDefault()}
 className="gap-2 rounded-lg text-[13px] font-medium"
 >
 <Avatar className="h-5 w-5 shrink-0">
 <AvatarImage src={m.avatar_url} />
 <AvatarFallback className="text-[8px] font-medium">{m.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <span className="truncate">{m.full_name}</span>
 </DropdownMenuCheckboxItem>
 ))}
 </div>
 </ScrollArea>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 )}
 </div>
 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">4. Chu kỳ</Label>
 <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as any)}>
 <TabsList className="grid grid-cols-2">
 {['week', 'month', 'quarter', 'year'].map((t) => (
 <TabsTrigger key={t} value={t} className="rounded-lg text-xs font-medium md:text-sm">
 {t === 'week' ? 'Tuần' : t === 'month' ? 'Tháng' : t === 'quarter' ? 'Quý' : 'Năm'}
 </TabsTrigger>
 ))}
 </TabsList>
 </Tabs>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-6">
 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">5. Con số mục tiêu</Label>
 <Input name="target_value" type="number" required placeholder="0" className="finance-input font-bold text-lg text-slate-900 focus:ring-primary/20" />
 </div>
 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">Đơn vị tính</Label>
 <Input name="unit" value={unitValue || ""} onChange={(e) => setUnitValue(e.target.value)} required className="finance-input font-medium text-sm focus:ring-primary/20" />
 </div>
 </div>

 <div className="space-y-3">
 <Label className="text-[13px] font-medium text-slate-500">6. Chi tiết kế hoạch</Label>
 <Input name="title" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} placeholder="Nhập tên kế hoạch..." required className="finance-input font-medium text-sm" />
 <Textarea name="description" value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} placeholder="Nhập mô tả chi tiết..." rows={2} className="bg-primary/5 border-none rounded-xl font-medium resize-none text-base md:text-sm p-4 focus:ring-1 focus:ring-primary/20 transition-all" />
 </div>

 <div className="pt-2">
 <Button type="submit" className="w-full bg-primary hover:bg-primary/90 min-h-11 rounded-xl font-medium text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-all">
 Phát hành chỉ tiêu
 </Button>
 </div>
 </div>
 )}
 </div>
 </ScrollArea>
 </form>
 </>
 ) : (
 <div className="p-8 text-center space-y-6">
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
          <p className="text-sm font-medium text-slate-500">Tiến độ chung hệ thống chỉ tiêu</p>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{avgProgress}%</p>
            <Progress value={avgProgress} className="h-2 max-w-[200px] flex-1 bg-slate-100" />
          </div>
        </div>
      </div>

      {/* Right side: Detailed counters divided by vertical border on desktop */}
      <div className="flex items-center gap-8 md:border-l md:border-slate-100 md:pl-8 shrink-0">
        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            Đang chạy
          </p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{goals.length}</p>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Hoàn thành
          </p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {goals.filter(g => g.progress >= 100).length}
            </p>
            <Badge className="border-none bg-emerald-50 px-2 py-0.5 text-sm font-medium text-emerald-500">
              100%
            </Badge>
          </div>
        </div>
      </div>
    </div>
  </div>

   {/* KPI List */}
  <div className="space-y-6 pt-2">
  {/* Unified Search & Filter Bar */}
  <div className="flex items-center gap-2 bg-slate-50/60 p-1.5 rounded-2xl border border-slate-100/80 shadow-sm w-full min-h-11">
    <div className="flex items-center gap-2 px-2 shrink-0">
      <Target className="w-4 h-4 text-primary shrink-0" />
      <span className="text-sm font-medium text-slate-600 hidden sm:inline">Danh sách chỉ tiêu ({filteredGoals.length})</span>
      <span className="text-sm font-medium text-slate-600 inline sm:hidden">({filteredGoals.length})</span>
    </div>
    <div className="relative flex-1 group">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within:text-primary transition-colors" />
      <Input
        placeholder="Tìm kiếm chỉ tiêu..."
        className="w-full pl-9 pr-3 h-10 text-sm font-medium bg-white border-slate-200/60 rounded-xl focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />
    </div>
  </div>

 <div className="hidden md:block premium-card border-none overflow-hidden p-0 rounded-2xl">
 <Table>
 <TableHeader>
 <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100 min-h-11">
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
 <TableRow
 key={goal.id}
 className="group hover:bg-slate-50/50 transition-all border-b border-slate-50 h-16 relative"
 >
 <TableCell className="pl-8">
 <div className="flex items-center gap-4">
 <div className={cn("p-2.5 rounded-lg shrink-0 shadow-sm border border-white/50", category.bg, category.color)}>
 <CatIcon className="h-[18px] w-[18px]" />
 </div>
 <div className="space-y-1">
 <Link href={`/dashboard/kpi/${goal.id}`} className="text-[14px] font-bold text-slate-900 group-hover:text-primary transition-colors leading-tight before:absolute before:inset-0 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-primary/20">
  {goal.title}
 </Link>
 <div className="flex items-center gap-2">
 <Badge className={cn("border-none px-1.5 py-0.5 text-[9px] font-bold", category.bg, category.color)}>
 {category.label}
 </Badge>
 </div>
 </div>
 </div>
 </TableCell>
 <TableCell>
 {goal.assignee ? (
 <div className="flex items-center gap-3">
 <Avatar className="h-8 w-8 border-2 border-white shadow-sm ring-1 ring-slate-100">
 <AvatarImage src={goal.assignee.avatar_url} />
 <AvatarFallback className="bg-slate-100 text-sm font-medium">{goal.assignee.full_name[0]}</AvatarFallback>
 </Avatar>
 <span className="text-sm font-medium text-slate-700">{goal.assignee.full_name}</span>
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <div className="p-1.5 bg-slate-100 rounded-lg">
 <Building2 className="w-3.5 h-3.5 text-slate-500" />
 </div>
 <span className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">Phòng</span>
 </div>
 )}
 </TableCell>
 <TableCell>
 <div className="flex flex-col gap-2 items-center px-4">
 <div className="flex justify-between w-full text-sm font-medium">
 <span className="text-slate-500">{goal.current_value || 0} / {goal.target_value} <span className="text-[9px] opacity-60">{goal.unit}</span></span>
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
 <Link
 key={goal.id}
 href={`/dashboard/kpi/${goal.id}`}
 className="premium-card p-6 border-none space-y-5 active:scale-[0.98] transition-all block outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
 >
 <div className="flex justify-between items-start">
 <div className="flex gap-4">
 <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-white/50", category.bg, category.color)}>
 <CatIcon className="w-6 h-6" />
 </div>
 <div className="space-y-1">
 <h4 className="text-[15px] md:text-base font-bold text-slate-900 leading-tight line-clamp-2">{goal.title}</h4>
 <p className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">{category.label}</p>
 </div>
 </div>
 {goal.assignee ? (
 <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-1 ring-slate-100">
 <AvatarImage src={goal.assignee.avatar_url} />
 <AvatarFallback className="text-sm font-medium">{goal.assignee.full_name[0]}</AvatarFallback>
 </Avatar>
 ) : (
 <div className="p-2 bg-slate-50 rounded-xl">
 <Building2 className="w-4 h-4 text-slate-500" />
 </div>
 )}
 </div>
 <div className="space-y-3">
 <div className="flex justify-between items-end text-xs md:text-sm font-bold">
 <p className="text-slate-900">{goal.current_value || 0} / {goal.target_value} <span className="text-[10px] md:text-[11px] opacity-50 truncate whitespace-nowrap">{goal.unit}</span></p>
 <span className="text-primary font-bold">{goal.progress || 0}%</span>
 </div>
 <Progress value={goal.progress} className="h-2 bg-slate-50 shadow-inner" />
 </div>
 <div className="flex justify-between items-center pt-4 border-t border-slate-50">
 <div className="flex items-center gap-1.5 text-sm font-medium text-slate-500 truncate whitespace-nowrap">
 <Clock className="w-3.5 h-3.5" />
 {new Date(goal.due_date).toLocaleDateString('vi-VN')}
 </div>
 <div className="p-1.5 bg-slate-50 rounded-lg">
 <ChevronRight className="w-4 h-4 text-slate-500" />
 </div>
 </div>
 </Link>
 );
 })}
 </div>
 </div>
 </div>
 );
}
