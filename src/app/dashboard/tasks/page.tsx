'use client'

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/utils/supabase/client'
import { 
 Table, 
 TableBody, 
 TableCell, 
 TableHead, 
 TableHeader, 
 TableRow 
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
 Plus, 
 Search, 
 Filter, 
 Loader2, 
 Calendar,
 Zap,
 ChevronRight,
 ListTodo,
 Users,
 FileText
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { 
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from "@/lib/utils";

function TasksContent() {
 const searchParams = useSearchParams()
 const initialStatus = searchParams.get('status') || 'all'
 
 const [tasks, setTasks] = useState<any[]>([])
 const [loading, setLoading] = useState(true)
 const [profile, setProfile] = useState<any>(null)
 const [searchQuery, setSearchQuery] = useState('')
 const [filterStatus, setFilterStatus] = useState<string>(initialStatus)
 const [viewMode, setViewMode] = useState<string>('task')
 const supabase = createClient()
 const router = useRouter()
 const { toast } = useToast()

 useEffect(() => {
 fetchTasks()
 }, [])

 const fetchTasks = async () => {
 setLoading(true)
 try {
 let query = supabase
 .from('tasks')
 .select(`
 *,
 creator:profiles!tasks_created_by_fkey(full_name, avatar_url, department_id),
 department:departments(name),
 task_assignees(
 profile:profiles(id, full_name, avatar_url)
 )
 `);

 const { data: { user } } = await supabase.auth.getUser()
 if (user) {
 const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
 setProfile(p)
 
 // Phân quyền: Nếu không phải Admin, chỉ lấy công việc của phòng mình
 if (p && p.role !== 'admin' && p.role !== 'director' && p.department_id) {
 query = query.or(`department_id.eq.${p.department_id},created_by.eq.${user.id},assignee_id.eq.${user.id}`);
 }
 }

 const { data } = await query.order('created_at', { ascending: false })
 setTasks(data || [])
 } catch (error) {
 console.error(error)
 } finally {
 setLoading(false)
 }
 }

 const handleToggleReportStatus = async (e: React.MouseEvent, taskId: string, currentStatus: string) => {
 e.stopPropagation();
 const newStatus = currentStatus === 'done' ? 'todo' : 'done';
 
 try {
  const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
  if (error) throw error;
  setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
  toast({ title: "Cập nhật thành công", description: "Đã thay đổi trạng thái báo cáo." });
 } catch (error: any) {
  toast({ variant: "destructive", title: "Lỗi", description: error.message });
 }
 };

   const allFilteredData = tasks.filter(task => {
   // 1. Không hiển thị các cards của KPI
   if (task.task_type === 'kpi') return false;

   const isReport = task.task_type === 'report';
   if (viewMode === 'task' && isReport) return false;
   if (viewMode === 'report' && !isReport) return false;

   // 2. Lọc theo trạng thái và tìm kiếm
   if (filterStatus === 'all') {
     if (!searchQuery) {
       if (task.status === 'done') return false;
     }
     if (task.is_archived) return false;
   } else {
     if (task.status !== filterStatus) return false;
   }
  
   const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase())
   return matchesSearch
   });

  const seenReports = new Set();
  const displayData = allFilteredData.filter(task => {
    if (task.task_type === 'report') {
      const isCreator = task.created_by === profile?.id;
      const isAdminOrDir = profile?.role === 'admin' || profile?.role === 'director';
      
      if (isCreator || isAdminOrDir) {
        const reportKey = `${task.title}_${task.created_by}`;
        if (seenReports.has(reportKey)) {
          return false;
        }
        seenReports.add(reportKey);
      }
    }
    return true;
  });

 const statusMap: Record<string, { label: string, color: string, dot: string, light: string }> = {
 todo: { label: 'Đang chờ', color: 'text-muted-foreground', dot: 'bg-slate-400', light: 'bg-muted' },
 doing: { label: 'Đang làm', color: 'text-primary', dot: 'bg-primary', light: 'bg-primary/5' },
 done: { label: 'Hoàn thành', color: 'text-emerald-700', dot: 'bg-emerald-500', light: 'bg-emerald-50' },
 late: { label: 'Trễ hạn', color: 'text-red-600', dot: 'bg-red-500', light: 'bg-red-50' },
 closed: { label: 'Đã đóng', color: 'text-slate-700', dot: 'bg-slate-600', light: 'bg-slate-100' },
 }

 if (loading) {
 return (
 <div className="flex h-96 items-center justify-center">
 <Loader2 className="h-6 w-6 animate-spin text-primary" />
 </div>
 );
 }

 return (
 <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6 md:space-y-10 animate-fade-in-up pb-20">
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 md:gap-6 pt-4 sm:pt-0">
 <div className="space-y-1">
 <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
 {viewMode === 'task' ? 'Công việc' : 'Yêu cầu báo cáo'}
 </h1>
 <p className="text-[13px] text-slate-500 font-medium">Quản trị & theo dõi tiến độ</p>
 </div>
 <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-5 rounded-xl font-medium">
 <Link href="/dashboard/tasks/new">
 <Plus className="mr-2 h-4 w-4" /> 
 {profile?.role === 'manager' || profile?.role === 'admin' ? 'Giao việc / Báo cáo' : 'Tạo mới'}
 </Link>
 </Button>
 </div>

 <div className="px-4 sm:px-0">
  <Tabs defaultValue="task" value={viewMode} onValueChange={setViewMode} className="w-full max-w-sm">
    <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-slate-100 rounded-xl">
      <TabsTrigger value="task" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Công việc</TabsTrigger>
      <TabsTrigger value="report" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Báo cáo</TabsTrigger>
    </TabsList>
  </Tabs>
 </div>

 <div className="flex flex-col sm:flex-row gap-4">
 <div className="relative flex-1 group">
 <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
 <Input 
 placeholder={viewMode === 'task' ? "Tìm tên công việc..." : "Tìm tên báo cáo..."} 
 className="finance-input finance-search-input w-full pl-12 h-10 text-[14px] font-medium" 
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 />
 </div>
 <Select value={filterStatus} onValueChange={setFilterStatus}>
 <SelectTrigger className="w-full sm:w-48 h-10 bg-white border-slate-200 rounded-xl font-medium text-slate-600 px-4 hover:border-primary/30 transition-all text-[14px]">
 <div className="flex items-center gap-2">
 <Filter className="w-4 h-4 text-primary/60" />
 <SelectValue placeholder="Trạng thái" />
 </div>
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-premium-hover p-2">
 <SelectItem value="all" className="rounded-xl py-3 font-semibold">Tất cả trạng thái</SelectItem>
 <SelectItem value="todo" className="rounded-xl py-3 font-semibold">Chưa hoàn thành</SelectItem>
 {viewMode === 'task' && <SelectItem value="doing" className="rounded-xl py-3 font-semibold">Đang thực hiện</SelectItem>}
 <SelectItem value="done" className="rounded-xl py-3 font-semibold">Đã hoàn thành</SelectItem>
 <SelectItem value="late" className="rounded-xl py-3 font-semibold text-red-600">Trễ hạn</SelectItem>
 {viewMode === 'report' && <SelectItem value="closed" className="rounded-xl py-3 font-semibold text-slate-600">Đã đóng</SelectItem>}
 </SelectContent>
 </Select>
 </div>

 {viewMode === 'task' ? (
   <>
   {/* Mobile Card View (Tasks) */}
   <div className="block sm:hidden space-y-4">
   {displayData.map((task) => {
   const status = statusMap[task.status] || statusMap.todo;
   const firstAssignee = task.task_assignees?.[0]?.profile;
   const otherCount = (task.task_assignees?.length || 0) - 1;

   return (
   <div key={task.id} className="premium-card p-6 space-y-4 active:scale-[0.98] transition-transform" onClick={() => router.push(`/dashboard/tasks/${task.id}`)}>
   <div className="flex justify-between items-start gap-4">
   <div className="space-y-1 flex-1">
   <h3 className="font-bold text-slate-900 text-[15px] md:text-base line-clamp-2 leading-snug">{task.title}</h3>
   <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 shrink-0 truncate whitespace-nowrap">
   <Calendar className="w-3 h-3" />
   {new Date(task.due_date).toLocaleDateString('vi-VN')}
   </div>
   </div>
   <div className={cn("px-2.5 py-1 rounded-full text-[12px] font-medium shrink-0 whitespace-nowrap", status.light, status.color)}>
   {status.label}
   </div>
   </div>
   
   <div className="space-y-3">
   <div className="flex items-center justify-between">
   <div className="flex items-center gap-2">
   <div className="flex -space-x-2">
   {task.task_assignees?.slice(0, 3).map((a: any, i: number) => (
   <Avatar key={i} className="h-6 w-6 border-2 border-white shadow-sm">
   <AvatarImage src={a.profile?.avatar_url} className="object-cover" />
   <AvatarFallback className="bg-primary text-white text-[10px] md:text-[8px] font-bold">{a.profile?.full_name?.[0]}</AvatarFallback>
   </Avatar>
   ))}
   </div>
   <span className="text-xs font-semibold text-slate-600">
   {firstAssignee?.full_name} {otherCount > 0 && `+${otherCount}`}
   </span>
   </div>
   <span className="text-xs font-bold text-primary">{task.progress}%</span>
   </div>
   <Progress value={task.progress} className="h-1.5 bg-slate-100" />
   </div>
   </div>
   )
   })}
   </div>

   {/* Desktop Table View (Tasks) */}
   <div className="hidden sm:block premium-card border-none overflow-hidden">
   <Table>
   <TableHeader>
   <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b border-slate-100 h-14">
   <TableHead className="w-[350px] font-medium text-[11px] text-slate-500 pl-8">Hồ sơ công việc</TableHead>
   <TableHead className="w-[140px] font-medium text-[11px] text-slate-500">Trạng thái</TableHead>
   <TableHead className="w-[120px] font-medium text-[11px] text-slate-500 text-center">Tiến độ</TableHead>
   <TableHead className="font-medium text-[11px] text-slate-500">Người xử lý</TableHead>
   <TableHead className="w-[140px] font-medium text-[11px] text-slate-500 text-right pr-8">Hạn cuối</TableHead>
   </TableRow>
   </TableHeader>
   <TableBody>
   {displayData.map((task) => {
   const status = statusMap[task.status] || statusMap.todo;
   const isLate = task.status !== 'done' && new Date(task.due_date) < new Date();
   const firstAssignee = task.task_assignees?.[0]?.profile;
   const otherCount = (task.task_assignees?.length || 0) - 1;

   return (
   <TableRow 
   key={task.id} 
   className="group hover:bg-slate-50/80 transition-all cursor-pointer border-b border-slate-50/80 h-20"
   onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
   >
   <TableCell className="pl-8 py-4">
   <div className="flex items-center gap-3">
   {task.priority === 'high' && (
   <div className="p-1.5 bg-red-50 rounded-lg shrink-0">
   <Zap className="w-3 h-3 text-red-500 fill-red-500" />
   </div>
   )}
   <span className="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1 leading-normal">{task.title}</span>
   </div>
   </TableCell>
   <TableCell>
   <div className={cn("inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium ", status.light, status.color)}>
   <div className={cn("w-1 h-1 rounded-full mr-2 opacity-60", status.dot)} />
   {status.label}
   </div>
   </TableCell>
   <TableCell>
   <div className="flex flex-col gap-2 items-center">
   <span className="text-[11px] font-bold text-primary">
   {task.task_type === 'kpi' ? `${task.current_value || 0}/${task.target_value || '∞'}` : `${task.progress || 0}%`}
   </span>
   <Progress value={task.progress} className="h-1 w-16 bg-slate-100 shadow-inner" />
   </div>
   </TableCell>
   <TableCell>
   <div className="flex items-center gap-3">
   <div className="flex -space-x-3 overflow-hidden">
   {task.task_assignees?.slice(0, 3).map((a: any, i: number) => (
   <Avatar key={i} className="h-8 w-8 border-2 border-white shadow-sm ring-1 ring-slate-100/50">
   <AvatarImage src={a.profile?.avatar_url} className="object-cover" />
   <AvatarFallback className="bg-primary text-white text-[10px] font-bold">
   {a.profile?.full_name?.[0]}
   </AvatarFallback>
   </Avatar>
   ))}
   {otherCount > 2 && (
   <div className="h-8 w-8 rounded-full bg-slate-50 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500 ring-1 ring-slate-100/50">
   +{otherCount - 2}
   </div>
   )}
   </div>
   <div className="flex flex-col">
   <span className="text-xs font-semibold text-slate-600 line-clamp-1">
   {firstAssignee?.full_name}
   </span>
   {otherCount > 0 && (
   <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1 truncate whitespace-nowrap">
   <Users className="w-2.5 h-2.5" /> + {otherCount} hỗ trợ
   </span>
   )}
   </div>
   </div>
   </TableCell>
   <TableCell className="text-right pr-8">
   <span className={cn("text-xs font-bold px-3 py-1 rounded-lg", isLate ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500")}>
   {new Date(task.due_date).toLocaleDateString('vi-VN')}
   </span>
   </TableCell>
   </TableRow>
   )
   })}
   </TableBody>
   </Table>
   </div>
   </>
 ) : (
   <>
    {/* List view for Reports */}
    <div className="space-y-3">
      {displayData.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Chưa có báo cáo nào</p>
        </div>
      )}
      {displayData.map((task) => {
        const status = statusMap[task.status] || statusMap.todo;
        const isLate = task.status !== 'done' && new Date(task.due_date) < new Date();
        const firstAssignee = task.task_assignees?.[0]?.profile;
        const deptName = task.department?.name;

        return (
          <div 
            key={task.id} 
            className="premium-card p-6 flex items-center gap-4 cursor-pointer hover:bg-slate-50/50 transition-all"
            onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
          >
            <div className="flex items-center justify-center pt-1 self-start" onClick={(e) => {
              if (task.status !== 'closed') {
                handleToggleReportStatus(e, task.id, task.status);
              } else {
                e.stopPropagation();
              }
            }}>
              <Checkbox 
                checked={task.status === 'done'} 
                
                className="w-5 h-5 rounded-[6px]"
              />
            </div>
            
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                {task.priority === 'high' && <Zap className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />}
                <h3 className={cn("font-bold text-[15px] group-hover:text-primary transition-colors", task.status === 'done' ? "text-slate-500 line-through" : "text-slate-900")}>
                  {task.title}
                </h3>
                {(() => {
                  const reportSiblings = tasks.filter(t => t.title === task.title && t.created_by === task.created_by && t.task_type === 'report');
                  const totalDepts = reportSiblings.length;
                  const doneDepts = reportSiblings.filter(t => t.status === 'done').length;
                  const isFullReport = doneDepts === totalDepts;
                  const isCreator = task.created_by === profile?.id;
                  const isAdminOrDir = profile?.role === 'admin' || profile?.role === 'director';
                  
                  if ((isCreator || isAdminOrDir) && totalDepts > 0) {
                    return (
                      <Badge className={cn(
                        "border-none text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm select-none",
                        isFullReport 
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-50" 
                          : "bg-red-50 text-red-600 hover:bg-red-50"
                      )}>
                        {doneDepts}/{totalDepts} phòng
                      </Badge>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> 
                  <span className={cn(isLate && "text-red-600 font-bold")}>{new Date(task.due_date).toLocaleDateString('vi-VN')}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {firstAssignee?.full_name || deptName || "Chưa giao"}
                </span>
              </div>
            </div>

            <div className="hidden sm:block shrink-0">
              <div className={cn("inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium ", status.light, status.color)}>
                <div className={cn("w-1 h-1 rounded-full mr-2 opacity-60", status.dot)} />
                {status.label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
   </>
 )}
 </div>
 )
}

export default function TasksPage() {
 return (
 <Suspense fallback={<div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
 <TasksContent />
 </Suspense>
 )
}
