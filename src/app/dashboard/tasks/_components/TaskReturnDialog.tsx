'use client';

// Dialog trả về báo cáo (Manager bấm trên submitted → doing, kèm lý do BẮT BUỘC).

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify';
import { updateTaskStatus } from '../_lib/taskActions';

interface Props {
  task: { id: string; title: string };
  onClose: () => void;
  onChanged: () => void;
}

export function TaskReturnDialog({ task, onClose, onChanged }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      notifyValidation('Vui lòng nhập lý do trả về');
      return;
    }
    setLoading(true);
    const res = await updateTaskStatus(task.id, 'doing', reason.trim());
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không trả về được');
      return;
    }
    notifySuccess('Đã trả về', 'Nhân viên sẽ nhận thông báo và sửa lại');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-[17px] font-semibold text-slate-900">Trả về sửa lại</DialogTitle>
          <DialogDescription className="text-[13px] text-slate-500 font-medium line-clamp-1">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="space-y-4 px-[var(--app-page-x)] py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">Lý do trả về</label>
              <Textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Số liệu chưa khớp, vui lòng sửa lại phần…"
                className="rounded-xl bg-slate-50 border-none focus-visible:ring-0"
                autoFocus
              />
            </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-amber-600 hover:bg-amber-700">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Trả về'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
