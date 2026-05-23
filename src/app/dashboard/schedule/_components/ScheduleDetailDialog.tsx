'use client'

import React from "react";
import { MapPin, Car, UserCheck, Pencil, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { cn, compareProfilesByHierarchy, canViewLeaveDetails } from "@/lib/utils";
import { format } from "date-fns";
import { typeLabels } from "../_lib/constants";
import { filterBGD, filterStaff } from "../_lib/utils";
import { useScheduleDetail } from "../_hooks/useScheduleDetail";
import ScheduleEditForm from "./ScheduleEditForm";
import { createClient } from "@/utils/supabase/client";

// --- Sub-component: Hiển thị danh sách người tham gia (Read Mode) ---
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
      <Badge key="all-bgd" variant="outline" className="bg-red-50 border-red-200 text-red-700 rounded-full px-3 py-1.5 flex items-center gap-2 font-bold shadow-sm whitespace-nowrap">
        Toàn bộ Ban Giám đốc
      </Badge>
    );
  }
  if (hasAllStaff) {
    elements.push(
      <Badge key="all-staff" variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 rounded-full px-3 py-1.5 flex items-center gap-2 font-bold shadow-sm whitespace-nowrap">
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
      <Badge key={`p-${idx}`} variant="outline" className="bg-white border-slate-200 rounded-full px-3 py-1.5 flex items-center gap-2 font-semibold text-slate-700 shadow-sm whitespace-nowrap">
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

// --- Sub-component: Phần Header chung của Dialog ---
function DetailHeader({ schedule, badgeColor, headerBg, isAllowedToView }: {
  schedule: any; badgeColor: string; headerBg: string; isAllowedToView: boolean;
}) {
  return (
    <div className={cn("px-[var(--app-page-x)] py-5 sm:p-6 relative overflow-hidden backdrop-blur-xl border-b border-slate-100", headerBg)}>
      <div className="relative z-10 space-y-3">
        <Badge className={cn("bg-white/60 backdrop-blur-md shadow-sm font-bold text-[10px] px-3 py-1 whitespace-nowrap", badgeColor)}>
          {typeLabels[schedule.type]?.label}
        </Badge>
        <DialogTitle className="text-lg sm:text-xl font-bold leading-tight tabular-nums text-slate-900 break-words">
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
  );
}

// --- Props Interface ---
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

export default function ScheduleDetailDialog({
  isOpen, setIsOpen, schedule, schedules, vehicles, rooms, isTCTH, allProfiles, departments, currentProfile, onAssignVehicle, onUpdateEndTime, onUpdateSchedule
}: ScheduleDetailDialogProps) {
  const detail = useScheduleDetail({
    isOpen, schedule, schedules, vehicles, rooms, allProfiles, currentProfile, isTCTH,
    onAssignVehicle, onUpdateEndTime, onUpdateSchedule
  });
  const supabase = createClient();
  const [safeLeave, setSafeLeave] = React.useState<any>(null);

  // Khi mở chi tiết đơn nghỉ phép mà caller không phải chủ đơn → gọi RPC server-side
  // để lấy payload đã được lọc (title/description ẩn nếu không có quyền)
  React.useEffect(() => {
    if (!isOpen || !schedule || schedule.type !== 'leave') {
      setSafeLeave(null);
      return;
    }
    if (schedule.created_by === currentProfile?.id) {
      setSafeLeave(null);
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_leave_safe', { p_schedule_id: schedule.id });
      if (!active) return;
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        setSafeLeave(row || null);
      }
    })();
    return () => { active = false; };
  }, [isOpen, schedule, currentProfile?.id]);

  if (!schedule) return null;

  // Nếu là đơn nghỉ phép và có dữ liệu RPC trả về → dùng payload đã được lọc ở server
  const safeSchedule = (schedule.type === 'leave' && safeLeave)
    ? { ...schedule, title: safeLeave.title, description: safeLeave.description, metadata: safeLeave.metadata }
    : schedule;
  const isAllowedToView = (schedule.type === 'leave' && safeLeave)
    ? safeLeave.can_view_detail
    : canViewLeaveDetails(schedule, currentProfile);
  const canEdit = detail.isLeave
    ? (detail.isCreator || isAllowedToView)
    : (detail.isParticipant || detail.isCreator || isTCTH);

  // Chế độ sửa — ủy quyền sang component ScheduleEditForm
  if (detail.isEditingSchedule) {
    return (
      <ScheduleEditForm
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        schedule={schedule}
        vehicles={vehicles}
        rooms={rooms}
        isTCTH={isTCTH}
        allProfiles={allProfiles}
        departments={departments}
        detail={detail}
      />
    );
  }

  // =====================================================
  // CHẾ ĐỘ XEM (Read Mode) — Giao diện mặc định
  // =====================================================
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="top-auto bottom-0 translate-y-0 flex flex-col overflow-hidden border-none p-0 shadow-2xl bg-white w-full max-h-[calc(100dvh-env(safe-area-inset-top)-1.5rem)] max-w-none rounded-t-[32px] rounded-b-none sm:top-[50%] sm:bottom-auto sm:translate-y-[-50%] sm:h-auto sm:max-h-[calc(100dvh-6rem)] sm:w-[calc(100dvw-2rem)] sm:max-w-xl sm:rounded-[24px]">
        <DialogHeader className="sr-only">
          <DialogDescription>Thông tin chi tiết, thành phần tham gia, phương tiện và các thao tác cập nhật lịch trình.</DialogDescription>
          <DialogTitle>Chi tiết lịch trình</DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden">
          {/* Header */}
          <DetailHeader schedule={safeSchedule} badgeColor={detail.badgeColor} headerBg={detail.headerBg} isAllowedToView={isAllowedToView} />

          {/* Body */}
          <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-[var(--app-page-x)]">
            {/* Nội dung mô tả */}
            {safeSchedule.description && isAllowedToView && (
              <div className="space-y-2">
                <p className="text-[12px] font-medium text-slate-400">Nội dung chi tiết</p>
                <p className="text-sm font-medium text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl">{safeSchedule.description}</p>
              </div>
            )}

            {/* Nút sửa lịch trình — nổi bật */}
            {canEdit && (
              <Button
                variant="outline"
                className="w-full min-h-11 rounded-xl text-sm font-medium text-slate-700 border-slate-200 hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-2"
                onClick={() => detail.setIsEditingSchedule(true)}
              >
                <Pencil className="w-4 h-4" />
                Sửa lịch trình
              </Button>
            )}

            {/* Địa điểm / Phòng họp */}
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-slate-400">Địa điểm</p>
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                <div className="p-2.5 bg-white rounded-xl shadow-sm shrink-0">
                  <MapPin className="w-4 h-4 text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">{schedule.room?.name || schedule.location || "Chưa xác định"}</p>
              </div>
            </div>

            {/* Thành phần tham gia */}
            <div className="space-y-3">
              <p className="text-[12px] font-medium text-slate-400">Thành phần tham gia</p>
              <RenderParticipants schedule={schedule} allProfiles={allProfiles} />
            </div>

            {/* Thông tin xe & lái xe */}
            {schedule.use_vehicle && (
              <div className="space-y-3">
                <p className="text-[12px] font-medium text-slate-400">Phương tiện & Lái xe</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                    <div className="p-2.5 bg-white rounded-xl shadow-sm shrink-0">
                      <Car className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Phương tiện</p>
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {schedule.vehicle ? `${schedule.vehicle.name} (${schedule.vehicle.plate_number})` : `Yêu cầu: ${schedule.requested_vehicle_type}`}
                      </p>
                    </div>
                  </div>

                  {detail.matchedVehicle && (
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                      <div className="p-2.5 bg-white rounded-xl shadow-sm shrink-0">
                        <UserCheck className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Lái xe & SĐT</p>
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {schedule.driver?.full_name || detail.matchedVehicle.default_driver?.full_name || detail.matchedVehicle.driver_name}
                        </p>
                        {(schedule.driver?.phone || detail.matchedVehicle.default_driver?.phone || detail.matchedVehicle.driver_phone) && (
                          <a
                            href={`tel:${schedule.driver?.phone || detail.matchedVehicle.default_driver?.phone || detail.matchedVehicle.driver_phone}`}
                            className="text-xs font-medium text-primary hover:underline block mt-0.5"
                          >
                            {schedule.driver?.phone || detail.matchedVehicle.default_driver?.phone || detail.matchedVehicle.driver_phone}
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
              <div className="p-5 bg-slate-50 rounded-2xl space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-sm shrink-0">
                    <Car className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-slate-700 whitespace-nowrap">Điều phối phương tiện</p>
                    <p className="text-[10px] font-medium text-slate-500">Chọn xe và lái xe phù hợp</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select value={detail.tempVehicleId || ''} onValueChange={detail.handleVehicleSelect}>
                    <SelectTrigger className="min-h-11 bg-white border-none rounded-xl font-medium text-sm shadow-sm">
                      <SelectValue placeholder={`Chọn xe ${schedule.requested_vehicle_type}...`} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {vehicles
                        .filter(v => schedule.requested_vehicle_type === 'Khác' ? !['4 chỗ', '7 chỗ'].includes(v.type) : v.type === schedule.requested_vehicle_type)
                        .map(v => (
                          <SelectItem key={v.id} value={v.id} className="text-base md:text-sm py-3 md:py-2">
                            <span className="font-bold text-slate-800">{v.name} - {v.plate_number}</span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Select value={detail.tempDriverId || ''} onValueChange={detail.setTempDriverId}>
                    <SelectTrigger className="min-h-11 bg-white border-none rounded-xl font-medium text-sm shadow-sm">
                      <SelectValue placeholder="Chọn Lái xe..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {allProfiles.filter(p => p.role === 'driver').map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-base md:text-sm py-3 md:py-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5"><AvatarImage src={p.avatar_url}/></Avatar>
                            <span className="font-bold text-slate-800">{p.full_name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    disabled={!detail.tempVehicleId || !detail.tempDriverId}
                    onClick={() => onAssignVehicle(schedule.id, detail.tempVehicleId, detail.tempDriverId)}
                    className="bg-primary text-white min-h-11 px-6 rounded-xl text-sm font-medium shadow-lg shadow-primary/20 active:scale-95 transition-all whitespace-nowrap"
                  >
                    Xác nhận gán
                  </Button>
                </div>
              </div>
            )}

            {/* Điều chỉnh thời gian nhanh */}
            {canEdit && (
              <div className="space-y-3">
                <p className="text-[12px] font-medium text-slate-400">Điều chỉnh nhanh</p>
                {!detail.isEditingTime && new Date(schedule.end_time) > new Date() && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 min-h-11 rounded-xl text-sm font-medium text-slate-600 border-slate-200 active:scale-95 transition-all whitespace-nowrap" onClick={() => detail.setIsEditingTime(true)}>Sửa giờ kết thúc</Button>
                    <Button variant="outline" className="flex-1 min-h-11 rounded-xl text-sm font-medium border-orange-200 text-orange-600 hover:bg-orange-50 active:scale-95 transition-all whitespace-nowrap" onClick={detail.handleEndNow}>Kết thúc sớm</Button>
                  </div>
                )}
                {detail.isEditingTime && (
                  <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl animate-in zoom-in-95 duration-200">
                    <div>
                      <p className="text-[12px] font-medium text-slate-500 mb-2">Giờ kết thúc mới</p>
                      <Input
                        type="datetime-local"
                        value={detail.newEndTime}
                        onChange={(e) => detail.setNewEndTime(e.target.value)}
                        className="min-h-11 rounded-xl border-none bg-white px-4 py-2 text-base md:text-sm font-medium shadow-sm"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" className="min-h-11 px-4 rounded-xl text-sm font-medium text-slate-500 active:scale-95 transition-all" onClick={() => detail.setIsEditingTime(false)}>Hủy</Button>
                      <Button className="min-h-11 px-4 rounded-xl text-sm font-medium bg-primary text-white shadow-lg shadow-primary/20 active:scale-95 transition-all" onClick={detail.handleSaveTime}>Lưu thay đổi</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          </ScrollArea>

          {/* Footer */}
          <DialogFooter className="shrink-0 px-[var(--app-page-x)] py-4 pb-safe border-t border-slate-100 bg-slate-50/50 flex flex-row flex-wrap justify-between items-center gap-3">
            <Button variant="ghost" className="min-h-11 px-4 rounded-xl font-medium text-slate-600 text-[13px] hover:bg-slate-200 active:scale-95 transition-all whitespace-nowrap" onClick={() => setIsOpen(false)}>Đóng cửa sổ</Button>
            {isTCTH && schedule.vehicle_id && (
              <Button
                variant="outline"
                className="min-h-11 px-4 rounded-xl font-medium text-[12px] border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 shadow-sm active:scale-95 transition-all whitespace-nowrap"
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
