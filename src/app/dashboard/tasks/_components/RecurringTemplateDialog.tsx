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
import { Loader2, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { fetchCurrentProfile } from '@/lib/fetch-profile';
import { notifyError, notifyValidation, notifySuccess } from '@/lib/notify';
import { canAssignTaskToOthers, getProfileDepartmentCode } from '@/lib/permissions';
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
          context: 'create-report',
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
  }, [isOpen, supabase]);

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

  const handleSave = async () => {
    if (!title.trim()) { notifyValidation('Vui lòng nhập tiêu đề'); return; }
    if (target === 'department' && deptIds.length === 0 && userIds.length === 0) {
      notifyValidation('Vui lòng chọn phòng ban nhận');
      return;
    }
    if (target === 'profile' && userIds.length === 0) {
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
      target_department_ids: target === 'department' ? deptIds : [],
      target_user_ids: target === 'profile' ? userIds : [],
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
            {editing ? 'Sửa lịch định kỳ' : 'Tạo lịch định kỳ'}
          </DialogTitle>
          <DialogDescription className="text-subtitle">
            Máy sẽ tự sinh task theo lịch — không cần thao tác lại mỗi lần.
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            <div className="tight-stack">
              <Label className="text-label">Tiêu đề</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tên task sinh ra mỗi kỳ..."
                className="min-h-11 rounded-xl bg-slate-50 border-none"
              />
            </div>

            <div className="tight-stack">
              <Label className="text-label">Mô tả</Label>
              <Textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl bg-slate-50 border-none resize-none"
              />
            </div>

            <div className="group-stack">
              <Label className="text-label">Đối tượng nhận</Label>
              {canAssign && (
                <Tabs value={target} onValueChange={(v) => setTarget(v as any)}>
                  <TabsList className="grid grid-cols-2 min-h-10">
                    <TabsTrigger value="department" className="rounded-lg font-semibold">Cả phòng ban</TabsTrigger>
                    <TabsTrigger value="profile" className="rounded-lg font-semibold">Cán bộ cụ thể</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
              {target === 'department' ? (
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
                <Label className="text-label">Hạn task = sau N ngày</Label>
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
