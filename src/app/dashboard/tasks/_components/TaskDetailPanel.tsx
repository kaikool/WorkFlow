'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Calendar, Play, CheckCircle2, Send, Clock, Users, Archive,
  AlertTriangle, Loader2, Building2, UserPlus, Undo2, X, RotateCcw,
  Pencil, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  STATUS_LABEL,
  STATUS_BADGE_CLASS,
  PRIORITY_LABEL,
  PRIORITY_BADGE_CLASS,
  TASK_TYPE_LABEL,
} from '../_lib/constants';
import {
  canApproveReport, canDelegateTask,
  canRejectSubmission, canReopenDone,
  canEditTask, canDeleteTask, canForceCompleteTask,
  canApproveExtension,
} from '@/lib/permissions';
import { updateTaskStatus, archiveTask, deleteTask } from '../_lib/taskActions';
import { fetchTaskAttachments } from '../_lib/attachmentHelpers';
import { fetchBatchSiblings } from '../_lib/fetchTasks';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { batchScopeDialog } from '@/components/ui/batch-scope-dialog';
import { TaskDelegateDialog } from './TaskDelegateDialog';
import { TaskApproveExtensionDialog } from './TaskApproveExtensionDialog';
import { TaskRequestExtensionDialog } from './TaskRequestExtensionDialog';
import { TaskSubmitReportDialog } from './TaskSubmitReportDialog';
import { TaskReturnDialog } from './TaskReturnDialog';
import { TaskReopenDialog } from './TaskReopenDialog';
import { TaskApproveDialog } from './TaskApproveDialog';
import { TaskEditDialog } from './TaskEditDialog';
import { TaskCommentList } from './TaskCommentList';
import { TaskTimeline } from './TaskTimeline';
import { TaskAttachmentManager } from './TaskAttachmentManager';
import { SelectionPill } from '@/components/ui/people-picker';
import type { TaskDetail } from '../_lib/types';

interface Props {
  task: TaskDetail;
  currentProfile: { id: string; role: string; department_id: string | null } | null;
  onChanged: () => void;
  showArchive?: boolean;
}

export function TaskDetailPanel({ task, currentProfile, onChanged, showArchive = true }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [openDelegate, setOpenDelegate] = useState(false);
  const [openExtension, setOpenExtension] = useState(false);
  const [openSubmit, setOpenSubmit] = useState(false);
  const [openReturn, setOpenReturn] = useState(false);
  const [openReopen, setOpenReopen] = useState(false);
  const [openApprove, setOpenApprove] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [openApproveExtension, setOpenApproveExtension] = useState<any>(null);
  // Đếm attachment để gate "Xoá nháp" (chỉ cho xoá khi 0 file + 0 comment user).
  // Tự fetch vì TaskDetail không kèm attachments — chỉ probe trong cửa sổ 10 phút.
  const [attachmentCount, setAttachmentCount] = useState<number | null>(null);

  if (!currentProfile) return null;

  const myId = currentProfile.id;
  const isCreator = task.created_by === myId;
  const isAssignee = (task.assignees ?? []).some(a => a.id === myId);
  const isManagerOfTask = canDelegateTask(currentProfile, task);
  const isManagerApprove = canApproveReport(currentProfile, task);
  const isApproveExtensionManager = canApproveExtension(currentProfile, task);
  const pendingExtension = (task.extension_requests ?? []).find(e => e.status === 'pending');
  const isAdminOrDirector = ['admin', 'director'].includes(currentProfile.role);
  const isReport = task.task_type === 'report';
  const dueOverdue = !!(task.due_date && new Date(task.due_date) < new Date()
    && !['done', 'canceled'].includes(task.status));

  const runStatus = async (next: any, key: string, errorTitle: string) => {
    setBusy(key);
    const res = await updateTaskStatus(task.id, next);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, errorTitle); return; }
    notifySuccess('Đã cập nhật trạng thái');
    onChanged();
  };

  const runArchive = async () => {
    setBusy('archive');
    const res = await archiveTask(task.id, !task.is_archived);
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Không lưu trữ được'); return; }
    notifySuccess(task.is_archived ? 'Đã đưa khỏi lưu trữ' : 'Đã lưu trữ');
    onChanged();
  };

  // TP/PP tự nộp báo cáo của chính mình → tự ghi nhận luôn (có audit comment ở RPC)
  const isReportSelfApprove = isReport && isAssignee && isManagerOfTask;

  // ─── Action gates ─────────────────────────────────────────────────
  // Bắt đầu (todo → doing): chỉ assignee. Manager-ngoài-assignee không cần "đập" Bắt đầu
  // (Phân công lại đã tự move sang doing). Cho cả task lẫn report.
  const canStart = isAssignee && task.status === 'todo';

  // Hoàn thành — chỉ hiện khi đang Đang làm (todo phải Bắt đầu trước cho rõ ý)
  const canMarkDoneTask = !isReport && (isAssignee || isManagerOfTask)
    && task.status === 'doing';
  const canMarkDoneReport = isReport && isAssignee
    && task.status === 'doing'
    && (!task.requires_approval || isReportSelfApprove);
  const canMarkDone = canMarkDoneTask || canMarkDoneReport;

  const canSubmit = isReport && isAssignee
    && task.status === 'doing'
    && task.requires_approval
    && !isReportSelfApprove;

  const canApproveSubmission = isReport && isManagerApprove && task.status === 'submitted';
  const canReject = canRejectSubmission(currentProfile, task);
  const canReopen = canReopenDone(currentProfile, task);
  const canRequestExtension = isAssignee && task.status !== 'done' && task.status !== 'canceled';
  const canDelegate = isManagerOfTask && task.status !== 'done' && task.status !== 'canceled';

  // done là trạng thái chốt — chỉ admin/director mở lại, không ai khác sửa được nữa.
  const isReadOnly = task.is_archived || task.status === 'canceled' || task.status === 'done';

  // Sửa nội dung — creator/admin/director, mọi status trừ canceled/archived.
  const canEdit = canEditTask(currentProfile, task);

  // Chủ động ghi nhận (Force Complete)
  const canForceComplete = !isReadOnly && canForceCompleteTask(currentProfile, task);

  // Xoá công việc hoàn toàn
  const canDelete = canDeleteTask(currentProfile, task);

  const runForceComplete = async () => {
    const ok = await confirmDialog({
      title: 'Xác nhận ghi nhận hoàn thành công việc/báo cáo?',
      description: 'Bạn có chắc chắn muốn ghi nhận hoàn thành? Việc này sẽ đóng công việc dù người nhận chưa nộp.',
      confirmText: 'Xác nhận',
    });
    if (!ok) return;
    
    setBusy('forceComplete');
    const res = await updateTaskStatus(task.id, 'done', '[Hệ thống] Đã ghi nhận hoàn thành.');
    setBusy(null);
    if (!res.ok) { notifyError(res.error, 'Không thể ghi nhận hoàn thành'); return; }
    notifySuccess('Đã cập nhật trạng thái');
    onChanged();
  };

  const runDelete = async () => {
    // Batch: nếu task thuộc lô, hỏi user áp cả lô hay chỉ task này.
    if (task.batch_id) {
      setBusy('delete');
      const siblings = await fetchBatchSiblings(task.batch_id);
      setBusy(null);
      const deletable = siblings.filter(s => canDeleteTask(currentProfile, s));

      if (deletable.length > 1) {
        const scope = await batchScopeDialog({
          title: 'Xoá cả lô công việc?',
          description: `Việc này nằm trong một lô gửi đến ${deletable.length} phòng. Xoá cả lô — hay chỉ task này?`,
          batchSize: deletable.length,
          destructive: true,
        });
        if (scope === null) return;
        const ids = scope === 'batch' ? deletable.map(s => s.id) : [task.id];
        await runDeleteIds(ids);
        return;
      }
    }

    const ok = await confirmDialog({
      title: 'Xoá công việc?',
      description: `Bạn có chắc muốn xoá "${task.title}"? Hành động này không thể quay lại và sẽ xoá luôn các file đính kèm.`,
      confirmText: 'Xoá',
      danger: true,
    });
    if (!ok) return;
    await runDeleteIds([task.id]);
  };

  const runDeleteIds = async (taskIds: string[]) => {
    setBusy('delete');
    let okCount = 0;
    let firstError: string | null = null;
    for (const id of taskIds) {
      const res = await deleteTask(id);
      if (res.ok) okCount += 1;
      else if (!firstError) firstError = res.error ?? null;
    }
    setBusy(null);

    if (okCount === 0) {
      notifyError(firstError ?? 'Lỗi không xác định', 'Không xoá được');
      return;
    }
    if (taskIds.length === 1) {
      notifySuccess('Đã xoá công việc');
    } else {
      const skipped = taskIds.length - okCount;
      notifySuccess(
        `Đã xoá ${okCount}/${taskIds.length} việc trong lô`,
        skipped > 0 ? `${skipped} task bỏ qua do lỗi quyền hoặc trạng thái` : undefined,
      );
    }
    onChanged();
  };

  // Cờ "Báo cáo bị trả về" — banner đỏ cam cho người được giao
  const lastReturnedAt = (task as any).last_returned_at as string | null | undefined;
  const lastReturnReason = (task as any).last_return_reason as string | null | undefined;
  const showReturnedBanner = !!(lastReturnedAt && lastReturnReason
    && task.status === 'doing'
    && (isAssignee || isManagerOfTask));

  return (
    <div className="group-stack">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 font-medium', STATUS_BADGE_CLASS[task.status])}>
          {STATUS_LABEL[task.status]}
        </Badge>
        {task.priority !== 'medium' && (
          <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 font-medium', PRIORITY_BADGE_CLASS[task.priority])}>
            {PRIORITY_LABEL[task.priority]}
          </Badge>
        )}
        <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-medium bg-slate-50 border-slate-200 text-slate-600">
          {isReport ? TASK_TYPE_LABEL.report : TASK_TYPE_LABEL.task}
        </Badge>
        {dueOverdue && (
          <Badge className="rounded-full px-2.5 py-0.5 font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertTriangle className="icon-sm mr-1" />
            Quá hạn
          </Badge>
        )}
        {task.is_archived && (
          <Badge variant="outline" className="rounded-full px-2.5 py-0.5 font-medium bg-slate-100 text-slate-500 border-slate-200">
            Lưu trữ
          </Badge>
        )}
        {showArchive && isAdminOrDirector && (task.status === 'done' || task.status === 'canceled') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={runArchive}
            disabled={busy !== null}
            className="ml-auto min-h-9 rounded-xl font-medium text-slate-500 hover:text-slate-900"
          >
            <Archive className="icon-sm mr-1.5" />
            {task.is_archived ? 'Khôi phục' : 'Lưu trữ'}
          </Button>
        )}
      </div>

      {/* Banner "Đã bị trả về" — gắn rõ lý do cho người được giao, có CTA Nộp lại */}
      {showReturnedBanner && (
        <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200">
          <Undo2 className="icon-md text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-label text-amber-800">Báo cáo bị trả về để sửa</p>
            <p className="text-subtitle text-amber-900 mt-0.5 whitespace-pre-wrap">{lastReturnReason}</p>
            <p className="text-meta text-amber-700 mt-1">
              {format(new Date(lastReturnedAt!), 'EEEE, dd/MM/yyyy HH:mm', { locale: vi })}
            </p>
          </div>
        </div>
      )}

      {/* Banner "Xin gia hạn đang chờ duyệt" — hiển thị cho Trưởng phòng xử lý hoặc NV theo dõi */}
      {pendingExtension && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 border border-blue-200">
          <Clock className="icon-md text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-label text-blue-800 font-semibold">Yêu cầu gia hạn đang chờ duyệt</p>
            <p className="text-subtitle text-slate-800 mt-1">
              <strong>{pendingExtension.requester?.full_name ?? 'Cán bộ'}</strong> xin gia hạn từ{' '}
              {task.due_date ? format(new Date(task.due_date), 'dd/MM/yyyy', { locale: vi }) : '—'}{' '}
              sang{' '}
              <span className="text-blue-700 font-bold">
                {format(new Date(pendingExtension.new_due_date), 'dd/MM/yyyy', { locale: vi })}
              </span>
            </p>
            {pendingExtension.reason && (
              <p className="text-[13px] text-slate-600 mt-1 italic">
                Lý do: "{pendingExtension.reason}"
              </p>
            )}
            {isApproveExtensionManager ? (
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => setOpenApproveExtension(pendingExtension)}
                  className="min-h-9 rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-none px-4"
                >
                  Xử lý yêu cầu
                </Button>
              </div>
            ) : (
              <p className="text-meta text-slate-500 mt-2">
                Đang chờ Trưởng phòng hoặc Ban Giám đốc phê duyệt.
              </p>
            )}
          </div>
        </div>
      )}

      {task.description && (
        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
          {task.description}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 p-4 bg-slate-50 rounded-2xl">
        {isReport && task.department && (
          <MetaRow
            icon={<Building2 className="icon-md text-amber-500" />}
            label="Phòng nhận báo cáo"
            value={<span className="heading-card truncate">{task.department.name}</span>}
          />
        )}

        <MetaRow
          icon={<Calendar className={cn('icon-md', dueOverdue ? 'text-red-500' : 'text-slate-400')} />}
          label="Hạn hoàn thành"
          value={
            <span className={cn('heading-card', dueOverdue && 'text-red-700')}>
              {task.due_date ? format(new Date(task.due_date), 'EEEE, dd/MM/yyyy HH:mm', { locale: vi }) : '—'}
            </span>
          }
        />

        {!isReport && task.department && (
          <MetaRow
            icon={<Building2 className="icon-md text-slate-400" />}
            label="Phòng ban"
            value={<span className="heading-card truncate">{task.department.name}</span>}
          />
        )}

        <MetaRow
          icon={
            <Avatar className="w-6 h-6">
              <AvatarImage src={task.creator?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-slate-100 text-meta font-semibold">
                {task.creator?.full_name?.[0] ?? '?'}
              </AvatarFallback>
            </Avatar>
          }
          label="Người giao"
          value={<span className="heading-card truncate">{task.creator?.full_name ?? '—'}</span>}
        />

        <div className="sm:col-span-2 tight-stack">
          <div className="flex items-center gap-1.5 text-meta">
            <Users className="icon-sm" />
            <span>{isReport ? 'Cán bộ được phân công' : 'Người nhận'}</span>
          </div>
          {/* task_assignees không bao giờ rỗng — RPC auto-fill TP khi report giao cho phòng.
              Đoạn fallback "Chưa phân công" cũ đã bỏ. */}
          {task.assignees && task.assignees.length > 0 && (
            <SelectionPill
              avatars={task.assignees}
              countLabel={
                task.assignees.length === 1
                  ? task.assignees[0].full_name ?? '1 người'
                  : `${task.assignees.length} người`
              }
            />
          )}
          {isReportSelfApprove && task.requires_approval && task.status === 'doing' && (
            <p className="text-subtitle text-amber-700 font-medium italic flex items-center gap-2">
              <AlertTriangle className="icon-sm" />
              Bạn là người duyệt báo cáo của chính mình — bấm "Hoàn thành" sẽ tự ghi nhận có audit log.
            </p>
          )}
          {task.requires_approval && (
            <p className="text-meta italic">
              Báo cáo này cần Trưởng phòng duyệt sau khi nộp.
            </p>
          )}
        </div>
      </div>

      {/* Action bar — dùng label-bên-cạnh-icon cho rõ, ưu tiên action chính lên trước.
          Action phụ (gia hạn, phân công) gom thành ghost button. Cancel/Reopen dồn về phải. */}
      {!isReadOnly && (
        <div className="flex flex-wrap gap-2 items-center">
          {canSubmit && (
            <PrimaryAction
              label="Nộp báo cáo"
              tone="primary"
              icon={<Send className="icon-md" />}
              onClick={() => setOpenSubmit(true)}
              disabled={busy !== null}
            />
          )}
          {canApproveSubmission && (
            <PrimaryAction
              label="Duyệt"
              tone="amber"
              icon={<CheckCircle2 className="icon-md" />}
              onClick={() => setOpenApprove(true)}
              disabled={busy !== null}
            />
          )}
          {canStart && !canSubmit && !canApproveSubmission && (
            <PrimaryAction
              label="Bắt đầu"
              tone="primary"
              icon={busy === 'start' ? <Loader2 className="icon-md animate-spin" /> : <Play className="icon-md" />}
              onClick={() => runStatus('doing', 'start', 'Không bắt đầu được')}
              disabled={busy !== null}
            />
          )}
          {canMarkDone && !canSubmit && !canApproveSubmission && (
            <PrimaryAction
              label="Hoàn thành"
              tone="primary"
              icon={busy === 'done' ? <Loader2 className="icon-md animate-spin" /> : <CheckCircle2 className="icon-md" />}
              onClick={() => runStatus('done', 'done', 'Không hoàn thành được')}
              disabled={busy !== null}
            />
          )}
          {canForceComplete && (
            <PrimaryAction
              label="Đã nhận"
              tone="primary"
              icon={busy === 'forceComplete' ? <Loader2 className="icon-md animate-spin" /> : <CheckCircle2 className="icon-md" />}
              onClick={runForceComplete}
              disabled={busy !== null}
            />
          )}

          {canApproveSubmission && (
            <SecondaryAction
              label="Trả về sửa"
              icon={<Undo2 className="icon-md" />}
              onClick={() => setOpenReturn(true)}
              disabled={busy !== null}
            />
          )}
          {!canApproveSubmission && canReject && (
            <SecondaryAction
              label="Trả về"
              icon={<Undo2 className="icon-md" />}
              onClick={() => setOpenReturn(true)}
              disabled={busy !== null}
            />
          )}
          {canDelegate && (
            <SecondaryAction
              label={(task.assignees?.length ?? 0) === 0 ? 'Phân công' : 'Phân công lại'}
              icon={<UserPlus className="icon-md" />}
              onClick={() => setOpenDelegate(true)}
              disabled={busy !== null}
            />
          )}
          {canEdit && (
            <SecondaryAction
              label="Sửa"
              icon={<Pencil className="icon-md" />}
              onClick={() => setOpenEdit(true)}
              disabled={busy !== null}
            />
          )}
          {canRequestExtension && (
            <SecondaryAction
              label="Xin gia hạn"
              icon={<Clock className="icon-md" />}
              onClick={() => setOpenExtension(true)}
              disabled={busy !== null}
            />
          )}

          {canDelete && (
            <DangerAction
              label="Xoá"
              icon={busy === 'delete' ? <Loader2 className="icon-md animate-spin" /> : <Trash2 className="icon-md" />}
              onClick={runDelete}
              disabled={busy !== null}
              className="ml-auto"
            />
          )}
        </div>
      )}

      {/* Done là readonly với mọi người — người tạo/admin có 1 nút Mở lại riêng để cảnh báo */}
      {!task.is_archived && task.status === 'done' && canReopen && (
        <div className="flex flex-wrap gap-2 items-center">
          <SecondaryAction
            label="Mở lại để sửa"
            icon={<RotateCcw className="icon-md" />}
            onClick={() => setOpenReopen(true)}
            disabled={busy !== null}
          />
        </div>
      )}

      {(task.extension_requests.length > 0 || task.comments.some(c => c.content.startsWith('[Hệ thống]'))) && (
        <div className="pt-2">
          <TaskTimeline task={task} />
        </div>
      )}

      <div className="pt-2 item-stack">
        <h3 className="heading-card">File đính kèm</h3>
        <TaskAttachmentManager
          taskId={task.id}
          canUpload={!isReadOnly && (isAssignee || isCreator || isManagerOfTask)}
        />
      </div>

      <div className="pt-2">
        <TaskCommentList
          taskId={task.id}
          comments={task.comments.filter(c => !c.content.startsWith('[Hệ thống]'))}
          onAdded={onChanged}
          canCompose={currentProfile.role !== 'admin'}
        />
      </div>

      {openDelegate && (
        <TaskDelegateDialog
          task={{ id: task.id, title: task.title, department_id: task.department_id }}
          currentAssigneeIds={(task.assignees ?? []).map(a => a.id)}
          onClose={() => setOpenDelegate(false)}
          onChanged={() => { setOpenDelegate(false); onChanged(); }}
        />
      )}
      {openExtension && (
        <TaskRequestExtensionDialog
          task={{ id: task.id, title: task.title, due_date: task.due_date }}
          onClose={() => setOpenExtension(false)}
          onChanged={() => { setOpenExtension(false); onChanged(); }}
        />
      )}
      {openSubmit && (
        <TaskSubmitReportDialog
          task={{ id: task.id, title: task.title }}
          onClose={() => setOpenSubmit(false)}
          onChanged={() => { setOpenSubmit(false); onChanged(); }}
        />
      )}
      {openApprove && (
        <TaskApproveDialog
          task={{ id: task.id, title: task.title }}
          onClose={() => setOpenApprove(false)}
          onChanged={() => { setOpenApprove(false); onChanged(); }}
        />
      )}
      {openReturn && (
        <TaskReturnDialog
          task={{ id: task.id, title: task.title }}
          onClose={() => setOpenReturn(false)}
          onChanged={() => { setOpenReturn(false); onChanged(); }}
        />
      )}
      {openReopen && (
        <TaskReopenDialog
          task={{ id: task.id, title: task.title }}
          onClose={() => setOpenReopen(false)}
          onChanged={() => { setOpenReopen(false); onChanged(); }}
        />
      )}
      {openEdit && (
        <TaskEditDialog
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            due_date: task.due_date,
            batch_id: task.batch_id,
          }}
          onClose={() => setOpenEdit(false)}
          onChanged={() => { setOpenEdit(false); onChanged(); }}
        />
      )}
      {openApproveExtension && (
        <TaskApproveExtensionDialog
          extension={{
            ...openApproveExtension,
            task: { title: task.title }
          }}
          onClose={() => setOpenApproveExtension(null)}
          onChanged={() => { setOpenApproveExtension(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function MetaRow({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-meta mb-0.5">{label}</p>
        {value}
      </div>
    </div>
  );
}

// Action button có label — tránh icon-only khó hiểu trên mobile.
// Touch ≥44px (min-h-11). Tone: primary (blue), amber (duyệt), outline (phụ), danger (huỷ).
type Tone = 'primary' | 'amber' | 'outline' | 'danger';

interface ActionProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

function PrimaryAction({ label, icon, onClick, disabled, tone = 'primary', className }: ActionProps & { tone?: 'primary' | 'amber' }) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-600 text-white hover:bg-amber-700 border-transparent'
      : 'bg-primary text-white hover:bg-primary/90 border-transparent';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-h-11 px-4 inline-flex items-center gap-2 rounded-full font-medium transition-all',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-95',
        toneClass,
        className,
      )}
    >
      {icon}
      <span className="text-[14px]">{label}</span>
    </button>
  );
}

function SecondaryAction({ label, icon, onClick, disabled, className }: ActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-h-11 px-4 inline-flex items-center gap-2 rounded-full font-medium transition-all',
        'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-95',
        className,
      )}
    >
      {icon}
      <span className="text-[14px]">{label}</span>
    </button>
  );
}

function DangerAction({ label, icon, onClick, disabled, className }: ActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'min-h-11 px-4 inline-flex items-center gap-2 rounded-full font-medium transition-all',
        'bg-transparent text-red-600 hover:bg-red-50 border-transparent',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-95',
        className,
      )}
    >
      {icon}
      <span className="text-[14px]">{label}</span>
    </button>
  );
}
