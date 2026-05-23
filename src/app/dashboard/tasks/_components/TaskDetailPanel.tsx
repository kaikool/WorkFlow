'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Calendar, Play, CheckCircle2, Send, Clock, Users, Archive,
  AlertTriangle, Loader2, Building2, UserPlus, Undo2, X,
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
import { canApproveReport, canDelegateTask, canReturnTask } from '@/lib/permissions';
import { updateTaskStatus, archiveTask } from '../_lib/taskActions';
import { TaskDelegateDialog } from './TaskDelegateDialog';
import { TaskRequestExtensionDialog } from './TaskRequestExtensionDialog';
import { TaskSubmitReportDialog } from './TaskSubmitReportDialog';
import { TaskReturnDialog } from './TaskReturnDialog';
import { TaskCancelDialog } from './TaskCancelDialog';
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
  const [openCancel, setOpenCancel] = useState(false);

  if (!currentProfile) return null;

  const myId = currentProfile.id;
  const isCreator = task.created_by === myId;
  const isAssignee = (task.assignees ?? []).some(a => a.id === myId);
  const isManagerOfTask = canDelegateTask(currentProfile, task);
  const isManagerApprove = canApproveReport(currentProfile, task);
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

  const canStart = (isAssignee || isManagerOfTask) && task.status === 'todo';

  // TP/PP tự nộp báo cáo của chính mình → tự ghi nhận luôn (có audit comment ở RPC)
  const isReportSelfApprove = isReport && isAssignee && isManagerOfTask;

  const canMarkDoneTask = !isReport && (isAssignee || isManagerOfTask)
    && (task.status === 'todo' || task.status === 'doing');
  const canMarkDoneReport = isReport && isAssignee
    && (task.status === 'todo' || task.status === 'doing')
    && (!task.requires_approval || isReportSelfApprove);
  const canMarkDone = canMarkDoneTask || canMarkDoneReport;

  const canSubmit = isReport && isAssignee
    && task.status === 'doing'
    && task.requires_approval
    && !isReportSelfApprove;

  const canApproveSubmission = isReport && isManagerApprove && task.status === 'submitted';
  const canReturn = canReturnTask(currentProfile, task);
  const canRequestExtension = isAssignee && task.status !== 'done' && task.status !== 'canceled';
  const canDelegate = isManagerOfTask && task.status !== 'done' && task.status !== 'canceled';
  const canCancel = (isCreator || isAssignee || isManagerOfTask)
    && task.status !== 'done' && task.status !== 'canceled';
  const isReadOnly = task.is_archived || task.status === 'canceled';

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
              {task.due_date ? format(new Date(task.due_date), 'EEEE, dd/MM/yyyy', { locale: vi }) : '—'}
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
          {task.assignees && task.assignees.length > 0 ? (
            <SelectionPill
              avatars={task.assignees}
              countLabel={
                task.assignees.length === 1
                  ? task.assignees[0].full_name ?? '1 người'
                  : `${task.assignees.length} người`
              }
            />
          ) : (
            <p className="text-subtitle text-amber-700 font-medium italic">
              Chưa phân công — chờ Trưởng phòng phân công cán bộ
            </p>
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
      {!isReadOnly && (
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-2 items-center">
            {canSubmit && (
              <IconCTA
                tooltip="Nộp báo cáo"
                tone="primary"
                onClick={() => setOpenSubmit(true)}
                disabled={busy !== null}
                icon={<Send className="icon-md" />}
              />
            )}
            {canApproveSubmission && (
              <IconCTA
                tooltip="Duyệt báo cáo"
                tone="amber"
                onClick={() => runStatus('done', 'approve', 'Không duyệt được')}
                disabled={busy !== null}
                icon={busy === 'approve' ? <Loader2 className="icon-md animate-spin" /> : <CheckCircle2 className="icon-md" />}
              />
            )}
            {canStart && !canSubmit && !canApproveSubmission && (
              <IconCTA
                tooltip="Bắt đầu"
                tone="primary"
                onClick={() => runStatus('doing', 'start', 'Không bắt đầu được')}
                disabled={busy !== null}
                icon={busy === 'start' ? <Loader2 className="icon-md animate-spin" /> : <Play className="icon-md" />}
              />
            )}
            {canMarkDone && !canSubmit && !canApproveSubmission && (
              <IconCTA
                tooltip="Hoàn thành"
                tone="primary"
                onClick={() => runStatus('done', 'done', 'Không hoàn thành được')}
                disabled={busy !== null}
                icon={busy === 'done' ? <Loader2 className="icon-md animate-spin" /> : <CheckCircle2 className="icon-md" />}
              />
            )}

            {canApproveSubmission && (
              <IconCTA
                tooltip="Trả về sửa lại"
                tone="outline"
                onClick={() => setOpenReturn(true)}
                disabled={busy !== null}
                icon={<Undo2 className="icon-md" />}
              />
            )}
            {!canApproveSubmission && canReturn && (
              <IconCTA
                tooltip={task.status === 'done' ? 'Trả lại báo cáo đã hoàn thành' : 'Trả lại'}
                tone="outline"
                onClick={() => setOpenReturn(true)}
                disabled={busy !== null}
                icon={<Undo2 className="icon-md" />}
              />
            )}
            {canDelegate && (
              <IconCTA
                tooltip={(task.assignees?.length ?? 0) === 0 ? 'Phân công' : 'Phân công lại'}
                tone="outline"
                onClick={() => setOpenDelegate(true)}
                disabled={busy !== null}
                icon={<UserPlus className="icon-md" />}
              />
            )}
            {canRequestExtension && (
              <IconCTA
                tooltip="Xin gia hạn"
                tone="outline"
                onClick={() => setOpenExtension(true)}
                disabled={busy !== null}
                icon={<Clock className="icon-md" />}
              />
            )}

            {canCancel && (
              <IconCTA
                tooltip="Huỷ công việc"
                tone="danger"
                onClick={() => setOpenCancel(true)}
                disabled={busy !== null}
                icon={<X className="icon-md" />}
                className="ml-auto"
              />
            )}
          </div>
        </TooltipProvider>
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
      {openReturn && (
        <TaskReturnDialog
          task={{ id: task.id, title: task.title, status: task.status }}
          onClose={() => setOpenReturn(false)}
          onChanged={() => { setOpenReturn(false); onChanged(); }}
        />
      )}
      {openCancel && (
        <TaskCancelDialog
          task={{ id: task.id, title: task.title }}
          onClose={() => setOpenCancel(false)}
          onChanged={() => { setOpenCancel(false); onChanged(); }}
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

type CTATone = 'primary' | 'amber' | 'outline' | 'danger';

function IconCTA({
  tooltip, icon, onClick, disabled, tone, className,
}: {
  tooltip: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: CTATone;
  className?: string;
}) {
  const toneClass: Record<CTATone, string> = {
    primary: 'bg-primary text-white hover:bg-primary/90 border-transparent',
    amber: 'bg-amber-600 text-white hover:bg-amber-700 border-transparent',
    outline: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    danger: 'bg-transparent text-red-600 hover:bg-red-50 border-transparent',
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={tooltip}
          className={cn(
            'h-11 w-11 inline-flex items-center justify-center rounded-full transition-all',
            'disabled:opacity-50 disabled:pointer-events-none',
            'active:scale-95',
            toneClass[tone],
            className,
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
