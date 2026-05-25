'use client';

// Sửa nội dung công việc — title/description/priority/due_date.
// Department/assignee/task_type/requires_approval đã chốt từ lúc tạo, không cho sửa
// (đổi assignee → Phân công lại; đổi loại → tạo mới).
// Gate: creator + admin/director, mọi status trừ canceled/archived.
// Audit comment [Hệ thống] tự tạo trong RPC khi có thay đổi thực sự.

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Calendar, Flag, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify';
import { updateTask } from '../_lib/taskActions';
import { TimePicker } from '@/components/ui/time-picker';
import type { TaskPriority } from '../_lib/types';

interface Props {
  task: {
    id: string;
    title: string;
    description: string | null;
    priority: TaskPriority;
    due_date: string | null;
  };
  onClose: () => void;
  onChanged: () => void;
}

export function TaskEditDialog({ task, onClose, onChanged }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.due_date ? new Date(task.due_date) : undefined,
  );
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { notifyValidation('Vui lòng nhập tiêu đề'); return; }
    if (!dueDate) { notifyValidation('Vui lòng chọn hạn hoàn thành'); return; }

    setLoading(true);
    const res = await updateTask(task.id, {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      due_date: dueDate.toISOString(),
    });
    setLoading(false);
    if (!res.ok) { notifyError(res.error, 'Không lưu được'); return; }
    notifySuccess('Đã cập nhật');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !loading && onClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">Sửa công việc</DialogTitle>
          <DialogDescription className="text-subtitle">
            Chỉ sửa được tiêu đề, mô tả, ưu tiên và hạn. Người nhận và loại đã chốt từ lúc tạo.
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 group-stack">
            <div className="tight-stack">
              <Label className="text-label">Tiêu đề</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-11 rounded-xl bg-slate-50 border-none px-4"
                autoFocus
              />
            </div>

            <div className="tight-stack">
              <Label className="text-label">Mô tả</Label>
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kế hoạch, yêu cầu, mục tiêu công việc..."
                className="rounded-xl bg-slate-50 border-none resize-none px-4 py-3"
              />
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
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
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
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Lưu thay đổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
