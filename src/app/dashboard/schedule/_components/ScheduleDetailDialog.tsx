'use client'

import React from "react";
import { Clock, MapPin, Car, UserCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { cn, compareProfilesByHierarchy } from "@/lib/utils";
import { format } from "date-fns";
import { typeLabels } from "../_lib/constants";
import { filterBGD, filterStaff } from "../_lib/utils";

interface ScheduleDetailDialogProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  schedule: any;
  vehicles: any[];
  rooms: any[];
  isTCTH: boolean;
  allProfiles: any[];
  currentProfile: any;
  onAssignVehicle: (scheduleId: string, vehicleId: string | null) => void;
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
  isOpen, setIsOpen, schedule, vehicles, rooms, isTCTH, allProfiles, currentProfile, onAssignVehicle, onUpdateEndTime, onUpdateSchedule
}: ScheduleDetailDialogProps) {
  const [isEditingTime, setIsEditingTime] = React.useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = React.useState(false);
  const [newEndTime, setNewEndTime] = React.useState("");
  const [editData, setEditData] = React.useState<any>({});

  React.useEffect(() => {
    if (schedule?.end_time && isOpen) {
      setNewEndTime(format(new Date(schedule.end_time), "yyyy-MM-dd'T'HH:mm"));
      setIsEditingTime(false);
      setIsEditingSchedule(false);
      setEditData({
        title: schedule.title || "",
        description: schedule.description || "",
        type: schedule.type || "trip",
        start_time: format(new Date(schedule.start_time), "yyyy-MM-dd'T'HH:mm"),
        end_time: format(new Date(schedule.end_time), "yyyy-MM-dd'T'HH:mm"),
        location: schedule.location || "",
        room_id: schedule.room_id || "none",
        use_vehicle: !!schedule.use_vehicle,
        vehicle_id: schedule.vehicle_id || "none",
        requested_vehicle_type: schedule.requested_vehicle_type || "4 chỗ",
        participant_ids: (schedule.participants || []).map((p: any) => p.profile?.id).filter(Boolean)
      });
    }
  }, [schedule, isOpen]);

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
  const canEdit = isParticipant || isCreator || isTCTH;

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

    onUpdateSchedule(schedule.id, {
      title: editData.title,
      description: editData.description || null,
      type: editData.type,
      start_time: new Date(editData.start_time).toISOString(),
      end_time: new Date(editData.end_time).toISOString(),
      location: isLeave ? null : editData.location,
      room_id: !isLeave && isBranchLocation && editData.room_id !== 'none' ? editData.room_id : null,
      use_vehicle: !isLeave && !!editData.use_vehicle,
      vehicle_id: !isLeave && editData.vehicle_id !== 'none' ? editData.vehicle_id : null,
      requested_vehicle_type: !isLeave && editData.use_vehicle ? editData.requested_vehicle_type : null,
      participant_ids: editData.participant_ids || []
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
                {schedule.title}
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
            {schedule.description && (
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input type="datetime-local" value={editData.start_time || ""} onChange={(e) => setEditData({ ...editData, start_time: e.target.value })} className="h-10 bg-white rounded-xl border-slate-200 font-medium" />
                      <Input type="datetime-local" value={editData.end_time || ""} onChange={(e) => setEditData({ ...editData, end_time: e.target.value })} className="h-10 bg-white rounded-xl border-slate-200 font-medium" />
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
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <p className="text-[13px] font-semibold text-slate-700">Thêm / bớt người tham gia</p>
                        </div>
                        <div className="max-h-44 overflow-y-auto pr-1">
                          <div className="flex flex-wrap gap-2">
                            {allProfiles
                              .filter((p: any) => p.role !== 'admin')
                              .map((p: any) => {
                                const selected = (editData.participant_ids || []).includes(p.id);
                                const locked = p.id === schedule.created_by;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => {
                                      const current = editData.participant_ids || [];
                                      setEditData({
                                        ...editData,
                                        participant_ids: selected
                                          ? current.filter((id: string) => id !== p.id)
                                          : [...current, p.id]
                                      });
                                    }}
                                    className={cn(
                                      "rounded-xl border px-3 py-1.5 text-[12px] font-semibold transition-all",
                                      selected ? "border-primary bg-primary text-white" : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100",
                                      locked && "cursor-not-allowed opacity-80"
                                    )}
                                  >
                                    {p.full_name}{locked ? " (người tạo)" : ""}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-sm font-medium text-slate-500 active:scale-95 transition-all" onClick={() => setIsEditingSchedule(false)}>Hủy</Button>
                      <Button size="sm" className="h-9 px-4 rounded-xl text-sm font-medium bg-primary text-white shadow-sm active:scale-95 transition-all" onClick={handleSaveSchedule}>Lưu lịch trình</Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 truncate">Địa điểm / Phòng họp</p>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">{schedule.room?.name || schedule.location || "Chưa xác định"}</p>
                </div>
              </div>

              {schedule.use_vehicle && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 truncate">Phương tiện</p>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <Car className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                      {schedule.vehicle ? `${schedule.vehicle.name} (${schedule.vehicle.plate_number})` : `Yêu cầu: ${schedule.requested_vehicle_type}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Thông tin lái xe */}
            {matchedVehicle && (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <UserCheck className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 leading-none mb-1 truncate whitespace-nowrap">Thông tin Lái xe</p>
                      <p className="text-sm font-bold text-emerald-800">{matchedVehicle.driver_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-500 leading-none mb-1 truncate whitespace-nowrap">Số điện thoại</p>
                    <p className="text-sm font-bold text-emerald-600">{matchedVehicle.driver_phone}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Điều phối xe (TCTH) */}
            {isTCTH && schedule.use_vehicle && !schedule.vehicle_id && (
              <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <Car className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-amber-800 truncate whitespace-nowrap">Điều phối phương tiện</p>
                    <p className="text-[9px] font-bold text-amber-600">Chọn xe và lái xe phù hợp cho lộ trình này</p>
                  </div>
                </div>
                <Select onValueChange={(v) => onAssignVehicle(schedule.id, v)}>
                  <SelectTrigger className="h-10 bg-white border-none rounded-xl font-medium shadow-sm text-[13px]">
                    <SelectValue placeholder={`Chọn xe ${schedule.requested_vehicle_type}...`} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-lg">
                    {vehicles
                      .filter(v => schedule.requested_vehicle_type === 'Khác' ? !['4 chỗ', '7 chỗ'].includes(v.type) : v.type === schedule.requested_vehicle_type)
                      .map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800">{v.name} - {v.plate_number}</span>
                            <span className="text-[11px] text-slate-500 truncate">Lái xe: {v.driver_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Thành phần tham gia */}
            <div className="space-y-3">
              <p className="text-[13px] font-medium text-slate-500">Thành phần tham gia</p>
              <RenderParticipants schedule={schedule} allProfiles={allProfiles} />
            </div>
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
                onClick={() => onAssignVehicle(schedule.id, null)}
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
