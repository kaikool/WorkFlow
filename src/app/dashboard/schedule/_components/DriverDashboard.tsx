import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/utils/supabase/client";
import { 
  Car, Clock, User, CheckCircle2, Navigation, AlertTriangle, 
  MapPin, Loader2, Gauge 
} from "lucide-react";
import { canCoordinateSharedResources } from "@/lib/permissions";

interface DriverDashboardProps {
  schedules: any[];
  profile: any;
  fetchData: () => Promise<void>;
  toast: any;
}

export default function DriverDashboard({ schedules, profile, fetchData, toast }: DriverDashboardProps) {
  const supabase = createClient();
  const [updating, setUpdating] = useState(false);

  // Dialog KM xuất phát
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [selectedStartSchedule, setSelectedStartSchedule] = useState<any>(null);
  const [startKm, setStartKm] = useState("");

  // Dialog KM kết thúc
  const [isEndOpen, setIsEndOpen] = useState(false);
  const [selectedEndSchedule, setSelectedEndSchedule] = useState<any>(null);
  const [endKm, setEndKm] = useState("");

  // Dialog Báo cáo sự cố xe
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [selectedIssueSchedule, setSelectedIssueSchedule] = useState<any>(null);
  const [issueText, setIssueText] = useState("");

  // Hiển thị các chuyến được gán cho tài xế (đã duyệt, đang chạy, hoặc đã hoàn thành)
  const myTrips = schedules.filter(s => {
    if (s.type !== 'trip') return false;
    if (!['approved', 'in_progress', 'completed'].includes(s.status)) return false;
    return s.participants?.some((p: any) => p.profile?.id === profile?.id) || s.driver_id === profile?.id;
  });

  // Lọc các chuyến xe khác đang hoạt động (đã duyệt hoặc đang chạy)
  const otherTrips = schedules.filter(s => {
    if (s.type !== 'trip' || (s.status !== 'approved' && s.status !== 'in_progress')) return false;
    return s.driver_id !== profile?.id && !s.participants?.some((p: any) => p.profile?.id === profile?.id) && s.vehicle_id;
  });

  const handleStartTrip = async () => {
    if (!startKm || isNaN(Number(startKm)) || Number(startKm) < 0) {
      toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng nhập số Km xuất phát hợp lệ." });
      return;
    }
    setUpdating(true);
    try {
      const schedule = selectedStartSchedule;
      const meta = schedule.metadata || {};
      const newMeta = {
        ...meta,
        start_km: Number(startKm),
        trip_started_at: new Date().toISOString()
      };

      const actualStart = new Date();

      const { error } = await supabase.from('schedules').update({
        status: 'in_progress',
        start_time: actualStart.toISOString(), // Cập nhật giờ bắt đầu thực tế để hiển thị đúng trên timeline BGĐ
        metadata: newMeta
      }).eq('id', schedule.id);

      if (error) throw error;

      toast({ title: "Thành công", description: "Chuyến đi đã chính thức bắt đầu!" });
      setIsStartOpen(false);
      setStartKm("");

      // Kiểm tra lệch lịch trình và cảnh báo TCTH
      const scheduledStart = new Date(schedule.start_time);
      const deviationMinutes = Math.round((actualStart.getTime() - scheduledStart.getTime()) / 60000);
      const THRESHOLD_MINUTES = 15;

      if (Math.abs(deviationMinutes) >= THRESHOLD_MINUTES) {
        const { data: tcthStaff } = await supabase.from('profiles').select('id, role, departments(name, code)');
        const tcthTargets = tcthStaff?.filter((p: any) => canCoordinateSharedResources(p)) || [];
        if (tcthTargets.length > 0) {
          const label = deviationMinutes > 0
            ? `muộn ${deviationMinutes} phút so với lịch (đăng ký ${scheduledStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`
            : `sớm ${Math.abs(deviationMinutes)} phút so với lịch (đăng ký ${scheduledStart.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`;
          await supabase.from('notifications').insert(
            tcthTargets.map((target: any) => ({
              user_id: target.id,
              title: `⚠️ Lệch lịch trình: ${deviationMinutes > 0 ? 'Xuất phát muộn' : 'Xuất phát sớm'}`,
              content: `Tài xế ${profile?.full_name} bắt đầu chuyến “${schedule.title}” ${label}.`,
              link: '/dashboard/schedule'
            }))
          );
        }
      }

      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Lỗi", description: e.message });
    } finally {
      setUpdating(false);
    }
  };

  const handleEndTrip = async () => {
    const start_km = selectedEndSchedule?.metadata?.start_km || 0;
    if (!endKm || isNaN(Number(endKm)) || Number(endKm) <= start_km) {
      toast({ 
        variant: "destructive", 
        title: "Lỗi", 
        description: `Vui lòng nhập số Km kết thúc lớn hơn số Km xuất phát (${start_km} km).` 
      });
      return;
    }
    setUpdating(true);
    try {
      const schedule = selectedEndSchedule;
      const meta = schedule.metadata || {};
      const actual_distance = Number(endKm) - start_km;
      const newMeta = {
        ...meta,
        end_km: Number(endKm),
        actual_distance,
        trip_ended_at: new Date().toISOString()
      };

      const actualEnd = new Date();

      const { error } = await supabase.from('schedules').update({
        status: 'completed',
        end_time: actualEnd.toISOString(), // Cập nhật giờ kết thúc thực tế để reset conflict và giải phóng xe/người
        metadata: newMeta
      }).eq('id', schedule.id);

      if (error) throw error;

      // Thông báo tự động cho Tổ chức Tổng hợp để quyết toán xăng xe
      const { data: tcthStaff } = await supabase.from('profiles').select('id, role, departments(name, code)');
      const tcthTargets = tcthStaff?.filter((p: any) => canCoordinateSharedResources(p)) || [];

      if (tcthTargets.length > 0) {
        await supabase.from('notifications').insert(
          tcthTargets.map((target: any) => ({
            user_id: target.id,
            title: "Quyết toán hành trình xe công 🚗",
            content: `Tài xế ${profile?.full_name} đã kết thúc chuyến "${schedule.title}". Quãng đường di chuyển thực tế: ${actual_distance} km.`,
            link: "/dashboard/schedule"
          }))
        );
      }

      toast({ title: "Thành công", description: "Hoàn thành chuyến đi và cập nhật số Km hành trình." });
      setIsEndOpen(false);
      setEndKm("");

      // Kiểm tra lệch giờ kết thúc và cảnh báo TCTH
      const scheduledEnd = new Date(schedule.end_time);
      const endDeviationMinutes = Math.round((actualEnd.getTime() - scheduledEnd.getTime()) / 60000);
      const END_THRESHOLD = 30;

      if (Math.abs(endDeviationMinutes) >= END_THRESHOLD) {
        const { data: tcthStaff2 } = await supabase.from('profiles').select('id, role, departments(name, code)');
        const tcthTargets2 = tcthStaff2?.filter((p: any) => canCoordinateSharedResources(p)) || [];
        if (tcthTargets2.length > 0) {
          const endLabel = endDeviationMinutes > 0
            ? `kết thúc muộn ${endDeviationMinutes} phút (dự kiến ${scheduledEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`
            : `kết thúc sớm ${Math.abs(endDeviationMinutes)} phút (dự kiến ${scheduledEnd.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})`;
          await supabase.from('notifications').insert(
            tcthTargets2.map((target: any) => ({
              user_id: target.id,
              title: `🚗 Quyết toán xe + Lệch lịch: ${endDeviationMinutes > 0 ? 'Trễ lịch' : 'Về sớm'}`,
              content: `Tài xế ${profile?.full_name} đã ${endLabel} cho chuyến “${schedule.title}”. Quãng đường thực tế: ${actual_distance} km.`,
              link: '/dashboard/schedule'
            }))
          );
        }
      }

      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Lỗi", description: e.message });
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

      // Thông báo cho TCTH
      const { data: tcthStaff } = await supabase.from('profiles').select('id, role, departments(name, code)');
      const tcthTargets = tcthStaff?.filter((p: any) => canCoordinateSharedResources(p)) || [];
      if (tcthTargets.length > 0) {
        await supabase.from('notifications').insert(
          tcthTargets.map((target: any) => ({
            user_id: target.id,
            title: "⚠️ Sự cố phương tiện 🚗",
            content: `Tài xế ${profile?.full_name} báo cáo sự cố xe ${(schedule.vehicle as any)?.plate_number || ""}: ${issueText}`,
            link: "/dashboard/schedule"
          }))
        );
      }

      toast({ title: "Thành công", description: "Báo cáo sự cố xe đã được gửi và xe đã chuyển sang trạng thái bảo trì." });
      setIsIssueOpen(false);
      setIssueText("");
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Lỗi", description: e.message });
    } finally {
      setUpdating(false);
    }
  };

  const completedTrips = myTrips.filter(s => s.status === 'completed');
  const totalKm = completedTrips.reduce((acc, s) => acc + (s.metadata?.actual_distance || 0), 0);
  const activeTrip = myTrips.find(s => s.status === 'in_progress');
  const driverStatus = activeTrip ? "Đang di chuyển" : "Sẵn sàng nhận lệnh";

  return (
    <div className="space-y-8 animate-fade-in-up">

      {/* Grid Thống kê Premium - Apple HIG Style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Tổng chuyến */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-white hover:shadow-md group flex items-center justify-between">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Tổng chuyến chạy</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{myTrips.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5 text-primary" />
          </div>
        </div>

        {/* Card 2: Tổng Km */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-white hover:shadow-md group flex items-center justify-between">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Quãng đường tích lũy</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {totalKm} <span className="text-sm font-medium text-slate-500">Km</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Gauge className="w-5 h-5 text-amber-600" />
          </div>
        </div>

        {/* Card 3: Trạng thái */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-white hover:shadow-md group flex items-center justify-between">
          <div className="space-y-1.5 min-w-0">
            <p className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Trạng thái hiện tại</p>
            <p className={`text-sm font-bold truncate ${activeTrip ? "text-emerald-600" : "text-primary"}`}>
              {driverStatus}
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${activeTrip ? "bg-emerald-50 animate-pulse" : "bg-slate-100"}`}>
            {activeTrip ? (
              <Navigation className="w-5 h-5 text-emerald-600" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-slate-500" />
            )}
          </div>
        </div>
      </div>

      {/* Section Header của danh sách */}
      <div className="flex items-center gap-2 px-1">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Car className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700 flex-1">Lịch trình của tôi</h3>
        <span className="text-xs font-bold text-primary bg-primary/10 rounded-full px-2.5 py-0.5 tabular-nums">
          {myTrips.length}
        </span>
      </div>

      {myTrips.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <Car className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-700">Chưa có chuyến nào được phân công</p>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
            Phòng Tổ chức Tổng hợp sẽ gán xe và thông báo cho bạn khi có lịch mới.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {myTrips.map((trip) => {
            const hasStarted = trip.status === 'in_progress' || trip.status === 'completed' || !!trip.metadata?.trip_started_at;
            const hasEnded = trip.status === 'completed' || !!trip.metadata?.end_km;
            const hasIssue = !!trip.metadata?.vehicle_issue;
            const startDt = new Date(trip.start_time);
            const endDt = new Date(trip.end_time);
            const fmtDt = (d: Date) => d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            // Xác định đường viền và huy hiệu theo chuẩn Apple HIG
            let borderStyle = "border-l-4 border-l-amber-500 border-slate-100"; // Chờ khởi hành
            let statusBadgeBg = "bg-amber-50 text-amber-700 border-amber-100";
            let statusText = "Chờ khởi hành";
            let statusIcon = <Clock className="w-3.5 h-3.5 shrink-0" />;

            if (hasEnded) {
              borderStyle = "border-l-4 border-l-slate-200 border-slate-100 opacity-80";
              statusBadgeBg = "bg-slate-50 text-slate-500 border-slate-100";
              statusText = "Đã hoàn thành";
              statusIcon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
            } else if (hasStarted) {
              borderStyle = "border-l-4 border-l-emerald-500 border-slate-100 ring-1 ring-emerald-500/10";
              statusBadgeBg = "bg-emerald-50 text-emerald-700 border-emerald-100";
              statusText = "Đang di chuyển";
              statusIcon = <Navigation className="w-3.5 h-3.5 shrink-0" />;
            }

            return (
              <div 
                key={trip.id} 
                className={`bg-white rounded-2xl border ${borderStyle} shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group`}
              >
                {/* Header thanh lịch với status badge */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50 bg-slate-50/20">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusBadgeBg}`}>
                      {statusIcon}
                      {statusText}
                    </span>
                    {hasIssue && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                        <AlertTriangle className="w-3 h-3 shrink-0 animate-pulse" /> Sự cố
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
                    {fmtDt(startDt).split(' ')[1] /* Lấy phần giờ */}
                  </span>
                </div>

                {/* Nội dung chính */}
                <div className="flex flex-col gap-5 px-5 py-5 flex-1">
                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h4 className="text-[15px] font-bold text-slate-900 leading-snug group-hover:text-primary transition-colors">
                      {trip.title}
                    </h4>
                    {trip.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {trip.description}
                      </p>
                    )}
                  </div>

                  {/* Chi tiết hành trình */}
                  <div className="space-y-2.5">
                    {/* Xe & biển số */}
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
                        <Car className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        {(trip.vehicle as any)?.name
                          ? `${(trip.vehicle as any).name} · ${(trip.vehicle as any).plate_number}`
                          : <span className="text-slate-400 font-normal italic">Chờ phân công xe</span>}
                      </span>
                    </div>

                    {/* Điểm đến */}
                    {trip.location && (
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5 border border-slate-100/30">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                        <span className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                          {trip.location}
                        </span>
                      </div>
                    )}

                    {/* Thời gian */}
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5 border border-slate-100/80">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <div className="text-[13px] text-slate-500 space-y-0.5 font-medium">
                        <div><span className="text-slate-400 text-xs font-semibold">Đi:</span> {fmtDt(startDt)}</div>
                        <div><span className="text-slate-400 text-xs font-semibold">Về:</span> {fmtDt(endDt)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Quãng đường Km */}
                  {trip.metadata?.start_km && (
                    <div className="flex items-stretch gap-2.5 pt-2 border-t border-slate-50">
                      <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center border border-slate-100/80">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Xuất phát</p>
                        <p className="text-[13px] font-bold text-slate-700 mt-0.5 tabular-nums">{trip.metadata.start_km} Km</p>
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2 text-center border border-slate-100/80">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kết thúc</p>
                        <p className="text-[13px] font-bold mt-0.5 tabular-nums">
                          {hasEnded
                            ? <span className="text-slate-700">{trip.metadata.end_km} Km</span>
                            : <span className="text-slate-300 font-normal italic text-xs">—</span>}
                        </p>
                      </div>
                      {hasEnded && trip.metadata?.actual_distance != null && (
                        <div className="flex-1 bg-emerald-50/50 rounded-xl px-3 py-2 text-center border border-emerald-100">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Tổng chạy</p>
                          <p className="text-[13px] font-bold text-emerald-700 mt-0.5 tabular-nums">{trip.metadata.actual_distance} Km</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Nút hành động */}
                {!hasEnded && (
                  <div className="flex items-center gap-2 px-5 pb-5 pt-1 bg-slate-50/10">
                    {!hasStarted ? (
                      <Button
                        onClick={() => { setSelectedStartSchedule(trip); setIsStartOpen(true); }}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold min-h-11 text-sm gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
                      >
                        <Navigation className="w-3.5 h-3.5" /> Bắt đầu chuyến
                      </Button>
                    ) : (
                      <Button
                        onClick={() => { setSelectedEndSchedule(trip); setIsEndOpen(true); }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold min-h-11 text-sm gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Kết thúc chuyến
                      </Button>
                    )}
                    <Button
                      onClick={() => { setSelectedIssueSchedule(trip); setIsIssueOpen(true); }}
                      variant="ghost"
                      title="Báo sự cố"
                      className="h-11 w-11 p-0 shrink-0 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all duration-150"
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
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
              const hasEnded = !!trip.metadata?.end_km;
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
                  className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 px-4 py-3.5 transition-all hover:border-slate-200 hover:shadow-sm"
                >
                  <Avatar className="w-9 h-9 shrink-0 border-2 border-white shadow-sm">
                    <AvatarImage src={trip.driver?.avatar_url} />
                    <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-700">
                      {driverName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-slate-800 truncate">{driverName}</p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-semibold bg-slate-50 border border-slate-100 rounded px-1">
                        {(trip.vehicle as any)?.plate_number}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{trip.title}</p>
                    <p className="text-[10px] font-semibold text-slate-400 mt-1 tabular-nums">
                      {fmtShort(startDt)} – {fmtShort(endDt)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${statusChip}`}>
                    {hasStarted && !hasEnded ? "Đang chạy" : hasEnded ? "Hoàn thành" : "Chờ khởi hành"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog: Bắt đầu chuyến */}
      <Dialog open={isStartOpen} onOpenChange={setIsStartOpen}>
        <DialogContent className="rounded-2xl max-w-sm border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogDescription className="sr-only">Nhập chỉ số kilomet hiện tại trước khi bắt đầu chuyến đi.</DialogDescription>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <Navigation className="w-4 h-4 text-slate-700" />
              </div>
              Bắt đầu chuyến đi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-600">Chỉ số Km hiện tại (Xuất phát)</label>
              <Input
                type="number"
                placeholder="Ví dụ: 12050"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm focus-visible:ring-1 focus-visible:ring-primary/30 px-4 text-slate-700"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsStartOpen(false)} className="rounded-xl font-semibold text-slate-500 min-h-11 px-5 active:scale-95 transition-all text-sm hover:bg-slate-100">
              Hủy
            </Button>
            <Button onClick={handleStartTrip} disabled={updating || !startKm} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold px-6 min-h-11 active:scale-95 transition-all text-sm shadow-sm">
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Kết thúc chuyến */}
      <Dialog open={isEndOpen} onOpenChange={setIsEndOpen}>
        <DialogContent className="rounded-2xl max-w-sm border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogDescription className="sr-only">Nhập chỉ số kilomet kết thúc để hoàn thành chuyến đi.</DialogDescription>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              Kết thúc chuyến đi
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-600">Chỉ số Km kết thúc</label>
              <Input
                type="number"
                placeholder={`Phải lớn hơn ${selectedEndSchedule?.metadata?.start_km || 0}`}
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                className="min-h-11 bg-slate-50 border-none rounded-xl font-medium text-sm focus-visible:ring-1 focus-visible:ring-emerald-600/30 px-4 text-slate-700"
              />
              {selectedEndSchedule?.metadata?.start_km && (
                <p className="text-xs text-slate-400 pl-1">Xuất phát đã ghi: <span className="font-bold text-slate-600">{selectedEndSchedule.metadata.start_km} Km</span></p>
              )}
            </div>
          </div>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsEndOpen(false)} className="rounded-xl font-semibold text-slate-500 min-h-11 px-5 active:scale-95 transition-all text-sm hover:bg-slate-100">
              Hủy
            </Button>
            <Button onClick={handleEndTrip} disabled={updating || !endKm} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold px-6 min-h-11 active:scale-95 transition-all text-sm shadow-sm">
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Hoàn thành chuyến"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Báo cáo sự cố */}
      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
        <DialogContent className="rounded-2xl max-w-sm border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogDescription className="sr-only">Mô tả sự cố phương tiện phát sinh để gửi thông báo bảo trì.</DialogDescription>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              Báo cáo sự cố xe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-600">Mô tả chi tiết sự cố</label>
              <Textarea
                placeholder="Ví dụ: Thủng lốp, hỏng điều hòa, động cơ báo lỗi..."
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                className="bg-slate-50 border-none rounded-xl font-medium text-sm focus-visible:ring-1 focus-visible:ring-red-500/30 p-4 min-h-[100px] placeholder:text-slate-400"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsIssueOpen(false)} className="rounded-xl font-semibold text-slate-500 min-h-11 px-5 active:scale-95 transition-all text-sm hover:bg-slate-100">
              Hủy
            </Button>
            <Button onClick={handleReportIssue} disabled={updating || !issueText.trim()} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold px-6 min-h-11 active:scale-95 transition-all text-sm shadow-sm">
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gửi báo cáo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

