'use client';

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify';
import { updateTaskStatus } from '../_lib/taskActions';

interface Props {
  task: { id: string; title: string; status?: string };
  onClose: () => void;
  onChanged: () => void;
}

export function TaskReturnDialog({ task, onClose, onChanged }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const isReopenDone = task.status === 'done';

  const handleSubmit = async () => {
    if (!reason.trim()) {
      notifyValidation('Vui lòng nhập lý do trả lại');
      return;
    }
    setLoading(true);
    const res = await updateTaskStatus(task.id, 'doing', reason.trim());
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không trả lại được');
      return;
    }
    notifySuccess(
      isReopenDone ? 'Đã trả lại báo cáo' : 'Đã trả về',
      'Người được giao sẽ nhận thông báo và làm lại.',
    );
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">
            {isReopenDone ? 'Trả lại báo cáo đã hoàn thành' : 'Trả về sửa lại'}
          </DialogTitle>
          <DialogDescription className="text-subtitle line-clamp-1">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 tight-stack">
            <Label className="text-label">Lý do trả lại (bắt buộc)</Label>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isReopenDone
                ? 'VD: Báo cáo thiếu số liệu phần X, cần bổ sung...'
                : 'VD: Số liệu chưa khớp, vui lòng sửa lại phần...'}
              className="rounded-xl bg-slate-50 border-none focus-visible:ring-0"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-amber-600 hover:bg-amber-700">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Trả lại'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
