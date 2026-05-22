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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, sortProfilesByHierarchy } from "@/lib/utils";
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
  profile?: any;
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
    profile,
  } = props;

  const isLeave = newSchedule.type === 'leave';
  const showEmployeeSelector = isLeave && ['hr_officer', 'secretary', 'admin'].includes(profile?.role);
  const sortedProfiles = React.useMemo(() => {
    const sorted = [...allProfiles];
    return sortProfilesByHierarchy(sorted);
  }, [allProfiles]);

  const leaveOnBehalfProfiles = React.useMemo(() => {
    return sortedProfiles.filter((p: any) => {
      // Cho phép đăng ký nghỉ cho BGĐ
      if (p.role === 'director') return true;
      // Và cũng cho phép tự chọn chính mình (HR, Thư ký, Admin) để đăng ký nghỉ phép cá nhân
      if (p.id === profile?.id) return true;
      return false;
    });
  }, [sortedProfiles, profile?.id]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 px-5 font-medium h-11 active:scale-[0.98] transition-all duration-300 ease-in-out">
          <Plus className="w-5 h-5 mr-2" /> Đăng ký lịch mới
        </Button>
      </DialogTrigger>
      <DialogContent className="flex w-[calc(100dvw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] flex-col overflow-hidden rounded-2xl border-none p-0 shadow-2xl">
        <DialogHeader className="shrink-0 px-5 pt-5 sm:px-6 sm:pt-6">
          <DialogTitle className="text-[17px] font-semibold text-slate-900">Thiết lập lịch trình mới</DialogTitle>
          <DialogDescription className="sr-only">Thiết lập chi tiết thời gian và thành phần tham gia cho lịch trình mới</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-5 px-5 py-4 sm:px-6">

          {/* 1. Thời gian */}
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-slate-500 whitespace-nowrap">Từ ngày</Label>
              <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-11 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-[14px] active:scale-[0.98] transition-all duration-300 ease-in-out truncate">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{startDate ? format(startDate, "dd/MM/yyyy") : "Chọn ngày"}</span>
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
              <Label className="text-[13px] font-medium text-slate-500 whitespace-nowrap">{isLeave ? 'Giờ bắt đầu' : 'Giờ đi'}</Label>
              <Select value={startTime} onValueChange={(v) => {
                setStartTime(v);
                const [h, m] = v.split(':');
                const endH = Math.min(parseInt(h) + 1, 18);
                setEndTime(`${endH.toString().padStart(2, '0')}:${m}`);
              }}>
                <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-left">
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-lg">
                  {timeOptions.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-slate-500 whitespace-nowrap">Đến ngày</Label>
              <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-11 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-[14px] active:scale-[0.98] transition-all duration-300 ease-in-out truncate">
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                    <span className="truncate">{endDate ? format(endDate, "dd/MM/yyyy") : "Chọn ngày"}</span>
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
              <Label className="text-[13px] font-medium text-slate-500 whitespace-nowrap">Giờ kết thúc</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-left">
                    <SelectValue />
                  </span>
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
              <Label className="text-[13px] font-medium text-slate-500 whitespace-nowrap">Loại hình</Label>
              <Select value={newSchedule.type} onValueChange={(v) => setNewSchedule({ ...newSchedule, type: v })}>
                <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
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
              <Label className="text-[13px] font-medium text-slate-500 whitespace-nowrap">
                {isLeave ? 'Lý do' : 'Tiêu đề'}
              </Label>
              <Input
                placeholder={isLeave ? "Lý do nghỉ phép..." : "Nội dung chính..."}
                className="h-11 scroll-mt-24 bg-slate-50 border-none rounded-xl font-medium text-[14px]"
                value={newSchedule.title}
                onChange={(e) => setNewSchedule({ ...newSchedule, title: e.target.value })}
              />
            </div>
          </div>

          {/* Chọn nhân sự nghỉ phép (chỉ dành cho HR Officer / Thư ký / Admin khi đăng ký Nghỉ phép) */}
          {showEmployeeSelector && (
            <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
              <Label className="text-[13px] font-medium text-slate-500">Nhân sự nghỉ phép</Label>
              <Select
                value={newSchedule.target_profile_id || profile?.id || ""}
                onValueChange={(val) => setNewSchedule({ ...newSchedule, target_profile_id: val })}
              >
                <SelectTrigger className="h-11 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
                  <SelectValue placeholder="Chọn nhân sự..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-lg">
                  {leaveOnBehalfProfiles.map((p: any) => {
                    const isSelf = p.id === profile?.id;
                    if (isSelf) {
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name} (Tôi)
                        </SelectItem>
                      );
                    }
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 3. Địa điểm & Phương tiện — ẩn khi là nghỉ phép */}
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

          {!isLeave && (
            <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                <Label className="text-[13px] font-medium text-slate-500 whitespace-nowrap">Địa điểm & Phương tiện</Label>
                <Tabs
                  value={newSchedule.location === 'Chi nhánh' ? 'branch' : 'outside'}
                  onValueChange={(value) => {
                    if (value === 'branch') setNewSchedule({ ...newSchedule, location: 'Chi nhánh', room_id: rooms[0]?.id || 'none' });
                    else setNewSchedule({ ...newSchedule, room_id: 'none', location: '' });
                  }}
                  className="w-full sm:w-auto"
                >
                  <TabsList className="grid min-w-[180px] grid-cols-2 bg-white shadow-sm ring-1 ring-slate-100 min-h-9">
                    <TabsTrigger value="outside" className="rounded-md text-[13px] font-medium">Ngoài</TabsTrigger>
                    <TabsTrigger value="branch" className="rounded-md text-[13px] font-medium">Chi nhánh</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {newSchedule.location === 'Chi nhánh' ? (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
                  <Label className="text-[10px] md:text-[13px] font-medium text-slate-500 whitespace-nowrap">Chọn phòng họp</Label>
                  <Select value={newSchedule.room_id} onValueChange={(v) => setNewSchedule({ ...newSchedule, room_id: v })}>
                    <SelectTrigger className="h-11 bg-white border-none rounded-xl font-medium shadow-sm text-[14px]">
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
                    className="h-11 bg-white border-none rounded-xl font-medium pl-11 shadow-sm text-[14px]"
                    value={newSchedule.location}
                    onChange={(e) => setNewSchedule({ ...newSchedule, location: e.target.value })}
                  />
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Switch
                  checked={newSchedule.use_vehicle}
                  onCheckedChange={(checked) => setNewSchedule({ ...newSchedule, use_vehicle: checked, vehicle_id: checked ? 'none' : newSchedule.vehicle_id })}
                  aria-label="Bật hoặc tắt sử dụng xe cơ quan"
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-[14px] font-medium text-slate-900 whitespace-nowrap">Sử dụng xe cơ quan</span>
                  <span className="text-[12px] text-slate-400 truncate">Tích chọn nếu cần điều xe</span>
                </div>
              </div>

              {newSchedule.use_vehicle && (
                <div className="animate-in slide-in-from-top-2 duration-300 space-y-3">
                  <p className="text-[13px] font-medium text-slate-500 whitespace-nowrap">Loại xe cần đăng ký</p>
                  <Tabs
                    value={newSchedule.requested_vehicle_type}
                    onValueChange={(value) => setNewSchedule({ ...newSchedule, requested_vehicle_type: value })}
                  >
                    <TabsList className="grid grid-cols-3 bg-white shadow-sm ring-1 ring-slate-100 min-h-9">
                      {['4 chỗ', '7 chỗ', 'Khác'].map(type => (
                        <TabsTrigger key={type} value={type} className="rounded-md text-[13px] font-medium">
                          {type}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
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



          {/* 4. Thành phần tham gia — ẩn khi là nghỉ phép */}
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
        </div>
        <DialogFooter className="shrink-0 border-t border-slate-100 bg-background/95 px-5 py-4 sm:px-6">
          <Button
            onClick={onSubmit}
            className={cn(
              "w-full h-11 rounded-xl font-semibold active:scale-[0.98] transition-all duration-300 ease-in-out",
              !isLeave && conflicts.length > 0
                ? "bg-amber-500 hover:bg-amber-600 text-white"
                : "bg-primary hover:bg-primary/90 text-white"
            )}
          >
            {isLeave ? 'Gửi đơn nghỉ phép' : (!isLeave && conflicts.length > 0 ? 'Vẫn tiếp tục đặt lịch?' : 'Xác nhận đăng ký')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
