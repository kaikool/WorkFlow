'use client'

import React from "react";
import { MapPin, Car, Pencil, Clock, MoreVertical, Trash2, CheckCircle2, XCircle, AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn, canViewLeaveDetails } from "@/lib/utils";
import { format } from "date-fns";
import { typeLabels } from "../_lib/constants";
import { filterBGD, checkConflicts, checkDeputyDirectorLimit } from "../_lib/utils";
import { useScheduleDetail } from "../_hooks/useScheduleDetail";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import ScheduleEditForm from "./ScheduleEditForm";
import RejectedBanner from "./RejectedBanner";
import RejectScheduleDialog from "./RejectScheduleDialog";
import VehicleRequestEmailDialog from "./VehicleRequestEmailDialog";
import { createClient } from "@/utils/supabase/client";

// --- Sub-component: Hiển thị danh sách người tham gia (Read Mode) ---
// --- Sub-component: Phần Header chung của Dialog ---
function DetailHeader({ schedule, badgeColor, headerBg, isAllowedToView }: {
  schedule: any; badgeColor: string; headerBg: string; isAllowedToView: boolean;
}) {
  const timeText = schedule.status === 'completed' || !(format(new Date(schedule.end_time), 'HH:mm') === '23:59')
    ? (schedule.status === 'in_progress' && new Date() > new Date(schedule.end_time)
      ? `${format(new Date(schedule.start_time), 'HH:mm dd/MM')} - ${format(new Date(), 'HH:mm dd/MM')}`
      : `${format(new Date(schedule.start_time), 'HH:mm dd/MM')} - ${format(new Date(schedule.end_time), 'HH:mm dd/MM')}`)
    : `Bắt đầu từ: ${format(new Date(schedule.start_time), 'HH:mm dd/MM')}`;

  return (
    <div className={cn("px-[var(--app-page-x)] py-5 sm:p-6 relative overflow-hidden backdrop-blur-xl border-b border-slate-100", headerBg)}>
      <div className="relative z-10 space-y-2.5 max-w-full">
        <Badge className={cn("bg-white/60 backdrop-blur-md shadow-sm font-bold text-[10px] px-3 py-1 whitespace-nowrap w-fit", badgeColor)}>
          {typeLabels[schedule.type]?.label}
        </Badge>
        <DialogTitle className="text-lg sm:text-xl font-bold leading-tight tabular-nums text-slate-900 break-words">
          {isAllowedToView ? schedule.title : `Nghỉ phép (${schedule.creator?.full_name || 'Cán bộ'})`}
        </DialogTitle>
        <div className="flex items-center gap-1.5 text-slate-600 text-[13px] font-semibold">
          <Clock className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="break-words leading-snug">{timeText}</span>
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
  allProfiles: any[];
  departments: any[];
  currentProfile: any;
  onAssignVehicle: (scheduleId: string, vehicleId: string | null, driverId: string | null) => void;
  onSelfArranged: (scheduleId: string) => void;
  onRejectSchedule: (scheduleId: string, reason: string) => Promise<void>;
  onUpdateEndTime: (scheduleId: string, newEndTime: string) => void;
  onUpdateSchedule: (scheduleId: string, updates: any) => void;
  onResubmitSchedule?: (scheduleId: string, changeReason: string, editedPayload: any) => void;
  onDeleteSchedule?: (scheduleId: string) => void;
}

export default function ScheduleDetailDialog({
  isOpen, setIsOpen, schedule, schedules, vehicles, rooms, allProfiles, departments, currentProfile, onAssignVehicle, onSelfArranged, onRejectSchedule, onUpdateEndTime, onUpdateSchedule, onResubmitSchedule, onDeleteSchedule
}: ScheduleDetailDialogProps) {
  const detail = useScheduleDetail({
    isOpen, schedule, schedules, vehicles, rooms, allProfiles, currentProfile,
    onAssignVehicle, onUpdateEndTime, onUpdateSchedule, onResubmitSchedule
  });
  const isCoordinator = detail.canCoord;
  // Tìm lịch trình khác trùng xe (đã có hoặc sắp tới) để cảnh báo coordinator
  const vehicleConflict = React.useMemo(() => {
    if (!detail.tempVehicleId || !schedule) return null;
    const sStart = new Date(schedule.start_time);
    const sEnd = new Date(schedule.end_time);
    return schedules.find((s: any) =>
      s.id !== schedule.id &&
      s.vehicle_id === detail.tempVehicleId &&
      (s.status === 'in_progress' || s.status === 'approved') &&
      new Date(s.start_time) < sEnd &&
      new Date(s.end_time) > sStart
    ) || null;
  }, [detail.tempVehicleId, schedules, schedule?.id]);

  // Kiểm tra xe/lái xe có bận trong khung giờ của lịch hiện tại không
  const vehicleBusyMap = React.useMemo(() => {
    if (!schedule) return new Map<string, boolean>();
    const sStart = new Date(schedule.start_time);
    const sEnd = new Date(schedule.end_time);
    const map = new Map<string, boolean>();
    schedules.forEach((s: any) => {
      if (s.id === schedule.id || s.status === 'rejected' || s.status === 'completed') return;
      const isOverlap = new Date(s.start_time) < sEnd && new Date(s.end_time) > sStart;
      if (!isOverlap) return;
      if (s.vehicle_id) map.set(s.vehicle_id, true);
    });
    return map;
  }, [schedules, schedule]);

  const driverBusyMap = React.useMemo(() => {
    if (!schedule) return new Map<string, boolean>();
    const sStart = new Date(schedule.start_time);
    const sEnd = new Date(schedule.end_time);
    const map = new Map<string, boolean>();
    schedules.forEach((s: any) => {
      if (s.id === schedule.id || s.status === 'rejected' || s.status === 'completed') return;
      const isOverlap = new Date(s.start_time) < sEnd && new Date(s.end_time) > sStart;
      if (!isOverlap) return;
      if (s.driver_id) map.set(s.driver_id, true);
    });
    return map;
  }, [schedules, schedule]);

  // Xung đột lịch hiển thị cho coordinator
  const scheduleConflicts = React.useMemo(() => {
    if (!schedule || schedule.type === 'leave') return [];
    const sStart = new Date(schedule.start_time);
    const sEnd = new Date(schedule.end_time);
    const participantIds = (schedule.participants || [])
      .map((p: any) => p.profile?.id)
      .filter(Boolean);

    const timeConflicts = checkConflicts({
      checkIds: participantIds,
      startDate: sStart,
      endDate: sEnd,
      startTime: `${sStart.getHours().toString().padStart(2, '0')}:${sStart.getMinutes().toString().padStart(2, '0')}`,
      endTime: `${sEnd.getHours().toString().padStart(2, '0')}:${sEnd.getMinutes().toString().padStart(2, '0')}`,
      schedules,
      ignoreScheduleId: schedule.id,
    });

    const bdgProfileIds = allProfiles
      .filter((p: any) => participantIds.includes(p.id))
      .filter((p: any) =>
        p.role === 'director' || p.title?.toLowerCase().includes('giám đốc')
      )
      .map((p: any) => p.id);

    const deputyWarnings = checkDeputyDirectorLimit({
      bdgProfileIds,
      startDate: sStart,
      endDate: sEnd,
      startTime: `${sStart.getHours().toString().padStart(2, '0')}:${sStart.getMinutes().toString().padStart(2, '0')}`,
      endTime: `${sEnd.getHours().toString().padStart(2, '0')}:${sEnd.getMinutes().toString().padStart(2, '0')}`,
      schedules,
      allProfiles,
      ignoreScheduleId: schedule.id,
    });

    return [...timeConflicts, ...deputyWarnings];
  }, [schedule, schedules, allProfiles]);

  const supabase = createClient();
  const [safeLeave, setSafeLeave] = React.useState<any>(null);
  const [rejectVehicleOpen, setRejectVehicleOpen] = React.useState(false);
  const [vehicleEmailOpen, setVehicleEmailOpen] = React.useState(false);

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
  const isRejected = schedule.status === 'rejected';
  const canEdit = detail.isLeave
    ? (detail.isCreator || isAllowedToView)
    : isRejected
      ? detail.isCreator
      : (detail.isParticipant || detail.isCreator || isCoordinator);

  // Chế độ sửa — ủy quyền sang component ScheduleEditForm
  if (detail.isEditingSchedule) {
    return (
      <ScheduleEditForm
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        schedule={schedule}
        vehicles={vehicles}
        rooms={rooms}
        allProfiles={allProfiles}
        departments={departments}
        detail={detail}
      />
    );
  }

  const isCompleted = schedule?.status === 'completed';
  const showEditAction = canEdit && !isRejected;
  const showEndAction = canEdit && !isCompleted;
  const showCancelVehicle = isCoordinator && schedule.vehicle_id && !isCompleted;
  const showReassignVehicle = (isCoordinator || currentProfile?.role === 'admin') && isCompleted && schedule.use_vehicle;
  const showDeleteAction = detail.isCreator || isCoordinator;
  const hasAnyAction = showEditAction || showEndAction || showCancelVehicle || showReassignVehicle || showDeleteAction;

  const handleDelete = async () => {
    const ok = await confirmDialog({
      title: 'Xóa lịch trình',
      description: 'Bạn có chắc chắn muốn xóa lịch trình này? Hành động này không thể hoàn tác.',
      confirmText: 'Xóa lịch trình',
      cancelText: 'Đóng',
      danger: true,
    });
    
    if (ok && onDeleteSchedule) {
      // Dùng setTimeout để tránh lỗi Radix UI bị kẹt pointer-events: none trên body 
      // khi đóng 2 dialog (ConfirmDialog và ScheduleDetailDialog) cùng lúc.
      setTimeout(() => {
        onDeleteSchedule(schedule.id);
      }, 100);
    }
  };

  const menuActions = hasAnyAction ? (
    <div className="flex items-center gap-1.5">
      {showEditAction && (
        <Button variant="ghost" size="icon" title="Sửa lịch trình" onClick={() => detail.openEditMode('edit')} className="h-10 w-10 rounded-xl text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-100">
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {showEndAction && (
        <Button variant="ghost" size="icon" title="Kết thúc" onClick={detail.handleEndNow} className="h-10 w-10 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100">
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      )}
      {showCancelVehicle && (
        <Button variant="ghost" size="icon" title="Hủy gán xe" onClick={() => onAssignVehicle(schedule.id, null, null)} className="h-10 w-10 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 border border-red-100">
          <Car className="h-4 w-4" />
        </Button>
      )}
      {showReassignVehicle && (
        <Button variant="ghost" size="icon" title="Gán lại xe" onClick={() => detail.openEditMode('edit')} className="h-10 w-10 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100">
          <Car className="h-4 w-4" />
        </Button>
      )}
      {showDeleteAction && (
        <Button variant="ghost" size="icon" title="Xóa lịch trình" onClick={handleDelete} className="h-10 w-10 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 border border-red-100">
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      {schedule.type === 'trip' && schedule.use_vehicle && (
        <Button
          variant="ghost"
          size="icon"
          title="Gửi email đề nghị xe"
          onClick={() => setVehicleEmailOpen(true)}
          className="h-10 w-10 rounded-xl text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-100"
        >
          <Mail className="h-4 w-4" />
        </Button>
      )}
    </div>
  ) : null;

  // =====================================================
  // CHẾ ĐỘ XEM (Read Mode) — Giao diện mặc định
  // =====================================================
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent hideCloseButton className="app-dialog-sheet app-dialog-sheet--xl shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogDescription>Thông tin chi tiết, thành phần tham gia, phương tiện và các thao tác cập nhật lịch trình.</DialogDescription>
          <DialogTitle>Chi tiết lịch trình</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <DetailHeader schedule={safeSchedule} badgeColor={detail.badgeColor} headerBg={detail.headerBg} isAllowedToView={isAllowedToView} />

        {/* Body */}
        <ScrollArea className="app-dialog-sheet-body">
          <div className="space-y-6 px-[var(--app-page-x)] py-4">

            {/* Banner đỏ khi lịch đã bị từ chối */}
            {isRejected && (
              <RejectedBanner
                schedule={schedule}
                isCreator={detail.isCreator}
                onResubmit={() => detail.openEditMode('resubmit')}
              />
            )}

            {/* Nội dung mô tả */}
            {safeSchedule.description && isAllowedToView && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium text-slate-400">Nội dung chi tiết</p>
                <p className="text-[14px] font-medium text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl">
                  {safeSchedule.description}
                </p>
              </div>
            )}

            {/* Địa điểm / Phòng họp */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
              <div className="p-2 bg-white rounded-lg shadow-sm shrink-0">
                <MapPin className="w-4 h-4 text-slate-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400 font-medium">Địa điểm</p>
                <p className="text-[14px] font-semibold text-slate-700 truncate">
                  {schedule.room?.name || schedule.location || "Chưa xác định"}
                </p>
              </div>
            </div>

            {/* Thành phần tham gia */}
            {(() => {
              if (!schedule?.participants) return null;
              const bgdProfiles = filterBGD(allProfiles);
              const participantIds = schedule.participants.map((p: any) => p.profile?.id);
              const hasAllBgd = bgdProfiles.length > 0 && bgdProfiles.every(p => participantIds.includes(p.id));

              const names: string[] = [];
              schedule.participants.forEach((p: any) => {
                if (!p.profile?.full_name) return;
                if (hasAllBgd && bgdProfiles.some(bp => bp.id === p.profile?.id)) return;
                names.push(p.profile.full_name);
              });

              const allNames = hasAllBgd ? ['Toàn bộ Ban Giám đốc', ...names] : names;
              if (allNames.length === 0) return null;

              return (
                <div className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                  <p className="text-[11px] font-medium text-slate-400">Thành phần tham gia</p>
                  <div className="text-[14px] font-semibold text-slate-700 leading-relaxed">
                    {allNames.map((name, i) => (
                      <p key={i}>{i + 1}. {name}</p>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Cảnh báo xung đột cho coordinator */}
            {isCoordinator && scheduleConflicts.length > 0 && (
              <>
                {/* Cảnh báo trùng lịch */}
                {scheduleConflicts.filter(c => !c.toLowerCase().includes('phó giám đốc') && !c.toLowerCase().includes('tối đa')).length > 0 && (
                  <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span className="text-[13px] font-semibold text-red-700">Cảnh báo trùng lịch</span>
                    </div>
                    <ul className="list-disc pl-5 text-xs font-medium text-red-600/80 space-y-1">
                      {scheduleConflicts.filter(c => !c.toLowerCase().includes('phó giám đốc') && !c.toLowerCase().includes('tối đa')).map((c, i) => (
                        <li key={i} className="leading-relaxed">{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Cảnh báo quá số Phó giám đốc */}
                {scheduleConflicts.filter(c => c.toLowerCase().includes('phó giám đốc') || c.toLowerCase().includes('tối đa')).length > 0 && (
                  <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <span className="text-[13px] font-semibold text-amber-700">Giới hạn Phó giám đốc</span>
                    </div>
                    <ul className="list-disc pl-5 text-xs font-medium text-amber-700/80 space-y-1">
                      {scheduleConflicts.filter(c => c.toLowerCase().includes('phó giám đốc') || c.toLowerCase().includes('tối đa')).map((c, i) => (
                        <li key={i} className="leading-relaxed">{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {/* Thông tin xe & lái xe */}
            {schedule.use_vehicle && schedule.vehicle && (
              <div className="text-[12px] text-slate-600 font-medium space-y-0.5 bg-slate-50 p-3 rounded-xl">
                <p className="text-slate-400 text-[11px] mb-1">Lái xe và phương tiện</p>
                <p>{schedule.driver?.full_name || detail.matchedVehicle?.default_driver?.full_name || detail.matchedVehicle?.driver_name || "Chưa có"}</p>
                <p>{schedule.vehicle.name} - {schedule.vehicle.plate_number}</p>
                {(schedule.driver?.phone || detail.matchedVehicle?.default_driver?.phone || detail.matchedVehicle?.driver_phone) && (
                  <a href={`tel:${schedule.driver?.phone || detail.matchedVehicle.default_driver?.phone || detail.matchedVehicle.driver_phone}`}
                    className="text-primary hover:underline">{schedule.driver?.phone || detail.matchedVehicle.default_driver?.phone || detail.matchedVehicle.driver_phone}
                  </a>
                )}
              </div>
            )}

            {/* Driver từ chối */}
            {schedule.metadata?.driver_rejected_at && isCoordinator && schedule.use_vehicle && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-red-700">Lái xe đã từ chối</p>
                  <p className="text-sm text-red-600 mt-0.5">{schedule.metadata?.driver_rejected_reason || "Không có lý do"}</p>
                </div>
              </div>
            )}

            {/* Điều phối xe */}
            {isCoordinator && schedule.use_vehicle && !schedule.vehicle_id && (
              <div className="p-3 bg-slate-50 rounded-xl space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-white rounded-lg shadow-sm shrink-0">
                    <Car className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-slate-700">Điều phối phương tiện</p>
                    <p className="text-[10px] font-medium text-slate-500">Chọn xe và lái xe phù hợp</p>
                  </div>
                </div>

                {/* Cảnh báo xe đang đi chuyến khác */}
                {vehicleConflict && (
                  <div className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-semibold text-amber-800">Xe đã có lịch trùng giờ: "{vehicleConflict.title}"</p>
                      <p className="text-[10px] text-amber-700 mt-0.5">
                        {new Date(vehicleConflict.start_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} – {new Date(vehicleConflict.end_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select value={detail.tempVehicleId || ''} onValueChange={detail.handleVehicleSelect}>
                    <SelectTrigger className="min-h-9 bg-white border-none rounded-xl font-medium text-xs shadow-sm">
                      <SelectValue placeholder="Chọn xe..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-lg p-1 min-w-[var(--radix-select-trigger-width)]">
                      {vehicles.map(v => {
                        const busy = vehicleBusyMap.has(v.id);
                        return (
                        <SelectItem key={v.id} value={v.id} className="text-[11px] py-1.5 pr-3">
                          <span className="grid grid-cols-[1fr_auto] items-center gap-2 w-full">
                            <span className="truncate font-semibold text-slate-800">{v.name} - {v.plate_number}</span>
                            <span className={"shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-center " + (busy ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>
                              {busy ? 'BẬN' : 'RẢNH'}
                            </span>
                          </span>
                        </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>

                  <Select value={detail.tempDriverId || ''} onValueChange={detail.handleDriverSelect}>
                    <SelectTrigger className="min-h-9 bg-white border-none rounded-xl font-medium text-xs shadow-sm">
                      <SelectValue placeholder="Chọn lái xe..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-lg p-1 min-w-[var(--radix-select-trigger-width)]">
                      {allProfiles.filter(p => p.role === 'driver').map(p => {
                        const busy = driverBusyMap.has(p.id);
                        return (
                        <SelectItem key={p.id} value={p.id} className="text-[11px] py-1.5 pr-3">
                          <span className="grid grid-cols-[1fr_auto] items-center gap-2 w-full">
                            <span className="truncate font-semibold text-slate-800">
                              {p.full_name}{p.phone ? ` - ${p.phone}` : ''}
                            </span>
                            <span className={"shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-center " + (busy ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700")}>
                              {busy ? 'BẬN' : 'RẢNH'}
                            </span>
                          </span>
                        </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button variant="outline"
                    onClick={() => setRejectVehicleOpen(true)}
                    className="min-h-9 rounded-xl text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 w-full"
                  >Từ chối</Button>
                  <Button variant="outline"
                    onClick={() => { onSelfArranged(schedule.id); setIsOpen(false); }}
                    className="min-h-9 rounded-xl text-xs font-semibold border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 w-full"
                  >Tự túc PT</Button>
                  <Button
                    disabled={!detail.tempVehicleId}
                    onClick={() => onAssignVehicle(schedule.id, detail.tempVehicleId, detail.tempDriverId)}
                    className={cn(
                      "min-h-9 rounded-xl text-xs font-semibold active:scale-[0.98] transition-all duration-300 ease-in-out w-full",
                      vehicleConflict
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-primary hover:bg-primary/90 text-white"
                    )}
                  >Xác nhận gán</Button>
                </div>
              </div>
            )}

            {/* Người tạo */}
            <p className="text-[11px] text-slate-400 italic leading-relaxed">
              Tạo bởi: {schedule.creator?.full_name || "Không xác định"}
              {schedule.type === 'leave' && schedule.created_by === schedule.creator?.id && ' (bạn)'}
            </p>

          </div>
          </ScrollArea>

          {/* Footer */}
          <DialogFooter className="app-dialog-sheet-footer flex flex-row justify-between items-center gap-3">
            {menuActions || <div />}
            <Button variant="ghost" className="min-h-11 px-4 rounded-xl font-medium text-slate-600 text-[13px] bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all whitespace-nowrap" onClick={() => setIsOpen(false)}>Đóng cửa sổ</Button>
          </DialogFooter>
      </DialogContent>

      <RejectScheduleDialog
        isOpen={rejectVehicleOpen}
        setIsOpen={setRejectVehicleOpen}
        scheduleTitle={schedule?.title}
        description="Không có phương tiện phù hợp cho lịch trình này. Nhập lý do để người tạo biết và có thể điều chỉnh."
        onConfirm={async (reason) => {
          if (onRejectSchedule) {
            await onRejectSchedule(schedule.id, reason);
            setRejectVehicleOpen(false);
          }
        }}
      />

      <VehicleRequestEmailDialog
        isOpen={vehicleEmailOpen}
        setIsOpen={setVehicleEmailOpen}
        schedule={schedule}
      />
    </Dialog>
  );
}
