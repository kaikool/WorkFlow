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
  onAssignVehicle: (scheduleId: string, vehicleId: string | null) => void;
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
      <Badge key={`p-${idx}`} variant="outline" className="bg-white border-slate-200 rounded-full px-3 py-1.5 flex items-center gap-2 font-medium text-slate-600 shadow-sm">
        <Avatar className="h-4 w-4">
          <AvatarImage src={p.profile?.avatar_url} />
          <AvatarFallback className="text-[8px]">{p.profile?.full_name?.[0]}</AvatarFallback>
        </Avatar>
        {p.profile?.full_name}
      </Badge>
    );
  });

  return <div className="flex flex-wrap gap-2">{elements}</div>;
}

export default function ScheduleDetailDialog({
  isOpen, setIsOpen, schedule, vehicles, isTCTH, allProfiles, onAssignVehicle
}: ScheduleDetailDialogProps) {
  if (!schedule) return null;

  const matchedVehicle = vehicles.find(v => v.id === schedule.vehicle_id);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="rounded-2xl border-none shadow-2xl max-w-xl p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle className="text-[17px] font-semibold text-slate-900">Chi tiết lịch trình</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col">
          {/* Header */}
          <div className={cn("p-6 text-white relative overflow-hidden", schedule.type === 'trip' ? "bg-amber-600" : "bg-slate-900")}>
            <div className="relative z-10 space-y-2">
              <Badge className="bg-white text-slate-900 border-none font-bold text-[10px] px-3 py-1">
                {typeLabels[schedule.type]?.label.toUpperCase()}
              </Badge>
              <h2 className="text-2xl font-bold leading-tight tabular-nums tracking-tighter">{schedule.title}</h2>
              <div className="flex items-center gap-4 text-white/80 text-xs font-bold pt-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {format(new Date(schedule.start_time), 'HH:mm dd/MM')} - {format(new Date(schedule.end_time), 'HH:mm dd/MM')}
                </div>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/80 rounded-full blur-3xl" />
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
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 flex flex-row justify-between gap-4">
            <Button variant="ghost" className="rounded-xl font-medium text-slate-500 text-xs md:text-[11px]" onClick={() => setIsOpen(false)}>Đóng cửa sổ</Button>
            {isTCTH && schedule.vehicle_id && (
              <Button
                variant="outline"
                className="rounded-xl font-semibold text-xs md:text-[11px] uppercase border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 truncate whitespace-nowrap"
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
