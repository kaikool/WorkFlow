'use client'

import React from "react";
import { Clock, MapPin, Car, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { typeLabels } from "../_lib/constants";
import { filterBGD, filterStaff } from "../_lib/utils";

interface ScheduleDetailDialogProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  schedule: any;
  vehicles: any[];
  isTCTH: boolean;
  allProfiles: any[];
  currentProfile: any;
  onAssignVehicle: (scheduleId: string, vehicleId: string | null) => void;
  onUpdateEndTime: (scheduleId: string, newEndTime: string) => void;
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

  remaining.forEach((p: any, idx: number) => {
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
  isOpen, setIsOpen, schedule, vehicles, isTCTH, allProfiles, currentProfile, onAssignVehicle, onUpdateEndTime
}: ScheduleDetailDialogProps) {
  const [isEditingTime, setIsEditingTime] = React.useState(false);
  const [newEndTime, setNewEndTime] = React.useState("");

  React.useEffect(() => {
    if (schedule?.end_time && isOpen) {
      setNewEndTime(format(new Date(schedule.end_time), "yyyy-MM-dd'T'HH:mm"));
      setIsEditingTime(false);
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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="rounded-2xl border-none shadow-2xl max-w-xl p-0 overflow-hidden bg-white">
        <DialogHeader className="sr-only">
          <DialogTitle className="text-[17px] font-semibold text-slate-900">Chi tiết lịch trình</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col">
          {/* Header */}
          <div className={cn("p-6 relative overflow-hidden backdrop-blur-xl border-b border-slate-100", headerBg)}>
            <div className="relative z-10 space-y-3">
              <Badge className={cn("bg-white/60 backdrop-blur-md shadow-sm font-bold text-[10px] px-3 py-1 uppercase tracking-wider", badgeColor)}>
                {typeLabels[schedule.type]?.label}
              </Badge>
              <DialogTitle className="text-xl md:text-2xl font-bold leading-tight tabular-nums tracking-tighter text-slate-900">
                {schedule.title}
              </DialogTitle>
              <div className="flex items-center gap-4 text-slate-600 text-[13px] font-semibold pt-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {format(new Date(schedule.start_time), 'HH:mm dd/MM')} - {format(new Date(schedule.end_time), 'HH:mm dd/MM')}
                </div>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/60 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {schedule.description && (
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 truncate">Nội dung chi tiết</p>
                <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl">{schedule.description}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[11px] text-slate-500 truncate">Địa điểm / Phòng họp</p>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="p-2 bg-white rounded-xl shadow-sm">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">{schedule.room?.name || schedule.location || "Chưa xác định"}</p>
                </div>
              </div>

              {schedule.use_vehicle && (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 truncate">Phương tiện</p>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      <Car className="w-4 h-4 text-orange-600" />
                    </div>
                    <p className="text-xs font-bold text-slate-700">
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
                      <p className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1 truncate whitespace-nowrap">Thông tin Lái xe</p>
                      <p className="text-sm font-bold text-emerald-800">{matchedVehicle.driver_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1 truncate whitespace-nowrap">Số điện thoại</p>
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
                    <p className="text-[11px] font-bold text-amber-800 uppercase truncate whitespace-nowrap">ĐIỀU PHỐI PHƯƠNG TIỆN</p>
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
                       <Button variant="outline" size="sm" className="h-8 px-3 rounded-xl text-xs font-semibold text-slate-600 border-slate-200 active:scale-95 transition-all" onClick={() => setIsEditingTime(true)}>Sửa giờ kết thúc</Button>
                       <Button variant="outline" size="sm" className="h-8 px-3 rounded-xl text-xs font-semibold border-orange-200 text-orange-600 hover:bg-orange-50 active:scale-95 transition-all" onClick={handleEndNow}>Kết thúc sớm</Button>
                    </div>
                  )}
                </div>
                {isEditingTime && (
                  <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase mb-1.5">Giờ kết thúc mới</p>
                      <input 
                        type="datetime-local" 
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                      />
                    </div>
                    <div className="flex gap-2 justify-end mt-1">
                      <Button variant="ghost" size="sm" className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-500 active:scale-95 transition-all" onClick={() => setIsEditingTime(false)}>Hủy</Button>
                      <Button size="sm" className="h-9 px-4 rounded-xl text-xs font-semibold bg-primary text-white shadow-sm active:scale-95 transition-all" onClick={handleSaveTime}>Lưu thay đổi</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex flex-row justify-between items-center gap-4">
            <Button variant="ghost" className="h-10 px-4 rounded-xl font-medium text-slate-600 text-[13px] hover:bg-slate-200 active:scale-95 transition-all" onClick={() => setIsOpen(false)}>Đóng cửa sổ</Button>
            {isTCTH && schedule.vehicle_id && (
              <Button
                variant="outline"
                className="h-10 px-5 rounded-xl font-bold text-[12px] uppercase border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 shadow-sm active:scale-95 transition-all"
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
