import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { addDays, endOfDay, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { resolveParticipantIds, checkConflicts, checkResourceConflicts } from "../_lib/utils";
import { canApproveLeave, canCoordinateSharedResources, canUseDriverWorkspace } from "@/lib/permissions";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { createSchedule as createScheduleHelper } from "../_lib/createSchedule";
import { updateScheduleAction } from "../_lib/updateSchedule";
import { fetchScheduleData } from "../_lib/fetchScheduleData";

export function useSchedule() {
  const supabase = createClient();
  const { toast } = useToast();
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();

  // Auto-open create dialog when navigated with ?type=leave (e.g. from HR dashboard)
  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'leave') {
      setNewSchedule(prev => ({ ...prev, type: 'leave' }));
      setIsCreateOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    type: "trip", use_room: false, room_id: "",
    use_vehicle: false, vehicle_id: "", requested_vehicle_type: "4 chỗ", participants: [],
    target_profile_id: ""
  });
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);

  // State chọn thành phần tham gia
  const [bgdMode, setBgdMode] = useState<'all' | 'specific' | 'none'>('none');
  const [selectedBGD, setSelectedBGD] = useState<string[]>([]);
  const [deptMode, setDeptMode] = useState<'all' | 'specific' | 'none'>('none');
  const [filterDepts, setFilterDepts] = useState<string[]>([]);
  const [participantMode, setParticipantMode] = useState<'all' | 'manager' | 'staff'>('staff');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // State dialog chi tiết
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Tính toán
  const defaultTab = canUseDriverWorkspace(profile) ? 'driver-trips' : 'calendar';
  const pendingVehicleCount = schedules.filter(s => s.use_vehicle && !s.vehicle_id).length;
  const pendingVehicleBadge = pendingVehicleCount > 9 ? "9+" : pendingVehicleCount;
  const canCoordinateResources = canCoordinateSharedResources(profile);

  // Đếm số đơn nghỉ phép chờ duyệt theo phân cấp lãnh đạo
  const getPendingLeavesCount = () => {
    if (!profile) return 0;
    return schedules.filter(s => {
      if (s.type !== 'leave' || s.status !== 'pending') return false;
      return canApproveLeave(profile, s);
    }).length;
  };

  const pendingLeavesCount = getPendingLeavesCount();
  const pendingLeavesBadge = pendingLeavesCount > 9 ? "9+" : pendingLeavesCount;

  const getDepartmentName = (user: any) => {
    const dept = user?.departments;
    return Array.isArray(dept) ? dept[0]?.name : dept?.name;
  };

  const isScheduleApprover = (user: any) => canCoordinateSharedResources(user);

  const sendNotifications = async (rows: any[]) => {
    const uniqueRows = rows.filter((row, index, arr) =>
      row?.user_id && arr.findIndex(item =>
        item.user_id === row.user_id &&
        item.title === row.title &&
        item.content === row.content &&
        item.link === row.link
      ) === index
    );
    if (uniqueRows.length === 0) return;

    const { error } = await supabase.from('notifications').insert(uniqueRows);
    if (error) {
      console.error('Notification insert failed:', error);
      toast({
        variant: "destructive",
        title: "Chưa gửi được thông báo",
        description: "Bảng notifications đang thiếu quyền INSERT. Cần chạy cập nhật RLS trong schema.sql."
      });
    }
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
    const finalCheckIds = Array.from(new Set([profile?.id, ...checkIds].filter(Boolean)));
    return checkConflicts({ checkIds: finalCheckIds, startDate, endDate, startTime, endTime, schedules });
  }, [startDate, endDate, startTime, endTime, selectedParticipants, selectedBGD, bgdMode, deptMode, participantMode, allProfiles, schedules, filterDepts, profile?.id]);

  const resourceConflicts = useMemo(() => {
    if (!startDate || !endDate || newSchedule.type === 'leave') return [];
    const start = new Date(startDate);
    const [sHour, sMin] = startTime.split(':');
    start.setHours(parseInt(sHour), parseInt(sMin));
    const end = new Date(endDate);
    const [eHour, eMin] = endTime.split(':');
    end.setHours(parseInt(eHour), parseInt(eMin));

    return checkResourceConflicts({
      roomId: newSchedule.location === 'Chi nhánh' ? newSchedule.room_id : null,
      start,
      end,
      schedules
    });
  }, [startDate, endDate, startTime, endTime, newSchedule.type, newSchedule.location, newSchedule.room_id, schedules]);

  useEffect(() => {
    if (profile?.department_id && filterDepts.length === 0) {
      setFilterDepts([profile.department_id]);
    }
  }, [profile?.department_id, filterDepts.length]);

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

  // Fetch dữ liệu và kích hoạt Real-time đồng bộ (có debounce để giảm spam)
  useEffect(() => {
    setMounted(true);
    fetchData();

    let refetchTimer: any = null;
    const scheduleRefetch = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => { fetchData(); }, 600);
    };

    const channel = supabase
      .channel('schedule_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_participants' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await fetchScheduleData(supabase, selectedDate, profile);
      setProfile(result.profile);
      if (result.profile?.department_id && filterDepts.length === 0) {
        setFilterDepts([result.profile.department_id]);
      }
      setSchedules(result.schedules);
      setVehicles(result.vehicles);
      setRooms(result.rooms);
      setAllProfiles(result.allProfiles);
      setDepartments(result.departments);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const findParticipantConflicts = async (params: {
    participantIds: string[];
    start: Date;
    end: Date;
    ignoreScheduleId?: string;
  }) => {
    const participantIds = Array.from(new Set(params.participantIds.filter(Boolean)));
    if (participantIds.length === 0) return [];

    const { data: rpcData, error: rpcError } = await supabase.rpc('check_schedule_participant_conflicts', {
      p_participant_ids: participantIds,
      p_start: params.start.toISOString(),
      p_end: params.end.toISOString(),
      p_ignore_schedule_id: params.ignoreScheduleId || null
    });

    if (!rpcError && rpcData) {
      return rpcData.map((row: any) => {
        const sStart = new Date(row.start_time).toLocaleString('vi-VN');
        const sEnd = new Date(row.end_time).toLocaleString('vi-VN');
        const suffix = row.status === 'pending' ? ' (Chờ duyệt)' : '';
        return `${row.full_name || 'Người tham gia'} đang bận${suffix}: ${row.title} (${sStart} - ${sEnd})`;
      });
    }

    if (rpcError) {
      console.warn('Conflict RPC unavailable, falling back to RLS-limited query:', rpcError);
    }

    const { data, error } = await supabase
      .from('schedules')
      .select(`id, title, start_time, end_time, status, participants:schedule_participants(profile:profiles(id, full_name))`)
      .neq('status', 'rejected')
      .lt('start_time', params.end.toISOString())
      .gt('end_time', params.start.toISOString());

    if (error) throw error;

    return (data || []).flatMap((schedule: any) => {
      if (schedule.id === params.ignoreScheduleId) return [];

      return (schedule.participants || [])
        .filter((participant: any) => participantIds.includes(participant.profile?.id))
        .map((participant: any) => {
          const sStart = new Date(schedule.start_time).toLocaleString('vi-VN');
          const sEnd = new Date(schedule.end_time).toLocaleString('vi-VN');
          const suffix = schedule.status === 'pending' ? ' (Chờ duyệt)' : '';
          return `${participant.profile?.full_name || 'Người tham gia'} đang bận${suffix}: ${schedule.title} (${sStart} - ${sEnd})`;
        });
    });
  };

  // Handlers
  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      const schedule = schedules.find(s => s.id === id);
      if (status === 'approved' && schedule?.use_vehicle && !schedule?.vehicle_id) {
        toast({ variant: "destructive", title: "Cần gán xe trước", description: "Lịch trình có yêu cầu xe phải được điều phối xe trước khi duyệt." });
        return;
      }

      const { error } = await supabase.from('schedules').update({ status }).eq('id', id);
      if (error) throw error;
      if (schedule?.created_by && schedule.created_by !== profile?.id) {
        await sendNotifications([{
          user_id: schedule.created_by,
          title: status === 'approved' ? "Lịch trình Đã Duyệt" : "Lịch trình Từ Chối",
          content: status === 'approved'
            ? `Lịch trình "${schedule.title}" đã được phê duyệt. Chúc bạn có một buổi làm việc hiệu quả.`
            : `Lịch trình "${schedule.title}" không được phê duyệt. Vui lòng kiểm tra lại.`,
          link: "/dashboard/schedule"
        }]);
      }
      toast({ title: "Thành công", description: `Đã ${status === 'approved' ? 'xác nhận' : 'từ chối'} lịch trình.` });
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    }
  };

  const handleAssignVehicle = async (scheduleId: string, vehicleId: string | null) => {
    try {
      const schedule = schedules.find(s => s.id === scheduleId);
      const vehicleConflicts = vehicleId && schedule ? checkResourceConflicts({
        vehicleId,
        start: new Date(schedule.start_time),
        end: new Date(schedule.end_time),
        schedules,
        ignoreScheduleId: scheduleId
      }) : [];

      // CHẶN cứng khi xe đã được gán cho lịch khác trùng giờ — không cho phép vượt
      if (vehicleConflicts.length > 0) {
        toast({ variant: "destructive", title: "Xe đã có lịch trùng giờ", description: vehicleConflicts[0] });
        return;
      }

      const { error } = await supabase.from('schedules').update({ vehicle_id: vehicleId, status: vehicleId ? 'approved' : 'pending' }).eq('id', scheduleId);
      if (error) throw error;
      const vehicle = vehicles.find(v => v.id === vehicleId);
      if (schedule?.created_by) {
        await sendNotifications([{
          user_id: schedule.created_by,
          title: vehicleId ? "Đã gán Xe điều động 🚗" : "Đã hủy gán Xe",
          content: vehicleId
            ? `Lịch trình "${schedule.title}" đã được gán xe: ${vehicle?.plate_number} - ${vehicle?.name}.`
            : `Lịch trình "${schedule.title}" đã bị hủy gán xe điều động.`,
          link: "/dashboard/schedule"
        }]);
      }
      // Loại trừ driver khỏi thông báo cập nhật lịch chung (quy tắc §5.E.2)
      const participantIds = (schedule?.participants || [])
        .filter((p: any) => p.profile?.role !== 'driver')
        .map((p: any) => p.profile?.id)
        .filter((uid: string) => uid && uid !== profile?.id && uid !== schedule?.created_by);
      if (vehicleId && participantIds.length > 0) {
        await sendNotifications(
          participantIds.map((uid: string) => ({
            user_id: uid,
            title: "Lịch trình đã được duyệt",
            content: `Lịch trình "${schedule.title}" đã được gán xe và phê duyệt.`,
            link: "/dashboard/schedule"
          }))
        );
      }
      toast({ title: "Thành công", description: vehicleId ? "Đã gán xe cho lịch trình." : "Đã hủy gán xe." });
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setIsDetailOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Lỗi", description: error.message });
    }
  };
  const handleDeleteSchedule = async (id: string) => {
    const schedule = schedules.find(s => s.id === id);
    if (schedule?.status === 'in_progress') {
      toast({ variant: 'destructive', title: 'Không thể xóa', description: 'Lịch trình đang diễn ra. Vui lòng kết thúc trước khi xóa.' });
      return;
    }
    const ok = await confirmDialog({
      title: 'Xóa lịch trình?',
      description: 'Toàn bộ thông tin liên quan tới lịch trình này sẽ bị gỡ khỏi hệ thống.',
      confirmText: 'Xóa',
      danger: true,
    });
    if (!ok) return;
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

      // Ghi nhận lịch sử / cảnh báo cho những người khác (thông báo) — loại trừ lái xe
      if (schedule.participants?.length > 0) {
        const otherParticipantIds = schedule.participants
          .filter((p: any) => p.profile?.id !== profile?.id && p.profile?.role !== 'driver')
          .map((p: any) => p.profile?.id)
          .filter(Boolean);
        
        if (otherParticipantIds.length > 0) {
          await sendNotifications(
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

  const handleUpdateSchedule = async (id: string, updates: any) => {
    await updateScheduleAction({
      supabase, toast, profile, allProfiles, schedules, id, updates,
      findParticipantConflicts, sendNotifications, setIsDetailOpen, fetchData,
    });
  };


  const resetCreateForm = () => {
    setNewSchedule({ title: "", description: "", location: "", department_id: "", type: "trip", use_room: false, room_id: "", use_vehicle: false, vehicle_id: "", requested_vehicle_type: "4 chỗ", participants: [], target_profile_id: "" });
    setStartDate(new Date());
    setEndDate(new Date());
    setStartTime("08:00");
    setEndTime("09:00");
    setBgdMode('none');
    setSelectedBGD([]);
    setDeptMode('none');
    setFilterDepts(profile?.department_id ? [profile.department_id] : []);
    setParticipantMode('staff');
    setSelectedParticipants([]);
    setIsCreateOpen(false);
  };

  const handleCreateSchedule = async () => {
    if (!startDate || !endDate) {
      toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng điền đầy đủ thông tin bắt buộc." });
      return;
    }
    await createScheduleHelper({
      supabase, toast, profile, allProfiles, newSchedule,
      startDate, endDate, startTime, endTime,
      conflicts, resourceConflicts,
      selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode,
      findParticipantConflicts, sendNotifications, isScheduleApprover,
      resetForm: resetCreateForm,
      fetchData,
    });
  };

  const handleSelectSchedule = (s: any) => {
    setSelectedSchedule(s);
    setIsDetailOpen(true);
  };

  return {
    schedules, vehicles, rooms, loading, profile, allProfiles, departments,
    selectedDate, setSelectedDate, filterType, setFilterType,
    isCreateOpen, setIsCreateOpen, newSchedule, setNewSchedule,
    startDate, setStartDate, endDate, setEndDate, startTime, setStartTime, endTime, setEndTime,
    isStartOpen, setIsStartOpen, isEndOpen, setIsEndOpen,
    bgdMode, setBgdMode, selectedBGD, setSelectedBGD,
    deptMode, setDeptMode, filterDepts, setFilterDepts,
    participantMode, setParticipantMode, selectedParticipants, setSelectedParticipants,
    selectedSchedule, setSelectedSchedule, isDetailOpen, setIsDetailOpen,
    timelineContainerRef, mounted, setMounted, searchParams,
    toast, supabase, defaultTab, pendingVehicleCount, pendingVehicleBadge,
    canCoordinateResources, getPendingLeavesCount, pendingLeavesCount, pendingLeavesBadge,
    getDepartmentName, isScheduleApprover, sendNotifications, weekDays, isTodaySelected,
    now, currentMinutes, startLimit, endLimit, duration, isWithinWorkingHours, currentTimePercent,
    conflicts, resourceConflicts, fetchData, findParticipantConflicts,
    handleStatusUpdate, handleAssignVehicle, handleDeleteSchedule, handleUpdateEndTime, handleUpdateSchedule, handleCreateSchedule, handleSelectSchedule
  };
}
