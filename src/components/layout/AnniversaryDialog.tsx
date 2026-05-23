'use client'

import React from "react";
import { Gift, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  fullName?: string;
  anniversaryYears: number;
  anniversaryMessage: string;
}

export default function AnniversaryDialog({ isOpen, setIsOpen, fullName, anniversaryYears, anniversaryMessage }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="overflow-hidden border-none bg-white p-0 shadow-2xl sm:max-w-md">
        <div className="relative bg-gradient-to-br from-amber-50 via-white to-amber-50 px-6 pb-6 pt-8">
          <div className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm ring-1 ring-amber-100">
            <Gift className="h-5 w-5 text-amber-500" />
          </div>
          <DialogHeader className="space-y-3 pr-14">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-200">
              <HeartHandshake className="h-7 w-7" />
            </div>
            <DialogTitle className="text-2xl font-bold leading-tight text-slate-950">
              Cảm ơn {fullName}
            </DialogTitle>
            <DialogDescription className="text-sm font-medium leading-relaxed text-slate-600">
              Hôm nay là ngày kỷ niệm bạn bắt đầu đồng hành cùng Chi nhánh.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 rounded-2xl bg-white/85 p-4 shadow-sm ring-1 ring-amber-100/70">
            <p className="text-[15px] font-semibold leading-relaxed text-slate-800">
              {anniversaryMessage}
            </p>
            {anniversaryYears > 0 && (
              <p className="mt-3 text-xs font-bold text-amber-700">
                {anniversaryYears} năm gắn bó
              </p>
            )}
          </div>
          <Button
            className="mt-5 h-11 w-full rounded-xl bg-slate-950 text-sm font-bold text-white hover:bg-slate-800"
            onClick={() => setIsOpen(false)}
          >
            Tiếp tục làm việc
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
