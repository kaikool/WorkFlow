'use client';

// TaskDetailDialog — popup detail đồng bộ với pattern Hồ sơ/Schedule.
// Đóng dialog = clear ?id= trong URL.

import React, { useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { useTaskDetail } from '../_hooks/useTaskDetail';
import { TaskDetailPanel } from './TaskDetailPanel';

interface Props {
  taskId: string | null;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  currentProfile: { id: string; role: string; department_id: string | null } | null;
  onChanged?: () => void;
}

export function TaskDetailDialog({
  taskId, isOpen, setIsOpen, currentProfile, onChanged,
}: Props) {
  const { loading, task, refetch } = useTaskDetail(isOpen ? taskId : null);

  // Trigger onChanged khi task state thay đổi từ trong (vd: nhận status update qua RPC)
  useEffect(() => {
    if (task && onChanged) onChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.status, task?.updated_at]);

  if (!isOpen || !taskId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent hideCloseButton className="app-dialog-sheet app-dialog-sheet--2xl shadow-2xl flex flex-col p-0">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-[18px] font-bold text-slate-900 leading-tight pr-8">
            {loading && !task ? 'Đang tải…' : (task?.title ?? 'Không tìm thấy')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Chi tiết công việc — thông tin, trạng thái, bình luận, lịch sử thay đổi.
          </DialogDescription>
        </DialogHeader>

        {loading && !task && (
          <div className="flex-1 flex items-center justify-center py-10">
            <Loader2 className="icon-lg animate-spin text-slate-400" />
          </div>
        )}
        {task && (
          <TaskDetailPanel
            task={task}
            currentProfile={currentProfile}
            onChanged={() => {
              refetch();
              onChanged?.();
            }}
            onClose={() => setIsOpen(false)}
          />
        )}
        {!loading && !task && (
          <p className="text-[14px] text-slate-500 text-center py-10">
            Công việc đã bị xoá hoặc bạn không có quyền xem.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
