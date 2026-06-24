'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Paperclip, FileText, Image as ImageIcon, Download, X, Loader2, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { notifyError, notifySuccess } from '@/lib/notify';
import {
  uploadAttachment,
  removeAttachment,
  getSignedUrl,
  fetchTaskAttachments,
  formatBytes,
  type TaskAttachment,
} from '../_lib/attachmentHelpers';

interface Props {
  taskId: string;
  // Có cho phép upload không (false nếu task done/canceled hoặc user không có quyền)
  canUpload?: boolean;
  // Tự fetch list (nếu false thì caller pass attachments)
  autoFetch?: boolean;
}

function fileIcon(mime: string | null | undefined) {
  if (mime?.startsWith('image/')) return ImageIcon;
  return FileText;
}

export function TaskAttachmentManager({ taskId, canUpload = true, autoFetch = true }: Props) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    if (!autoFetch) return;
    const list = await fetchTaskAttachments(taskId);
    setAttachments(list);
  }, [taskId, autoFetch]);

  useEffect(() => { reload(); }, [reload]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const res = await uploadAttachment(taskId, file);
      if (!res.ok) {
        notifyError(res.error, `Không upload được ${file.name}`);
      }
    }
    setUploading(false);
    notifySuccess('Đã tải lên');
    reload();
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    const res = await removeAttachment(id);
    setRemovingId(null);
    if (!res.ok) { notifyError(res.error, 'Không xoá được file'); return; }
    notifySuccess('Đã xoá file');
    reload();
  };

  const handleDownload = async (path: string, filename: string) => {
    const url = await getSignedUrl(path);
    if (!url) { notifyError('Không lấy được liên kết tải về', 'Lỗi tải file'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="item-stack">
      {canUpload && (
        <label
          className={cn(
            'flex items-center gap-3 min-h-11 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-all',
            uploading
              ? 'bg-slate-50 border-slate-300 cursor-not-allowed'
              : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-primary/40',
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
            className="sr-only"
          />
          {uploading ? (
            <>
              <Loader2 className="icon-md text-slate-500 animate-spin" />
              <span className="text-subtitle font-medium text-slate-600">Đang tải lên...</span>
            </>
          ) : (
            <>
              <Upload className="icon-md text-slate-500" />
              <span className="text-subtitle font-medium text-slate-600">
                Đính kèm file (PDF, Word, Excel, ảnh — tối đa 20MB)
              </span>
            </>
          )}
        </label>
      )}

      {attachments.length > 0 && (
        <ul className="item-stack">
          {attachments.map(att => {
            const Icon = fileIcon(att.mime_type);
            return (
              <li
                key={att.id}
                className="flex items-center gap-3 h-12 px-3 bg-white border border-slate-100 rounded-xl"
              >
                <Icon className="icon-md text-slate-500 shrink-0" />
                <button
                  type="button"
                  onClick={() => handleDownload(att.storage_path, att.filename)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-subtitle font-medium text-slate-900 truncate">{att.filename}</p>
                  <p className="text-meta">{formatBytes(att.size_bytes)}</p>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(att.storage_path, att.filename)}
                  aria-label="Tải về"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                >
                  <Download className="icon-sm" />
                </button>
                {canUpload && (
                  <button
                    type="button"
                    onClick={() => handleRemove(att.id)}
                    disabled={removingId === att.id}
                    aria-label="Xoá"
                    className="w-9 h-9 inline-flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    {removingId === att.id ? <Loader2 className="icon-sm animate-spin" /> : <X className="icon-sm" />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!canUpload && attachments.length === 0 && (
        <p className="text-meta italic flex items-center gap-1.5">
          <Paperclip className="icon-sm" /> Chưa có file đính kèm
        </p>
      )}
    </div>
  );
}
