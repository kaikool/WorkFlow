'use client';

import React, { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Calendar, Flag, Loader2, Building2, User as UserIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { notifyError, notifyValidation, notifySuccess } from '@/lib/notify';
import { canAssignTaskToOthers, canRequestReport, canTargetCrossDepartment, getProfileDepartmentCode, isHubDepartment } from '@/lib/permissions';
import { createTask } from '../_lib/taskActions';
import { fetchAssignableProfiles, fetchDepartments } from '../_lib/fetchTasks';
import { PeoplePicker } from '@/components/ui/people-picker';
import { DepartmentPicker } from '@/components/ui/department-picker';
import { TimePicker } from '@/components/ui/time-picker';
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

// Mặc định deadline = cuối giờ làm (17:00) cùng ngày để không bị 00:00 vô nghĩa.
function defaultDueDate(): Date {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  return d;
}

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  onCreated?: () => void;
}

export function CreateTaskDialog({ isOpen, setIsOpen, onCreated }: Props) {
  const { currentProfile } = useAppData();
  const profile = currentProfile;
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fetching, setFetching] = useState(true);

  const [formType, setFormType] = useState<TaskType>('task');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>(() => defaultDueDate());
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const [reportTarget, setReportTarget] = useState<'profile' | 'department'>('department');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [requiresApproval, setRequiresApproval] = useState(false);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !profile) return;
    setFetching(true);
    (async () => {
      const list = await fetchAssignableProfiles({
        context: formType === 'task' ? 'create-task' : 'create-report',
        caller: {
          id: profile.id,
          role: profile.role ?? null,
          department_id: profile.department_id ?? null,
          department_code: getProfileDepartmentCode(profile),
        },
      });
      setProfiles(list as ProfileItem[]);

      if (profile.role === 'staff') setSelectedAssignees([profile.id]);

      const depts = await fetchDepartments();
      setDepartments(depts);
      setFetching(false);
    })();
  }, [isOpen, profile?.id, formType]);

  const isStaff = profile?.role === 'staff';
  const isHub = isHubDepartment(profile);
  // Staff (kể cả hub) khoá tự-ghi-chú khi giao "task". Tab Báo cáo mới mở rộng cho hub.
  const isLockedToSelf = isStaff;
  const canAssignTask = canAssignTaskToOthers(profile);
  const canMakeReport = canRequestReport(profile);
  // "Cả phòng ban" toggle: admin/director + hub manager/staff.
  // Non-hub manager bị siết về phòng mình → không có nhu cầu chọn phòng.
  const canCrossDept = canTargetCrossDepartment(profile);
  // Hiện tab "Giao việc": admin/director/manager. Hiện tab "Báo cáo": + staff hub.
  const showTaskTab = canAssignTask || isStaff; // staff vẫn thấy tab task (self-assign)
  const showReportTab = canMakeReport;

  // Nếu không cross-dept thì force chọn cá nhân (PeoplePicker đã filter sẵn phòng mình).
  useEffect(() => {
    if (!canCrossDept) setReportTarget('profile');
  }, [canCrossDept]);

  const resetForm = () => {
    setTitle(''); setDescription('');
    setSelectedAssignees(isLockedToSelf && profile ? [profile.id] : []);
    setSelectedDepartments([]);
    setDueDate(defaultDueDate());
    setPriority('medium');
    setRequiresApproval(false);
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
      if (reportTarget === 'department') {
        // Cả phòng ban — áp cho cả Luồng A (hub manager) lẫn Luồng B.
        // RPC auto-fill TP làm đầu mối; không cần gửi assignee_ids.
        if (selectedDepartments.length === 0) {
          notifyValidation('Vui lòng chọn ít nhất một phòng ban');
          setLoading(false); return;
        }
        const batchId = selectedDepartments.length > 1 ? crypto.randomUUID() : null;
        for (const deptId of selectedDepartments) {
          const res = await createTask({
            title: title.trim(),
            description: description.trim() || null,
            task_type: formType,
            priority,
            due_date: dueDate.toISOString(),
            dept_id: deptId,
            assignee_ids: null,
            requires_approval: formType === 'report' ? requiresApproval : false,
            batch_id: batchId,
          });
          if (!res.ok) {
            notifyError(res.error, formType === 'task' ? 'Không tạo được công việc' : 'Không tạo được báo cáo');
            setLoading(false); return;
          }
        }
        notifySuccess(
          formType === 'task' ? 'Đã giao việc cho phòng' : 'Đã gửi yêu cầu',
          `${selectedDepartments.length} phòng — Trưởng phòng sẽ phân công lại`,
        );
      } else if (formType === 'task') {
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
      } else {
        if (selectedAssignees.length === 0) {
          notifyValidation('Vui lòng chọn người nhận');
          setLoading(false); return;
        }
        const batchId = selectedAssignees.length > 1 ? crypto.randomUUID() : null;
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
            requires_approval: requiresApproval,
            batch_id: batchId,
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

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">
            {formType === 'task' ? 'Giao việc' : 'Yêu cầu báo cáo'}
          </DialogTitle>
          <DialogDescription className="text-subtitle">
            {formType === 'task'
              ? (canCrossDept
                  ? 'Đích danh cán bộ phòng mình hoặc giao cho cả phòng (Trưởng phòng tự phân công).'
                  : 'Đích danh người nhận và đặt hạn hoàn thành.')
              : 'Gửi đến cả phòng (Trưởng phòng tự phân công) hoặc cán bộ cụ thể.'}
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            {/* Tabs A/B — chỉ hiện khi có cả 2 lựa chọn */}
            {showTaskTab && showReportTab && (
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
              <Label className="text-label">
                {isLockedToSelf && formType === 'task' ? 'Người nhận' : 'Đối tượng nhận'}
              </Label>

              {/* Toggle "Cả phòng ban / Cán bộ cụ thể" — hiện cho hub user + admin/director.
                  Áp cho cả Luồng A (hub manager giao task qua phòng → TP nhận) lẫn Luồng B. */}
              {!isLockedToSelf && canCrossDept && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReportTarget('department')}
                    className={cn(
                      'min-h-16 p-3 rounded-xl border text-left transition-all',
                      reportTarget === 'department'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="icon-md text-amber-500" />
                      <span className="heading-card">Cả phòng ban</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportTarget('profile')}
                    className={cn(
                      'min-h-16 p-3 rounded-xl border text-left transition-all',
                      reportTarget === 'profile'
                        ? 'bg-primary/10 border-primary'
                        : 'bg-white border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <UserIcon className="icon-md text-primary" />
                      <span className="heading-card">Cán bộ cụ thể</span>
                    </div>
                  </button>
                </div>
              )}

              {fetching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="icon-md animate-spin text-slate-400" />
                </div>
              ) : isLockedToSelf && formType === 'task' ? (
                <p className="text-subtitle italic px-1 py-2 bg-slate-50 rounded-xl">
                  Bạn đang tự ghi chú việc cho chính mình.
                </p>
              ) : reportTarget === 'department' ? (
                <DepartmentPicker
                  items={departments}
                  selected={selectedDepartments}
                  onChange={setSelectedDepartments}
                  triggerLabel={formType === 'task' ? 'Chọn phòng ban nhận việc' : 'Chọn phòng ban nhận báo cáo'}
                />
              ) : (
                <PeoplePicker
                  profiles={profiles}
                  currentUserId={profile?.id}
                  myDepartmentId={profile?.department_id ?? null}
                  myDepartmentName={profile?.departments?.name ?? null}
                  selected={selectedAssignees}
                  onChange={setSelectedAssignees}
                  mode="multiple"
                />
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="tight-stack">
                <Label className="text-label">Hạn hoàn thành</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full min-h-11 rounded-xl bg-slate-50 border-none font-medium justify-start px-4 shadow-none hover:bg-slate-100 text-slate-900',
                          !dueDate && 'text-slate-400',
                        )}
                      >
                        <Calendar className="icon-sm mr-2 text-slate-500" />
                        {dueDate ? format(dueDate, 'dd/MM/yyyy', { locale: vi }) : 'Chọn ngày'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border border-slate-200 shadow-lg bg-white" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={dueDate}
                        onSelect={(d) => {
                          if (!d) { setDueDate(undefined); return; }
                          // Giữ HH:mm hiện tại, chỉ đổi ngày
                          const next = new Date(d);
                          next.setHours(
                            dueDate?.getHours() ?? 17,
                            dueDate?.getMinutes() ?? 0,
                            0, 0,
                          );
                          setDueDate(next);
                        }}
                        initialFocus
                        locale={vi}
                      />
                    </PopoverContent>
                  </Popover>

                  <TimePicker
                    value={dueDate ? format(dueDate, 'HH:mm') : '17:00'}
                    onChange={(v) => {
                      const [h, m] = v.split(':').map(Number);
                      const base = dueDate ?? new Date();
                      const next = new Date(base);
                      next.setHours(h, m, 0, 0);
                      setDueDate(next);
                    }}
                    triggerClassName="w-full"
                  />
                </div>
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

            {formType === 'report' && (
              <label className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 cursor-pointer">
                <Switch
                  checked={requiresApproval}
                  onCheckedChange={setRequiresApproval}
                  className="mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-subtitle font-semibold text-slate-900">Cần Trưởng phòng duyệt</p>
                  <p className="text-meta">
                    Mặc định tắt — nộp xong là ghi nhận hoàn thành luôn. Bật khi cần kiểm soát chặt.
                  </p>
                </div>
              </label>
            )}
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
              isLockedToSelf && formType === 'task' ? 'Tạo công việc' :
                formType === 'task' ? 'Giao việc' : 'Gửi yêu cầu'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
