'use client'

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ShieldCheck,
} from "lucide-react";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

import { resolveParticipantIds, checkConflicts } from "./_lib/utils";
import CreateScheduleDialog from "./_components/CreateScheduleDialog";
import ScheduleDetailDialog from "./_components/ScheduleDetailDialog";
import DateNavigator from "./_components/DateNavigator";
import CalendarView from "./_components/CalendarView";
import TcthDashboard from "./_components/TcthDashboard";
import LeaveApprovalDashboard from "./_components/LeaveApprovalDashboard";
import DriverDashboard from "./_components/DriverDashboard";
import { Car } from "lucide-react";

export default function SchedulePage() {
  const supabase = createClient();
  const { toast } = useToast();
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Dữ liệu chính
  const [schedules, setSchedules] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  // State điều hướng
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'all' | 'bgd' | 'dept'>('all');

  // State dialog tạo mới
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    title: "", description: "", location: "", department_id: "",
    type: "meeting", use_room: false, room_id: "",
    use_vehicle: false, vehicle_id: "", requested_vehicle_type: "4 chỗ", participants: []
  });
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);

  // State chọn thành phần tham gia
  const [bgdMode, setBgdMode] = useState<'all' | 'specific' | 'none'>('all');
  const [selectedBGD, setSelectedBGD] = useState<string[]>([]);
  const [deptMode, setDeptMode] = useState<'all' | 'specific' | 'none'>('all');
  const [filterDepts, setFilterDepts] = useState<string[]>([]);
  const [participantMode, setParticipantMode] = useState<'all' | 'manager' | 'staff'>('all');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // State dialog chi tiết
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Tính toán
  const defaultTab = profile?.role === 'driver' ? 'driver-trips' : 'calendar';
  const isTCTH = profile?.role === 'admin' || profile?.departments?.name === 'Tổ chức Tổng hợp';

  // Đếm số đơn nghỉ phép chờ duyệt theo phân cấp lãnh đạo
  const getPendingLeavesCount = () => {
    if (!profile) return 0;
    return schedules.filter(s => {
      if (s.type !== 'leave' || s.status !== 'pending') return false;
      if (profile.role === 'admin' || profile.role === 'hr_officer' || profile.departments?.name === 'Tổ chức Tổng hợp') {
        return true;
      }
      if (profile.role === 'director') {
        return s.creator?.is_department_head === true;
      }
      if (profile.role === 'manager') {
        return s.creator?.department_id === profile.department_id;
      }
      return false;
    }).length;
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
    end: endOfWeek(selectedDate, { weekStartsOn: 1 })
  });

  const isTodaySelected = isSameDay(selectedDate, new Date());
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startLimit = 8 * 60;
  const endLimit = 17 * 60;
  const duration = endLimit - startLimit;
  const isWithinWorkingHours = currentMinutes >= startLimit && currentMinutes <= endLimit;
  const currentTimePercent = isWithinWorkingHours ? ((currentMinutes - startLimit) / duration) * 100 : -1;

  // Kiểm tra xung đột lịch
  const conflicts = useMemo(() => {
    if (!startDate || !endDate) return [];
    const checkIds = resolveParticipantIds({
      selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles
    });
    return checkConflicts({ checkIds, startDate, endDate, startTime, endTime, schedules });
  }, [startDate, endDate, startTime, endTime, selectedParticipants, selectedBGD, bgdMode, deptMode, participantMode, allProfiles, schedules, filterDepts]);

  // Auto-scroll timeline khi chọn tab BGĐ
  useEffect(() => {
    if (filterType === 'bgd' && timelineContainerRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      if (currentHour >= 8 && currentHour <= 17) {
        const totalMinutes = 9 * 60;
        const minutesElapsed = (currentHour - 8) * 60 + currentMinutes;
        const percentElapsed = minutesElapsed / totalMinutes;
        setTimeout(() => {
          if (timelineContainerRef.current) {
            const containerWidth = timelineContainerRef.current.scrollWidth;
            const clientWidth = timelineContainerRef.current.clientWidth;
            const scrollTarget = containerWidth * percentElapsed - clientWidth / 2;
            timelineContainerRef.current.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
          }
        }, 300);
      }
    }
  }, [filterType, loading]);

  // Tự động cập nhật trạng thái online/bận
  useEffect(() => {
    const updatePresenceStatus = async () => {
      if (!profile) return;
      const now = new Date();
      const currentAct = schedules.find(s =>
        s.status === 'approved' &&
        new Date(s.start_time) <= now &&
        new Date(s.end_time) >= now &&
        s.participants?.some((p: any) => p.profile?.id === profile.id)
      );
      let targetStatus = 'online';
      if (currentAct) {
        targetStatus = currentAct.type === 'trip' ? 'on_trip' : 'in_meeting';
      }
      // Luôn cập nhật để đảm bảo trạng thái trở về 'online' sau khi lịch kết thúc
      if (profile.status !== targetStatus) {
        await supabase.from('profiles').update({
          status: targetStatus, last_seen: new Date().toISOString()
        }).eq('id', profile.id);
        setProfile((prev: any) => prev ? { ...prev, status: targetStatus } : prev);
      }
    };
    updatePresenceStatus();
    const interval = setInterval(updatePresenceStatus, 60000);
    return () => clearInterval(interval);
  }, [schedules, profile, supabase]);

  // Fetch dữ liệu
  useEffect(() => { fetchData(); }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*, departments(name)').eq('id', user.id).single();
        setProfile(p);
      }
    } catch (e) { console.error(e); }

    try {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
      // Lấy tất cả lịch có start_time trong tuần HOẶC end_time >= đầu tuần để bắt lịch nhiều ngày chạy qua tuần
      const { data: scheds, error: sError } = await supabase
        .from('schedules')
        .select(`*, creator:profiles(full_name, avatar_url, department_id, is_department_head), room:rooms(name), vehicle:vehicles(name, plate_number), participants:schedule_participants(profile:profiles(id, full_name, avatar_url, role, is_department_head))`)
        .gte('end_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time');
      if (sError) throw sError;
      setSchedules(scheds || []);

      const { data: vData } = await supabase.from('vehicles').select('*');
      setVehicles(vData || []);
      const { data: rData } = await supabase.from('rooms').select('*');
      setRooms(rData || []);
      const { data: pData } = await supabase.from('profiles').select('id, full_name, role, department_id, is_department_head, departments(name)');
      setAllProfiles(pData || []);
      const { data: dData } = await supabase.from('departments').select('*');
      setDepartments(dData || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const { error } = await supabase.from('schedules').update({ status }).eq('id', id);
      if (error) throw error;
      const schedule = schedules.find(s => s.id === id);
      if (schedule?.created_by) {
        await supabase.from('notifications').insert({
          user_id: schedule.created_by,
          title: status === 'approved' ? "Lịch trình Đã Duyệt" : "Lịch trình Từ Chối",
          content: status === 'approved'
            ? `Lịch trình "${schedule.title}" đã được phê duyệt. Chúc bạn có một buổi làm việc hiệu quả.`
            : `Lịch trình "${schedule.title}" không được phê duyệt. Vui lòng kiểm tra lại.`,
          link: "/dashboard/schedule"
        });
      }
      toast({ title: "Thành công", description: `Đã ${status === 'approved' ? 'xác nhận' : 'từ chối'} lịch trình.` });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    }
  };

  const handleAssignVehicle = async (scheduleId: string, vehicleId: string | null) => {
    try {
      const { error } = await supabase.from('schedules').update({ vehicle_id: vehicleId }).eq('id', scheduleId);
      if (error) throw error;
      const schedule = schedules.find(s => s.id === scheduleId);
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (schedule?.created_by) {
        await supabase.from('notifications').insert({
          user_id: schedule.created_by,
          title: vehicleId ? "Đã gán Xe điều động 🚗" : "Đã hủy gán Xe",
          content: vehicleId
            ? `Lịch trình "${schedule.title}" đã được gán xe: ${vehicle?.plate_number} - ${vehicle?.name}.`
            : `Lịch trình "${schedule.title}" đã bị hủy gán xe điều động.`,
          link: "/dashboard/schedule"
        });
      }
      toast({ title: "Thành công", description: vehicleId ? "Đã gán xe cho lịch trình." : "Đã hủy gán xe." });
      setIsDetailOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    }
  };
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lịch trình này?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Thành công', description: 'Đã xóa lịch trình.' });
      setIsDetailOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Lỗi', description: error.message });
    }
  };

  const handleUpdateEndTime = async (id: string, newEndTimeStr: string) => {
    try {
      // Get current schedule to compare and notify
      const schedule = schedules.find(s => s.id === id);
      if (!schedule) return;
      
      const newEndTime = new Date(newEndTimeStr);
      const isEndEarly = newEndTime <= new Date();

      const { error } = await supabase.from('schedules').update({ end_time: newEndTime.toISOString() }).eq('id', id);
      if (error) throw error;

      // Ghi nhận lịch sử / cảnh báo cho những người khác (thông báo)
      if (schedule.participants?.length > 0) {
        const otherParticipantIds = schedule.participants
          .filter((p: any) => p.profile?.id !== profile?.id)
          .map((p: any) => p.profile?.id);
        
        if (otherParticipantIds.length > 0) {
          await supabase.from('notifications').insert(
            otherParticipantIds.map((uid: string) => ({
              user_id: uid,
              title: isEndEarly ? "Lịch trình kết thúc sớm" : "Lịch trình thay đổi thời gian",
              content: `${profile?.full_name || 'Ai đó'} vừa cập nhật thời gian kết thúc của "${schedule.title}" thành ${String(newEndTime.getHours()).padStart(2, '0')}:${String(newEndTime.getMinutes()).padStart(2, '0')} ${String(newEndTime.getDate()).padStart(2, '0')}/${String(newEndTime.getMonth() + 1).padStart(2, '0')}.`,
              link: "/dashboard/schedule"
            }))
          );
        }
      }

      toast({ title: "Thành công", description: "Đã cập nhật thời gian kết thúc." });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    }
  };


  const handleCreateSchedule = async () => {
    if (!newSchedule.title || !startDate || !endDate) {
      toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng điền đầy đủ thông tin bắt buộc." });
      return;
    }
    // Chỉ kiểm tra xung đột khi không phải nghỉ phép
    if (newSchedule.type !== 'leave' && conflicts.length > 0) {
      toast({ variant: "destructive", title: "Trùng lịch trình", description: "Vui lòng điều chỉnh lại thời gian hoặc thành phần tham gia do có người đang bận." });
      return;
    }

    const start = new Date(startDate);
    const [sHour, sMin] = startTime.split(':');
    start.setHours(parseInt(sHour), parseInt(sMin));
    const end = new Date(endDate);
    const [eHour, eMin] = endTime.split(':');
    end.setHours(parseInt(eHour), parseInt(eMin));

    const isLeave = newSchedule.type === 'leave';

    try {
      const { use_vehicle, participants, vehicle_id, ...insertData } = newSchedule;
      const { data: createdSchedule, error } = await supabase.from('schedules').insert({
        ...insertData,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        room_id: (!isLeave && newSchedule.location === 'Chi nhánh' && newSchedule.room_id !== "none") ? newSchedule.room_id : null,
        vehicle_id: null,
        requested_vehicle_type: (!isLeave && use_vehicle) ? newSchedule.requested_vehicle_type : null,
        use_vehicle: !isLeave && use_vehicle,
        created_by: profile?.id,
        department_id: profile?.department_id,
        status: (profile?.role === 'admin' || profile?.departments?.name === 'Tổ chức Tổng hợp') ? 'approved' : 'pending'
      }).select().single();
      if (error) throw error;

      // Nghỉ phép: chỉ thêm chính người tạo làm participant
      // Lịch thường: resolve theo lựa chọn thành phần
      const finalParticipants = isLeave
        ? [profile?.id].filter(Boolean)
        : resolveParticipantIds({ selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles });

      if (finalParticipants.length > 0) {
        await supabase.from('schedule_participants').insert(
          finalParticipants.map(pid => ({ schedule_id: createdSchedule.id, profile_id: pid }))
        );
      }

      if (createdSchedule.status === 'pending') {
        // Nghỉ phép: thông báo cho lãnh đạo phòng + TCTH
        // Lịch thường: thông báo chỉ cho TCTH
        const notifyTargets = isLeave
          ? allProfiles.filter(p =>
              p.departments?.name === 'Tổ chức Tổng hợp' ||
              (p.department_id === profile?.department_id && p.role === 'manager')
            )
          : allProfiles.filter(p => p.departments?.name === 'Tổ chức Tổng hợp');

        if (notifyTargets.length > 0) {
          await supabase.from('notifications').insert(
            notifyTargets.map(user => ({
              user_id: user.id,
              title: isLeave ? "Đơn xin nghỉ phép mới" : "Yêu cầu lịch trình mới",
              content: isLeave
                ? `${profile?.full_name} xin nghỉ phép: ${newSchedule.title}. Vui lòng phê duyệt đơn.`
                : `${profile?.full_name} vừa đăng ký lịch: ${newSchedule.title}. Vui lòng điều phối xe/phòng.`,
              link: "/dashboard/schedule"
            }))
          );
        }
      }

      toast({ title: "Thành công", description: isLeave ? "Đơn nghỉ phép đã được gửi." : "Lịch trình đã được đăng ký." });
      // Reset toàn bộ form về trạng thái mặc định
      setNewSchedule({ title: "", description: "", location: "", department_id: "", type: "meeting", use_room: false, room_id: "", use_vehicle: false, vehicle_id: "", requested_vehicle_type: "4 chỗ", participants: [] });
      setStartDate(new Date());
      setEndDate(new Date());
      setStartTime("08:00");
      setEndTime("09:00");
      setBgdMode('all');
      setSelectedBGD([]);
      setDeptMode('all');
      setFilterDepts([]);
      setParticipantMode('all');
      setSelectedParticipants([]);
      setIsCreateOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    }
  };

  const handleSelectSchedule = (s: any) => {
    setSelectedSchedule(s);
    setIsDetailOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 animate-fade-in-up pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 sm:pt-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Lịch trình</h1>
          <p className="text-[13px] text-slate-500 font-medium">Điều phối lịch họp & công tác</p>
        </div>
        <div className="flex items-center gap-3">
          <CreateScheduleDialog
            isOpen={isCreateOpen} setIsOpen={setIsCreateOpen}
            newSchedule={newSchedule} setNewSchedule={setNewSchedule}
            startDate={startDate} setStartDate={setStartDate}
            endDate={endDate} setEndDate={setEndDate}
            startTime={startTime} setStartTime={setStartTime}
            endTime={endTime} setEndTime={setEndTime}
            isStartOpen={isStartOpen} setIsStartOpen={setIsStartOpen}
            isEndOpen={isEndOpen} setIsEndOpen={setIsEndOpen}
            rooms={rooms} conflicts={conflicts} onSubmit={handleCreateSchedule} toast={toast}
            allProfiles={allProfiles} departments={departments}
            bgdMode={bgdMode} setBgdMode={setBgdMode}
            selectedBGD={selectedBGD} setSelectedBGD={setSelectedBGD}
            deptMode={deptMode} setDeptMode={setDeptMode}
            filterDepts={filterDepts} setFilterDepts={setFilterDepts}
            participantMode={participantMode} setParticipantMode={setParticipantMode}
            selectedParticipants={selectedParticipants} setSelectedParticipants={setSelectedParticipants}
          />
        </div>
      </div>

      {/* Chọn ngày */}
      <DateNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} weekDays={weekDays} />

      {/* Tabs */}
      <Tabs key={defaultTab} defaultValue={defaultTab} className="space-y-8 w-full">
        <TabsList className="bg-slate-100/60 p-1 rounded-xl h-11 w-full flex gap-1">
          <TabsTrigger value="calendar" className="flex-1 rounded-lg py-1.5 font-medium text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
            <CalendarIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
            <span className="hidden sm:inline">Lịch biểu</span>
            <span className="inline sm:hidden">Lịch</span>
          </TabsTrigger>
          {profile?.departments?.name === 'Tổ chức Tổng hợp' && (
            <TabsTrigger value="tcth" className="flex-1 rounded-lg py-1.5 font-medium text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
              <span>Điều phối</span>
              {schedules.filter(s => s.use_vehicle && !s.vehicle_id).length > 0 && (
                <span className="ml-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-orange-500 text-[9px] text-white font-bold shrink-0">
                  {schedules.filter(s => s.use_vehicle && !s.vehicle_id).length}
                </span>
              )}
            </TabsTrigger>
          )}
          {(profile?.role === 'hr_officer' || profile?.role === 'admin' || profile?.departments?.name === 'Tổ chức Tổng hợp' || profile?.role === 'director' || profile?.role === 'manager') && (
            <TabsTrigger value="leave-approval" className="flex-1 rounded-lg py-1.5 font-medium text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm flex items-center justify-center">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
              <span className="hidden sm:inline">Phê duyệt nghỉ phép</span>
              <span className="inline sm:hidden">Duyệt phép</span>
              {getPendingLeavesCount() > 0 && (
                <span className="ml-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-blue-500 text-[9px] text-white font-bold shrink-0">
                  {getPendingLeavesCount()}
                </span>
              )}
            </TabsTrigger>
          )}
          {profile?.role === 'driver' && (
            <TabsTrigger value="driver-trips" className="flex-1 rounded-lg py-1.5 font-medium text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm flex items-center justify-center">
              <Car className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
              <span className="hidden sm:inline">Lịch chạy xe</span>
              <span className="inline sm:hidden">Lịch chạy</span>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="calendar">
          <CalendarView
            loading={loading}
            filterType={filterType} setFilterType={setFilterType}
            schedules={schedules} selectedDate={selectedDate}
            profile={profile} allProfiles={allProfiles} isTCTH={isTCTH}
            timelineContainerRef={timelineContainerRef}
            isTodaySelected={isTodaySelected} currentTimePercent={currentTimePercent}
            startLimit={startLimit} duration={duration}
            onSelectSchedule={handleSelectSchedule}
            onStatusUpdate={handleStatusUpdate}
          />
        </TabsContent>

        {profile?.departments?.name === 'Tổ chức Tổng hợp' && (
          <TabsContent value="tcth">
            <TcthDashboard
              schedules={schedules} vehicles={vehicles} rooms={rooms}
              selectedDate={selectedDate} onSelectSchedule={handleSelectSchedule}
            />
          </TabsContent>
        )}
        {(profile?.role === 'hr_officer' || profile?.role === 'admin' || profile?.departments?.name === 'Tổ chức Tổng hợp' || profile?.role === 'director' || profile?.role === 'manager') && (
          <TabsContent value="leave-approval">
            <LeaveApprovalDashboard
              schedules={schedules}
              profile={profile}
              onStatusUpdate={handleStatusUpdate}
            />
          </TabsContent>
        )}
        {profile?.role === 'driver' && (
          <TabsContent value="driver-trips">
            <DriverDashboard
              schedules={schedules}
              profile={profile}
              fetchData={fetchData}
              toast={toast}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialog chi tiết */}
      <ScheduleDetailDialog
        isOpen={isDetailOpen} setIsOpen={setIsDetailOpen}
        schedule={selectedSchedule} vehicles={vehicles}
        isTCTH={isTCTH} allProfiles={allProfiles}
        currentProfile={profile}
        onAssignVehicle={handleAssignVehicle}
        onUpdateEndTime={handleUpdateEndTime}
      />
    </div>
  );
}
