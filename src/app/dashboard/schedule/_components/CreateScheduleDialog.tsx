'use client'

import React from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Car,
  Plus,
  AlertCircle,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { timeOptions } from "../_lib/constants";
import ParticipantSelector from "./ParticipantSelector";

interface CreateScheduleDialogProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  newSchedule: any;
  setNewSchedule: (v: any) => void;
  startDate: Date | undefined;
  setStartDate: (v: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (v: Date | undefined) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  isStartOpen: boolean;
  setIsStartOpen: (v: boolean) => void;
  isEndOpen: boolean;
  setIsEndOpen: (v: boolean) => void;
  rooms: any[];
  conflicts: string[];
  onSubmit: () => void;
  toast: any;
  allProfiles: any[];
  departments: any[];
  bgdMode: 'all' | 'specific' | 'none';
  setBgdMode: (v: 'all' | 'specific' | 'none') => void;
  selectedBGD: string[];
  setSelectedBGD: (v: string[]) => void;
  deptMode: 'all' | 'specific' | 'none';
  setDeptMode: (v: 'all' | 'specific' | 'none') => void;
  filterDepts: string[];
  setFilterDepts: (v: string[]) => void;
  participantMode: 'all' | 'manager' | 'staff';
  setParticipantMode: (v: 'all' | 'manager' | 'staff') => void;
  selectedParticipants: string[];
  setSelectedParticipants: (v: string[]) => void;
}

export default function CreateScheduleDialog(props: CreateScheduleDialogProps) {
  const {
    isOpen, setIsOpen,
    newSchedule, setNewSchedule,
    startDate, setStartDate, endDate, setEndDate,
    startTime, setStartTime, endTime, setEndTime,
    isStartOpen, setIsStartOpen, isEndOpen, setIsEndOpen,
    rooms, conflicts, onSubmit, toast,
    allProfiles, departments,
    bgdMode, setBgdMode, selectedBGD, setSelectedBGD,
    deptMode, setDeptMode, filterDepts, setFilterDepts,
    participantMode, setParticipantMode,
    selectedParticipants, setSelectedParticipants,
  } = props;

  const isLeave = newSchedule.type === 'leave';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 h-10 px-5 rounded-xl font-medium">
          <Plus className="w-5 h-5 mr-2" /> Đăng ký lịch mới
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl border-none shadow-2xl max-w-lg p-6">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-semibold text-slate-900">Thiết lập lịch trình mới</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-4 max-h-[65vh] overflow-y-auto px-1">

          {/* 1. Thời gian */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-slate-500">Từ ngày</Label>
              <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-10 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-[14px] active:scale-95 transition-all">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "Chọn ngày"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      if (date && endDate && date > endDate) setEndDate(date);
                      setIsStartOpen(false);
                    }}
                    initialFocus
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-slate-500">{isLeave ? 'Giờ bắt đầu' : 'Giờ đi'}</Label>
              <Select value={startTime} onValueChange={(v) => {
                setStartTime(v);
                const [h, m] = v.split(':');
                const endH = Math.min(parseInt(h) + 1, 18);
                setEndTime(`${endH.toString().padStart(2, '0')}:${m}`);
              }}>
                <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
                  <Clock className="mr-2 h-4 w-4 text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-lg">
                  {timeOptions.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-slate-500">Đến ngày</Label>
              <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-10 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-[14px] active:scale-95 transition-all">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "Chọn ngày"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date && startDate && date < startDate) {
                        toast({ variant: "destructive", title: "Lỗi", description: "Ngày kết thúc không thể trước ngày bắt đầu." });
                        return;
                      }
                      setEndDate(date);
                      setIsEndOpen(false);
                    }}
                    initialFocus
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-slate-500">Giờ kết thúc</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
                  <Clock className="mr-2 h-4 w-4 text-primary" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-lg">
                  {timeOptions.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. Loại hình & Tiêu đề */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-slate-500">Loại hình</Label>
              <Select value={newSchedule.type} onValueChange={(v) => setNewSchedule({ ...newSchedule, type: v })}>
                <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-lg">
                  <SelectItem value="meeting">Họp nội bộ</SelectItem>
                  <SelectItem value="trip">Đi công tác</SelectItem>
                  <SelectItem value="event">Sự kiện</SelectItem>
                  <SelectItem value="leave">Nghỉ phép</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-slate-500">
                {isLeave ? 'Lý do' : 'Tiêu đề'}
              </Label>
              <Input
                placeholder={isLeave ? "Lý do nghỉ phép..." : "Nội dung chính..."}
                className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]"
                value={newSchedule.title}
                onChange={(e) => setNewSchedule({ ...newSchedule, title: e.target.value })}
              />
            </div>
          </div>

          {/* 3. Địa điểm & Phương tiện — ẩn khi là nghỉ phép */}
          {!isLeave && (
            <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-[13px] font-medium text-slate-500">Địa điểm & Phương tiện</Label>
                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                  <button type="button"
                    onClick={() => setNewSchedule({ ...newSchedule, room_id: 'none', location: '' })}
                    className={cn("px-3 py-1.5 text-[13px] font-medium rounded-md transition-all", newSchedule.location !== 'Chi nhánh' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500")}
                  >Ngoài</button>
                  <button type="button"
                    onClick={() => setNewSchedule({ ...newSchedule, location: 'Chi nhánh', room_id: rooms[0]?.id || 'none' })}
                    className={cn("px-3 py-1.5 text-[13px] font-medium rounded-md transition-all", newSchedule.location === 'Chi nhánh' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500")}
                  >Chi nhánh</button>
                </div>
              </div>

              {newSchedule.location === 'Chi nhánh' ? (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                  <Label className="text-[10px] md:text-[13px] font-medium text-slate-500">Chọn phòng họp</Label>
                  <Select value={newSchedule.room_id} onValueChange={(v) => setNewSchedule({ ...newSchedule, room_id: v })}>
                    <SelectTrigger className="h-10 bg-white border-none rounded-xl font-medium shadow-sm text-[14px]">
                      <SelectValue placeholder="Chọn phòng họp..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-lg">
                      {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.capacity} chỗ)</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="relative animate-in fade-in zoom-in-95 duration-300">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    placeholder="Nhập địa chỉ / lộ trình cụ thể..."
                    className="h-10 bg-white border-none rounded-xl font-medium pl-11 shadow-sm text-[14px]"
                    value={newSchedule.location}
                    onChange={(e) => setNewSchedule({ ...newSchedule, location: e.target.value })}
                  />
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <div
                  onClick={() => setNewSchedule({ ...newSchedule, use_vehicle: !newSchedule.use_vehicle, vehicle_id: !newSchedule.use_vehicle ? 'none' : newSchedule.vehicle_id })}
                  className={cn("w-10 h-6 rounded-full relative transition-colors cursor-pointer", newSchedule.use_vehicle ? "bg-primary" : "bg-slate-200")}
                >
                  <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", newSchedule.use_vehicle ? "left-5" : "left-1")} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-medium text-slate-900">Sử dụng xe cơ quan</span>
                  <span className="text-[12px] text-slate-400 truncate">Tích chọn nếu cần điều xe</span>
                </div>
              </div>

              {newSchedule.use_vehicle && (
                <div className="animate-in slide-in-from-top-2 duration-300 space-y-3">
                  <p className="text-[13px] font-medium text-slate-500">Loại xe cần đăng ký</p>
                  <div className="flex gap-2 p-1 bg-white rounded-xl shadow-sm border border-slate-100">
                    {['4 chỗ', '7 chỗ', 'Khác'].map(type => (
                      <button key={type} type="button"
                        onClick={() => setNewSchedule({ ...newSchedule, requested_vehicle_type: type })}
                        className={cn("flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all", newSchedule.requested_vehicle_type === type ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500")}
                      >{type}</button>
                    ))}
                  </div>
                  <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <Car className="w-4 h-4 text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-blue-700 leading-tight">Yêu cầu của bạn sẽ được bộ phận TCTH phê duyệt và gán xe/lái xe cụ thể sau khi đăng ký.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Banner thông tin đơn nghỉ phép cá nhân */}
          {isLeave && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-start gap-3 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-2 bg-white rounded-xl shadow-sm shrink-0">
                <Users className="w-4 h-4 text-slate-500" />
              </div>
              <div className="space-y-1">
                <p className="text-[13px] font-bold text-slate-700">Đơn nghỉ phép cá nhân</p>
                <p className="text-[12px] text-slate-500 leading-relaxed">Chỉ áp dụng cho cá nhân. Đơn sẽ được gửi tới lãnh đạo phòng và TCTH để phê duyệt. Khi được duyệt, trạng thái của bạn sẽ hiển thị là "Nghỉ phép" trên lịch trình phòng ban và cá nhân.</p>
              </div>
            </div>
          )}

          {/* 4. Thành phần tham gia — ẩn khi là nghỉ phép */}
          {!isLeave && (
            <ParticipantSelector
              allProfiles={allProfiles}
              departments={departments}
              bgdMode={bgdMode}
              setBgdMode={setBgdMode}
              selectedBGD={selectedBGD}
              setSelectedBGD={setSelectedBGD}
              deptMode={deptMode}
              setDeptMode={setDeptMode}
              filterDepts={filterDepts}
              setFilterDepts={setFilterDepts}
              participantMode={participantMode}
              setParticipantMode={setParticipantMode}
              selectedParticipants={selectedParticipants}
              setSelectedParticipants={setSelectedParticipants}
            />
          )}

          {/* Cảnh báo trùng lịch — chỉ hiển thị khi không phải nghỉ phép */}
          {!isLeave && conflicts.length > 0 && (
            <div className="p-3 bg-red-50/50 rounded-2xl border border-red-100 mt-4 space-y-2 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-[13px] font-semibold text-red-700">Cảnh báo trùng lịch</span>
              </div>
              <ul className="list-disc pl-5 text-xs font-medium text-red-600/80 space-y-1">
                {conflicts.map((c, i) => (
                  <li key={i} className="leading-relaxed">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter className="pt-4 border-t border-slate-100">
          <Button onClick={onSubmit} className="w-full h-10 rounded-xl font-semibold active:scale-95 transition-all">
            {isLeave ? 'Gửi Đơn nghỉ phép' : 'Xác nhận đăng ký'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
