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
import { hasTCTHPermission } from "@/lib/permissions";

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
      toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng nhập số KM xuất phát hợp lệ." });
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
        const tcthTargets = tcthStaff?.filter((p: any) => hasTCTHPermission(p)) || [];
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
        description: `Vui lòng nhập số KM kết thúc lớn hơn số KM xuất phát (${start_km} km).` 
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
      const tcthTargets = tcthStaff?.filter((p: any) => hasTCTHPermission(p)) || [];

      if (tcthTargets.length > 0) {
        await supabase.from('notifications').insert(
          tcthTargets.map((target: any) => ({
            user_id: target.id,
            title: "Quyết toán hành trình xe công 🚗",
            content: `Tài xế ${profile?.full_name} đã kết thúc chuyến "${schedule.title}". Quãng đường di chuyển thực tế: ${actual_distance} KM.`,
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
        const tcthTargets2 = tcthStaff2?.filter((p: any) => hasTCTHPermission(p)) || [];
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
      const tcthTargets = tcthStaff?.filter((p: any) => hasTCTHPermission(p)) || [];

      if (tcthTargets.length > 0) {
        await supabase.from('notifications').insert(
          tcthTargets.map((target: any) => ({
            user_id: target.id,
            title: "Báo cáo sự cố phương tiện khẩn cấp ⚠️",
            content: `Tài xế ${profile?.full_name} báo cáo sự cố xe "${(schedule.vehicle as any)?.name}": "${issueText}"`,
            link: "/dashboard/schedule"
          }))
        );
      }

      toast({ title: "Đã gửi báo cáo", description: "Phòng Tổ chức Tổng hợp đã được thông báo để xử lý." });
      setIsIssueOpen(false);
      setIssueText("");
      fetchData();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Lỗi", description: e.message });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <Car className="w-3.5 h-3.5" /> Lịch trình di chuyển của tôi
          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">{myTrips.length}</span>
        </h3>
      </div>

      {myTrips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center bg-slate-50/50">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Car className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-700">Chưa có chuyến đi nào được gán cho bạn</p>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">Các yêu cầu điều động xe sẽ hiển thị ở đây sau khi phòng Tổ chức Tổng hợp duyệt và gán xe.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myTrips.map((trip) => {
            const hasStarted = trip.status === 'in_progress' || trip.status === 'completed' || !!trip.metadata?.trip_started_at;
            const hasEnded = trip.status === 'completed' || !!trip.metadata?.end_km;
            const hasIssue = !!trip.metadata?.vehicle_issue;
            const startDt = new Date(trip.start_time);
            const endDt = new Date(trip.end_time);
            const fmtDt = (d: Date) => d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            return (
              <div key={trip.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
                {/* Status bar */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-50">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full ${
                    hasEnded
                      ? "bg-slate-100 text-slate-500"
                      : hasStarted
                        ? "bg-emerald-50 text-emerald-600 animate-pulse"
                        : "bg-blue-50 text-blue-600"
                  }`}>
                    {hasEnded ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : hasStarted ? (
                      <Navigation className="w-3 h-3" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                    {hasEnded ? "Đã hoàn thành" : hasStarted ? "Đang di chuyển" : "Chờ khởi hành"}
                  </span>

                  {hasIssue && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full bg-rose-50 text-rose-600">
                      <AlertTriangle className="w-3 h-3 shrink-0" /> Sự cố xe
                    </span>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-col gap-3 px-5 py-4 flex-1">
                  {/* Title */}
                  <div>
                    <h4 className="text-[15px] font-bold text-slate-900 leading-snug">{trip.title}</h4>
                    {trip.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">{trip.description}</p>
                    )}
                  </div>

                  {/* Info box */}
                  <div className="bg-slate-50 rounded-xl px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2.5">
                      <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-sm font-semibold text-slate-700">
                        {(trip.vehicle as any)?.name
                          ? `${(trip.vehicle as any).name} · ${(trip.vehicle as any).plate_number}`
                          : "Chờ gán xe"}
                      </span>
                    </div>
                    {trip.location && (
                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-xs font-medium text-slate-500 line-clamp-2">{trip.location}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="text-xs font-medium text-slate-500 space-y-0.5">
                        <div><span className="text-slate-400 font-semibold">Đi:</span> {fmtDt(startDt)}</div>
                        <div><span className="text-slate-400 font-semibold">Về:</span> {fmtDt(endDt)}</div>
                      </div>
                    </div>
                  </div>

                  {/* KM metrics */}
                  {trip.metadata?.start_km && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Km xuất phát</p>
                        <p className="text-sm font-bold text-slate-700 flex items-center justify-center gap-1 mt-1">
                          <Gauge className="w-3 h-3 text-slate-400" /> {trip.metadata.start_km}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-center">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Km kết thúc</p>
                        <p className="text-sm font-bold text-slate-700 flex items-center justify-center gap-1 mt-1">
                          {hasEnded ? (
                            <><Gauge className="w-3 h-3 text-slate-400" /> {trip.metadata.end_km}</>
                          ) : (
                            <span className="text-slate-400 font-medium italic text-xs">Chưa ghi</span>
                          )}
                        </p>
                      </div>
                      {hasEnded && trip.metadata?.actual_distance != null && (
                        <div className="col-span-2 bg-emerald-50 rounded-xl px-3 py-2.5 text-center">
                          <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Tổng quãng đường</p>
                          <p className="text-sm font-bold text-emerald-700 mt-1">{trip.metadata.actual_distance} km</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action footer */}
                {!hasEnded && (
                  <div className="flex items-center gap-2 px-5 pb-4 pt-3 border-t border-slate-50">
                    {!hasStarted ? (
                      <Button
                        onClick={() => { setSelectedStartSchedule(trip); setIsStartOpen(true); }}
                        className="flex-1 bg-slate-900 hover:bg-black text-white rounded-xl font-bold h-10 text-xs gap-1.5 shadow-sm active:scale-95 transition-all"
                      >
                        <Navigation className="w-3.5 h-3.5" /> Bắt đầu chuyến
                      </Button>
                    ) : (
                      <Button
                        onClick={() => { setSelectedEndSchedule(trip); setIsEndOpen(true); }}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold h-10 text-xs gap-1.5 shadow-sm active:scale-95 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Kết thúc chuyến
                      </Button>
                    )}
                    <Button
                      onClick={() => { setSelectedIssueSchedule(trip); setIsIssueOpen(true); }}
                      variant="ghost"
                      title="Báo sự cố"
                      className="hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-xl h-10 w-10 p-0 shrink-0 flex items-center justify-center transition-colors"
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

      {/* Các chuyến xe khác */}
      {otherTrips.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500 shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Các xe khác đang hoạt động</h3>
              <p className="text-xs text-slate-400">Thông tin lộ trình của đội xe</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {otherTrips.map(trip => {
              const hasStarted = !!trip.metadata?.trip_started_at;
              const hasEnded = !!trip.metadata?.end_km;
              const driverName = trip.driver?.full_name
                || trip.participants?.find((p: any) => p.profile?.role === 'driver')?.profile?.full_name
                || "Lái xe khác";
              const startDt = new Date(trip.start_time);
              const endDt = new Date(trip.end_time);
              const fmtShort = (d: Date) => d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

              return (
                <div key={trip.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm p-4 flex flex-col gap-3">
                  {/* Driver row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="w-7 h-7 shrink-0 border border-slate-100">
                        <AvatarImage src={trip.driver?.avatar_url} />
                        <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-600">{driverName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-700 truncate">{driverName}</p>
                        <p className="text-[10px] text-slate-400 truncate">{(trip.vehicle as any)?.plate_number || "Không rõ biển số"}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full ml-2 ${
                      hasStarted && !hasEnded ? "bg-emerald-50 text-emerald-600" : hasEnded ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-600"
                    }`}>
                      {hasStarted && !hasEnded ? "Đang chạy" : hasEnded ? "Xong" : "Chờ đi"}
                    </span>
                  </div>

                  {/* Trip info */}
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-slate-800 line-clamp-1">{trip.title}</p>
                    {trip.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="w-3 h-3 shrink-0 text-slate-400" />
                        <span className="line-clamp-1">{trip.location}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-1.5 text-xs text-slate-500">
                      <Clock className="w-3 h-3 shrink-0 text-slate-400 mt-0.5" />
                      <div className="space-y-0.5">
                        <div><span className="font-semibold text-slate-400">Đi:</span> {fmtShort(startDt)}</div>
                        <div><span className="font-semibold text-slate-400">Về:</span> {fmtShort(endDt)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialog km xuất phát */}
      <Dialog open={isStartOpen} onOpenChange={setIsStartOpen}>
        <DialogContent className="rounded-2xl max-w-sm border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogDescription className="sr-only">Nhập chỉ số kilomet hiện tại trước khi bắt đầu chuyến đi.</DialogDescription>
            <DialogTitle className="text-base font-bold text-slate-900">Bắt đầu chuyến đi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chỉ số KM hiện tại (Xuất phát)</label>
              <Input
                type="number"
                placeholder="Ví dụ: 12050"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                className="h-11 rounded-xl border-none bg-slate-50 px-4 font-bold text-slate-700 focus-visible:ring-primary"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsStartOpen(false)} className="rounded-xl font-semibold text-slate-500">Hủy</Button>
            <Button
              onClick={handleStartTrip}
              disabled={updating || !startKm}
              className="bg-slate-900 hover:bg-black rounded-xl font-bold px-6"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog km kết thúc */}
      <Dialog open={isEndOpen} onOpenChange={setIsEndOpen}>
        <DialogContent className="rounded-2xl max-w-sm border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogDescription className="sr-only">Nhập chỉ số kilomet kết thúc để hoàn thành chuyến đi.</DialogDescription>
            <DialogTitle className="text-base font-bold text-slate-900">Kết thúc chuyến đi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chỉ số KM kết thúc</label>
              <Input
                type="number"
                placeholder={`Phải lớn hơn ${selectedEndSchedule?.metadata?.start_km || 0}`}
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                className="h-11 rounded-xl border-none bg-slate-50 px-4 font-bold text-slate-700 focus-visible:ring-emerald-500"
              />
              {selectedEndSchedule?.metadata?.start_km && (
                <p className="text-xs text-slate-400 pl-1">Km xuất phát đã ghi nhận: <span className="font-bold text-slate-600">{selectedEndSchedule.metadata.start_km} km</span></p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsEndOpen(false)} className="rounded-xl font-semibold text-slate-500">Hủy</Button>
            <Button
              onClick={handleEndTrip}
              disabled={updating || !endKm}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold px-6 shadow-sm shadow-emerald-100"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Hoàn thành chuyến"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog báo cáo sự cố xe */}
      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
        <DialogContent className="rounded-2xl max-w-sm border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogDescription className="sr-only">Mô tả sự cố phương tiện phát sinh để gửi thông báo bảo trì.</DialogDescription>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Báo cáo sự cố xe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mô tả chi tiết sự cố</label>
              <Textarea
                placeholder="Ví dụ: Thủng lốp, hỏng điều hòa, động cơ báo lỗi..."
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                className="rounded-xl bg-slate-50 border-none focus-visible:ring-rose-400 text-sm p-4 min-h-[100px] placeholder:text-slate-400"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsIssueOpen(false)} className="rounded-xl font-semibold text-slate-500">Hủy</Button>
            <Button
              onClick={handleReportIssue}
              disabled={updating || !issueText.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold px-6 shadow-sm shadow-rose-100"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gửi báo cáo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
