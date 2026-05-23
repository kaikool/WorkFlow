'use client'

import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, Navigation } from "lucide-react";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  startKm: string;
  setStartKm: (v: string) => void;
  updating: boolean;
  onConfirm: () => void;
}

export default function StartTripDialog({ isOpen, setIsOpen, startKm, setStartKm, updating, onConfirm }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="rounded-2xl max-w-sm border-none p-6 shadow-2xl">
        <DialogHeader>
          <DialogDescription className="sr-only">Nhập chỉ số kilomet hiện tại trước khi bắt đầu chuyến đi.</DialogDescription>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <Navigation className="w-4 h-4 text-slate-700" />
            </div>
            Bắt đầu chuyến đi
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-600">Chỉ số Km hiện tại (Xuất phát)</label>
            <Input
              type="number"
              placeholder="Ví dụ: 12050"
              value={startKm}
              onChange={(e) => setStartKm(e.target.value)}
              className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-slate-700"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl font-semibold text-slate-500 min-h-11 px-5 active:scale-95 transition-all text-sm hover:bg-slate-100">
            Hủy
          </Button>
          <Button onClick={onConfirm} disabled={updating || !startKm} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold px-6 min-h-11 active:scale-95 transition-all text-sm shadow-sm">
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Xác nhận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
