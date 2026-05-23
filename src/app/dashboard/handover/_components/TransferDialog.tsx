"use client";

import React from "react";
import { Search, ArrowRight, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { transferDocument } from "../_lib/transferActions";
import type { DocumentRow } from "../_lib/types";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  document: DocumentRow;
  allProfiles: any[];
  currentProfileId: string;
  onSuccess: () => void;
}

export default function TransferDialog({ isOpen, setIsOpen, document, allProfiles, currentProfileId, onSuccess }: Props) {
  const [query, setQuery] = React.useState("");
  const [receiverId, setReceiverId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
      setReceiverId(null);
      setNote("");
    }
  }, [isOpen]);

  // Loại tài xế (không tham gia luồng giấy) và chính mình
  const candidates = React.useMemo(() => {
    return allProfiles.filter((p) => p.id !== currentProfileId && p.role !== "driver");
  }, [allProfiles, currentProfileId]);

  // Group theo phòng ban — để chọn cross-dept dễ hơn
  const grouped = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, { name: string; people: any[] }>();
    for (const p of candidates) {
      if (q && !(p.full_name || "").toLowerCase().includes(q)) continue;
      const dept = p.departments?.name || "Không có phòng ban";
      if (!map.has(dept)) map.set(dept, { name: dept, people: [] });
      map.get(dept)!.people.push(p);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [candidates, query]);

  const handleSubmit = async () => {
    if (!receiverId) {
      notifyValidation("Vui lòng chọn người nhận");
      return;
    }
    setSubmitting(true);
    const res = await transferDocument(document.id, receiverId, note.trim() || null);
    setSubmitting(false);
    if (!res.ok) {
      notifyError(res.error, "Không chuyển được hồ sơ");
      return;
    }
    notifySuccess("Đã chuyển hồ sơ", "Đợi người nhận xác nhận \"Đã nhận\".");
    onSuccess();
    setIsOpen(false);
  };

  const selectedProfile = candidates.find((p) => p.id === receiverId);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="app-dialog-sheet app-dialog-sheet--lg shadow-2xl">
        <DialogHeader className="app-dialog-sheet-header">
          <DialogTitle className="text-[17px] font-semibold text-slate-900">Chuyển hồ sơ</DialogTitle>
          <DialogDescription className="text-[13px] text-slate-500 font-medium truncate">
            {document.short_code} — {document.title}
          </DialogDescription>
        </DialogHeader>

        <div className="app-dialog-sheet-body">
          <div className="space-y-4 px-[var(--app-page-x)] py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm người nhận theo họ tên..."
                className="h-11 pl-9 bg-slate-50 border-none rounded-xl font-medium"
              />
            </div>

            <ScrollArea className="max-h-[280px] sm:max-h-[360px] -mx-1 pr-1">
              <div className="space-y-3 px-1">
                {grouped.map((dept) => (
                  <div key={dept.name} className="space-y-1">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1">
                      {dept.name}
                    </p>
                    {dept.people.map((p) => {
                      const selected = p.id === receiverId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setReceiverId(p.id)}
                          className={cn(
                            "w-full min-h-11 flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-all",
                            selected
                              ? "bg-primary/5 ring-2 ring-primary/30"
                              : "hover:bg-slate-50"
                          )}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback className="bg-slate-100 text-[11px]">
                              {p.full_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-semibold text-slate-900 truncate">
                              {p.full_name}
                            </p>
                            <p className="text-[12px] text-slate-500 font-medium truncate">
                              {p.departments?.name || "—"}
                            </p>
                          </div>
                          {selected && <Check className="w-5 h-5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
                {grouped.length === 0 && (
                  <p className="text-[13px] text-slate-400 font-medium text-center py-6">
                    Không tìm thấy người nhận phù hợp
                  </p>
                )}
              </div>
            </ScrollArea>

            {selectedProfile && (
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-slate-500">Ghi chú (tuỳ chọn)</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Hướng dẫn xử lý, lưu ý cho người nhận..."
                  rows={2}
                  className="bg-slate-50 border-none rounded-xl font-medium resize-none p-3"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            className="min-h-11 px-4 rounded-xl font-medium text-slate-500 text-[13px]"
          >
            Huỷ
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!receiverId || submitting}
            className="min-h-11 px-5 rounded-xl font-semibold bg-primary hover:bg-primary/90 text-white"
          >
            {submitting ? "Đang chuyển..." : <>Chuyển <ArrowRight className="w-4 h-4 ml-1" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
