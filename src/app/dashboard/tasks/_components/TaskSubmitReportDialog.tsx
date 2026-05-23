'use client';

// Dialog NV nộp báo cáo (luồng B: doing → submitted). File đính kèm sẽ thêm ở P2.

import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Paperclip } from 'lucide-react';
import { notifyError, notifySuccess } from '@/lib/notify';
import { updateTaskStatus, addComment } from '../_lib/taskActions';

interface Props {
  task: { id: string; title: string };
  onClose: () => void;
  onChanged: () => void;
}

export function TaskSubmitReportDialog({ task, onClose, onChanged }: Props) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    // 1. Add comment kèm note nếu có
    if (note.trim()) {
      const cm = await addComment(task.id, `[Nộp báo cáo] ${note.trim()}`);
      if (!cm.ok) {
        setLoading(false);
        notifyError(cm.error, 'Không lưu được ghi chú');
        return;
      }
    }
    // 2. Chuyển status sang submitted
    const res = await updateTaskStatus(task.id, 'submitted');
    setLoading(false);
    if (!res.ok) {
      notifyError(res.error, 'Không nộp được');
      return;
    }
    notifySuccess('Đã nộp báo cáo', 'Trưởng phòng sẽ duyệt sớm.');
    onChanged();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-[17px] font-semibold text-slate-900">Nộp báo cáo</DialogTitle>
          <DialogDescription className="text-[13px] text-slate-500 font-medium line-clamp-1">{task.title}</DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="space-y-4 px-[var(--app-page-x)] py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500">Ghi chú khi nộp (tuỳ chọn)</label>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="VD: Đã hoàn tất theo yêu cầu, lưu ý mục…"
                className="rounded-xl bg-slate-50 border-none focus-visible:ring-0"
              />
            </div>

            {/* P2 sẽ thêm component upload attachment ở đây */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 italic">
              <Paperclip className="icon-sm" />
              File đính kèm — sẽ có ở phase tiếp theo (tuỳ chọn).
            </div>
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading} className="rounded-xl">
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-primary">
            {loading ? <Loader2 className="icon-sm animate-spin" /> : 'Nộp báo cáo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
