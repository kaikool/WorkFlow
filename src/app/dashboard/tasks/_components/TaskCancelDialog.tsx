'use client';

// Dialog huỷ task — chỉ creator/manager/admin/director bấm được (assignee không huỷ task của người khác).
// Lý do BẮT BUỘC: huỷ là quyết định có tác động (notify nhiều người, mất tiến độ).
// Hiển thị warning kèm số assignee sẽ nhận thông báo để người huỷ biết tác động.

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle } from 'lucide-react';
import { notifyError, notifySuccess, notifyValidation } from '@/lib/notify';
import { cancelTask } from '../_lib/taskActions';

interface Props {
  task: {
    id: string;
    title: string;
    assigneeCount?: number;  // Để hiện cảnh báo "N người sẽ nhận thông báo"
  };
  onClose: () => void;
  onChanged: () => void;
}

export function TaskCancelDialog({ task, onClose, onChanged }: Props) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      notifyValidation('Vui lòng nhập lý do huỷ');
      return;
    }
    setLoading(true);
    const res = await cancelTask(task.id, reason.trim());
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không huỷ được');
      return;
    }
    notifySuccess('Đã huỷ công việc', 'Người liên quan đã nhận thông báo.');
    onChanged();
  };

  const assigneeCount = task.assigneeCount ?? 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="heading-section">Huỷ công việc?</DialogTitle>
          <DialogDescription className="text-subtitle line-clamp-1">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="px-[var(--app-page-x)] py-4 tight-stack">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertTriangle className="icon-sm text-red-700 shrink-0 mt-0.5" />
              <div className="text-subtitle text-red-800">
                <p>
                  Việc đã huỷ <b>không thể quay lại</b>. Trạng thái chuyển sang <b>Đã huỷ</b> và lưu vĩnh viễn trong nhật ký.
                </p>
                {assigneeCount > 0 && (
                  <p className="mt-1">
                    {assigneeCount === 1 ? '1 người' : `${assigneeCount} người`} đang nhận sẽ được thông báo.
                  </p>
                )}
              </div>
            </div>

            <Label className="text-label">Lý do huỷ (bắt buộc)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Không còn cần làm, kế hoạch đổi, trùng với việc khác…"
              className="rounded-xl bg-slate-50 border-none focus-visible:ring-0"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Không huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-red-600 hover:bg-red-700">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Xác nhận huỷ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
