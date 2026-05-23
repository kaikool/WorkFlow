'use client'

import React from "react";
import { Calendar as CalendarIcon, Clock, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { vi } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { timeOptions } from "../_lib/constants";
import ParticipantSelector from "./ParticipantSelector";

interface ScheduleEditFormProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  schedule: any;
  vehicles: any[];
  rooms: any[];
  isTCTH: boolean;
  allProfiles: any[];
  departments: any[];
  detail: any;
}

// Form chỉnh sửa lịch trình — hiển thị toàn cửa sổ Dialog
export default function ScheduleEditForm({
  isOpen, setIsOpen, schedule, vehicles, rooms, isTCTH, allProfiles, departments, detail
}: ScheduleEditFormProps) {
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="top-auto bottom-0 translate-y-0 flex flex-col overflow-hidden border-none p-0 shadow-2xl bg-white w-full max-h-[calc(100dvh-env(safe-area-inset-top)-1.5rem)] max-w-none rounded-t-[32px] rounded-b-none sm:top-[50%] sm:bottom-auto sm:translate-y-[-50%] sm:h-auto sm:max-h-[calc(100dvh-6rem)] sm:w-[calc(100dvw-2rem)] sm:max-w-2xl sm:rounded-[24px]">
        <DialogHeader className="sr-only">
          <DialogDescription>Chỉnh sửa thông tin lịch trình, thời gian, địa điểm và thành phần tham gia.</DialogDescription>
          <DialogTitle>Sửa lịch trình</DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
          {/* Thanh tiêu đề chế độ sửa */}
          <div className="px-[var(--app-page-x)] py-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
              onClick={() => detail.setIsEditingSchedule(false)}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-slate-900 truncate">Sửa lịch trình</p>
              <p className="text-[12px] text-slate-500 font-medium truncate">{schedule.title}</p>
            </div>
          </div>

          {/* Nội dung form sửa */}
          <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-[var(--app-page-x)]">
            {/* Tiêu đề */}
            <div className="space-y-3">
              <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Tiêu đề lịch trình</Label>
              <Input
                value={detail.editData.title || ""}
                onChange={(e) => detail.setEditData({ ...detail.editData, title: e.target.value })}
                className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"
                placeholder="Nhập tiêu đề..."
              />
            </div>

            {/* Nội dung chi tiết */}
            <div className="space-y-3">
              <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Nội dung chi tiết</Label>
              <Textarea
                value={detail.editData.description || ""}
                onChange={(e) => detail.setEditData({ ...detail.editData, description: e.target.value })}
                className="min-h-20 bg-slate-50 border-none rounded-xl font-medium text-base md:text-sm resize-none"
                placeholder="Mô tả nội dung..."
              />
            </div>

            {/* Lưới 2 cột: Loại + Địa điểm */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Loại lịch trình</Label>
                <Select value={detail.editData.type} onValueChange={(v) => detail.setEditData({ ...detail.editData, type: v })}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="meeting" className="text-base md:text-sm py-3 md:py-2">Họp nội bộ</SelectItem>
                    <SelectItem value="trip" className="text-base md:text-sm py-3 md:py-2">Đi công tác</SelectItem>
                    <SelectItem value="event" className="text-base md:text-sm py-3 md:py-2">Sự kiện</SelectItem>
                    <SelectItem value="leave" className="text-base md:text-sm py-3 md:py-2">Nghỉ phép</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Hình thức địa điểm</Label>
                <Select value={detail.editData.location === 'Chi nhánh' ? 'branch' : 'outside'} onValueChange={(v) => detail.setEditData({ ...detail.editData, location: v === 'branch' ? 'Chi nhánh' : '', room_id: v === 'branch' ? (rooms[0]?.id || 'none') : 'none' })}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="outside" className="text-base md:text-sm py-3 md:py-2">Địa điểm ngoài</SelectItem>
                    <SelectItem value="branch" className="text-base md:text-sm py-3 md:py-2">Chi nhánh</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lưới 2 cột: Ngày bắt đầu + Giờ đi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Từ ngày</Label>
                <Popover open={detail.isStartOpen} onOpenChange={detail.setIsStartOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full min-h-11 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-base md:text-sm active:scale-95 transition-all">
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{detail.editStartDate ? format(detail.editStartDate, "dd/MM/yyyy") : "Chọn ngày"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Calendar
                      mode="single"
                      selected={detail.editStartDate}
                      onSelect={(date) => {
                        detail.setEditStartDate(date);
                        if (date && detail.editEndDate && date > detail.editEndDate) detail.setEditEndDate(date);
                        detail.setIsStartOpen(false);
                      }}
                      initialFocus
                      locale={vi}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-3">
                <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Giờ đi</Label>
                <Select value={detail.editStartTime} onValueChange={detail.handleStartTimeChange}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm">
                    <Clock className="mr-2 h-4 w-4 text-primary shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time} className="text-base md:text-sm py-3 md:py-2">{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lưới 2 cột: Ngày kết thúc + Giờ về */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Đến ngày</Label>
                <Popover open={detail.isEndOpen} onOpenChange={detail.setIsEndOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full min-h-11 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-base md:text-sm active:scale-95 transition-all">
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{detail.editEndDate ? format(detail.editEndDate, "dd/MM/yyyy") : "Chọn ngày"}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <Calendar
                      mode="single"
                      selected={detail.editEndDate}
                      onSelect={(date) => { detail.setEditEndDate(date); detail.setIsEndOpen(false); }}
                      initialFocus
                      locale={vi}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-3">
                <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Giờ về</Label>
                <Select value={detail.editEndTime} onValueChange={detail.setEditEndTime}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm">
                    <Clock className="mr-2 h-4 w-4 text-primary shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {timeOptions.map(time => (
                      <SelectItem key={time} value={time} className="text-base md:text-sm py-3 md:py-2">{time}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Địa điểm chi tiết */}
            {detail.editData.type !== 'leave' && detail.editData.location === 'Chi nhánh' ? (
              <div className="space-y-3">
                <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Phòng họp</Label>
                <Select value={detail.editData.room_id || 'none'} onValueChange={(v) => detail.setEditData({ ...detail.editData, room_id: v })}>
                  <SelectTrigger className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm"><SelectValue placeholder="Chọn phòng họp" /></SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    {rooms.map(r => <SelectItem key={r.id} value={r.id} className="text-base md:text-sm py-3 md:py-2">{r.name} ({r.capacity} chỗ)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : detail.editData.type !== 'leave' ? (
              <div className="space-y-3">
                <Label className="text-[12px] font-medium text-slate-500 pl-0.5">Địa điểm / Lộ trình</Label>
                <Input value={detail.editData.location || ""} onChange={(e) => detail.setEditData({ ...detail.editData, location: e.target.value })} className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm" placeholder="Nhập địa điểm cụ thể..." />
              </div>
            ) : null}

            {/* Phương tiện */}
            {detail.editData.type !== 'leave' && (
              <div className="space-y-4 p-4 bg-slate-50/50 rounded-2xl">
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700 cursor-pointer">
                  <Checkbox checked={!!detail.editData.use_vehicle} onCheckedChange={(checked) => detail.setEditData({ ...detail.editData, use_vehicle: checked === true, vehicle_id: checked === true ? detail.editData.vehicle_id : 'none' })} />
                  Sử dụng xe cơ quan
                </label>
                {detail.editData.use_vehicle && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Select value={detail.editData.requested_vehicle_type || '4 chỗ'} onValueChange={(v) => detail.setEditData({ ...detail.editData, requested_vehicle_type: v })}>
                      <SelectTrigger className="min-h-11 bg-white border-none rounded-xl font-medium text-sm shadow-sm"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="4 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 4 chỗ</SelectItem>
                        <SelectItem value="7 chỗ" className="text-base md:text-sm py-3 md:py-2">Xe 7 chỗ</SelectItem>
                        <SelectItem value="Khác" className="text-base md:text-sm py-3 md:py-2">Loại khác</SelectItem>
                      </SelectContent>
                    </Select>
                    {isTCTH && (
                      <Select value={detail.editData.vehicle_id || 'none'} onValueChange={(v) => detail.setEditData({ ...detail.editData, vehicle_id: v })}>
                        <SelectTrigger className="min-h-11 bg-white border-none rounded-xl font-medium text-sm shadow-sm"><SelectValue placeholder="Xe cụ thể" /></SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          <SelectItem value="none" className="text-base md:text-sm py-3 md:py-2">Chưa gán xe</SelectItem>
                          {vehicles.map(v => <SelectItem key={v.id} value={v.id} className="text-base md:text-sm py-3 md:py-2">{v.name} - {v.plate_number}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Thành phần tham gia */}
            {detail.editData.type !== 'leave' && (
              <ParticipantSelector
                allProfiles={allProfiles}
                departments={departments}
                bgdMode={detail.bgdMode} setBgdMode={detail.setBgdMode}
                selectedBGD={detail.selectedBGD} setSelectedBGD={detail.setSelectedBGD}
                deptMode={detail.deptMode} setDeptMode={detail.setDeptMode}
                filterDepts={detail.filterDepts} setFilterDepts={detail.setFilterDepts}
                participantMode={detail.participantMode} setParticipantMode={detail.setParticipantMode}
                selectedParticipants={detail.selectedParticipants} setSelectedParticipants={detail.setSelectedParticipants}
              />
            )}

            {/* Cảnh báo xung đột */}
            {detail.editData.type !== 'leave' && detail.conflicts.length > 0 && (
              <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 space-y-2 animate-in fade-in zoom-in-95">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-[13px] font-bold text-red-700 whitespace-nowrap">Cảnh báo trùng lịch</span>
                </div>
                <ul className="list-disc pl-5 text-xs font-medium text-red-600/80 space-y-1">
                  {detail.conflicts.map((c: string, i: number) => (
                    <li key={i} className="leading-relaxed">{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          </ScrollArea>

          {/* Footer chế độ sửa */}
          <div className="shrink-0 px-[var(--app-page-x)] py-4 pb-safe border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="min-h-11 px-4 rounded-xl font-medium text-slate-500 text-[13px] hover:bg-slate-200 active:scale-95 transition-all whitespace-nowrap"
              onClick={() => detail.setIsEditingSchedule(false)}
            >
              Hủy bỏ
            </Button>
            <Button
              className={cn(
                "min-h-11 px-4 rounded-xl font-medium text-sm shadow-lg active:scale-95 transition-all whitespace-nowrap",
                detail.editData.type !== 'leave' && detail.conflicts.length > 0
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20"
                  : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
              )}
              onClick={detail.handleSaveSchedule}
            >
              {detail.editData.type !== 'leave' && detail.conflicts.length > 0 ? 'Vẫn tiếp tục lưu?' : 'Lưu lịch trình'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
