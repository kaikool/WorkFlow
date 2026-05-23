'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Calendar, Flag, Loader2, Building2, User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { notifyError, notifyValidation, notifySuccess } from '@/lib/notify';
import { canAssignTaskToOthers } from '@/lib/permissions';
import { createTask } from '../_lib/taskActions';
import { fetchAssignableProfiles, fetchDepartments } from '../_lib/fetchTasks';
import { PeoplePicker } from '@/components/ui/people-picker';
import { DepartmentPicker } from '@/components/ui/department-picker';
import type { TaskType, TaskPriority } from '../_lib/types';

interface ProfileItem {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  title: string | null;
  department_id: string | null;
  is_department_head: boolean | null;
  departments?: { name?: string | null; code?: string | null } | null;
}

interface Department { id: string; name: string; code?: string | null }

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  onCreated?: () => void;
}

export function CreateTaskDialog({ isOpen, setIsOpen, onCreated }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<any>(null);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fetching, setFetching] = useState(true);

  const [formType, setFormType] = useState<TaskType>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const [reportTarget, setReportTarget] = useState<'profile' | 'department'>('department');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFetching(true);
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setFetching(false); return; }
      const { data: p } = await supabase
        .from('profiles')
        .select('id, role, department_id, full_name, departments(name, code)')
        .eq('id', user.id)
        .single();
      setProfile(p);

      const list = await fetchAssignableProfiles({
        context: formType === 'task' ? 'create-task' : 'create-report',
        caller: { id: p?.id, role: p?.role, department_id: p?.department_id },
      });
      setProfiles(list as ProfileItem[]);

      if (p?.role === 'staff') setSelectedAssignees([p.id]);

      const depts = await fetchDepartments();
      setDepartments(depts);
      setFetching(false);
    })();
  }, [isOpen, supabase, formType]);

  const isStaff = profile?.role === 'staff';
  const canAssign = canAssignTaskToOthers(profile);

  const resetForm = () => {
    setTitle(''); setDescription('');
    setSelectedAssignees(isStaff && profile ? [profile.id] : []);
    setSelectedDepartments([]);
    setDueDate(new Date());
    setPriority('medium');
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    setIsOpen(false);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { notifyValidation('Vui lòng nhập tiêu đề'); return; }
    if (!dueDate) { notifyValidation('Vui lòng chọn hạn hoàn thành'); return; }

    setLoading(true);
    try {
      if (formType === 'task') {
        if (selectedAssignees.length === 0) {
          notifyValidation('Vui lòng chọn người nhận');
          setLoading(false); return;
        }
        const firstAssignee = profiles.find(p => p.id === selectedAssignees[0]);
        const deptId = firstAssignee?.department_id ?? profile?.department_id ?? null;
        const res = await createTask({
          title: title.trim(),
          description: description.trim() || null,
          task_type: 'task',
          priority,
          due_date: dueDate.toISOString(),
          dept_id: deptId,
          assignee_ids: selectedAssignees,
        });
        if (!res.ok) { notifyError(res.error, 'Không tạo được công việc'); setLoading(false); return; }
        notifySuccess('Đã giao việc', `${selectedAssignees.length} người sẽ nhận thông báo`);
      } else if (reportTarget === 'department') {
        if (selectedDepartments.length === 0) {
          notifyValidation('Vui lòng chọn ít nhất một phòng ban');
          setLoading(false); return;
        }
        for (const deptId of selectedDepartments) {
          const res = await createTask({
            title: title.trim(),
            description: description.trim() || null,
            task_type: 'report',
            priority,
            due_date: dueDate.toISOString(),
            dept_id: deptId,
            assignee_ids: null,
          });
          if (!res.ok) { notifyError(res.error, 'Không tạo được báo cáo'); setLoading(false); return; }
        }
        notifySuccess('Đã gửi yêu cầu', `${selectedDepartments.length} phòng sẽ nhận yêu cầu báo cáo`);
      } else {
        if (selectedAssignees.length === 0) {
          notifyValidation('Vui lòng chọn người nhận');
          setLoading(false); return;
        }
        for (const userId of selectedAssignees) {
          const assignee = profiles.find(x => x.id === userId);
          const deptId = assignee?.department_id ?? profile?.department_id ?? null;
          const res = await createTask({
            title: title.trim(),
            description: description.trim() || null,
            task_type: 'report',
            priority,
            due_date: dueDate.toISOString(),
            dept_id: deptId,
            assignee_ids: [userId],
          });
          if (!res.ok) { notifyError(res.error, 'Không tạo được báo cáo'); setLoading(false); return; }
        }
        notifySuccess('Đã gửi yêu cầu', `${selectedAssignees.length} cán bộ sẽ nhận yêu cầu báo cáo`);
      }
      resetForm();
      setIsOpen(false);
      onCreated?.();
    } catch (err: any) {
      notifyError(err, 'Lỗi hệ thống');
    } finally {
      setLoading(false);
    }
  };

  const showReportTab = !isStaff;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">
            {formType === 'task' ? 'Giao việc' : 'Yêu cầu báo cáo'}
          </DialogTitle>
          <DialogDescription className="text-subtitle">
            {formType === 'task'
              ? 'Đích danh người nhận và đặt hạn hoàn thành.'
              : 'Gửi đến cả phòng (Trưởng phòng tự phân công) hoặc cán bộ cụ thể.'}
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            {showReportTab && (
              <Tabs value={formType} onValueChange={(v) => setFormType(v as TaskType)}>
                <TabsList className="grid grid-cols-2 min-h-11">
                  <TabsTrigger value="task" className="rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Giao việc
                  </TabsTrigger>
                  <TabsTrigger value="report" className="rounded-lg font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    Yêu cầu báo cáo
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <div className="tight-stack">
              <Label className="text-label">Tiêu đề</Label>
              <Input
                placeholder={formType === 'task' ? 'Tên công việc cần làm...' : 'Tên báo cáo yêu cầu...'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-11 rounded-xl bg-slate-50 border-none px-4"
              />
            </div>

            <div className="tight-stack">
              <Label className="text-label">Mô tả</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  formType === 'task'
                    ? 'Kế hoạch, yêu cầu, mục tiêu công việc...'
                    : 'Số liệu, biểu mẫu, lưu ý khi nộp...'
                }
                className="rounded-xl bg-slate-50 border-none resize-none px-4 py-3"
              />
            </div>

            <div className="group-stack">
              <Label className="text-label">{formType === 'task' ? 'Người nhận' : 'Đối tượng nhận'}</Label>

              {formType === 'report' && canAssign && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReportTarget('department')}
                    className={cn(
                      'min-h-16 p-3 rounded-xl border text-left transition-all',
                      reportTarget === 'department'
                        ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="icon-md text-amber-500" />
                      <span className="heading-card">Cả phòng ban</span>
                    </div>
                    <p className="text-meta mt-1">TP phòng tự phân công cán bộ.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportTarget('profile')}
                    className={cn(
                      'min-h-16 p-3 rounded-xl border text-left transition-all',
                      reportTarget === 'profile'
                        ? 'bg-primary/5 border-primary/30 ring-2 ring-primary/30'
                        : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <UserIcon className="icon-md text-primary" />
                      <span className="heading-card">Cán bộ cụ thể</span>
                    </div>
                    <p className="text-meta mt-1">Đích danh cán bộ tự nộp.</p>
                  </button>
                </div>
              )}

              {fetching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="icon-md animate-spin text-slate-400" />
                </div>
              ) : isStaff && formType === 'task' ? (
                <p className="text-subtitle italic px-1 py-2 bg-slate-50 rounded-xl">
                  Bạn đang tự ghi chú việc cho chính mình.
                </p>
              ) : formType === 'task' || reportTarget === 'profile' ? (
                <PeoplePicker
                  profiles={profiles}
                  currentUserId={profile?.id}
                  myDepartmentId={profile?.department_id ?? null}
                  myDepartmentName={profile?.departments?.name ?? null}
                  selected={selectedAssignees}
                  onChange={setSelectedAssignees}
                  mode="multiple"
                />
              ) : (
                <DepartmentPicker
                  items={departments}
                  selected={selectedDepartments}
                  onChange={setSelectedDepartments}
                  triggerLabel="Chọn phòng ban nhận báo cáo"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="tight-stack">
                <Label className="text-label">Hạn hoàn thành</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full min-h-11 rounded-xl bg-slate-50 border-none font-medium justify-start px-4 shadow-none hover:bg-slate-100',
                        !dueDate && 'text-slate-400',
                      )}
                    >
                      <Calendar className="icon-sm mr-2 text-slate-500" />
                      {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: vi }) : 'Chọn ngày'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border border-slate-200 shadow-lg" align="start">
                    <CalendarPicker mode="single" selected={dueDate} onSelect={setDueDate} initialFocus locale={vi} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="tight-stack">
                <Label className="text-label">Mức độ ưu tiên</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger className="min-h-11 rounded-xl bg-slate-50 border-none font-medium px-4">
                    <div className="flex items-center gap-2">
                      <Flag className={cn(
                        'icon-sm',
                        priority === 'high' ? 'text-red-500' :
                          priority === 'low' ? 'text-slate-400' : 'text-slate-500',
                      )} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                    <SelectItem value="low">Ưu tiên thấp</SelectItem>
                    <SelectItem value="medium">Bình thường</SelectItem>
                    <SelectItem value="high">Khẩn trương</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between items-center gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
            className="min-h-11 px-4 rounded-xl font-medium text-slate-500"
          >
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="min-h-11 px-5 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
          >
            {loading ? <Loader2 className="icon-sm animate-spin" /> : (
              isStaff && formType === 'task' ? 'Tạo công việc' :
                formType === 'task' ? 'Giao việc' : 'Gửi yêu cầu'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
