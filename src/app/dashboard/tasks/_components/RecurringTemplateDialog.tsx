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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Flag, Building2, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { fetchCurrentProfile } from '@/lib/fetch-profile';
import { notifyError, notifyValidation, notifySuccess } from '@/lib/notify';
import {
  canAssignTaskToOthers,
  canRequestReport,
  getProfileDepartmentCode,
} from '@/lib/permissions';
import { upsertRecurringTemplate } from '../_lib/recurringActions';
import { fetchAssignableProfiles, fetchDepartments } from '../_lib/fetchTasks';
import { PeoplePicker } from '@/components/ui/people-picker';
import { DepartmentPicker } from '@/components/ui/department-picker';
import { CronScheduleSelector } from './CronScheduleSelector';
import type { RecurringTemplate, ScheduleKind } from '../_lib/recurringHelpers';
import type { TaskType, TaskPriority } from '../_lib/types';

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  editing?: RecurringTemplate | null;
  onSaved?: () => void;
}

export function RecurringTemplateDialog({ isOpen, setIsOpen, editing, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('report');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [target, setTarget] = useState<'department' | 'profile'>('department');
  const [deptIds, setDeptIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [kind, setKind] = useState<ScheduleKind>('weekly');
  const [weeklyDow, setWeeklyDow] = useState<number | null>(5);
  const [weeklyTime, setWeeklyTime] = useState('15:00');
  const [monthlyDom, setMonthlyDom] = useState<number | null>(1);
  const [monthlyTime, setMonthlyTime] = useState('09:00');
  const [dueDays, setDueDays] = useState(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const p = await fetchCurrentProfile(supabase);
      if (!p) return;
      setProfile(p);
      const [list, depts] = await Promise.all([
        fetchAssignableProfiles({
          context: taskType === 'task' ? 'create-task' : 'create-report',
          caller: {
            id: p.id,
            role: p.role,
            department_id: p.department_id,
            department_code: getProfileDepartmentCode(p),
          },
        }),
        fetchDepartments(),
      ]);
      setProfiles(list);
      setDepartments(depts);
    })();
  }, [isOpen, supabase, taskType]);

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description ?? '');
      setTaskType(editing.task_type);
      setPriority(editing.priority);
      setDeptIds(editing.target_department_ids ?? []);
      setUserIds(editing.target_user_ids ?? []);
      setTarget(editing.target_user_ids?.length > 0 ? 'profile' : 'department');
      setKind(editing.schedule_kind);
      setWeeklyDow(editing.weekly_dow);
      setWeeklyTime(editing.weekly_time?.slice(0, 5) ?? '15:00');
      setMonthlyDom(editing.monthly_dom);
      setMonthlyTime(editing.monthly_time?.slice(0, 5) ?? '09:00');
      setDueDays(editing.due_days_after_fire);
    } else {
      setTitle(''); setDescription('');
      setTaskType('report'); setPriority('medium');
      setTarget('department'); setDeptIds([]); setUserIds([]);
      setKind('weekly'); setWeeklyDow(5); setWeeklyTime('15:00');
      setMonthlyDom(1); setMonthlyTime('09:00');
      setDueDays(7);
    }
  }, [isOpen, editing]);

  const canAssign = canAssignTaskToOthers(profile);
  const canMakeReport = canRequestReport(profile);
  // Tab "Giao việc": admin/director/manager. Tab "Báo cáo": + staff hub.
  const showTaskTab = canAssign;
  const showReportTab = canMakeReport;

  // Task chỉ giao cho cá nhân (không qua phòng) — auto-lock target khi đổi type.
  useEffect(() => {
    if (taskType === 'task') setTarget('profile');
  }, [taskType]);

  // Khi mở dialog mới (không edit) — chọn tab mặc định theo quyền.
  useEffect(() => {
    if (!isOpen || editing) return;
    if (!canAssign && canMakeReport) setTaskType('report');
    else if (canAssign && !canMakeReport) setTaskType('task');
  }, [isOpen, editing, canAssign, canMakeReport]);

  const handleSave = async () => {
    if (!title.trim()) { notifyValidation('Vui lòng nhập tiêu đề'); return; }
    if (taskType === 'task' && userIds.length === 0) {
      notifyValidation('Vui lòng chọn người nhận');
      return;
    }
    if (taskType === 'report' && target === 'department' && deptIds.length === 0) {
      notifyValidation('Vui lòng chọn phòng ban nhận');
      return;
    }
    if (taskType === 'report' && target === 'profile' && userIds.length === 0) {
      notifyValidation('Vui lòng chọn cán bộ nhận');
      return;
    }
    if (kind === 'weekly' && (weeklyDow === null || !weeklyTime)) {
      notifyValidation('Vui lòng chọn thứ và giờ');
      return;
    }
    if (kind === 'monthly' && (monthlyDom === null || !monthlyTime)) {
      notifyValidation('Vui lòng chọn ngày và giờ');
      return;
    }

    setLoading(true);
    const res = await upsertRecurringTemplate({
      id: editing?.id ?? null,
      title: title.trim(),
      description: description.trim() || null,
      task_type: taskType,
      priority,
      // Task: luôn theo cá nhân. Report: theo lựa chọn target.
      target_department_ids: taskType === 'report' && target === 'department' ? deptIds : [],
      target_user_ids: taskType === 'task' || target === 'profile' ? userIds : [],
      schedule_kind: kind,
      weekly_dow: kind === 'weekly' ? weeklyDow : null,
      weekly_time: kind === 'weekly' ? weeklyTime : null,
      monthly_dom: kind === 'monthly' ? monthlyDom : null,
      monthly_time: kind === 'monthly' ? monthlyTime : null,
      due_days_after_fire: dueDays,
      is_active: editing?.is_active ?? true,
    });
    setLoading(false);
    if (!res.ok) { notifyError(res.error, 'Không lưu được template'); return; }
    notifySuccess(editing ? 'Đã cập nhật' : 'Đã tạo template');
    onSaved?.();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">
            {editing
              ? (taskType === 'task' ? 'Sửa lịch giao việc định kỳ' : 'Sửa lịch báo cáo định kỳ')
              : (taskType === 'task' ? 'Lịch giao việc định kỳ' : 'Lịch báo cáo định kỳ')}
          </DialogTitle>
          <DialogDescription className="text-subtitle">
            {taskType === 'task'
              ? 'Máy tự giao việc cho cán bộ theo lịch — không cần nhắc lại mỗi kỳ.'
              : 'Máy tự yêu cầu báo cáo theo lịch — không cần thao tác lại mỗi lần.'}
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            {/* Tabs A/B — chỉ hiện khi có cả 2 quyền và không edit (edit khoá type) */}
            {!editing && showTaskTab && showReportTab && (
              <Tabs value={taskType} onValueChange={(v) => setTaskType(v as TaskType)}>
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={taskType === 'task' ? 'Tên công việc sinh ra mỗi kỳ...' : 'Tên báo cáo sinh ra mỗi kỳ...'}
                className="min-h-11 rounded-xl bg-slate-50 border-none"
              />
            </div>

            <div className="tight-stack">
              <Label className="text-label">Mô tả</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={taskType === 'task'
                  ? 'Kế hoạch, yêu cầu, mục tiêu công việc...'
                  : 'Số liệu, biểu mẫu, lưu ý khi nộp...'}
                className="rounded-xl bg-slate-50 border-none resize-none"
              />
            </div>

            <div className="group-stack">
              <Label className="text-label">{taskType === 'task' ? 'Người nhận' : 'Đối tượng nhận'}</Label>
              {/* Report: cho chọn cả phòng / cán bộ. Task: luôn theo cá nhân. */}
              {taskType === 'report' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTarget('department')}
                    className={cn(
                      'min-h-16 p-3 rounded-xl border text-left transition-all',
                      target === 'department'
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
                    onClick={() => setTarget('profile')}
                    className={cn(
                      'min-h-16 p-3 rounded-xl border text-left transition-all',
                      target === 'profile'
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
              {taskType === 'report' && target === 'department' ? (
                <DepartmentPicker
                  items={departments}
                  selected={deptIds}
                  onChange={setDeptIds}
                  triggerLabel="Chọn phòng ban"
                />
              ) : (
                <PeoplePicker
                  profiles={profiles}
                  currentUserId={profile?.id}
                  myDepartmentId={profile?.department_id ?? null}
                  myDepartmentName={profile?.departments?.name ?? null}
                  selected={userIds}
                  onChange={setUserIds}
                  mode="multiple"
                />
              )}
            </div>

            <div className="group-stack">
              <Label className="text-label">Lịch sinh task</Label>
              <CronScheduleSelector
                kind={kind}
                onKindChange={setKind}
                weeklyDow={weeklyDow}
                onWeeklyDowChange={setWeeklyDow}
                weeklyTime={weeklyTime}
                onWeeklyTimeChange={setWeeklyTime}
                monthlyDom={monthlyDom}
                onMonthlyDomChange={setMonthlyDom}
                monthlyTime={monthlyTime}
                onMonthlyTimeChange={setMonthlyTime}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="tight-stack">
                <Label className="text-label">
                  {taskType === 'task' ? 'Hạn làm xong = sau N ngày' : 'Hạn nộp = sau N ngày'}
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={dueDays}
                  onChange={(e) => setDueDays(Number(e.target.value))}
                  className="min-h-11 rounded-xl bg-slate-50 border-none"
                />
              </div>
              <div className="tight-stack">
                <Label className="text-label">Mức độ ưu tiên</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger className="min-h-11 rounded-xl bg-slate-50 border-none">
                    <div className="flex items-center gap-2">
                      <Flag className={cn('icon-sm',
                        priority === 'high' ? 'text-red-500' :
                        priority === 'low' ? 'text-slate-400' : 'text-slate-500')} />
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="low">Thấp</SelectItem>
                    <SelectItem value="medium">Bình thường</SelectItem>
                    <SelectItem value="high">Khẩn trương</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between gap-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={loading}
                  className="min-h-11 px-4 rounded-xl text-slate-500">Huỷ</Button>
          <Button onClick={handleSave} disabled={loading}
                  className="min-h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : (editing ? 'Cập nhật' : 'Tạo')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
