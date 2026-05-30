"use client";

import React from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Undo2,
  User,
  Building2,
  Send,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { fetchDocumentComments, addDocumentComment } from "../_lib/commentActions";
import type { DocumentComment } from "../_lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { notifyError, notifySuccess } from "@/lib/notify";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { DOCUMENT_STATUS_META } from "../_lib/constants";
import { fetchDocumentById } from "../_lib/fetchHandover";
import { acknowledgeDocument, completeDocument } from "../_lib/transferActions";
import { canViewAllDocuments } from "@/lib/permissions";
import type { DocumentRow, HandoverRow } from "../_lib/types";
import HandoverTimeline from "./HandoverTimeline";
import SLABadge from "./SLABadge";
import TransferDialog from "./TransferDialog";
import ReturnReasonDialog from "./ReturnReasonDialog";
import ImageUploader from "./ImageUploader";
import ImageLightbox from "./ImageLightbox";

interface Props {
  documentId: string | null;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  profile: any;
  allProfiles: any[];
  onChanged: () => void;
}

export default function DocumentDetailDialog({
  documentId,
  isOpen,
  setIsOpen,
  profile,
  allProfiles,
  onChanged,
}: Props) {
  const [doc, setDoc] = React.useState<DocumentRow | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isTransferOpen, setIsTransferOpen] = React.useState(false);
  const [isReturnOpen, setIsReturnOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  // States for comments
  const [comments, setComments] = React.useState<DocumentComment[]>([]);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [newComment, setNewComment] = React.useState("");
  const [submittingComment, setSubmittingComment] = React.useState(false);

  const refetch = React.useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    const fresh = await fetchDocumentById(documentId);
    setDoc(fresh);
    setLoading(false);

    setLoadingComments(true);
    const freshComments = await fetchDocumentComments(documentId);
    setComments(freshComments);
    setLoadingComments(false);
  }, [documentId]);

  React.useEffect(() => {
    if (!isOpen || !documentId) {
      setDoc(null);
      setComments([]);
      return;
    }

    refetch();

    // Subscribe to realtime for document_comments
    const { createClient } = require("@/utils/supabase/client");
    const supabase = createClient();
    const channel = supabase
      .channel(`doc_comments_${documentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "document_comments",
          filter: `document_id=eq.${documentId}`,
        },
        async (payload: any) => {
          const { data: userProfile } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, department_id, departments(name)")
            .eq("id", payload.new.user_id)
            .single();

          const freshComment: DocumentComment = {
            ...payload.new,
            user: userProfile,
          };

          setComments((prev) => {
            if (prev.some((c) => c.id === freshComment.id)) return prev;
            return [...prev, freshComment].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, documentId, refetch]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !doc || !profile) return;
    setSubmittingComment(true);
    const res = await addDocumentComment(doc.id, profile.id, newComment.trim());
    setSubmittingComment(false);
    if (!res.ok) {
      notifyError(res.error, "Không gửi được ý kiến");
      return;
    }
    setNewComment("");
    setComments((prev) => {
      if (prev.some((c) => c.id === res.comment.id)) return prev;
      return [...prev, res.comment];
    });
  };

  if (!isOpen || !documentId) return null;

  const meta = doc && DOCUMENT_STATUS_META[doc.status];
  const StatusIcon = meta?.icon;

  const isCreator = doc?.creator_id === profile?.id;
  const isHolder = doc?.current_assignee_id === profile?.id;
  const isReadOnly = !isHolder && !isCreator && !canViewAllDocuments(profile);

  // Tìm handover PENDING gần nhất với receiver = me → để show "Đã nhận" / "Trả về"
  const pendingHandover: HandoverRow | undefined = doc?.handovers?.find(
    (h) => h.status === "PENDING" && h.receiver_id === profile?.id
  );

  // Hồ sơ đang chờ người khác nhận — ẩn nút action của sender, hiển thị info đang chờ ai
  const outgoingPending: HandoverRow | undefined = doc?.handovers?.find(
    (h) => h.status === "PENDING" && h.sender_id === profile?.id
  );

  // Sender chỉ được thao tác (Chuyển/Hoàn thành) khi đang giữ hồ sơ thực sự,
  // tức không trong trạng thái chờ người khác nhận.
  const canSenderAct = !!doc
    && isHolder
    && !outgoingPending
    && doc.status !== "PENDING_RECEIPT"
    && doc.status !== "COMPLETED";

  const handleAcknowledge = async () => {
    if (!pendingHandover) return;
    const res = await acknowledgeDocument(pendingHandover.id);
    if (!res.ok) {
      notifyError(res.error, "Không xác nhận được hồ sơ");
      return;
    }
    notifySuccess("Đã nhận hồ sơ", "Hệ thống bắt đầu đếm SLA từ giây phút này.");
    await refetch();
    onChanged();
  };

  const handleComplete = async () => {
    if (!doc) return;
    const res = await completeDocument(doc.id);
    if (!res.ok) {
      notifyError(res.error, "Không hoàn thành được hồ sơ");
      return;
    }
    notifySuccess("Đã hoàn thành", "Luồng luân chuyển hồ sơ đã đóng.");
    await refetch();
    onChanged();
  };

  const handleImagesChange = async (newUrls: string[]) => {
    if (!doc) return;
    const { createClient } = await import("@/utils/supabase/client");
    const supabase = createClient();
    const { error } = await supabase
      .from("documents")
      .update({ attached_image_urls: newUrls })
      .eq("id", doc.id);
    if (error) {
      notifyError(error, "Không lưu được ảnh đính kèm");
      return;
    }
    await refetch();
    onChanged();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="app-dialog-sheet app-dialog-sheet--xl shadow-2xl">
          <DialogHeader className="app-dialog-sheet-header">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-mono text-[12px] font-semibold text-slate-500 tabular-nums">
                {doc?.short_code || "—"}
              </p>
              {meta && StatusIcon && (
                <Badge className={cn("font-semibold text-[11px]", meta.badgeClass)}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {meta.label}
                </Badge>
              )}
              {doc && <SLABadge document={doc} />}
            </div>
            <DialogTitle className="text-[18px] font-bold text-slate-900 leading-tight">
              {doc?.title || "Đang tải..."}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Chi tiết hồ sơ, timeline luân chuyển và các thao tác chuyển/nhận.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="app-dialog-sheet-body">
            <div className="space-y-6 px-[var(--app-page-x)] py-4">
              {loading && !doc && (
                <p className="text-[13px] text-slate-400 font-medium">Đang tải dữ liệu...</p>
              )}

              {doc && (
                <>
                  {/* Thông tin cơ bản */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {doc.customer_name && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-400 font-medium">Khách hàng</p>
                          <p className="text-[14px] font-semibold text-slate-700 truncate">
                            {doc.customer_name}
                          </p>
                        </div>
                      </div>
                    )}
                    {doc.category && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <FileText className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-400 font-medium">Nhóm hồ sơ</p>
                          <p className="text-[14px] font-semibold text-slate-700 truncate">
                            {doc.category.name} · SLA {doc.category.sla_hours}h
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Vị trí hiện tại của hồ sơ — khi PENDING_RECEIPT thì hiển thị người
                        đang chờ nhận thay vì current_assignee_id (vẫn là sender chưa chuyển ownership) */}
                    {(() => {
                      const pendingFromCurrent = doc.handovers?.find(
                        (h) => h.status === "PENDING" && h.sender_id === doc.current_assignee_id
                      );
                      const displayAssignee = doc.status === "PENDING_RECEIPT" && pendingFromCurrent?.receiver
                        ? pendingFromCurrent.receiver
                        : doc.current_assignee;
                      const positionLabel = doc.status === "PENDING_RECEIPT"
                        ? "Đang chờ nhận"
                        : "Đang ở bàn";
                      if (!displayAssignee) return null;
                      return (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl sm:col-span-2">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <Building2 className="w-4 h-4 text-slate-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] text-slate-400 font-medium">{positionLabel}</p>
                            <p className="text-[14px] font-semibold text-slate-700 truncate">
                              {displayAssignee.full_name}
                              <span className="text-slate-400 font-medium">
                                {" "}· {displayAssignee.departments?.name || "—"}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Ảnh đính kèm */}
                  {(doc.attached_image_urls.length > 0 || isHolder || isCreator) && (
                    <div className="space-y-2">
                      <p className="text-[12px] font-medium text-slate-400">
                        Ảnh bìa / tờ trình ({doc.attached_image_urls.length})
                      </p>
                      <ImageUploader
                        documentId={doc.id}
                        imageUrls={doc.attached_image_urls}
                        onChange={handleImagesChange}
                        onClickImage={(idx) => setLightboxIndex(idx)}
                        readOnly={isReadOnly || doc.status === "COMPLETED" || !!outgoingPending}
                      />
                    </div>
                  )}

                  {/* Ý kiến & Thảo luận */}
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <p className="heading-card flex items-center justify-between text-slate-500">
                      <span>Ý kiến & Thảo luận ({comments.length})</span>
                      {loadingComments && <span className="text-[11px] font-normal text-slate-400 animate-pulse">Đang tải...</span>}
                    </p>

                    {/* Comments List */}
                    <div className="space-y-3">
                      {comments.length === 0 ? (
                        <p className="text-[12px] text-slate-400 font-medium italic pl-1 py-1">
                          Chưa có ý kiến thảo luận nào.
                        </p>
                      ) : (
                        <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1 overscroll-contain">
                          {comments.map((c) => {
                            const isMe = c.user_id === profile?.id;
                            return (
                              <div key={c.id} className={cn("flex gap-2.5 items-start", isMe && "flex-row-reverse")}>
                                <Avatar className="h-7 w-7 mt-0.5 shrink-0 select-none">
                                  <AvatarImage src={c.user?.avatar_url || undefined} />
                                  <AvatarFallback className="text-[10px] bg-slate-100 font-semibold text-slate-600">
                                    {c.user?.full_name?.[0] || "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={cn("min-w-0 max-w-[80%] flex flex-col", isMe ? "items-end" : "items-start")}>
                                  <div className={cn("flex items-center gap-1.5 flex-wrap", isMe && "flex-row-reverse")}>
                                    <span className="text-[11px] font-semibold text-slate-700">
                                      {c.user?.full_name || "Thành viên"}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {c.user?.departments?.name ? `(${c.user.departments.name})` : ""}
                                    </span>
                                    <span className="text-[9px] text-slate-400 tabular-nums">
                                      {format(new Date(c.created_at), "HH:mm dd/MM", { locale: vi })}
                                    </span>
                                  </div>
                                  <div className={cn(
                                    "mt-1 text-[13px] font-medium p-2.5 rounded-xl break-words whitespace-pre-wrap text-left shadow-sm",
                                    isMe
                                      ? "bg-primary text-white rounded-tr-none"
                                      : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-none"
                                  )}>
                                    {c.content}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Form to submit new comment */}
                    {!isReadOnly && doc.status !== "COMPLETED" && (
                      <div className="flex gap-2 items-start mt-2">
                        <Avatar className="h-7 w-7 mt-1 shrink-0 select-none">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-slate-100 font-semibold text-slate-600">
                            {profile?.full_name?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 relative">
                          <Textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="Nhập ý kiến thảo luận..."
                            rows={1}
                            className="bg-slate-50 border-none rounded-xl font-medium resize-none p-2.5 pr-10 text-[13px] min-h-[40px] max-h-[120px] w-full focus-visible:ring-1 focus-visible:ring-primary/20 placeholder:text-slate-400 text-slate-700"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                if (e.ctrlKey || e.metaKey) {
                                  e.preventDefault();
                                  handleSendComment();
                                }
                              }
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={handleSendComment}
                            disabled={submittingComment || !newComment.trim()}
                            className="absolute right-1 bottom-1 h-8 w-8 text-primary hover:text-primary/90 hover:bg-transparent disabled:text-slate-300"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <p className="text-[12px] font-medium text-slate-400">Truy vết luân chuyển</p>
                    <HandoverTimeline document={doc} />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="app-dialog-sheet-footer flex flex-row flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="min-h-11 px-4 rounded-xl font-medium text-slate-500 text-[13px]"
            >
              Đóng
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              {/* Người nhận đang chờ → "Đã nhận" / "Trả về" */}
              {pendingHandover && doc && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setIsReturnOpen(true)}
                    className="min-h-11 px-4 rounded-xl font-medium text-[13px] border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Undo2 className="w-4 h-4 mr-1" /> Trả về
                  </Button>
                  <Button
                    onClick={handleAcknowledge}
                    className="min-h-11 px-4 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Check className="w-4 h-4 mr-1" /> Đã nhận
                  </Button>
                </>
              )}

              {/* Người đang giữ (đã accept) → "Chuyển tiếp" / "Hoàn thành" */}
              {canSenderAct && doc && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleComplete}
                    className="min-h-11 px-4 rounded-xl font-medium text-[13px] border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Hoàn thành
                  </Button>
                  <Button
                    onClick={() => setIsTransferOpen(true)}
                    className="min-h-11 px-4 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
                  >
                    Chuyển tiếp <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {doc && (
        <>
          <TransferDialog
            isOpen={isTransferOpen}
            setIsOpen={setIsTransferOpen}
            document={doc}
            allProfiles={allProfiles}
            currentProfile={profile}
            onSuccess={async () => {
              await refetch();
              onChanged();
            }}
          />
          {pendingHandover && (
            <ReturnReasonDialog
              isOpen={isReturnOpen}
              setIsOpen={setIsReturnOpen}
              handoverId={pendingHandover.id}
              documentShortCode={doc.short_code}
              onSuccess={async () => {
                await refetch();
                onChanged();
              }}
            />
          )}
          <ImageLightbox
            images={doc.attached_image_urls}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        </>
      )}
    </>
  );
}
