'use client';

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { notifyError, notifyValidation } from '@/lib/notify';
import { addComment } from '../_lib/taskActions';
import type { TaskDetail } from '../_lib/types';

interface Props {
  taskId: string;
  comments: TaskDetail['comments'];
  onAdded: () => void;
  canCompose?: boolean;
}

export function TaskCommentList({ taskId, comments, onAdded, canCompose = true }: Props) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!body.trim()) {
      notifyValidation('Vui lòng nhập nội dung');
      return;
    }
    setBusy(true);
    const res = await addComment(taskId, body.trim());
    setBusy(false);
    if (!res.ok) {
      notifyError(res.error, 'Không gửi được bình luận');
      return;
    }
    setBody('');
    onAdded();
  };

  const disabled = busy || !body.trim();

  return (
    <section className="item-stack">
      <h3 className="heading-card">Bình luận ({comments.length})</h3>

      <div className="item-stack">
        {comments.length === 0 ? (
          <p className="text-meta italic py-2">Chưa có bình luận</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="avatar-sm shrink-0">
                <AvatarImage src={c.user?.avatar_url ?? undefined} alt={c.user?.full_name ?? ''} />
                <AvatarFallback className="text-meta">
                  {c.user?.full_name?.charAt(0) ?? '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className="heading-card truncate">{c.user?.full_name ?? '—'}</span>
                  <span className="text-meta">
                    {format(new Date(c.created_at), 'HH:mm dd/MM', { locale: vi })}
                  </span>
                </div>
                <p className="text-subtitle text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
                  {c.content}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="relative pt-3 border-t border-slate-100">
        {canCompose ? (
          <>
            <Textarea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Viết bình luận..."
              className="rounded-2xl bg-slate-50 border-none focus-visible:ring-0 resize-none pr-12 pl-4 py-3"
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={disabled}
              aria-label="Gửi bình luận"
              className={cn(
                'absolute right-2 bottom-2 w-9 h-9 inline-flex items-center justify-center rounded-full transition-all',
                disabled
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-primary text-white hover:bg-primary/90 active:scale-90',
              )}
            >
              {busy ? <Loader2 className="icon-sm animate-spin" /> : <Send className="icon-sm" />}
            </button>
          </>
        ) : (
          <p className="text-meta italic">Bạn đang ở chế độ quản trị hệ thống — chỉ xem.</p>
        )}
      </div>
    </section>
  );
}
