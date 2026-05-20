'use client'

import React from "react";
import { Calendar as CalendarIcon, Clock, MapPin, Car, UserCheck, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { vi } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { cn, compareProfilesByHierarchy, canViewLeaveDetails } from "@/lib/utils";
import { format } from "date-fns";
import { typeLabels, timeOptions } from "../_lib/constants";
import { filterBGD, filterStaff, resolveParticipantIds, checkConflicts, checkResourceConflicts } from "../_lib/utils";
import ParticipantSelector from "./ParticipantSelector";

interface ScheduleDetailDialogProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  schedule: any;
  schedules: any[];
  vehicles: any[];
  rooms: any[];
  isTCTH: boolean;
  allProfiles: any[];
  departments: any[];
  currentProfile: any;
  onAssignVehicle: (scheduleId: string, vehicleId: string | null, driverId: string | null) => void;
  onUpdateEndTime: (scheduleId: string, newEndTime: string) => void;
  onUpdateSchedule: (scheduleId: string, updates: any) => void;
}

function RenderParticipants({ schedule, allProfiles }: { schedule: any; allProfiles: any[] }) {
  if (!schedule?.participants) return null;

  const bgdProfiles = filterBGD(allProfiles);
  const staffProfiles = filterStaff(allProfiles);
  const participantIds = schedule.participants.map((p: any) => p.profile?.id);

  const hasAllBgd = bgdProfiles.length > 0 && bgdProfiles.every(p => participantIds.includes(p.id));
  const hasAllStaff = staffProfiles.length > 0 && staffProfiles.every(p => participantIds.includes(p.id));

  const elements: React.ReactNode[] = [];

  if (hasAllBgd) {
    elements.push(
      <Badge key="all-bgd" variant="outline" className="bg-red-50 border-red-200 text-red-700 rounded-full px-3 py-1.5 flex items-center gap-2 font-bold shadow-sm">
        Toàn bộ Ban Giám đốc
      </Badge>
    );
  }
  if (hasAllStaff) {
    elements.push(
      <Badge key="all-staff" variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 rounded-full px-3 py-1.5 flex items-center gap-2 font-bold shadow-sm">
        Toàn bộ Đơn vị / Phòng ban
      </Badge>
    );
  }

  const remaining = schedule.participants.filter((p: any) => {
    const isBgd = bgdProfiles.some(bp => bp.id === p.profile?.id);
    const isStaff = staffProfiles.some(sp => sp.id === p.profile?.id);
    if (isBgd && hasAllBgd) return false;
    if (isStaff && hasAllStaff) return false;
    return true;
  });

  remaining.sort((a: any, b: any) => compareProfilesByHierarchy(a.profile, b.profile)).forEach((p: any, idx: number) => {
    elements.push(
      <Badge key={`p-${idx}`} variant="outline" className="bg-white border-slate-200 rounded-full px-3 py-1.5 flex items-center gap-2 font-semibold text-slate-700 shadow-sm">
        <Avatar className="h-5 w-5">
          <AvatarImage src={p.profile?.avatar_url} />
          <AvatarFallback className="text-[9px] bg-slate-100">{p.profile?.full_name?.[0]}</AvatarFallback>
        </Avatar>
        {p.profile?.full_name}
      </Badge>
    );
  });

  return <div className="flex flex-wrap gap-2">{elements}</div>;
}

export default function ScheduleDetailDialog({
  isOpen, setIsOpen, schedule, schedules, vehicles, rooms, isTCTH, allProfiles, departments, currentProfile, onAssignVehicle, onUpdateEndTime, onUpdateSchedule
}: ScheduleDetailDialogProps) {
  const [isEditingTime, setIsEditingTime] = React.useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = React.useState(false);
  const [newEndTime, setNewEndTime] = React.useState("");
  const [editData, setEditData] = React.useState<any>({});

  const [tempVehicleId, setTempVehicleId] = React.useState<string | null>(null);
  const [tempDriverId, setTempDriverId] = React.useState<string | null>(null);

  // New States for Date & Time Pickers in Edit Mode
  const [editStartDate, setEditStartDate] = React.useState<Date | undefined>(undefined);
  const [editEndDate, setEditEndDate] = React.useState<Date | undefined>(undefined);
  const [editStartTime, setEditStartTime] = React.useState<string>("08:00");
  const [editEndTime, setEditEndTime] = React.useState<string>("09:00");
  const [isStartOpen, setIsStartOpen] = React.useState(false);
  const [isEndOpen, setIsEndOpen] = React.useState(false);

  // States for ParticipantSelector
  const [bgdMode, setBgdMode] = React.useState<'all' | 'specific' | 'none'>('specific');
  const [selectedBGD, setSelectedBGD] = React.useState<string[]>([]);
  const [deptMode, setDeptMode] = React.useState<'all' | 'specific' | 'none'>('specific');
  const [filterDepts, setFilterDepts] = React.useState<string[]>([]);
  const [participantMode, setParticipantMode] = React.useState<'all' | 'manager' | 'staff'>('staff');
  const [selectedParticipants, setSelectedParticipants] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (schedule?.end_time && isOpen) {
      setNewEndTime(format(new Date(schedule.end_time), "yyyy-MM-dd'T'HH:mm"));
      setIsEditingTime(false);
      setIsEditingSchedule(false);
      setTempVehicleId(schedule.vehicle_id || null);
      setTempDriverId(schedule.driver_id || null);
      
      const existingIds = (schedule.participants || []).map((p: any) => p.profile?.id).filter(Boolean);
      const bgdProfiles = filterBGD(allProfiles);
      const bgdIds = bgdProfiles.filter(p => existingIds.includes(p.id)).map(p => p.id);
      const otherIds = existingIds.filter((id: string) => !bgdProfiles.some(bp => bp.id === id));
      const activeDepts = Array.from(new Set(allProfiles.filter(p => otherIds.includes(p.id)).map(p => p.department_id).filter(Boolean)));
      
      setBgdMode(bgdIds.length > 0 ? 'specific' : 'none');
      setSelectedBGD(bgdIds);
      setDeptMode(otherIds.length > 0 ? 'specific' : 'none');
      setFilterDepts(activeDepts.length > 0 ? activeDepts : (currentProfile?.department_id ? [currentProfile.department_id] : []));
      setParticipantMode('staff');
      setSelectedParticipants(otherIds);

      const start = new Date(schedule.start_time);
      const end = new Date(schedule.end_time);
      setEditStartDate(start);
      setEditEndDate(end);
      setEditStartTime(format(start, "HH:mm"));
      setEditEndTime(format(end, "HH:mm"));

      setEditData({
        title: schedule.title || "",
        description: schedule.description || "",
        type: schedule.type || "trip",
        start_time: format(start, "yyyy-MM-dd'T'HH:mm"),
        end_time: format(end, "yyyy-MM-dd'T'HH:mm"),
        location: schedule.location || "",
        room_id: schedule.room_id || "none",
        use_vehicle: !!schedule.use_vehicle,
        vehicle_id: schedule.vehicle_id || "none",
        requested_vehicle_type: schedule.requested_vehicle_type || "4 chỗ",
      });
    }
  }, [schedule, isOpen]);

  const conflicts = React.useMemo(() => {
    if (!editStartDate || !editEndDate || editData.type === 'leave') return [];

    const startString = `${format(editStartDate, 'yyyy-MM-dd')}T${editStartTime}`;
    const endString = `${format(editEndDate, 'yyyy-MM-dd')}T${editEndTime}`;
    let start: Date;
    let end: Date;
    try {
      start = new Date(startString);
      end = new Date(endString);
    } catch {
      return [];
    }

    const finalParticipantIds = resolveParticipantIds({ selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles });

    const pConflicts = checkConflicts({
      checkIds: finalParticipantIds,
      startDate: editStartDate,
      endDate: editEndDate,
      startTime: editStartTime,
      endTime: editEndTime,
      schedules,
      ignoreScheduleId: schedule?.id
    });

    const rConflicts = checkResourceConflicts({
      roomId: editData.location === 'Chi nhánh' && editData.room_id !== 'none' ? editData.room_id : null,
      vehicleId: editData.use_vehicle && editData.vehicle_id !== 'none' ? editData.vehicle_id : null,
      start,
      end,
      schedules,
      ignoreScheduleId: schedule?.id
    });

    return [...pConflicts, ...rConflicts];
  }, [editStartDate, editEndDate, editStartTime, editEndTime, selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles, schedules, editData.location, editData.room_id, editData.use_vehicle, editData.vehicle_id, editData.type, schedule?.id]);

  if (!schedule) return null;

  const matchedVehicle = vehicles.find(v => v.id === schedule.vehicle_id);

  const headerBgMap: any = {
    meeting: "bg-blue-50/80",
    trip: "bg-orange-50/80",
    event: "bg-purple-50/80", // Using a very light subtle tint
    leave: "bg-slate-100/80",
  };
  const badgeColorMap: any = {
    meeting: "text-blue-700 border-blue-200/50",
    trip: "text-orange-700 border-orange-200/50",
    event: "text-purple-700 border-purple-200/50",
    leave: "text-slate-700 border-slate-200/50",
  };
  const headerBg = headerBgMap[schedule.type] || "bg-slate-50/80";
  const badgeColor = badgeColorMap[schedule.type] || "text-slate-700 border-slate-200/50";

  const isParticipant = schedule.participants?.some((p: any) => p.profile?.id === currentProfile?.id);
  const isCreator = schedule.created_by === currentProfile?.id;
  const isLeave = schedule.type === 'leave';
  const isAllowedToView = canViewLeaveDetails(schedule, currentProfile);
  const canEdit = isLeave 
    ? (isCreator || isAllowedToView)
    : (isParticipant || isCreator || isTCTH);

  const handleSaveTime = () => {
    if (!newEndTime) return;
    const confirmMsg = "Bạn có chắc chắn muốn thay đổi thời gian kết thúc của lịch trình này không? Tất cả những người tham gia sẽ nhận được thông báo.";
    if (confirm(confirmMsg)) {
      onUpdateEndTime(schedule.id, new Date(newEndTime).toISOString());
      setIsEditingTime(false);
    }
  };

  const handleEndNow = () => {
    const confirmMsg = "Bạn có chắc chắn muốn báo kết thúc lịch trình này ngay bây giờ? Tất cả những người tham gia sẽ nhận được thông báo.";
    if (confirm(confirmMsg)) {
      onUpdateEndTime(schedule.id, new Date().toISOString());
      setIsEditingTime(false);
    }
  };

  const handleSaveSchedule = () => {
    const isLeave = editData.type === 'leave';
    const isBranchLocation = editData.location === 'Chi nhánh';

    if (!editData.title?.trim()) return;
    if (!isLeave && isBranchLocation && (!editData.room_id || editData.room_id === 'none')) return;
    if (!isLeave && !isBranchLocation && !editData.location?.trim()) return;

    const finalParticipantIds = isLeave 
      ? [currentProfile?.id].filter(Boolean)
      : resolveParticipantIds({ selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles });

    const startString = `${format(editStartDate || new Date(), 'yyyy-MM-dd')}T${editStartTime}`;
    const endString = `${format(editEndDate || new Date(), 'yyyy-MM-dd')}T${editEndTime}`;

    onUpdateSchedule(schedule.id, {
      title: editData.title,
      description: editData.description || null,
      type: editData.type,
      start_time: new Date(startString).toISOString(),
      end_time: new Date(endString).toISOString(),
      location: isLeave ? null : editData.location,
      room_id: !isLeave && isBranchLocation && editData.room_id !== 'none' ? editData.room_id : null,
      use_vehicle: !isLeave && !!editData.use_vehicle,
      vehicle_id: !isLeave && editData.vehicle_id !== 'none' ? editData.vehicle_id : null,
      requested_vehicle_type: !isLeave && editData.use_vehicle ? editData.requested_vehicle_type : null,
      participant_ids: finalParticipantIds
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[calc(100dvw-2rem)] max-w-xl max-h-[calc(100dvh-2rem)] rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-white">
        <DialogHeader className="sr-only">
          <DialogDescription>Thông tin chi tiết, thành phần tham gia, phương tiện và các thao tác cập nhật lịch trình.</DialogDescription>
          <DialogTitle className="text-[17px] font-semibold text-slate-900">Chi tiết lịch trình</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
          {/* Header */}
          <div className={cn("p-5 sm:p-6 relative overflow-hidden backdrop-blur-xl border-b border-slate-100", headerBg)}>
            <div className="relative z-10 space-y-3">
              <Badge className={cn("bg-white/60 backdrop-blur-md shadow-sm font-bold text-[10px] px-3 py-1", badgeColor)}>
                {typeLabels[schedule.type]?.label}
              </Badge>
              <DialogTitle className="text-lg sm:text-xl md:text-2xl font-bold leading-tight tabular-nums text-slate-900 break-words">
                {isAllowedToView ? schedule.title : `Nghỉ phép (${schedule.creator?.full_name || 'Cán bộ'})`}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 text-slate-600 text-[13px] font-semibold pt-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  {format(new Date(schedule.start_time), 'HH:mm dd/MM')} - {format(new Date(schedule.end_time), 'HH:mm dd/MM')}
                </div>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/60 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 p-5 sm:p-6 space-y-6 overflow-y-auto overscroll-contain">
            {schedule.description && isAllowedToView && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 truncate">Nội dung chi tiết</p>
                <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl">{schedule.description}</p>
              </div>
            )}

            {canEdit && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold text-slate-700">Thông tin lịch trình</p>
                  {!isEditingSchedule && (
                    <Button variant="outline" size="sm" className="h-8 px-3 rounded-xl text-sm font-medium text-slate-600 border-slate-200 active:scale-95 transition-all" onClick={() => setIsEditingSchedule(true)}>Sửa lịch trình</Button>
                  )}
                </div>

                {isEditingSchedule && (
                  <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                    <Input value={editData.title || ""} onChange={(e) => setEditData({ ...editData, title: e.target.value })} className="h-10 bg-white rounded-xl border-slate-200 font-medium" placeholder="Tiêu đề lịch trình" />
                    <Textarea value={editData.description || ""} onChange={(e) => setEditData({ ...editData, description: e.target.value })} className="min-h-20 bg-white rounded-xl border-slate-200 font-medium resize-none" placeholder="Nội dung chi tiết" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Select value={editData.type} onValueChange={(v) => setEditData({ ...editData, type: v })}>
                        <SelectTrigger className="h-10 bg-white rounded-xl border-slate-200 font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="meeting">Họp nội bộ</SelectItem>
                          <SelectItem value="trip">Đi công tác</SelectItem>
                          <SelectItem value="event">Sự kiện</SelectItem>
                          <SelectItem value="leave">Nghỉ phép</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={editData.location === 'Chi nhánh' ? 'branch' : 'outside'} onValueChange={(v) => setEditData({ ...editData, location: v === 'branch' ? 'Chi nhánh' : '', room_id: v === 'branch' ? (rooms[0]?.id || 'none') : 'none' })}>
                        <SelectTrigger className="h-10 bg-white rounded-xl border-slate-200 font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="outside">Địa điểm ngoài</SelectItem>
                          <SelectItem value="branch">Chi nhánh</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Bắt đầu */}
                    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-semibold text-slate-500">Từ ngày</Label>
                        <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="w-full h-10 bg-white border border-slate-200 rounded-xl font-medium justify-start text-left text-[14px] active:scale-95 transition-all truncate">
                              <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                              <span className="truncate">{editStartDate ? format(editStartDate, "dd/MM/yyyy") : "Chọn ngày"}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <Calendar
                              mode="single"
                              selected={editStartDate}
                              onSelect={(date) => {
                                setEditStartDate(date);
                                if (date && editEndDate && date > editEndDate) setEditEndDate(date);
                                setIsStartOpen(false);
                              }}
                              initialFocus
                              locale={vi}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-semibold text-slate-500">Giờ đi</Label>
                        <Select value={editStartTime} onValueChange={(v) => {
                          setEditStartTime(v);
                          const [h, m] = v.split(':');
                          const endH = Math.min(parseInt(h) + 1, 23);
                          setEditEndTime(`${endH.toString().padStart(2, '0')}:${m}`);
                        }}>
                          <SelectTrigger className="h-10 bg-white border border-slate-200 rounded-xl font-medium text-[14px]">
                            <Clock className="mr-2 h-4 w-4 text-primary shrink-0" />
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

                    {/* Kết thúc */}
                    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-semibold text-slate-500">Đến ngày</Label>
                        <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="w-full h-10 bg-white border border-slate-200 rounded-xl font-medium justify-start text-left text-[14px] active:scale-95 transition-all truncate">
                              <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                              <span className="truncate">{editEndDate ? format(editEndDate, "dd/MM/yyyy") : "Chọn ngày"}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
                            <Calendar
                              mode="single"
                              selected={editEndDate}
                              onSelect={(date) => {
                                setEditEndDate(date);
                                setIsEndOpen(false);
                              }}
                              initialFocus
                              locale={vi}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[12px] font-semibold text-slate-500">Giờ về</Label>
                        <Select value={editEndTime} onValueChange={setEditEndTime}>
                          <SelectTrigger className="h-10 bg-white border border-slate-200 rounded-xl font-medium text-[14px]">
                            <Clock className="mr-2 h-4 w-4 text-primary shrink-0" />
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

                    {editData.type !== 'leave' && editData.location === 'Chi nhánh' ? (
                      <Select value={editData.room_id || 'none'} onValueChange={(v) => setEditData({ ...editData, room_id: v })}>
                        <SelectTrigger className="h-10 bg-white rounded-xl border-slate-200 font-medium"><SelectValue placeholder="Chọn phòng họp" /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.capacity} chỗ)</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : editData.type !== 'leave' ? (
                      <Input value={editData.location || ""} onChange={(e) => setEditData({ ...editData, location: e.target.value })} className="h-10 bg-white rounded-xl border-slate-200 font-medium" placeholder="Địa điểm / lộ trình cụ thể" />
                    ) : null}

                    {editData.type !== 'leave' && (
                      <div className="space-y-3">
                        <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                          <input type="checkbox" checked={!!editData.use_vehicle} onChange={(e) => setEditData({ ...editData, use_vehicle: e.target.checked, vehicle_id: e.target.checked ? editData.vehicle_id : 'none' })} />
                          Sử dụng xe cơ quan
                        </label>
                        {editData.use_vehicle && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Select value={editData.requested_vehicle_type || '4 chỗ'} onValueChange={(v) => setEditData({ ...editData, requested_vehicle_type: v })}>
                              <SelectTrigger className="h-10 bg-white rounded-xl border-slate-200 font-medium"><SelectValue /></SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="4 chỗ">Xe 4 chỗ</SelectItem>
                                <SelectItem value="7 chỗ">Xe 7 chỗ</SelectItem>
                                <SelectItem value="Khác">Loại khác</SelectItem>
                              </SelectContent>
                            </Select>
                            {isTCTH && (
                              <Select value={editData.vehicle_id || 'none'} onValueChange={(v) => setEditData({ ...editData, vehicle_id: v })}>
                                <SelectTrigger className="h-10 bg-white rounded-xl border-slate-200 font-medium"><SelectValue placeholder="Xe cụ thể" /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="none">Chưa gán xe</SelectItem>
                                  {vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name} - {v.plate_number}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {editData.type !== 'leave' && (
                      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                        <ParticipantSelector
                          allProfiles={allProfiles}
                          departments={departments}
                          bgdMode={bgdMode} setBgdMode={setBgdMode}
                          selectedBGD={selectedBGD} setSelectedBGD={setSelectedBGD}
                          deptMode={deptMode} setDeptMode={setDeptMode}
                          filterDepts={filterDepts} setFilterDepts={setFilterDepts}
                          participantMode={participantMode} setParticipantMode={setParticipantMode}
                          selectedParticipants={selectedParticipants} setSelectedParticipants={setSelectedParticipants}
                        />
                      </div>
                    )}

                    {editData.type !== 'leave' && conflicts.length > 0 && (
                      <div className="p-3 bg-red-50/50 rounded-2xl border border-red-100 mt-2 space-y-2 animate-in fade-in zoom-in-95">
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

                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-sm font-medium text-slate-500 active:scale-95 transition-all" onClick={() => setIsEditingSchedule(false)}>Hủy</Button>
                      <Button
                        size="sm"
                        className={cn(
                          "h-9 px-4 rounded-xl text-sm font-medium shadow-sm active:scale-95 transition-all",
                          editData.type !== 'leave' && conflicts.length > 0
                            ? "bg-amber-500 hover:bg-amber-600 text-white"
                            : "bg-primary hover:bg-primary/90 text-white"
                        )}
                        onClick={handleSaveSchedule}
                      >
                        {editData.type !== 'leave' && conflicts.length > 0 ? 'Vẫn tiếp tục lưu?' : 'Lưu lịch trình'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Địa điểm / Phòng họp */}
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 truncate">Địa điểm / Phòng họp</p>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="p-2 bg-white rounded-xl shadow-xs">
                  <MapPin className="w-4 h-4 text-slate-500" />
                </div>
                <p className="text-sm font-semibold text-slate-700">{schedule.room?.name || schedule.location || "Chưa xác định"}</p>
              </div>
            </div>

            {/* Thành phần tham gia */}
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <p className="text-[13px] font-medium text-slate-500">Thành phần tham gia</p>
              <RenderParticipants schedule={schedule} allProfiles={allProfiles} />
            </div>

            {/* Thông tin xe & lái xe */}
            {schedule.use_vehicle && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <p className="text-[13px] font-medium text-slate-500">Thông tin xe & lái xe</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="p-2 bg-white rounded-lg shadow-xs">
                      <Car className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Phương tiện</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {schedule.vehicle ? `${schedule.vehicle.name} (${schedule.vehicle.plate_number})` : `Yêu cầu: ${schedule.requested_vehicle_type}`}
                      </p>
                    </div>
                  </div>

                  {matchedVehicle && (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="p-2 bg-white rounded-lg shadow-xs">
                        <UserCheck className="w-4 h-4 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Lái xe & SĐT</p>
                        <p className="text-sm font-semibold text-slate-700">
                          {schedule.driver?.full_name || matchedVehicle.default_driver?.full_name || matchedVehicle.driver_name}
                        </p>
                        {(schedule.driver?.phone || matchedVehicle.default_driver?.phone || matchedVehicle.driver_phone) && (
                          <a
                            href={`tel:${schedule.driver?.phone || matchedVehicle.default_driver?.phone || matchedVehicle.driver_phone}`}
                            className="text-xs font-bold text-primary hover:underline block mt-0.5"
                          >
                            {schedule.driver?.phone || matchedVehicle.default_driver?.phone || matchedVehicle.driver_phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Điều phối xe (TCTH) */}
            {isTCTH && schedule.use_vehicle && !schedule.vehicle_id && (
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-xs">
                    <Car className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-700 truncate whitespace-nowrap">Điều phối phương tiện</p>
                    <p className="text-[9px] font-semibold text-slate-500">Chọn xe và lái xe phù hợp cho lộ trình này</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select value={tempVehicleId || ''} onValueChange={(v) => { 
                    setTempVehicleId(v);
                    const selectedV = vehicles.find(x => x.id === v);
                    if (selectedV?.driver_id) setTempDriverId(selectedV.driver_id);
                  }}>
                    <SelectTrigger className="h-10 bg-white border border-slate-200 rounded-xl font-medium shadow-sm text-[13px]">
                      <SelectValue placeholder={`Chọn xe ${schedule.requested_vehicle_type}...`} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                      {vehicles
                        .filter(v => schedule.requested_vehicle_type === 'Khác' ? !['4 chỗ', '7 chỗ'].includes(v.type) : v.type === schedule.requested_vehicle_type)
                        .map(v => (
                          <SelectItem key={v.id} value={v.id}>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800">{v.name} - {v.plate_number}</span>
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Select value={tempDriverId || ''} onValueChange={setTempDriverId}>
                    <SelectTrigger className="h-10 bg-white border border-slate-200 rounded-xl font-medium shadow-sm text-[13px]">
                      <SelectValue placeholder="Chọn Lái xe..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border border-slate-200 shadow-lg">
                      {allProfiles.filter(p => p.role === 'driver').map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5"><AvatarImage src={p.avatar_url}/></Avatar>
                            <span className="font-bold text-slate-800">{p.full_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end pt-2">
                  <Button 
                    disabled={!tempVehicleId || !tempDriverId}
                    onClick={() => onAssignVehicle(schedule.id, tempVehicleId, tempDriverId)}
                    className="bg-primary text-white h-9 px-4 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all"
                  >
                    Xác nhận Gán
                  </Button>
                </div>
              </div>
            )}
            {/* Điều chỉnh thời gian (Nếu có quyền) */}
            {canEdit && (
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-slate-700">Điều chỉnh lịch trình</p>
                  {!isEditingTime && new Date(schedule.end_time) > new Date() && (
                    <div className="flex gap-2">
                       <Button variant="outline" size="sm" className="h-8 px-3 rounded-xl text-sm font-medium text-slate-600 border-slate-200 active:scale-95 transition-all" onClick={() => setIsEditingTime(true)}>Sửa giờ kết thúc</Button>
                       <Button variant="outline" size="sm" className="h-8 px-3 rounded-xl text-sm font-medium border-orange-200 text-orange-600 hover:bg-orange-50 active:scale-95 transition-all" onClick={handleEndNow}>Kết thúc sớm</Button>
                    </div>
                  )}
                </div>
                {isEditingTime && (
                  <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 mb-1.5">Giờ kết thúc mới</p>
                      <input 
                        type="datetime-local" 
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                      />
                    </div>
                    <div className="flex gap-2 justify-end mt-1">
                      <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-sm font-medium text-slate-500 active:scale-95 transition-all" onClick={() => setIsEditingTime(false)}>Hủy</Button>
                      <Button size="sm" className="h-9 px-4 rounded-xl text-sm font-medium bg-primary text-white shadow-sm active:scale-95 transition-all" onClick={handleSaveTime}>Lưu thay đổi</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 px-5 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-row flex-wrap justify-between items-center gap-3 sm:gap-4">
            <Button variant="ghost" className="h-10 px-4 rounded-xl font-medium text-slate-600 text-[13px] hover:bg-slate-200 active:scale-95 transition-all" onClick={() => setIsOpen(false)}>Đóng cửa sổ</Button>
            {isTCTH && schedule.vehicle_id && (
              <Button
                variant="outline"
                className="h-10 px-5 rounded-xl font-bold text-[12px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 shadow-sm active:scale-95 transition-all"
                onClick={() => onAssignVehicle(schedule.id, null, null)}
              >
                Hủy gán xe
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
