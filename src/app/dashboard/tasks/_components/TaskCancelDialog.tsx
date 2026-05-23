'use client';

// Dialog hủy task (creator/assignee/manager đều bấm được — chốt với user).

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cancelTask } from '../_lib/taskActions';

interface Props {
  task: { id: string; title: string };
  onClose: () => void;
  onChanged: () => void;
}

export function TaskCancelDialog({ task, onClose, onChanged }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    const res = await cancelTask(task.id, reason.trim() || undefined);
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không hủy được');
      return;
    }
    notifySuccess('Đã hủy công việc');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-[17px] font-semibold text-slate-900">Huỷ công việc?</DialogTitle>
          <DialogDescription className="text-[13px] text-slate-500 font-medium line-clamp-1">
            {task.title} — sẽ chuyển sang trạng thái Đã huỷ, không thể quay lại.
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="space-y-4 px-[var(--app-page-x)] py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">Lý do (tuỳ chọn)</label>
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Không còn cần làm, kế hoạch đổi…"
                className="rounded-xl bg-slate-50 border-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Không hủy
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-red-600 hover:bg-red-700">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Xác nhận hủy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
