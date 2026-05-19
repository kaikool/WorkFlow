import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/utils/supabase/client";
import { 
  Car, Clock, User, CheckCircle2, Navigation, AlertTriangle, 
  MapPin, Loader2, Gauge 
} from "lucide-react";

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

  // Lọc chuyến đi được gán xe và tài xế là participant hoặc được gán trực tiếp
  const myTrips = schedules.filter(s => {
    if (s.type !== 'trip' || s.status !== 'approved') return false;
    // Lọc nếu tài xế là một trong các người tham gia chuyến đi
    return s.participants?.some((p: any) => p.profile?.id === profile?.id) || s.vehicle_id;
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

      const { error } = await supabase.from('schedules').update({
        metadata: newMeta
      }).eq('id', schedule.id);

      if (error) throw error;

      toast({ title: "Thành công", description: "Chuyến đi đã chính thức bắt đầu!" });
      setIsStartOpen(false);
      setStartKm("");
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

      const { error } = await supabase.from('schedules').update({
        metadata: newMeta
      }).eq('id', schedule.id);

      if (error) throw error;

      // Thông báo tự động cho Tổ chức Tổng hợp để quyết toán xăng xe
      const { data: tcthStaff } = await supabase.from('profiles').select('id, role, departments(name)');
      const tcthTargets = tcthStaff?.filter(p => (p.departments as any)?.name === 'Tổ chức Tổng hợp' || p.role === 'admin') || [];

      if (tcthTargets.length > 0) {
        await supabase.from('notifications').insert(
          tcthTargets.map(target => ({
            user_id: target.id,
            title: "Quyết toán hành trình xe công 🚗",
            content: `Tài xế ${profile?.full_name} đã kết thúc chuyến "${schedule.title}". Quãng đường di chuyển thực tế: ${actual_distance} KM.`,
            link: "/dashboard/schedule"
          }))
        );
      }

      toast({ title: "Thành công", description: "Đã hoàn thành chuyến đi và cập nhật số Km hành trình." });
      setIsEndOpen(false);
      setEndKm("");
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
      const { data: tcthStaff } = await supabase.from('profiles').select('id, role, departments(name)');
      const tcthTargets = tcthStaff?.filter(p => (p.departments as any)?.name === 'Tổ chức Tổng hợp' || p.role === 'admin') || [];

      if (tcthTargets.length > 0) {
        await supabase.from('notifications').insert(
          tcthTargets.map(target => ({
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
    <div className="space-y-6">
      <div className="flex items-center justify-between pl-1">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Car className="w-4 h-4 text-primary" /> LỊCH TRÌNH DI CHUYỂN CỦA TÔI ({myTrips.length})
        </h3>
      </div>

      {myTrips.length === 0 ? (
        <div className="premium-card p-12 text-center border-none bg-slate-50/50">
          <div className="w-14 h-14 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Car className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-700">Chưa có chuyến đi nào được gán cho bạn hôm nay</p>
          <p className="text-xs text-slate-400 mt-1">Các yêu cầu điều động xe mới của phòng ban sẽ hiển thị ở đây sau khi được duyệt.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {myTrips.map((trip) => {
            const hasStarted = !!trip.metadata?.trip_started_at;
            const hasEnded = !!trip.metadata?.end_km;
            const hasIssue = !!trip.metadata?.vehicle_issue;

            return (
              <div key={trip.id} className="premium-card p-6 border border-slate-100 bg-white hover:shadow-premium-hover transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-5">
                  {/* Trạng thái hành trình */}
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-wider ${
                      hasEnded 
                        ? "bg-slate-100 text-slate-500" 
                        : (hasStarted ? "bg-emerald-50 text-emerald-600 animate-pulse" : "bg-blue-50 text-blue-600")
                    }`}>
                      {hasEnded ? "Đã hoàn thành" : (hasStarted ? "Đang di chuyển" : "Chờ khởi hành")}
                    </span>

                    {hasIssue && (
                      <span className="text-[10px] font-extrabold px-3 py-1.5 rounded-full bg-rose-50 text-rose-600 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> SỰ CỐ XE
                      </span>
                    )}
                  </div>

                  {/* Chi tiết chuyến xe */}
                  <div className="space-y-3">
                    <h4 className="text-base font-bold text-slate-900 leading-snug">{trip.title}</h4>
                    {trip.description && (
                      <p className="text-xs text-slate-500 line-clamp-2">{trip.description}</p>
                    )}
                  </div>

                  {/* Thông tin Phương tiện và Địa điểm */}
                  <div className="space-y-2 bg-slate-50/50 p-4 rounded-2xl">
                    <div className="flex items-center gap-2.5 text-xs font-bold text-slate-700">
                      <Car className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{(trip.vehicle as any)?.name ? `${(trip.vehicle as any).name} (${(trip.vehicle as any).plate_number})` : "Chờ gán xe"}</span>
                    </div>
                    {trip.location && (
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-500">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="line-clamp-1">{trip.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-500">
                      <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{new Date(trip.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(trip.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Hiển thị số KM hành trình đã ghi nhận */}
                  {trip.metadata?.start_km && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-50/30 p-3.5 rounded-xl border border-slate-100/50 text-center">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">KM BẮT ĐẦU</p>
                        <p className="text-sm font-extrabold text-slate-700 flex items-center justify-center gap-1 mt-0.5">
                          <Gauge className="w-3.5 h-3.5 text-slate-400" /> {trip.metadata.start_km} km
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">KM KẾT THÚC</p>
                        <p className="text-sm font-extrabold text-slate-700 flex items-center justify-center gap-1 mt-0.5">
                          {hasEnded ? (
                            <><Gauge className="w-3.5 h-3.5 text-slate-400" /> {trip.metadata.end_km} km</>
                          ) : (
                            <span className="text-slate-400 font-semibold italic text-xs">Chưa ghi nhận</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Nút hành động */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-6 mt-6 border-t border-slate-50">
                  {!hasStarted && (
                    <Button
                      onClick={() => {
                        setSelectedStartSchedule(trip);
                        setIsStartOpen(true);
                      }}
                      className="w-full sm:flex-1 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold h-12 text-xs gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      <Navigation className="w-4 h-4" /> BẮT ĐẦU CHUYẾN
                    </Button>
                  )}

                  {hasStarted && !hasEnded && (
                    <Button
                      onClick={() => {
                        setSelectedEndSchedule(trip);
                        setIsEndOpen(true);
                      }}
                      className="w-full sm:flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold h-12 text-xs gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" /> KẾT THÚC CHUYẾN
                    </Button>
                  )}

                  {!hasEnded && (
                    <Button
                      onClick={() => {
                        setSelectedIssueSchedule(trip);
                        setIsIssueOpen(true);
                      }}
                      variant="ghost"
                      className="w-full sm:w-auto hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-2xl font-bold h-12 px-4 text-xs gap-1.5 transition-colors shrink-0 flex items-center justify-center"
                    >
                      <AlertTriangle className="w-4 h-4" /> BÁO SỰ CỐ
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIALOG KM XUẤT PHÁT */}
      <Dialog open={isStartOpen} onOpenChange={setIsStartOpen}>
        <DialogContent className="rounded-[32px] max-w-sm border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Bắt đầu chuyến đi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase pl-1">Chỉ số KM hiện tại (Xuất phát)</label>
              <Input
                type="number"
                placeholder="Ví dụ: 12050"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                className="h-12 rounded-2xl border-none bg-slate-50 shadow-inner px-5 font-bold text-slate-700 focus-visible:ring-primary"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsStartOpen(false)} className="rounded-xl font-bold">HỦY</Button>
            <Button 
              onClick={handleStartTrip} 
              disabled={updating || !startKm}
              className="bg-slate-900 hover:bg-black rounded-xl font-bold px-6"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "XÁC NHẬN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG KM KẾT THÚC */}
      <Dialog open={isEndOpen} onOpenChange={setIsEndOpen}>
        <DialogContent className="rounded-[32px] max-w-sm border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Kết thúc chuyến đi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase pl-1">Chỉ số KM kết thúc</label>
              <Input
                type="number"
                placeholder={`Phải lớn hơn ${selectedEndSchedule?.metadata?.start_km || 0}`}
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                className="h-12 rounded-2xl border-none bg-slate-50 shadow-inner px-5 font-bold text-slate-700 focus-visible:ring-emerald-500"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsEndOpen(false)} className="rounded-xl font-bold">HỦY</Button>
            <Button 
              onClick={handleEndTrip} 
              disabled={updating || !endKm}
              className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold px-6 shadow-md shadow-emerald-100"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "HOÀN THÀNH CHUYẾN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG BÁO CÁO SỰ CỐ XE */}
      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
        <DialogContent className="rounded-[32px] max-w-sm border-none p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5 shrink-0" /> Báo cáo sự cố xe
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase pl-1">Chi tiết sự cố phát sinh</label>
              <Textarea
                placeholder="Mô tả sự cố gặp phải (Ví dụ: Thủng lốp, hỏng điều hòa, động cơ báo lỗi...)"
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                className="rounded-2xl bg-slate-50 border-none focus-visible:ring-rose-500 text-sm p-4 shadow-inner placeholder:text-slate-400 min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsIssueOpen(false)} className="rounded-xl font-bold">HỦY</Button>
            <Button 
              onClick={handleReportIssue} 
              disabled={updating || !issueText.trim()}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold px-6 shadow-md shadow-rose-100"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "GỬI BÁO CÁO BẢO TRÌ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
