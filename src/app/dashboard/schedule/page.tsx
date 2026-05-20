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
import { addDays, endOfDay, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

import { resolveParticipantIds, checkConflicts, checkResourceConflicts } from "./_lib/utils";
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
    type: "trip", use_room: false, room_id: "",
    use_vehicle: false, vehicle_id: "", requested_vehicle_type: "4 chỗ", participants: []
  });
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [isEndOpen, setIsEndOpen] = useState(false);

  // State chọn thành phần tham gia
  const [bgdMode, setBgdMode] = useState<'all' | 'specific' | 'none'>('specific');
  const [selectedBGD, setSelectedBGD] = useState<string[]>([]);
  const [deptMode, setDeptMode] = useState<'all' | 'specific' | 'none'>('specific');
  const [filterDepts, setFilterDepts] = useState<string[]>([]);
  const [participantMode, setParticipantMode] = useState<'all' | 'manager' | 'staff'>('all');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  // State dialog chi tiết
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Tính toán
  const defaultTab = profile?.role === 'driver' ? 'driver-trips' : 'calendar';
  const pendingVehicleCount = schedules.filter(s => s.use_vehicle && !s.vehicle_id).length;
  const pendingVehicleBadge = pendingVehicleCount > 9 ? "9+" : pendingVehicleCount;
  const isTCTH = profile?.role === 'admin' || profile?.role === 'secretary' || profile?.role === 'hr_officer' || profile?.departments?.name === 'Tổ chức Tổng hợp';

  // Đếm số đơn nghỉ phép chờ duyệt theo phân cấp lãnh đạo
  const getPendingLeavesCount = () => {
    if (!profile) return 0;
    return schedules.filter(s => {
      if (s.type !== 'leave' || s.status !== 'pending') return false;
      if (profile.role === 'admin' || profile.role === 'hr_officer') {
        return true;
      }
      if (profile.role === 'director') {
        return s.creator?.is_department_head === true || s.creator?.role === 'manager';
      }
      if (profile.role === 'manager') {
        return s.creator?.department_id === profile.department_id && s.created_by !== profile.id && s.creator?.role !== 'manager';
      }
      return false;
    }).length;
  };

  const pendingLeavesCount = getPendingLeavesCount();
  const pendingLeavesBadge = pendingLeavesCount > 9 ? "9+" : pendingLeavesCount;

  const getDepartmentName = (user: any) => {
    const dept = user?.departments;
    return Array.isArray(dept) ? dept[0]?.name : dept?.name;
  };

  const isScheduleApprover = (user: any) =>
    user?.role === 'admin' ||
    user?.role === 'secretary' ||
    user?.role === 'hr_officer' ||
    getDepartmentName(user) === 'Tổ chức Tổng hợp';

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

  // Fetch dữ liệu
  useEffect(() => { fetchData(); }, [selectedDate]);

  const fetchData = async () => {
    setLoading(true);
    let currentProfile: any = profile;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*, departments(name)').eq('id', user.id).single();
        setProfile(p);
        currentProfile = p;
        if (p?.department_id && filterDepts.length === 0) setFilterDepts([p.department_id]);
      }
    } catch (e) { console.error(e); }

    try {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = new Date(Math.max(
        endOfWeek(selectedDate, { weekStartsOn: 1 }).getTime(),
        endOfDay(addDays(selectedDate, 3)).getTime()
      ));
      // Lấy tất cả lịch có start_time trong tuần Hoặc end_time >= đầu tuần để bắt lịch nhiều ngày chạy qua tuần
      const schedulesQuery = supabase
        .from('schedules')
        .select(`*, creator:profiles(full_name, avatar_url, department_id, role, is_department_head), room:rooms(name), vehicle:vehicles(name, plate_number), participants:schedule_participants(profile:profiles(id, full_name, avatar_url, role, is_department_head))`)
        .gte('end_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time');

      const canSeePendingQueue = currentProfile?.role === 'admin' || currentProfile?.role === 'secretary' || currentProfile?.role === 'hr_officer' || currentProfile?.departments?.name === 'Tổ chức Tổng hợp';
      const pendingQueueQuery = canSeePendingQueue
        ? supabase
            .from('schedules')
            .select(`*, creator:profiles(full_name, avatar_url, department_id, role, is_department_head), room:rooms(name), vehicle:vehicles(name, plate_number), participants:schedule_participants(profile:profiles(id, full_name, avatar_url, role, is_department_head))`)
            .or('status.eq.pending,and(use_vehicle.eq.true,vehicle_id.is.null)')
            .order('start_time')
        : Promise.resolve({ data: [] as any[], error: null });

      const [
        { data: scheds, error: sError },
        { data: pendingQueue, error: pendingError },
        { data: vData },
        { data: rData },
        { data: pData },
        { data: dData },
      ] = await Promise.all([
        schedulesQuery,
        pendingQueueQuery,
        supabase.from('vehicles').select('*'),
        supabase.from('rooms').select('*'),
        supabase.from('profiles').select('id, full_name, role, department_id, is_department_head, departments(name)'),
        supabase.from('departments').select('*'),
      ]);

      if (sError) throw sError;
      if (pendingError) throw pendingError;

      setSchedules([...(scheds || []), ...(pendingQueue || [])].filter((item, index, arr) => (
        arr.findIndex(x => x.id === item.id) === index
      )));

      setVehicles(vData || []);
      setRooms(rData || []);
      setAllProfiles(pData || []);
      setDepartments(dData || []);
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
      if (schedule?.created_by) {
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

      if (vehicleConflicts.length > 0) {
        toast({ variant: "destructive", title: "Trùng lịch xe", description: vehicleConflicts[0] });
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
      const participantIds = (schedule?.participants || [])
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
    try {
      const schedule = schedules.find(s => s.id === id);
      if (!schedule) return;

      const nextStart = updates.start_time ? new Date(updates.start_time) : new Date(schedule.start_time);
      const nextEnd = updates.end_time ? new Date(updates.end_time) : new Date(schedule.end_time);
      if (nextEnd <= nextStart) {
        toast({ variant: "destructive", title: "Lỗi thời gian", description: "Thời gian kết thúc phải sau thời gian bắt đầu." });
        return;
      }

      const resourceErrors = checkResourceConflicts({
        roomId: updates.room_id,
        vehicleId: updates.vehicle_id,
        start: nextStart,
        end: nextEnd,
        schedules,
        ignoreScheduleId: id
      });

      if (resourceErrors.length > 0) {
        toast({ variant: "destructive", title: "Trùng tài nguyên", description: resourceErrors[0] });
        return;
      }

      const { participant_ids, ...scheduleUpdates } = updates;
      const nextParticipantIds = Array.isArray(participant_ids)
        ? Array.from(new Set([schedule.created_by, ...participant_ids].filter(Boolean)))
        : (schedule.participants || []).map((p: any) => p.profile?.id).filter(Boolean);
      const participantConflicts = await findParticipantConflicts({
        participantIds: nextParticipantIds,
        start: nextStart,
        end: nextEnd,
        ignoreScheduleId: id
      });

      if (participantConflicts.length > 0) {
        toast({
          variant: "destructive",
          title: "Trùng lịch người tham gia",
          description: participantConflicts.slice(0, 3).join('\n')
        });
        return;
      }

      const { error } = await supabase.from('schedules').update(scheduleUpdates).eq('id', id);
      if (error) throw error;

      const oldParticipantIds = (schedule.participants || [])
        .map((p: any) => p.profile?.id)
        .filter(Boolean);
      let finalParticipantIds = oldParticipantIds;
      let addedParticipantIds: string[] = [];

      if (Array.isArray(participant_ids)) {
        finalParticipantIds = Array.from(new Set([schedule.created_by, ...participant_ids].filter(Boolean)));
        addedParticipantIds = finalParticipantIds.filter((uid: string) => !oldParticipantIds.includes(uid));

        await supabase.from('schedule_participants').delete().eq('schedule_id', id);
        if (finalParticipantIds.length > 0) {
          await supabase.from('schedule_participants').insert(
            finalParticipantIds.map((uid: string) => ({ schedule_id: id, profile_id: uid }))
          );
        }
      }

      const notifyTargets = finalParticipantIds.filter((uid: string) => uid && uid !== profile?.id);

      if (notifyTargets.length > 0) {
        await sendNotifications(
          notifyTargets.map((uid: string) => ({
            user_id: uid,
            title: addedParticipantIds.includes(uid) ? "Bạn được thêm vào lịch trình" : `Lịch trình đã được cập nhật`,
            content: addedParticipantIds.includes(uid)
              ? `${profile?.full_name || 'Người dùng'} đã thêm bạn vào lịch trình "${scheduleUpdates.title || schedule.title}".`
              : `${profile?.full_name || 'Người dùng'} vừa cập nhật lịch trình "${scheduleUpdates.title || schedule.title}".`,
            link: "/dashboard/schedule"
          }))
        );
      }

      toast({ title: "Thành công", description: "Đã cập nhật lịch trình." });
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setIsDetailOpen(false);
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
    const start = new Date(startDate);
    const [sHour, sMin] = startTime.split(':');
    start.setHours(parseInt(sHour), parseInt(sMin));
    const end = new Date(endDate);
    const [eHour, eMin] = endTime.split(':');
    end.setHours(parseInt(eHour), parseInt(eMin));

    const isLeave = newSchedule.type === 'leave';

    if (end <= start) {
      toast({ variant: "destructive", title: "Lỗi thời gian", description: "Thời gian kết thúc phải sau thời gian bắt đầu." });
      return;
    }

    if (!isLeave && newSchedule.location === 'Chi nhánh' && (!newSchedule.room_id || newSchedule.room_id === 'none')) {
      toast({ variant: "destructive", title: "Thiếu phòng họp", description: "Vui lòng chọn phòng họp tại chi nhánh." });
      return;
    }

    if (!isLeave && newSchedule.location !== 'Chi nhánh' && !newSchedule.location.trim()) {
      toast({ variant: "destructive", title: "Thiếu địa điểm", description: "Vui lòng nhập địa điểm hoặc lộ trình cụ thể." });
      return;
    }

    if (!isLeave && conflicts.length > 0) {
      toast({ variant: "destructive", title: "Trùng lịch trình", description: "Vui lòng điều chỉnh lại thời gian hoặc thành phần tham gia do có người đang bận." });
      return;
    }

    if (!isLeave && resourceConflicts.length > 0) {
      toast({ variant: "destructive", title: "Trùng tài nguyên", description: resourceConflicts[0] });
      return;
    }

    try {
      const { use_vehicle, participants, vehicle_id, ...insertData } = newSchedule;
      const selectedParticipantIds = isLeave
        ? [profile?.id].filter(Boolean)
        : resolveParticipantIds({ selectedParticipants, bgdMode, selectedBGD, deptMode, filterDepts, participantMode, allProfiles });
      const finalParticipants = Array.from(new Set([profile?.id, ...selectedParticipantIds].filter(Boolean)));

      const participantConflicts = await findParticipantConflicts({
        participantIds: finalParticipants,
        start,
        end
      });

      if (participantConflicts.length > 0) {
        toast({
          variant: "destructive",
          title: "Trùng lịch người tham gia",
          description: participantConflicts.slice(0, 3).join('\n')
        });
        return;
      }

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
        status: (profile?.role === 'admin' || profile?.role === 'secretary' || profile?.role === 'hr_officer' || profile?.departments?.name === 'Tổ chức Tổng hợp') ? 'approved' : 'pending'
      }).select().single();
      if (error) throw error;

      // Nghỉ phép: chỉ thêm chính người tạo làm participant
      // Lịch thường: resolve theo lựa chọn thành phần
      if (finalParticipants.length > 0) {
        await supabase.from('schedule_participants').insert(
          finalParticipants.map((pid: string) => ({ schedule_id: createdSchedule.id, profile_id: pid }))
        );
      }

      if (createdSchedule.status === 'pending') {
        // Nghỉ phép: thông báo cho lãnh đạo phòng + TCTH
        // Lịch thường: thông báo chỉ cho TCTH
        const notifyTargets = isLeave
          ? allProfiles.filter(p =>
              isScheduleApprover(p) ||
              (p.department_id === profile?.department_id && (p.role === 'manager' || p.is_department_head))
            )
          : allProfiles.filter(isScheduleApprover);

        if (notifyTargets.length > 0) {
          await sendNotifications(
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

      const participantNotifyTargets = finalParticipants.filter((uid: string) => uid !== profile?.id);
      if (participantNotifyTargets.length > 0) {
        await sendNotifications(
          participantNotifyTargets.map((uid: string) => ({
            user_id: uid,
            title: createdSchedule.status === 'approved' ? "Lịch trình mới" : "Lịch trình đang chờ duyệt",
            content: `${profile?.full_name} đã thêm bạn vào lịch trình "${newSchedule.title}" từ ${start.toLocaleString('vi-VN')} đến ${end.toLocaleString('vi-VN')}.`,
            link: "/dashboard/schedule"
          }))
        );
      }

      toast({ title: "Thành công", description: isLeave ? "Đơn nghỉ phép đã được gửi." : "Lịch trình đã được đăng ký." });
      // Reset toàn bộ form về trạng thái mặc định
      setNewSchedule({ title: "", description: "", location: "", department_id: "", type: "trip", use_room: false, room_id: "", use_vehicle: false, vehicle_id: "", requested_vehicle_type: "4 chỗ", participants: [] });
      setStartDate(new Date());
      setEndDate(new Date());
      setStartTime("08:00");
      setEndTime("09:00");
      setBgdMode('specific');
      setSelectedBGD([]);
      setDeptMode('specific');
      setFilterDepts(profile?.department_id ? [profile.department_id] : []);
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
          <h1 className="text-2xl font-semibold text-slate-900">Lịch trình</h1>
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
            rooms={rooms} conflicts={[...conflicts, ...resourceConflicts]} onSubmit={handleCreateSchedule} toast={toast}
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
      <DateNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} weekDays={weekDays} schedules={schedules} />

      {/* Tabs */}
      <Tabs key={defaultTab} defaultValue={defaultTab} className="space-y-8 w-full">
        <TabsList className="bg-slate-100/60 p-1 rounded-xl h-11 w-full flex gap-1">
          <TabsTrigger value="calendar" className="flex-1 rounded-lg py-1.5 font-medium text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center justify-center">
            <CalendarIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
            <span className="hidden sm:inline">Lịch biểu</span>
            <span className="inline sm:hidden">Lịch</span>
          </TabsTrigger>
          {isTCTH && (
            <TabsTrigger value="tcth" className="flex-1 rounded-lg py-1.5 font-medium text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
              <span>Điều phối</span>
              {pendingVehicleCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500 p-0 text-[10px] font-bold leading-none text-white tabular-nums">
                  {pendingVehicleBadge}
                </span>
              )}
            </TabsTrigger>
          )}
          {(profile?.role === 'hr_officer' || profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'manager') && (
            <TabsTrigger value="leave-approval" className="flex-1 rounded-lg py-1.5 font-medium text-[13px] md:text-[14px] data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm flex items-center justify-center">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
              <span className="hidden sm:inline">Phê duyệt nghỉ phép</span>
              <span className="inline sm:hidden">Duyệt phép</span>
              {pendingLeavesCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 p-0 text-[10px] font-bold leading-none text-white tabular-nums">
                  {pendingLeavesBadge}
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

        {isTCTH && (
          <TabsContent value="tcth">
            <TcthDashboard
              schedules={schedules} vehicles={vehicles} rooms={rooms}
              selectedDate={selectedDate} onSelectSchedule={handleSelectSchedule}
            />
          </TabsContent>
        )}
        {(profile?.role === 'hr_officer' || profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'manager') && (
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
        schedule={selectedSchedule} vehicles={vehicles} rooms={rooms}
        isTCTH={isTCTH} allProfiles={allProfiles}
        currentProfile={profile}
        onAssignVehicle={handleAssignVehicle}
        onUpdateEndTime={handleUpdateEndTime}
        onUpdateSchedule={handleUpdateSchedule}
      />
    </div>
  );
}
