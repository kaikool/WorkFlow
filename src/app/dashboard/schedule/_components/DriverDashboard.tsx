import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import {
  Car, Clock, CheckCircle2, Navigation, AlertTriangle,
  MapPin, Gauge, ChevronDown
} from "lucide-react";
import { canCoordinateSharedResources } from "@/lib/permissions";
import { notifyError, notifySuccess, notifyValidation } from "@/lib/notify";
import { useAppData } from "@/hooks/use-app-data";
import StartTripDialog from "./driver/StartTripDialog";
import EndTripDialog from "./driver/EndTripDialog";
import ReportIssueDialog from "./driver/ReportIssueDialog";
import DriverStatsGrid from "./driver/DriverStatsGrid";
import MyTripCard from "./driver/MyTripCard";
import { EmptyState } from "@/components/ui/empty-state";

interface DriverDashboardProps {
  schedules: any[];
  profile: any;
  fetchData: () => Promise<void>;
  toast: any;
}

export default function DriverDashboard({ schedules, profile, fetchData, toast }: DriverDashboardProps) {
  const supabase = createClient();
  const { profiles: cachedProfiles } = useAppData();
  // Bộ phận điều phối — tính từ cache shared, không query lại mỗi lần thao tác
  const coordinatorTargets = React.useMemo(
    () => cachedProfiles.filter((p: any) => canCoordinateSharedResources(p)),
    [cachedProfiles]
  );
  const [updating, setUpdating] = useState(false);

  // Dialog KM xuất phát
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [selectedStartSchedule, setSelectedStartSchedule] = useState<any>(null);

  // Dialog KM kết thúc
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [selectedEndSchedule, setSelectedEndSchedule] = useState<any>(null);

  // Dialog Xác nhận lịch
  const [selectedConfirmSchedule, setSelectedConfirmSchedule] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);

  // Dialog Báo cáo sự cố xe
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [selectedIssueSchedule, setSelectedIssueSchedule] = useState<any>(null);
  const [issueText, setIssueText] = useState("");

  // Dialog Từ chối lịch
  const [selectedRejectSchedule, setSelectedRejectSchedule] = useState<any>(null);

  // Thống kê toàn bộ chuyến từ CSDL toàn thời gian (All-Time Sync)
  const [driverStats, setDriverStats] = useState({ totalTrips: 0 });

  const fetchDriverStats = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('status, metadata')
        .eq('type', 'trip')
        .eq('driver_id', profile.id);

      if (error) throw error;

      if (data) {
        setDriverStats({
          totalTrips: data.length
        });
      }
    } catch (err) {
      console.error("Error fetching driver stats:", err);
    }
  };

  useEffect(() => {
    fetchDriverStats();
  }, [profile?.id, schedules]);

  // Hiển thị các chuyến được gán cho tài xế (đã duyệt, đang chạy, hoặc đã hoàn thành)
  const myTrips = schedules.filter(s => {
    if (s.type !== 'trip') return false;
    if (!['approved', 'in_progress', 'completed'].includes(s.status)) return false;
    return s.participants?.some((p: any) => p.profile?.id === profile?.id) || s.driver_id === profile?.id;
  });
  const activeTrips = myTrips.filter(s => s.status !== 'completed');
  const completedTrips = myTrips.filter(s => s.status === 'completed');

  // Lọc các chuyến xe khác đang hoạt động (đã duyệt hoặc đang chạy)
  const otherTrips = schedules.filter(s => {
    if (s.type !== 'trip' || (s.status !== 'approved' && s.status !== 'in_progress')) return false;
    return s.driver_id !== profile?.id && !s.participants?.some((p: any) => p.profile?.id === profile?.id) && s.vehicle_id;
  });

  const handleStartTrip = async () => {
    setUpdating(true);
    try {
      const schedule = selectedStartSchedule;
      const meta = schedule.metadata || {};
      const actualStart = new Date();
      const newMeta = {
        ...meta,
        trip_started_at: actualStart.toISOString(),
        actual_start_time: actualStart.toISOString(),
      };

      // Chỉ cập nhật status + metadata; GIỮ NGUYÊN start_time đăng ký để timeline BGĐ không bị nhảy
      const { error } = await supabase.from('schedules').update({
        status: 'in_progress',
        metadata: newMeta
      }).eq('id', schedule.id);

      if (error) throw error;

      notifySuccess("Đã bắt đầu chuyến đi");
      setIsStartOpen(false);

      // Kiểm tra lệch lịch trình và cảnh báo bộ phận điều phối
      const scheduledStart = new Date(schedule.start_time);
      const deviationMinutes = Math.round((actualStart.getTime() - scheduledStart.getTime()) / 60000);
      const THRESHOLD_MINUTES = 15;

      if (Math.abs(deviationMinutes) >= THRESHOLD_MINUTES) {
        if (coordinatorTargets.length > 0) {
          const label = deviationMinutes > 0
            ? `muộn ${deviationMinutes} phút so với lịch (đăng ký ${scheduledStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`
            : `sớm ${Math.abs(deviationMinutes)} phút so với lịch (đăng ký ${scheduledStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`;
          await supabase.from('notifications').insert(
            coordinatorTargets.map((target: any) => ({
              user_id: target.id,
              title: `⚠️ Lệch lịch trình: ${deviationMinutes > 0 ? 'Xuất phát muộn' : 'Xuất phát sớm'}`,
              content: `Tài xế ${profile?.full_name} bắt đầu chuyến "${schedule.title}" ${label}.`,
              link: '/dashboard/schedule'
            }))
          );
        }
      }

      fetchData();
    } catch (e) {
      notifyError(e, "Không bắt đầu được chuyến");
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmTrip = async (schedule: any) => {
    setConfirming(true);
    try {
      const meta = schedule.metadata || {};
      const newMeta = {
        ...meta,
        driver_confirmed_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('schedules').update({
        metadata: newMeta
      }).eq('id', schedule.id);
      if (error) throw error;

      // Thông báo cho người tạo lịch và bộ phận điều phối
      const notifyUserIds: string[] = [];
      if (schedule.created_by && schedule.created_by !== profile?.id) {
        notifyUserIds.push(schedule.created_by);
      }
      coordinatorTargets.forEach((target: any) => {
        if (target.id !== profile?.id && !notifyUserIds.includes(target.id)) {
          notifyUserIds.push(target.id);
        }
      });

      if (notifyUserIds.length > 0) {
        await supabase.from('notifications').insert(
          notifyUserIds.map((uid: string) => ({
            user_id: uid,
            title: "✅ Lái xe đã xác nhận lịch",
            content: `Tài xế ${profile?.full_name} đã xác nhận nhận lịch chạy xe cho chuyến "${schedule.title}".`,
            link: "/dashboard/schedule"
          }))
        );
      }

      notifySuccess("Đã xác nhận lịch", "Người gán đã được thông báo.");
      fetchData();
    } catch (e) {
      notifyError(e, "Không xác nhận được lịch");
    } finally {
      setConfirming(false);
    }
  };

  const handleRejectTrip = async (schedule: any, reason: string) => {
    setUpdating(true);
    try {
      const meta = schedule.metadata || {};
      const newMeta = {
        ...meta,
        driver_rejected_at: new Date().toISOString(),
        driver_rejected_reason: reason,
        driver_rejected_by: profile?.id,
      };

      // Clear driver_id + lưu lý do từ chối vào metadata, trả lịch về pending để coordinator xử lý
      const { error } = await supabase.from('schedules').update({
        driver_id: null,
        metadata: newMeta,
      }).eq('id', schedule.id);
      if (error) throw error;

      // Thông báo cho bộ phận điều phối
      if (coordinatorTargets.length > 0) {
        await supabase.from('notifications').insert(
          coordinatorTargets.map((target: any) => ({
            user_id: target.id,
            title: "Lái xe từ chối lịch",
            content: `Tài xế ${profile?.full_name} từ chối chuyến "${schedule.title}". Lý do: ${reason}. Vui lòng điều phối lại.`,
            link: "/dashboard/schedule"
          }))
        );
      }

      notifySuccess("Đã từ chối lịch", "Bộ phận điều phối đã được thông báo.");
      setSelectedRejectSchedule(null);
      fetchData();
    } catch (e) {
      notifyError(e, "Không từ chối được lịch");
    } finally {
      setUpdating(false);
    }
  };

  const handleEndTrip = async () => {
    setUpdating(true);
    try {
      const schedule = selectedEndSchedule;
      const meta = schedule.metadata || {};
      const actualEnd = new Date();
      const newMeta = {
        ...meta,
        trip_ended_at: actualEnd.toISOString(),
        actual_end_time: actualEnd.toISOString(),
      };

      // Giữ nguyên end_time đăng ký để bảo toàn timeline; status='completed' đã tự giải phóng tài nguyên
      const { error } = await supabase.from('schedules').update({
        status: 'completed',
        metadata: newMeta
      }).eq('id', schedule.id);

      if (error) throw error;

      notifySuccess("Đã hoàn thành chuyến đi");
      setIsEndOpen(false);

      // Kiểm tra lệch giờ kết thúc
      const scheduledEnd = new Date(schedule.end_time);
      const endDeviationMinutes = Math.round((actualEnd.getTime() - scheduledEnd.getTime()) / 60000);
      const END_THRESHOLD = 30;

      if (Math.abs(endDeviationMinutes) >= END_THRESHOLD && coordinatorTargets.length > 0) {
        const endLabel = endDeviationMinutes > 0
          ? `kết thúc muộn ${endDeviationMinutes} phút (dự kiến ${scheduledEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`
          : `kết thúc sớm ${Math.abs(endDeviationMinutes)} phút (dự kiến ${scheduledEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`;
        await supabase.from('notifications').insert(
          coordinatorTargets.map((target: any) => ({
            user_id: target.id,
            title: `🚗 Quyết toán xe + Lệch lịch: ${endDeviationMinutes > 0 ? 'Trễ lịch' : 'Về sớm'}`,
            content: `Tài xế ${profile?.full_name} đã ${endLabel} cho chuyến "${schedule.title}".`,
            link: '/dashboard/schedule'
          }))
        );
      }

      fetchData();
    } catch (e) {
      notifyError(e, "Không kết thúc được chuyến");
    } finally {
      setUpdating(false);
    }
  };

  const handleReportIssue = async () => {
    if (!issueText.trim()) return;
    setUpdating(true);
    try {
      const schedule = selectedIssueSchedule;
      const meta = schedule.metadata || {};
      const newMeta = {
        ...meta,
        vehicle_issue: issueText
      };

      const { error } = await supabase.from('schedules').update({
        metadata: newMeta
      }).eq('id', schedule.id);

      if (error) throw error;

      // Đổi trạng thái xe sang bảo trì nếu gặp lỗi nghiêm trọng (tùy chọn)
      if (schedule.vehicle_id) {
        await supabase.from('vehicles').update({ status: 'maintenance' }).eq('id', schedule.vehicle_id);
      }

      // Thông báo cho bộ phận điều phối (lấy từ cache shared)
      if (coordinatorTargets.length > 0) {
        await supabase.from('notifications').insert(
          coordinatorTargets.map((target: any) => ({
            user_id: target.id,
            title: "⚠️ Sự cố phương tiện 🚗",
            content: `Tài xế ${profile?.full_name} báo cáo sự cố xe ${(schedule.vehicle as any)?.plate_number || ""}: ${issueText}`,
            link: "/dashboard/schedule"
          }))
        );
      }

      notifySuccess(
        "Đã báo cáo sự cố",
        "Xe đã chuyển sang trạng thái bảo trì và bộ phận điều phối đã được thông báo."
      );
      setIsIssueOpen(false);
      setIssueText("");
      fetchData();
    } catch (e) {
      notifyError(e, "Không gửi được báo cáo sự cố");
    } finally {
      setUpdating(false);
    }
  };

  const activeTrip = myTrips.find(s => s.status === 'in_progress');
  const driverStatus = activeTrip ? "Di chuyển" : "Sẵn sàng";

  return (
    <div className="space-y-8 animate-fade-in-up">

      <DriverStatsGrid
        totalTrips={driverStats.totalTrips}
        activeTrip={activeTrip}
        driverStatus={driverStatus}
      />

      {/* Section Header của danh sách */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Car className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 flex-1">Lịch trình của tôi</h3>
        <Badge className="border-none bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary tabular-nums">
          {activeTrips.length}
        </Badge>
      </div>

      {myTrips.length === 0 ? (
        <EmptyState
          icon={<Car className="icon-lg" />}
          title="Chưa có chuyến nào được phân công"
          description="Phòng Tổ chức Tổng hợp sẽ gán xe và thông báo cho bạn khi có lịch mới."
        />
      ) : (
        <div className="space-y-6">
          {/* Chuyến đang hoạt động */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeTrips.map((trip) => (
              <MyTripCard
                key={trip.id}
                trip={trip}
                onConfirm={handleConfirmTrip}
                onStart={(t) => { setSelectedStartSchedule(t); setIsStartOpen(true); }}
                onEnd={(t) => { setSelectedEndSchedule(t); setIsEndOpen(true); }}
                onReportIssue={(t) => { setSelectedIssueSchedule(t); setIsIssueOpen(true); }}
                onReject={(t, reason) => handleRejectTrip(t, reason)}
              />
            ))}
          </div>

          {/* Chuyến đã hoàn thành — gom nhóm */}
          {completedTrips.length > 0 && (
            <Collapsible defaultOpen={false} className="space-y-2">
              <CollapsibleTrigger className={cn(
                "group w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg",
                "bg-slate-50/30 hover:brightness-[0.96] transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
              )}>
                <div className="w-1 h-4 rounded-full shrink-0 bg-slate-300" />
                <CheckCircle2 className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-xs font-bold tracking-tight text-slate-400">Đã hoàn thành</span>
                <Badge className="h-4.5 min-w-4.5 rounded-full border-0 px-1.5 text-[9px] font-extrabold bg-slate-100 text-slate-500 leading-none flex items-center justify-center">
                  {completedTrips.length}
                </Badge>
                <ChevronDown className="ml-auto w-3 h-3 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1.5">
                  {completedTrips.map((trip) => (
                    <MyTripCard
                      key={trip.id}
                      trip={trip}
                      onConfirm={handleConfirmTrip}
                      onStart={(t) => { setSelectedStartSchedule(t); setIsStartOpen(true); }}
                      onEnd={(t) => { setSelectedEndSchedule(t); setIsEndOpen(true); }}
                      onReportIssue={(t) => { setSelectedIssueSchedule(t); setIsIssueOpen(true); }}
                      onReject={(t, reason) => handleRejectTrip(t, reason)}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Xe khác đang hoạt động */}
      {otherTrips.length > 0 && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <Navigation className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <h3 className="text-sm font-semibold text-slate-500">Xe khác đang hoạt động</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {otherTrips.map(trip => {
              const hasStarted = !!trip.metadata?.trip_started_at;
              const hasEnded = !!trip.metadata?.trip_ended_at;
              const driverName = trip.driver?.full_name
                || trip.participants?.find((p: any) => p.role === 'driver')?.profile?.full_name
                || "Lái xe";
              const startDt = new Date(trip.start_time);
              const endDt = new Date(trip.end_time);
              const fmtShort = (d: Date) => d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

              const statusChip = hasStarted && !hasEnded
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : hasEnded
                  ? "bg-slate-100 text-slate-500 border border-slate-200"
                  : "bg-amber-50 text-amber-700 border border-amber-100";

              return (
                <div 
                  key={trip.id} 
                  className="flex items-start gap-3 bg-white rounded-2xl border border-slate-100 px-4 py-3.5 transition-all hover:border-slate-200 hover:shadow-sm"
                >
                  <Avatar className="w-9 h-9 shrink-0 border-2 border-white shadow-sm mt-0.5">
                    <AvatarImage src={trip.driver?.avatar_url} />
                    <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-700">
                      {driverName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-bold text-slate-800 whitespace-nowrap">{driverName}</p>
                        <Badge variant="outline" className="shrink-0 rounded px-1 py-0 text-[10px] font-medium text-slate-400">
                          {(trip.vehicle as any)?.plate_number}
                        </Badge>
                      </div>
                      <Badge className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium ${statusChip}`}>
                        {hasStarted && !hasEnded ? "Đang chạy" : hasEnded ? "Hoàn thành" : "Chờ khởi hành"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-snug">{trip.title}</p>
                    <p className="text-[10px] font-semibold text-slate-400 tabular-nums">
                      🕐 {fmtShort(startDt)} – {fmtShort(endDt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog: Bắt đầu chuyến */}
      <StartTripDialog
        isOpen={isStartOpen}
        setIsOpen={setIsStartOpen}
        updating={updating}
        onConfirm={handleStartTrip}
      />

      {/* Dialog: Kết thúc chuyến */}
      <EndTripDialog
        isOpen={isEndOpen}
        setIsOpen={setIsEndOpen}
        selectedSchedule={selectedEndSchedule}
        updating={updating}
        onConfirm={handleEndTrip}
      />

      {/* Dialog: Báo cáo sự cố */}
      <ReportIssueDialog
        isOpen={isIssueOpen}
        setIsOpen={setIsIssueOpen}
        issueText={issueText}
        setIssueText={setIssueText}
        updating={updating}
        onConfirm={handleReportIssue}
      />
    </div>
  );
}
