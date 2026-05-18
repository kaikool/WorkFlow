'use client'

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Plus, Loader2, CheckCircle2, ArrowRight, User, Calendar, Flag, Layout, Check, X, Lock, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function NewTaskPage() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [creatorProfile, setCreatorProfile] = useState<any>(null);
  
  const [formType, setFormType] = useState<string>("task");
  
  const [assignType, setAssignType] = useState<"profile" | "department">("profile");
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [reminders, setReminders] = useState<string[]>([]);

  const isStaff = creatorProfile?.role === 'staff';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    setCreatorProfile(p);

    let query = supabase.from('profiles').select('*');
    if (p && p.role !== 'admin' && p.role !== 'director' && p.department_id) {
      query = query.eq('department_id', p.department_id);
    }
    const { data: members } = await query.order('full_name');
    
    // Bỏ Ban giám đốc (director, admin) khỏi danh sách giao việc (để gán user bình thường)
    const assignableMembers = (members || []).filter(m => m.role !== 'director' && m.role !== 'admin');
    setProfiles(assignableMembers);

    const { data: depts } = await supabase.from('departments').select('*').order('name');
    setDepartments(depts || []);

    setSelectedAssignees([user.id]);
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    let finalAssigneeId = null;
    let finalAssigneesList: string[] = [];
    let targetDeptId = creatorProfile?.department_id;

    if (formType === 'report' && assignType === 'department') {
      if (!selectedDepartment) {
        toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng chọn phòng ban nhận báo cáo." });
        setLoading(false); return;
      }
      // Giao cho Trưởng phòng của phòng ban đó
      const { data: managers } = await supabase.from('profiles')
        .select('id')
        .eq('department_id', selectedDepartment)
        .eq('role', 'manager')
        .limit(1);
      
      if (managers && managers.length > 0) {
        finalAssigneeId = managers[0].id;
        finalAssigneesList = [managers[0].id];
        targetDeptId = selectedDepartment;
      } else {
        toast({ variant: "destructive", title: "Lỗi", description: "Phòng ban này chưa có Trưởng phòng để nhận việc." });
        setLoading(false); return;
      }
    } else {
      if (selectedAssignees.length === 0) {
        toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng chọn ít nhất một người xử lý." });
        setLoading(false); return;
      }
      finalAssigneeId = selectedAssignees[0];
      finalAssigneesList = selectedAssignees;
      
      const p = profiles.find(x => x.id === finalAssigneeId);
      if (p) targetDeptId = p.department_id;
    }

    try {
      const { data: newTask, error: taskError } = await supabase.from('tasks').insert({
        title: formData.get('title'),
        description: formData.get('description'),
        assignee_id: finalAssigneeId,
        priority: formData.get('priority') || 'medium',
        task_type: formType,
        due_date: dueDate?.toISOString(),
        created_by: creatorProfile?.id,
        department_id: targetDeptId,
        status: 'todo',
        progress: 0,
        metadata: { reminders }
      }).select().single();

      if (taskError) throw taskError;

      const assigneeData = finalAssigneesList.map(userId => ({
        task_id: newTask.id,
        user_id: userId
      }));

      const { error: assigneeError } = await supabase.from('task_assignees').insert(assigneeData);
      if (assigneeError) throw assigneeError;

      if (finalAssigneesList.length > 0) {
        const notifications = finalAssigneesList.map(userId => ({
          user_id: userId,
          title: formType === 'report' ? "Bạn có yêu cầu báo cáo mới" : "Bạn có công việc mới",
          content: `${creatorProfile?.full_name} đã giao cho bạn: ${formData.get('title')}`,
          link: `/dashboard/tasks/${newTask.id}`
        }));
        await supabase.from('notifications').insert(notifications);
      }

      setIsSuccess(true);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignee = (id: string) => {
    if (isStaff) return;
    setSelectedAssignees(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-6 animate-in zoom-in duration-500">
        <div className="inline-flex items-center justify-center bg-emerald-50 text-emerald-600 p-6 rounded-full">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Hoàn tất!</h2>
          <p className="text-slate-500 font-medium text-sm">Hồ sơ đã được ghi nhận thành công.</p>
        </div>
        <div className="flex flex-col gap-2 pt-4">
          <Button asChild className="bg-primary hover:bg-primary/90 h-10 rounded-xl font-medium">
            <Link href="/dashboard/tasks">Về danh sách <ArrowRight className="ml-2 w-4 h-4" /></Link>
          </Button>
          <Button variant="ghost" onClick={() => setIsSuccess(false)} className="text-slate-500 font-medium h-10 rounded-xl hover:bg-slate-50">
            Tạo thêm
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-0 sm:px-6 space-y-10 animate-fade-in-up pb-20">
      <div className="flex items-center justify-between mb-6 px-4 sm:px-0 pt-4 sm:pt-0">
        <Button variant="ghost" asChild className="p-0 hover:bg-transparent text-slate-500 hover:text-slate-900 transition-colors">
          <Link href="/dashboard/tasks" className="flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" />
            <span className="text-[13px] font-medium">Quay lại</span>
          </Link>
        </Button>
      </div>

      <form onSubmit={handleCreateTask}>
        <div className="px-4 sm:px-0 mb-6">
          <Tabs defaultValue="task" value={formType} onValueChange={setFormType} className="w-full max-w-sm">
            <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-slate-100 rounded-xl">
              <TabsTrigger value="task" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Giao Công Việc</TabsTrigger>
              <TabsTrigger value="report" className="rounded-lg text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Yêu Cầu Báo Cáo</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4 sm:px-0">
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="px-2 py-0.5 text-[11px] font-medium rounded-md border-none bg-primary text-white">
                  {formType === 'task' ? 'Công việc' : 'Báo cáo'}
                </Badge>
              </div>
              <Input 
                name="title" 
                id="title" 
                placeholder={formType === 'task' ? "Nhập tiêu đề công việc..." : "Nhập tên báo cáo yêu cầu..."} 
                className="h-14 rounded-xl bg-slate-50 border-none shadow-none font-semibold text-slate-900 text-xl focus-visible:ring-0 placeholder:text-slate-500 px-4" 
                required 
              />
              <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                <Label htmlFor="description" className="text-xs font-bold text-slate-500 uppercase truncate whitespace-nowrap">
                  {formType === 'task' ? 'Mô tả chi tiết' : 'Nội dung báo cáo chi tiết'}
                </Label>
                <Textarea 
                  name="description" 
                  id="description" 
                  rows={2}
                  placeholder={formType === 'task' ? "Nhập nội dung mô tả kế hoạch..." : "Nhập hướng dẫn, yêu cầu của báo cáo..."} 
                  className="min-h-[60px] bg-transparent border-none text-slate-600 font-medium p-0 focus-visible:ring-0 resize-none leading-relaxed text-base md:text-sm overflow-hidden" 
                  onInput={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                    e.target.style.height = 'auto';
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              
              <div className="space-y-3">
                <Label className="text-[13px] font-medium text-slate-500">Người / Phòng nhận</Label>
                
                {formType === 'report' && (
                  <Tabs value={assignType} onValueChange={(v: any) => setAssignType(v)} className="w-full mb-3">
                    <TabsList className="grid w-full grid-cols-2 h-9 p-1 bg-slate-100 rounded-lg">
                      <TabsTrigger value="profile" className="rounded-md text-[11px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Cán bộ</TabsTrigger>
                      <TabsTrigger value="department" className="rounded-md text-[11px] font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">Phòng ban</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}

                {assignType === 'profile' || formType === 'task' ? (
                  <Popover>
                    <PopoverTrigger asChild disabled={isStaff}>
                      <Button variant="outline" className={cn(
                        "w-full h-auto min-h-[44px] rounded-xl border-none bg-slate-50 justify-between px-4 py-2 text-left font-bold text-slate-900 shadow-sm transition-all hover:bg-slate-100",
                        isStaff && "cursor-not-allowed opacity-80"
                      )}>
                        <div className="flex flex-wrap gap-1.5 overflow-hidden">
                          {selectedAssignees.length === 0 ? <span className="text-slate-400 font-normal">Chọn người nhận</span> : 
                           selectedAssignees.map(id => profiles.find(p => p.id === id)).filter(Boolean).map(p => (
                            <Badge key={p.id} variant="secondary" className="bg-primary text-white border-none px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 text-[12px] font-medium whitespace-nowrap truncate">
                              {p.full_name}
                            </Badge>
                          ))}
                        </div>
                        {isStaff ? <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronLeft className="w-4 h-4 text-slate-500 -rotate-90 shrink-0" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-2 rounded-xl border border-slate-200 shadow-lg" align="end">
                      <div className="max-h-[300px] overflow-y-auto space-y-1 p-1">
                        {profiles.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => toggleAssignee(p.id)}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all",
                              selectedAssignees.includes(p.id) ? "bg-primary/5 text-primary" : "hover:bg-slate-50"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn("w-4 h-4 rounded-md border flex items-center justify-center transition-all", selectedAssignees.includes(p.id) ? "bg-primary border-primary" : "border-slate-300")}>
                                {selectedAssignees.includes(p.id) && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <span className="text-xs font-bold">{p.full_name}</span>
                            </div>
                            {p.role === 'manager' && <Badge className="text-[11px] bg-amber-50 text-amber-600 border-none px-1.5 font-medium whitespace-nowrap truncate">Lãnh đạo</Badge>}
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900 px-4 shadow-sm hover:bg-slate-100 transition-all">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <SelectValue placeholder="Chọn phòng ban nhận..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id} className="font-medium text-[13px] py-2">{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {isStaff && <p className="text-xs text-slate-500 font-medium pl-1 italic">Bạn đang tự giao việc cho chính mình.</p>}
              </div>

              {formType === 'task' && (
                <div className="space-y-3">
                  <Label className="text-[13px] font-medium text-slate-500">Phân loại danh mục</Label>
                  <Select name="task_type" defaultValue="regular">
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-medium text-slate-900 px-4 shadow-sm hover:bg-slate-100 transition-all">
                      <div className="flex items-center gap-2">
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                      <SelectItem value="regular" className="font-medium text-[13px] py-2">Công việc nghiệp vụ</SelectItem>
                      <SelectItem value="kpi" className="font-medium text-[13px] py-2">Chỉ tiêu kinh doanh</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 pt-2 border-t border-slate-50">
                <div className="space-y-2">
                  <Label htmlFor="due_date" className="text-[13px] font-medium text-slate-500">Hạn hoàn thành</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900 justify-start px-4 shadow-sm", !dueDate && "text-muted-foreground")}>
                        <Calendar className="mr-2 h-4 w-4 text-primary" />
                        {dueDate ? format(dueDate, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-xl border border-slate-200 shadow-lg" align="start">
                      <CalendarPicker mode="single" selected={dueDate} onSelect={setDueDate} initialFocus locale={vi} />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-[13px] font-medium text-slate-500">Mức độ ưu tiên</Label>
                  <Select name="priority" defaultValue="medium">
                    <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-none font-medium text-slate-900 px-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Flag className="w-4 h-4 text-primary" />
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                      <SelectItem value="low" className="font-medium text-[13px] py-2">Ưu tiên thấp</SelectItem>
                      <SelectItem value="medium" className="font-medium text-[13px] py-2 text-primary">Bình thường</SelectItem>
                      <SelectItem value="high" className="font-medium text-[13px] py-2 text-red-600">Khẩn trương</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formType === 'report' && (
                <div className="space-y-3 pt-4 border-t border-slate-50">
                  <Label className="text-[13px] font-medium text-slate-500">Cài đặt nhắc nhở tự động</Label>
                  <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <Checkbox 
                        checked={reminders.includes('1d')}
                        onCheckedChange={(c) => setReminders(prev => c ? [...prev, '1d'] : prev.filter(x => x !== '1d'))}
                        className="rounded-[6px] data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <span className="text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors">Nhắc trước 1 ngày</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <Checkbox 
                        checked={reminders.includes('2h')}
                        onCheckedChange={(c) => setReminders(prev => c ? [...prev, '2h'] : prev.filter(x => x !== '2h'))}
                        className="rounded-[6px] data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <span className="text-[13px] font-medium text-slate-700 group-hover:text-slate-900 transition-colors">Nhắc trước 2 giờ</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-50 space-y-3">
                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 h-10 rounded-xl font-medium text-[14px]">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (formType === 'task' ? (isStaff ? "Tạo công việc" : "Giao việc") : "Gửi yêu cầu báo cáo")}
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.back()} className="text-slate-500 font-bold h-10 w-full rounded-xl hover:bg-slate-50 text-xs">
                  Hủy bỏ
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
