"use client";

import React from "react";
import { Search, ArrowRight, Check, Crown } from "lucide-react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { transferDocument } from "../_lib/transferActions";
import type { DocumentRow } from "../_lib/types";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  document: DocumentRow;
  allProfiles: any[];
  currentProfile: any;
  onSuccess: () => void;
}

// Thứ tự ưu tiên các nhóm phòng ban — theo yêu cầu nghiệp vụ (TECHNICAL_RULES).
// Group có priority nhỏ hơn hiển thị trước.
const PRIORITY_BGD = 0;
const PRIORITY_MY_DEPT = 1;
const PRIORITY_KHDN = 2;
const PRIORITY_BAN_LE = 3;
const PRIORITY_TCTH = 4;
const PRIORITY_HTTD = 5;
const PRIORITY_OTHER = 100;

// Heuristic match tên phòng ban không phụ thuộc dấu/khoảng trắng
function deptMatches(name: string, keywords: string[]): boolean {
  const lower = name.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

interface DeptGroup {
  key: string;
  label: string;
  priority: number;
  members: any[];
}

export default function TransferDialog({
  isOpen, setIsOpen, document, allProfiles, currentProfile, onSuccess,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [receiverId, setReceiverId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [openGroup, setOpenGroup] = React.useState<string>("");

  React.useEffect(() => {
    if (isOpen) {
      setQuery("");
      setReceiverId(null);
      setNote("");
      // Mặc định mở nhóm BGĐ — là nhóm được ưu tiên nhất
      setOpenGroup("bgd");
    }
  }, [isOpen]);

  // Loại tài xế (không tham gia luồng giấy) và chính mình
  const candidates = React.useMemo(() => {
    return allProfiles.filter((p) => p.id !== currentProfile?.id && p.role !== "driver");
  }, [allProfiles, currentProfile?.id]);

  // Phân nhóm theo thứ tự ưu tiên
  const groups: DeptGroup[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchSearch = (p: any) => !q || (p.full_name || "").toLowerCase().includes(q);

    // Group 1: BGĐ — director role
    const bgd: any[] = [];
    // Group 2..6: theo phòng ban tên / code
    const myDept: any[] = [];
    const khdn: any[] = [];
    const banLe: any[] = [];
    const tcth: any[] = [];
    const httd: any[] = [];
    // Các phòng khác — group theo từng phòng riêng, sort by code
    const otherByDept = new Map<string, { name: string; code: string; members: any[] }>();

    for (const p of candidates) {
      if (!matchSearch(p)) continue;

      // BGĐ: role director — luôn vào nhóm BGĐ bất kể phòng ban
      if (p.role === "director") {
        bgd.push(p);
        continue;
      }

      const deptName: string = p.departments?.name || "";
      const deptCode: string = p.departments?.code || "";

      // Cùng phòng với user hiện tại
      if (currentProfile?.department_id && p.department_id === currentProfile.department_id) {
        myDept.push(p);
        continue;
      }

      // KHDN: Khách hàng Doanh nghiệp
      if (deptMatches(deptName, ["khdn", "doanh nghiệp"])) {
        khdn.push(p);
        continue;
      }
      // Bán lẻ
      if (deptMatches(deptName, ["bán lẻ"])) {
        banLe.push(p);
        continue;
      }
      // TCTH: code 13602 hoặc tên
      if (deptCode === "13602" || deptMatches(deptName, ["tcth", "tổ chức tổng hợp"])) {
        tcth.push(p);
        continue;
      }
      // HTTD: Hỗ trợ Tín dụng
      if (deptMatches(deptName, ["httd", "hỗ trợ tín dụng"])) {
        httd.push(p);
        continue;
      }

      // Mọi phòng khác — gom theo phòng riêng
      const key = p.department_id || "no-dept";
      if (!otherByDept.has(key)) {
        otherByDept.set(key, {
          name: deptName || "Không có phòng ban",
          code: deptCode || "zzz",
          members: [],
        });
      }
      otherByDept.get(key)!.members.push(p);
    }

    const result: DeptGroup[] = [];
    if (bgd.length > 0)     result.push({ key: "bgd",   label: "Ban Giám đốc",  priority: PRIORITY_BGD,     members: bgd });
    if (myDept.length > 0)  result.push({ key: "mine",  label: `Phòng của tôi${currentProfile?.departments?.name ? ` (${currentProfile.departments.name})` : ""}`, priority: PRIORITY_MY_DEPT, members: myDept });
    if (khdn.length > 0)    result.push({ key: "khdn",  label: "Phòng Khách hàng Doanh nghiệp", priority: PRIORITY_KHDN, members: khdn });
    if (banLe.length > 0)   result.push({ key: "banle", label: "Phòng Bán lẻ",  priority: PRIORITY_BAN_LE,  members: banLe });
    if (tcth.length > 0)    result.push({ key: "tcth",  label: "Phòng Tổ chức Tổng hợp", priority: PRIORITY_TCTH, members: tcth });
    if (httd.length > 0)    result.push({ key: "httd",  label: "Phòng Hỗ trợ Tín dụng", priority: PRIORITY_HTTD, members: httd });

    // Các phòng khác — sort theo code phòng ban
    const others = Array.from(otherByDept.entries())
      .sort(([, a], [, b]) => a.code.localeCompare(b.code, "vi", { numeric: true }))
      .map(([id, val]) => ({
        key: `dept-${id}`,
        label: val.name,
        priority: PRIORITY_OTHER,
        members: val.members,
      }));
    result.push(...others);

    return result.sort((a, b) => a.priority - b.priority);
  }, [candidates, query, currentProfile]);

  // Khi user search và có kết quả → mở luôn nhóm đầu tiên có kết quả
  React.useEffect(() => {
    if (query.trim() && groups.length > 0) {
      setOpenGroup(groups[0].key);
    }
  }, [query, groups]);

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

  const totalMembers = groups.reduce((acc, g) => acc + g.members.length, 0);

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

            {totalMembers === 0 ? (
              <p className="text-[13px] text-slate-400 font-medium text-center py-6">
                Không tìm thấy người nhận phù hợp
              </p>
            ) : (
              <Accordion
                type="single"
                collapsible
                value={openGroup}
                onValueChange={setOpenGroup}
                className="space-y-2"
              >
                {groups.map((g) => {
                  const selectedInGroup = g.members.some((m) => m.id === receiverId);
                  return (
                    <AccordionItem
                      key={g.key}
                      value={g.key}
                      className={cn(
                        "border border-slate-100 rounded-xl bg-white px-3 overflow-hidden",
                        selectedInGroup && "ring-2 ring-primary/30 border-primary/20"
                      )}
                    >
                      <AccordionTrigger className="hover:no-underline py-3 min-h-11">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {g.key === "bgd" && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
                          <span className="text-[13px] font-semibold text-slate-700 truncate text-left">
                            {g.label}
                          </span>
                          <span className="ml-auto text-[11px] font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">
                            {g.members.length}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-2">
                        <div className="space-y-1 pt-1">
                          {g.members.map((p) => {
                            const selected = p.id === receiverId;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setReceiverId(p.id)}
                                className={cn(
                                  "w-full min-h-11 flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-all",
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
                                  {p.title && (
                                    <p className="text-[12px] text-slate-500 font-medium truncate">
                                      {p.title}
                                    </p>
                                  )}
                                </div>
                                {selected && <Check className="w-5 h-5 text-primary shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}

            {receiverId && (
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
            disabled={submitting}
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
