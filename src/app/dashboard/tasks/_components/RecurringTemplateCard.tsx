'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  AlertCircle, Calendar, Edit2, Loader2, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { notifyError, notifySuccess } from '@/lib/notify';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import {
  deleteRecurringTemplate, toggleRecurringTemplate,
} from '../_lib/recurringActions';
import {
  formatScheduleHuman,
  type RecurringTemplate,
} from '../_lib/recurringHelpers';

interface Props {
  template: RecurringTemplate;
  onEdit: (t: RecurringTemplate) => void;
  onChanged: () => void;
}

export function RecurringTemplateCard({ template, onEdit, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const handleToggle = async (active: boolean) => {
    setBusy('toggle');
    const res = await toggleRecurringTemplate(template.id, active);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Không đổi trạng thái được'); return; }
    notifySuccess(active ? 'Đã bật' : 'Đã tắt');
    onChanged();
  };

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: 'Xoá lịch định kỳ?',
      description: `"${template.title}" sẽ bị xoá vĩnh viễn. Công việc đã sinh trước đó vẫn còn.`,
      confirmText: 'Xoá',
      danger: true,
    });
    if (!ok) return;
    setBusy('delete');
    const res = await deleteRecurringTemplate(template.id);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Không xoá được'); return; }
    notifySuccess('Đã xoá mẫu định kỳ');
    onChanged();
  };

  const nextRun = template.next_run_at ? new Date(template.next_run_at) : null;
  const totalTargets = template.target_department_ids.length + template.target_user_ids.length;

  return (
    <div className={cn(
      'premium-card p-5 border-none item-stack',
      !template.is_active && 'opacity-60',
    )}>
      <div className="flex items-start gap-3">
        <Calendar className={cn('icon-md mt-1', template.is_active ? 'text-amber-500' : 'text-slate-400')} />
        <div className="min-w-0 flex-1 tight-stack">
          <p className="heading-card truncate">{template.title}</p>
          <p className="text-subtitle text-slate-600">{formatScheduleHuman(template)}</p>
          {template.description && (
            <p className="text-meta line-clamp-2 italic">{template.description}</p>
          )}
        </div>
        <Switch
          checked={template.is_active}
          onCheckedChange={handleToggle}
          disabled={busy !== null}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
        <Badge variant="outline" className="rounded-full px-2 py-0.5 font-medium bg-slate-50 border-slate-200 text-slate-600">
          Công việc
        </Badge>
        <Badge variant="outline" className="rounded-full px-2 py-0.5 font-medium bg-slate-50 border-slate-200 text-slate-600">
          {totalTargets > 0
            ? template.target_department_ids.length > 0
              ? `${template.target_department_ids.length} phòng`
              : `${template.target_user_ids.length} cán bộ`
            : 'Chưa có đích'}
        </Badge>
        {nextRun && template.is_active ? (
          <span className="text-meta ml-auto">
            Lần kế: {format(nextRun, "EEEE 'lúc' HH:mm dd/MM", { locale: vi })}
          </span>
        ) : (
          <span className="text-meta ml-auto italic flex items-center gap-1">
            <AlertCircle className="icon-sm" /> Đang tắt
          </span>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(template)}
          disabled={busy !== null}
          className="min-h-9 rounded-xl font-medium"
        >
          <Edit2 className="icon-sm mr-1.5" /> Sửa
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={busy !== null}
          className="min-h-9 rounded-xl font-medium text-red-600 hover:bg-red-50 hover:text-red-700 ml-auto"
        >
          {busy === 'delete' ? <Loader2 className="icon-sm animate-spin" /> : <Trash2 className="icon-sm mr-1.5" />}
          Xoá
        </Button>
      </div>
    </div>
  );
}
