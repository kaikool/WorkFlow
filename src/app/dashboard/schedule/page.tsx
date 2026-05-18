'use client'

import React, { useState, useEffect, useRef } from "react";
import { 
 Calendar as CalendarIcon,
 ChevronLeft, 
 ChevronRight,
 Clock,
 MapPin,
 Users,
 Car,
 DoorOpen,
 CheckCircle2,
 AlertCircle,
 MoreVertical,
 CalendarDays,
 Plus,
 Loader2,
 UserCheck,
 ShieldCheck,
 ListTodo
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { 
 Dialog, 
 DialogContent, 
 DialogHeader, 
 DialogTitle, 
 DialogTrigger,
 DialogFooter
} from "@/components/ui/dialog";
import { 
 Select, 
 SelectContent, 
 SelectItem, 
 SelectTrigger, 
 SelectValue 
} from "@/components/ui/select";
import { 
 Tabs, 
 TabsContent, 
 TabsList, 
 TabsTrigger 
} from "@/components/ui/tabs";
import { 
 Popover,
 PopoverContent,
 PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { vi } from "date-fns/locale";

export default function SchedulePage() {
 const supabase = createClient();
 const { toast } = useToast();
 
 const [schedules, setSchedules] = useState<any[]>([]);
 const [vehicles, setVehicles] = useState<any[]>([]);
 const [rooms, setRooms] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [profile, setProfile] = useState<any>(null);
 const timelineContainerRef = useRef<HTMLDivElement>(null);

  const getDirectorColor = (fullName: string) => {
    const name = fullName ? fullName.trim() : '';
    const colors = [
      {
        bg: 'bg-indigo-50/80',
        border: 'border-indigo-200',
        text: 'text-indigo-700',
        bullet: 'bg-indigo-500',
        pill: 'bg-indigo-50/80 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
        hover: 'hover:bg-indigo-100'
      },
      {
        bg: 'bg-emerald-50/80',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        bullet: 'bg-emerald-500',
        pill: 'bg-emerald-50/80 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
        hover: 'hover:bg-emerald-100'
      },
      {
        bg: 'bg-rose-50/80',
        border: 'border-rose-200',
        text: 'text-rose-700',
        bullet: 'bg-rose-500',
        pill: 'bg-rose-50/80 text-rose-700 border-rose-200 hover:bg-rose-100',
        hover: 'hover:bg-rose-100'
      },
      {
        bg: 'bg-amber-50/80',
        border: 'border-amber-200',
        text: 'text-amber-700',
        bullet: 'bg-amber-500',
        pill: 'bg-amber-50/80 text-amber-700 border-amber-200 hover:bg-amber-100',
        hover: 'hover:bg-amber-100'
      },
      {
        bg: 'bg-sky-50/80',
        border: 'border-sky-200',
        text: 'text-sky-700',
        bullet: 'bg-sky-500',
        pill: 'bg-sky-50/80 text-sky-700 border-sky-200 hover:bg-sky-100',
        hover: 'hover:bg-sky-100'
      },
      {
        bg: 'bg-fuchsia-50/80',
        border: 'border-fuchsia-200',
        text: 'text-fuchsia-700',
        bullet: 'bg-fuchsia-500',
        pill: 'bg-fuchsia-50/80 text-fuchsia-700 border-fuchsia-200 hover:bg-fuchsia-100',
        hover: 'hover:bg-fuchsia-100'
      },
      {
        bg: 'bg-teal-50/80',
        border: 'border-teal-200',
        text: 'text-teal-700',
        bullet: 'bg-teal-500',
        pill: 'bg-teal-50/80 text-teal-700 border-teal-200 hover:bg-teal-100',
        hover: 'hover:bg-teal-100'
      },
      {
        bg: 'bg-violet-50/80',
        border: 'border-violet-200',
        text: 'text-violet-700',
        bullet: 'bg-violet-500',
        pill: 'bg-violet-50/80 text-violet-700 border-violet-200 hover:bg-violet-100',
        hover: 'hover:bg-violet-100'
      }
    ];

    // Get active BGD list dynamically to assign collision-free colors based on alphabetical list index
    const bgdList = allProfiles
      .filter(p => (p.role === 'director' || p.full_name?.toLowerCase().includes('giám đốc')) && !p.full_name?.toLowerCase().includes('admin') && p.role !== 'admin')
      .map(p => p.full_name)
      .sort();
    
    const index = bgdList.indexOf(fullName);
    if (index !== -1) {
      return colors[index % colors.length];
    }

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const renderParticipants = (schedule: any) => {
    if (!schedule || !schedule.participants) return null;
    
    // Get all BGD profiles from allProfiles
    const bgdProfiles = allProfiles.filter(p => 
      (p.role === 'director' || p.full_name?.toLowerCase().includes('giám đốc')) && 
      !p.full_name?.toLowerCase().includes('admin') && 
      p.role !== 'admin'
    );
    
    // Get all staff profiles
    const staffProfiles = allProfiles.filter(p => 
      p.role !== 'admin' && 
      p.role !== 'director' && 
      !p.full_name?.toLowerCase().includes('admin') &&
      !p.full_name?.toLowerCase().includes('giám đốc')
    );

    const participantIds = schedule.participants.map((p: any) => p.profile?.id);
    
    const hasAllBgd = bgdProfiles.length > 0 && bgdProfiles.every(p => participantIds.includes(p.id));
    const hasAllStaff = staffProfiles.length > 0 && staffProfiles.every(p => participantIds.includes(p.id));

    const elements = [];

    if (hasAllBgd) {
      elements.push(
        <Badge key="all-bgd" variant="outline" className="bg-red-50 border-red-200 text-red-700 rounded-full px-3 py-1.5 flex items-center gap-2 font-bold shadow-sm">
          <Users className="w-3.5 h-3.5" />
          Toàn bộ Ban Giám đốc
        </Badge>
      );
    }

    if (hasAllStaff) {
      elements.push(
        <Badge key="all-staff" variant="outline" className="bg-blue-50 border-blue-200 text-blue-700 rounded-full px-3 py-1.5 flex items-center gap-2 font-bold shadow-sm">
          <Users className="w-3.5 h-3.5" />
          Toàn bộ Đơn vị / Phòng ban
        </Badge>
      );
    }

    // Get other participants who are not part of the groups that are fully invited
    const remainingParticipants = schedule.participants.filter((p: any) => {
      const isBgd = bgdProfiles.some(bp => bp.id === p.profile?.id);
      const isStaff = staffProfiles.some(sp => sp.id === p.profile?.id);
      
      if (isBgd && hasAllBgd) return false;
      if (isStaff && hasAllStaff) return false;
      return true;
    });

    remainingParticipants.forEach((p: any, idx: number) => {
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

    return (
      <div className="flex flex-wrap gap-2">
        {elements}
      </div>
    );
  };

  const [isCreateOpen, setIsCreateOpen] = useState(false);
 const [selectedDate, setSelectedDate] = useState(new Date());
 const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
 const [isDetailOpen, setIsDetailOpen] = useState(false);

 const [newSchedule, setNewSchedule] = useState({
 title: "",
 description: "",
 location: "",
 department_id: "",
 type: "meeting",
 use_room: false,
 room_id: "",
 use_vehicle: false,
 vehicle_id: "",
 requested_vehicle_type: "4 chỗ",
 participants: []
 });

 const [allProfiles, setAllProfiles] = useState<any[]>([]);
 const [departments, setDepartments] = useState<any[]>([]);
 const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
 
 // Các state cho bộ lọc thông minh
 const [filterDepts, setFilterDepts] = useState<string[]>([]);
 const [filterRoles, setFilterRoles] = useState<string[]>(['manager', 'staff']);
 
 const [bgdMode, setBgdMode] = useState<'all' | 'specific' | 'none'>('all');
 const [selectedBGD, setSelectedBGD] = useState<string[]>([]);
 const [deptMode, setDeptMode] = useState<'all' | 'specific' | 'none'>('all');
 
 const [startDate, setStartDate] = useState<Date | undefined>(new Date());
 const [endDate, setEndDate] = useState<Date | undefined>(new Date());
 const [startTime, setStartTime] = useState("08:00");
 const [endTime, setEndTime] = useState("09:00");
 const [isStartOpen, setIsStartOpen] = useState(false);
 const [isEndOpen, setIsEndOpen] = useState(false);

 const [filterType, setFilterType] = useState<'all' | 'bgd' | 'dept'>('all');
 const [participantMode, setParticipantMode] = useState<'all' | 'manager' | 'staff'>('all');
 const [selectedVehicleType, setSelectedVehicleType] = useState<string>('4 chỗ');

  useEffect(() => {
    if (filterType === 'bgd' && timelineContainerRef.current) {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      
      if (currentHour >= 8 && currentHour <= 17) {
        const startLimit = 8;
        const totalHours = 9; // 8 to 17
        const totalMinutes = totalHours * 60;
        const minutesElapsed = (currentHour - startLimit) * 60 + currentMinutes;
        const percentElapsed = minutesElapsed / totalMinutes;
        
        setTimeout(() => {
          if (timelineContainerRef.current) {
            const containerWidth = timelineContainerRef.current.scrollWidth;
            const clientWidth = timelineContainerRef.current.clientWidth;
            const scrollTarget = containerWidth * percentElapsed - clientWidth / 2;
            timelineContainerRef.current.scrollTo({
              left: Math.max(0, scrollTarget),
              behavior: 'smooth'
            });
          }
        }, 300);
      }
    }
  }, [filterType, loading]);

 // Logic kiểm tra xung đột lịch trình
 const conflicts = React.useMemo(() => {
 if (!startDate || !endDate) return [];
 
 // Tổng hợp tất cả người tham gia tiềm năng để kiểm tra xung đột
 let checkIds = [...selectedParticipants];
 
 if (bgdMode === 'all') {
 const bgdIds = allProfiles.filter(p => (p.role === 'director' || p.full_name?.toLowerCase().includes('giám đốc')) && !p.full_name?.toLowerCase().includes('admin') && p.role !== 'admin').map(p => p.id);
 checkIds = [...new Set([...checkIds, ...bgdIds])];
 } else {
 checkIds = [...new Set([...checkIds, ...selectedBGD])];
 }

 if (deptMode === 'all') {
 const allStaffIds = allProfiles.filter(p => p.role !== 'admin' && p.role !== 'director').map(p => p.id);
 checkIds = [...new Set([...checkIds, ...allStaffIds])];
 } else if (filterDepts.length > 0) {
 if (participantMode === 'all') {
 const deptStaffIds = allProfiles
 .filter(p => filterDepts.includes(p.department_id))
 .map(p => p.id);
 checkIds = [...new Set([...checkIds, ...deptStaffIds])];
 } else if (participantMode === 'manager') {
 const deptManagerIds = allProfiles
 .filter(p => filterDepts.includes(p.department_id) && p.role === 'manager')
 .map(p => p.id);
 checkIds = [...new Set([...checkIds, ...deptManagerIds])];
 }
 }

 if (checkIds.length === 0) return [];

 try {
 const startString = `${format(startDate, 'yyyy-MM-dd')}T${startTime}`;
 const endString = `${format(endDate, 'yyyy-MM-dd')}T${endTime}`;
 const start = new Date(startString);
 const end = new Date(endString);

 const foundConflicts: string[] = [];
 schedules.forEach(s => {
 if (s.status === 'rejected') return;
 const isPending = s.status === 'pending';
 const sStart = new Date(s.start_time);
 const sEnd = new Date(s.end_time);

 const isOverlapping = (start < sEnd && end > sStart);
 
 if (isOverlapping) {
  s.participants?.forEach((p: any) => {
  if (checkIds.includes(p.profile?.id)) {
  foundConflicts.push(`${p.profile?.full_name} đang bận${isPending ? ' (Chờ duyệt)' : ''}: ${s.title} (${format(sStart, 'HH:mm')} - ${format(sEnd, 'HH:mm')})`);
  }
  });
 }
 });
 return Array.from(new Set(foundConflicts));
 } catch (e) {
 return [];
 }
 }, [startDate, endDate, startTime, endTime, selectedParticipants, selectedBGD, bgdMode, deptMode, participantMode, allProfiles, schedules, filterDepts]);

 const isTCTH = profile?.role === 'admin' || profile?.departments?.name === 'Tổ chức Tổng hợp';

 // Status Presence Logic - Tự động cập nhật trạng thái hồ sơ
 useEffect(() => {
 const updatePresenceStatus = async () => {
 if (!profile || schedules.length === 0) return;
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

 // Chỉ cập nhật nếu trạng thái khác biệt (Tránh loop)
 if (profile.status !== targetStatus && targetStatus !== 'online') {
 await supabase.from('profiles').update({ 
 status: targetStatus,
 last_seen: new Date().toISOString()
 }).eq('id', profile.id);
 }
 };

 updatePresenceStatus();
 const interval = setInterval(updatePresenceStatus, 60000); // Kiểm tra mỗi phút
 return () => clearInterval(interval);
 }, [schedules, profile, supabase]);

 useEffect(() => {
 fetchData();
 }, [selectedDate]);

 const fetchData = async () => {
 setLoading(true);
 try {
 const { data: { user } } = await supabase.auth.getUser();
 if (user) {
 const { data: p } = await supabase.from('profiles').select('*, departments(name)').eq('id', user.id).single();
 setProfile(p);
 }
 } catch (e) {
 console.error(e);
 }

 try {
 // Lấy lịch trong tuần của ngày được chọn
 const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
 const end = endOfWeek(selectedDate, { weekStartsOn: 1 });

 const { data: scheds, error: sError } = await supabase
 .from('schedules')
 .select(`
 *,
 creator:profiles(full_name, avatar_url),
 room:rooms(name),
 vehicle:vehicles(name, plate_number),
 participants:schedule_participants(
 profile:profiles(id, full_name, avatar_url, role)
 )
 `)
 .gte('start_time', start.toISOString())
 .lte('start_time', end.toISOString())
 .order('start_time');
 
 if (sError) throw sError;
 setSchedules(scheds || []);

 const { data: vData } = await supabase.from('vehicles').select('*');
 setVehicles(vData || []);

 const { data: rData } = await supabase.from('rooms').select('*');
 setRooms(rData || []);

 const { data: pData } = await supabase.from('profiles').select('id, full_name, role, department_id, departments(name)');
 setAllProfiles(pData || []);

 const { data: dData } = await supabase.from('departments').select('*');
 setDepartments(dData || []);

 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 } finally {
 setLoading(false);
 }
 };

 const handleStatusUpdate = async (id: string, status: string) => {
 try {
 const { error } = await supabase
 .from('schedules')
 .update({ status })
 .eq('id', id);

 if (error) throw error;
 
 // Notify creator
 const schedule = schedules.find(s => s.id === id);
 if (schedule && schedule.created_by) {
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
 const { error } = await supabase
 .from('schedules')
 .update({ vehicle_id: vehicleId })
 .eq('id', scheduleId);
 if (error) throw error;

 // Notify creator
 const schedule = schedules.find(s => s.id === scheduleId);
 const vehicle = vehicles.find(v => v.id === vehicleId);
 if (schedule && schedule.created_by) {
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

 const handleCreateSchedule = async () => {
 if (!newSchedule.title || !startDate || !endDate) {
 toast({ variant: "destructive", title: "Lỗi", description: "Vui lòng điền đầy đủ thông tin bắt buộc." });
 return;
 }

 if (conflicts.length > 0) {
 toast({ variant: "destructive", title: "Trùng lịch trình", description: "Vui lòng điều chỉnh lại thời gian hoặc thành phần tham gia do có người đang bận." });
 return;
 }

 // Kết hợp ngày và giờ
 const start = new Date(startDate);
 const [sHour, sMin] = startTime.split(':');
 start.setHours(parseInt(sHour), parseInt(sMin));

 const end = new Date(endDate);
 const [eHour, eMin] = endTime.split(':');
 end.setHours(parseInt(eHour), parseInt(eMin));

 try {
 const { use_vehicle, participants, vehicle_id, ...insertData } = newSchedule;
 
 const { data: createdSchedule, error } = await supabase.from('schedules').insert({
 ...insertData,
 start_time: start.toISOString(),
 end_time: end.toISOString(),
 room_id: (newSchedule.location === 'Chi nhánh' && newSchedule.room_id !== "none") ? newSchedule.room_id : null,
 vehicle_id: null, // User không được tự chọn xe, Admin/TCTH sẽ gán sau
 requested_vehicle_type: use_vehicle ? newSchedule.requested_vehicle_type : null,
 use_vehicle: use_vehicle,
 created_by: profile?.id,
 department_id: profile?.department_id,
 status: (profile?.role === 'admin' || profile?.departments?.name === 'Tổ chức Tổng hợp') ? 'approved' : 'pending'
 }).select().single();

 if (error) throw error;

 // Thêm người tham gia dựa trên logic thông minh hoặc chọn tay
 let finalParticipants = [...selectedParticipants];
 
 // 1. Xử lý BGĐ
 if (bgdMode === 'all') {
 const bgdIds = allProfiles.filter(p => (p.role === 'director' || p.full_name?.toLowerCase().includes('giám đốc')) && !p.full_name?.toLowerCase().includes('admin') && p.role !== 'admin').map(p => p.id);
 finalParticipants = [...new Set([...finalParticipants, ...bgdIds])];
 } else {
 finalParticipants = [...new Set([...finalParticipants, ...selectedBGD])];
 }

 // 2. Xử lý Đơn vị
 if (deptMode === 'all') {
 const allStaffIds = allProfiles.filter(p => p.role !== 'admin' && p.role !== 'director').map(p => p.id);
 finalParticipants = [...new Set([...finalParticipants, ...allStaffIds])];
 } else if (filterDepts.length > 0) {
 // Nếu chọn lẻ phòng nhưng chọn All cán bộ của phòng đó
 if (participantMode === 'all') {
 const deptStaffIds = allProfiles
 .filter(p => filterDepts.includes(p.department_id))
 .map(p => p.id);
 finalParticipants = [...new Set([...finalParticipants, ...deptStaffIds])];
 } else if (participantMode === 'manager') {
 const deptManagerIds = allProfiles
 .filter(p => filterDepts.includes(p.department_id) && p.role === 'manager')
 .map(p => p.id);
 finalParticipants = [...new Set([...finalParticipants, ...deptManagerIds])];
 }
 }

 if (finalParticipants.length > 0) {
 const participantRecords = finalParticipants.map(pid => ({
 schedule_id: createdSchedule.id,
 profile_id: pid
 }));
 await supabase.from('schedule_participants').insert(participantRecords);
 }

 // THÊM: Thông báo cho TCTH nếu lịch ở trạng thái chờ duyệt
 if (createdSchedule.status === 'pending') {
 const tcthUsers = allProfiles.filter(p => p.departments?.name === 'Tổ chức Tổng hợp');
 if (tcthUsers.length > 0) {
 const tcthNotifications = tcthUsers.map(user => ({
 user_id: user.id,
 title: "Yêu cầu lịch trình mới",
 content: `${profile?.full_name} vừa đăng ký lịch: ${newSchedule.title}. Vui lòng điều phối xe/phòng.`,
 link: "/dashboard/schedule"
 }));
 await supabase.from('notifications').insert(tcthNotifications);
 }
 }

 toast({ title: "Thành công", description: "Lịch trình đã được đăng ký." });
 setIsCreateOpen(false);
 fetchData();
 } catch (error: any) {
 toast({ variant: "destructive", title: "Lỗi", description: error.message });
 }
 };

 const weekDays = eachDayOfInterval({
 start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
 end: endOfWeek(selectedDate, { weekStartsOn: 1 })
 });

 const typeLabels: any = {
 briefing: { label: "Họp giao ban", color: "bg-red-50 text-red-600 border-red-100", icon: Users },
 meeting: { label: "Họp nội bộ", color: "bg-blue-50 text-blue-600 border-blue-100", icon: DoorOpen },
 trip: { label: "Đi công tác", color: "bg-orange-50 text-orange-600 border-orange-100", icon: Car },
 event: { label: "Sự kiện chi nhánh", color: "bg-purple-50 text-purple-600 border-purple-100", icon: CalendarIcon }
 };

 const statusLabels: any = {
 pending: { label: "Đang chờ duyệt", color: "bg-slate-100 text-slate-500" },
 approved: { label: "Đã xác nhận", color: "bg-emerald-100 text-emerald-600" },
 rejected: { label: "Từ chối", color: "bg-red-100 text-red-600" }
 };

  const isTodaySelected = isSameDay(selectedDate, new Date());
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startLimit = 8 * 60; // 08:00
  const endLimit = 17 * 60;  // 17:00
  const duration = endLimit - startLimit;
  const isWithinWorkingHours = currentMinutes >= startLimit && currentMinutes <= endLimit;
  const currentTimePercent = isWithinWorkingHours ? ((currentMinutes - startLimit) / duration) * 100 : -1;

 return (
 <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 animate-fade-in-up pb-20">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pt-4 sm:pt-0">
 <div className="space-y-1">
 <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
 Lịch trình
 </h1>
 <p className="text-[13px] text-slate-500 font-medium">Điều phối lịch họp & công tác</p>
 </div>
 <div className="flex items-center gap-3">
 <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
 <DialogTrigger asChild>
 <Button className="bg-primary hover:bg-primary/90 h-10 px-5 rounded-xl font-medium">
 <Plus className="w-5 h-5 mr-2" /> Đăng ký lịch mới
 </Button>
 </DialogTrigger>
 <DialogContent className="rounded-2xl border-none shadow-2xl max-w-lg p-6">
  <DialogHeader>
  <DialogTitle className="text-[17px] font-semibold text-slate-900">Thiết lập lịch trình mới</DialogTitle>
  </DialogHeader>
  <div className="space-y-5 py-4 max-h-[65vh] overflow-y-auto px-1">
 {/* 1. Thời gian */}
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-[13px] font-medium text-slate-500">Từ ngày</Label>
 <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
 <PopoverTrigger asChild>
 <Button variant="outline" className="w-full h-10 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-[14px]">
 <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
 {startDate ? format(startDate, "dd/MM/yyyy") : "Chọn ngày"}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
 <Calendar 
 mode="single" 
 selected={startDate} 
 onSelect={(date) => {
 setStartDate(date);
 if (date && endDate && date > endDate) setEndDate(date);
 setIsStartOpen(false);
 }} 
 initialFocus 
 locale={vi} 
 />
 </PopoverContent>
 </Popover>
 </div>
 <div className="space-y-2">
 <Label className="text-[13px] font-medium text-slate-500">Giờ đi</Label>
 <Select value={startTime} onValueChange={(v) => {
 setStartTime(v);
 const [h, m] = v.split(':');
 const endH = Math.min(parseInt(h) + 1, 18);
 setEndTime(`${endH.toString().padStart(2, '0')}:${m}`);
 }}>
 <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
 <Clock className="mr-2 h-4 w-4 text-primary" />
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-lg">
 {Array.from({ length: 12 }).map((_, i) => {
 const time = `${(i + 7).toString().padStart(2, '0')}:00`;
 return <SelectItem key={time} value={time}>{time}</SelectItem>;
 })}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-[13px] font-medium text-slate-500">Đến ngày</Label>
 <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
 <PopoverTrigger asChild>
 <Button variant="outline" className="w-full h-10 bg-slate-50 border-none rounded-xl font-medium justify-start text-left text-[14px]">
 <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
 {endDate ? format(endDate, "dd/MM/yyyy") : "Chọn ngày"}
 </Button>
 </PopoverTrigger>
 <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl z-[9999] pointer-events-auto" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
 <Calendar 
 mode="single" 
 selected={endDate} 
 onSelect={(date) => {
 if (date && startDate && date < startDate) {
 toast({ variant: "destructive", title: "Lỗi", description: "Ngày kết thúc không thể trước ngày bắt đầu." });
 return;
 }
 setEndDate(date);
 setIsEndOpen(false);
 }} 
 initialFocus 
 locale={vi} 
 />
 </PopoverContent>
 </Popover>
 </div>
 <div className="space-y-2">
 <Label className="text-[13px] font-medium text-slate-500">Giờ kết thúc</Label>
 <Select value={endTime} onValueChange={setEndTime}>
 <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
 <Clock className="mr-2 h-4 w-4 text-primary" />
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-lg">
 {Array.from({ length: 12 }).map((_, i) => {
 const time = `${(i + 7).toString().padStart(2, '0')}:00`;
 return <SelectItem key={time} value={time}>{time}</SelectItem>;
 })}
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* 2. Loại hình & Tiêu đề */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-[13px] font-medium text-slate-500">Loại hình</Label>
 <Select value={newSchedule.type} onValueChange={(v) => setNewSchedule({...newSchedule, type: v})}>
 <SelectTrigger className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]">
 <SelectValue />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-lg">
 <SelectItem value="briefing">Họp giao ban</SelectItem>
 <SelectItem value="meeting">Họp nội bộ</SelectItem>
 <SelectItem value="trip">Đi công tác</SelectItem>
 <SelectItem value="event">Sự kiện</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-[13px] font-medium text-slate-500">Tiêu đề</Label>
 <Input 
 placeholder="Nội dung chính..." 
 className="h-10 bg-slate-50 border-none rounded-xl font-medium text-[14px]"
 value={newSchedule.title}
 onChange={(e) => setNewSchedule({...newSchedule, title: e.target.value})}
 />
 </div>
 </div>

 {/* 3. Địa điểm & Phương tiện */}
 <div className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
 <div className="flex items-center justify-between mb-2">
 <Label className="text-[13px] font-medium text-slate-500">Địa điểm & Phương tiện</Label>
 <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
 <button 
 type="button"
 onClick={() => setNewSchedule({...newSchedule, room_id: 'none', location: ''})}
 className={cn("px-3 py-1.5 text-[13px] font-medium rounded-md transition-all", newSchedule.location !== 'Chi nhánh' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500")}
 >Ngoài</button>
 <button 
 type="button"
 onClick={() => setNewSchedule({...newSchedule, location: 'Chi nhánh', room_id: rooms[0]?.id || 'none'})}
 className={cn("px-3 py-1.5 text-[13px] font-medium rounded-md transition-all", newSchedule.location === 'Chi nhánh' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500")}
 >Chi nhánh</button>
 </div>
 </div>

 {newSchedule.location === 'Chi nhánh' ? (
 <div className="space-y-2 animate-in fade-in zoom-in-95 duration-300">
 <Label className="text-[10px] md:text-[13px] font-medium text-slate-500">Chọn phòng họp</Label>
 <Select value={newSchedule.room_id} onValueChange={(v) => setNewSchedule({...newSchedule, room_id: v})}>
 <SelectTrigger className="h-10 bg-white border-none rounded-xl font-medium shadow-sm text-[14px]">
 <SelectValue placeholder="Chọn phòng họp..." />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-lg">
 {rooms.map(r => <SelectItem key={r.id} value={r.id}>{r.name} ({r.capacity} chỗ)</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 ) : (
 <div className="relative animate-in fade-in zoom-in-95 duration-300">
 <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
 <Input 
 placeholder="Nhập địa chỉ / lộ trình cụ thể..." 
 className="h-10 bg-white border-none rounded-xl font-medium pl-11 shadow-sm text-[14px]"
 value={newSchedule.location}
 onChange={(e) => setNewSchedule({...newSchedule, location: e.target.value})}
 />
 </div>
 )}

 <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
 <div 
 onClick={() => setNewSchedule({...newSchedule, use_vehicle: !newSchedule.use_vehicle, vehicle_id: !newSchedule.use_vehicle ? 'none' : newSchedule.vehicle_id})}
 className={cn("w-10 h-6 rounded-full relative transition-colors cursor-pointer", newSchedule.use_vehicle ? "bg-primary" : "bg-slate-200")}
 >
 <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", newSchedule.use_vehicle ? "left-5" : "left-1")} />
 </div>
 <div className="flex flex-col">
 <span className="text-[14px] font-medium text-slate-900">SỬ DỤNG XE CƠ QUAN</span>
 <span className="text-[12px] text-slate-400 truncate">Tích chọn nếu cần điều xe</span>
 </div>
 </div>

 {newSchedule.use_vehicle && (
 <div className="animate-in slide-in-from-top-2 duration-300 space-y-3">
 <p className="text-[13px] font-medium text-slate-500">Loại xe cần đăng ký</p>
 <div className="flex gap-2 p-1 bg-white rounded-xl shadow-sm border border-slate-100">
 {['4 chỗ', '7 chỗ', 'Khác'].map(type => (
 <button 
 key={type}
 type="button"
 onClick={() => setNewSchedule({...newSchedule, requested_vehicle_type: type})}
 className={cn("flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all", newSchedule.requested_vehicle_type === type ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500")}
 >{type}</button>
 ))}
 </div>
 <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center gap-3">
 <div className="p-2 bg-white rounded-xl shadow-sm">
 <Car className="w-4 h-4 text-blue-600" />
 </div>
 <p className="text-xs font-bold text-blue-700 leading-tight">Yêu cầu của bạn sẽ được bộ phận TCTH phê duyệt và gán xe/lái xe cụ thể sau khi đăng ký.</p>
 </div>
 </div>
 )}
 </div>

   {/* 4. Thành phần tham gia */}
  <div className="space-y-6 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
    <div className="flex items-center gap-2">
      <Users className="w-4 h-4 text-primary" />
      <Label className="text-[13px] font-semibold text-slate-900">Thành phần tham gia</Label>
    </div>
    
    <div className="space-y-6">
      {/* Part 1: BGĐ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold text-slate-500 flex items-center gap-2">
            <div className="w-1 h-3 bg-red-500 rounded-full" /> 1. BAN GIÁM ĐỐC
          </div>
          <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
            <button 
              type="button"
              onClick={() => setBgdMode('all')}
              className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", bgdMode === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
            >Tất cả</button>
            <button 
              type="button"
              onClick={() => setBgdMode('specific')}
              className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", bgdMode === 'specific' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
            >Chọn</button>
            <button 
              type="button"
              onClick={() => { setBgdMode('none'); setSelectedBGD([]); }}
              className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", bgdMode === 'none' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
            >Không ai</button>
          </div>
        </div>
        
        {bgdMode === 'specific' && (
          <div className="flex flex-wrap gap-2 pl-3 animate-in fade-in slide-in-from-top-1">
            {allProfiles.filter(p => (p.role === 'director' || p.full_name?.toLowerCase().includes('giám đốc')) && !p.full_name?.toLowerCase().includes('admin') && p.role !== 'admin').map(p => (
              <button 
                key={p.id}
                type="button"
                onClick={() => selectedBGD.includes(p.id) ? setSelectedBGD(selectedBGD.filter(id => id !== p.id)) : setSelectedBGD([...selectedBGD, p.id])}
                className={cn("px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border", selectedBGD.includes(p.id) ? "bg-red-500 text-white border-red-500 shadow-md shadow-red-500/10" : "bg-slate-50 text-slate-500 border-slate-100")}
              >{p.full_name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Part 2: PHÒNG */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-semibold text-slate-500 flex items-center gap-2">
            <div className="w-1 h-3 bg-blue-500 rounded-full" /> 2. ĐƠN VỊ / PHÒNG
          </div>
          <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
            <button 
              type="button"
              onClick={() => setDeptMode('all')}
              className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", deptMode === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
            >Tất cả</button>
            <button 
              type="button"
              onClick={() => setDeptMode('specific')}
              className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", deptMode === 'specific' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
            >Chọn</button>
            <button 
              type="button"
              onClick={() => { setDeptMode('none'); setFilterDepts([]); setSelectedParticipants([]); }}
              className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", deptMode === 'none' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
            >Không ai</button>
          </div>
        </div>

        {deptMode === 'specific' && (
          <div className="flex flex-wrap gap-2 pl-3 animate-in fade-in slide-in-from-top-1">
            {departments.map(d => (
              <button 
                key={d.id}
                type="button"
                onClick={() => filterDepts.includes(d.id) ? setFilterDepts(filterDepts.filter(id => id !== d.id)) : setFilterDepts([...filterDepts, d.id])}
                className={cn("rounded-lg text-[13px] font-medium h-8 px-3 transition-all border", filterDepts.includes(d.id) ? "bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20" : "bg-slate-50 text-slate-500 border-slate-100")}
              >{d.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Part 3: CÁN BỘ */}
      {(deptMode === 'specific' && filterDepts.length > 0) && (
        <div className="space-y-3 pt-2 border-t border-slate-50 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-slate-500 flex items-center gap-2">
              <div className="w-1 h-3 bg-emerald-500 rounded-full" /> 3. CHI TIẾT CÁN BỘ
            </div>
            <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
              <button 
                type="button"
                onClick={() => setParticipantMode('all')}
                className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", participantMode === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >Tất cả</button>
              <button 
                type="button"
                onClick={() => setParticipantMode('manager')}
                className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", participantMode === 'manager' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >Lãnh đạo</button>
              <button 
                type="button"
                onClick={() => setParticipantMode('staff')}
                className={cn("px-2.5 py-1 text-[11px] font-bold rounded-md transition-all shrink-0", participantMode === 'staff' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
              >Cán bộ</button>
            </div>
          </div>

          <div className="pl-3">
            {participantMode === 'staff' ? (
              <div className="max-h-40 overflow-y-auto pr-2 space-y-4 animate-in fade-in slide-in-from-top-2">
                {departments.filter(d => filterDepts.includes(d.id)).map(dept => {
                  const deptMembers = allProfiles.filter(p => p.department_id === dept.id && p.role !== 'admin' && p.role !== 'director');
                  if (deptMembers.length === 0) return null;
                  return (
                    <div key={dept.id} className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{dept.name}</p>
                      <div className="flex flex-wrap gap-2">
                        {deptMembers.map(p => {
                          const isSelected = selectedParticipants.includes(p.id);
                          const initials = p.full_name ? p.full_name.trim().split(' ').pop()?.substring(0, 2).toUpperCase() || 'CB' : 'CB';
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => selectedParticipants.includes(p.id) ? setSelectedParticipants(selectedParticipants.filter(id => id !== p.id)) : setSelectedParticipants([...selectedParticipants, p.id])}
                              className={cn(
                                "flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 shrink-0",
                                isSelected 
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 ring-2 ring-emerald-500/10 shadow-sm" 
                                  : "bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:border-slate-300"
                              )}
                            >
                              <Avatar className="w-5 h-5 text-[9px] font-bold shadow-xs">
                                {p.avatar_url ? (
                                  <AvatarImage src={p.avatar_url} alt={p.full_name} />
                                ) : (
                                  <AvatarFallback className={cn(
                                    "text-white",
                                    isSelected ? "bg-emerald-600" : "bg-slate-400"
                                  )}>
                                    {initials}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <span className="truncate max-w-[120px]">{p.full_name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-2">
                {participantMode === 'all' && (
                  <p className="text-xs font-bold text-slate-500 italic">✓ Tự động mời tất cả cán bộ thuộc các phòng đã chọn.</p>
                )}
                {participantMode === 'manager' && (
                  <p className="text-xs font-bold text-slate-500 italic">✓ Tự động mời Lãnh đạo các phòng đã chọn.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  </div>

  {conflicts.length > 0 && (
    <div className="p-3 bg-red-50/50 rounded-2xl border border-red-100 mt-4 space-y-2 animate-in fade-in zoom-in-95">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-600" />
        <span className="text-[13px] font-semibold text-red-700">Cảnh báo trùng lịch</span>
      </div>
      <ul className="list-disc pl-5 text-xs font-medium text-red-600/80 space-y-1">
        {conflicts.map((c, i) => (
          <li key={i} className="leading-relaxed">{c}</li>
        ))}
      </ul>
    </div>
  )}
</div>
  <DialogFooter className="pt-4 border-t border-slate-100">
  <Button onClick={handleCreateSchedule} className="w-full h-10 rounded-xl font-semibold">Xác nhận đăng ký</Button>
  </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 </div>

 {/* Date Navigator */}
 <div className="w-full">
 <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <CalendarDays className="w-4 h-4 text-primary" />
 <span className="text-[15px] font-bold text-slate-900 whitespace-nowrap">
 Tháng {format(selectedDate, 'MM, yyyy')}
 </span>
 </div>
 <div className="flex items-center gap-1.5">
 <Button variant="outline" size="icon" className="rounded-lg border-slate-200 h-8 w-8" onClick={() => setSelectedDate(addDays(selectedDate, -7))}>
 <ChevronLeft className="w-4 h-4" />
 </Button>
 <Button variant="outline" className="rounded-lg border-slate-200 font-semibold h-8 px-3 text-[13px]" onClick={() => setSelectedDate(new Date())}>
 Hôm nay
 </Button>
 <Button variant="outline" size="icon" className="rounded-lg border-slate-200 h-8 w-8" onClick={() => setSelectedDate(addDays(selectedDate, 7))}>
 <ChevronRight className="w-4 h-4" />
 </Button>
 </div>
 </div>

 <div className="grid grid-cols-7 gap-1">
 {weekDays.map((day, idx) => {
 const isSelected = isSameDay(day, selectedDate);
 const isToday = isSameDay(day, new Date());
 return (
 <button 
 key={idx}
 onClick={() => setSelectedDate(day)}
 className={cn(
 "flex flex-col items-center py-2.5 rounded-xl transition-all relative",
 isSelected 
 ? "bg-primary text-white ring-2 ring-primary/20" 
 : "hover:bg-slate-100 text-slate-500"
 )}
 >
 <span className={cn(
 "text-[9px] font-bold uppercase mb-1", 
 isSelected ? "text-white/70" : "text-slate-400"
 )}>
 {format(day, 'EEEEEE', { locale: vi })}
 </span>
 <span className={cn(
 "text-[15px] font-bold",
 isSelected ? "" : ""
 )}>
 {format(day, 'd')}
 </span>
 {isToday && !isSelected && (
 <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
 )}
 </button>
 );
 })}
 </div>
 </div>
 </div>

 {/* Tabs System for different views */}
 <Tabs defaultValue="calendar" className="space-y-8 w-full">
 <TabsList className="bg-slate-100/60 p-1 rounded-xl h-auto w-full flex">
 <TabsTrigger value="calendar" className="flex-1 rounded-lg px-5 py-2 font-medium text-[14px] data-[state=active]:bg-white data-[state=active]:shadow-sm">
 <CalendarIcon className="w-4 h-4 mr-2" /> Lịch biểu
 </TabsTrigger>
 {profile?.departments?.name === 'Tổ chức Tổng hợp' && (
 <TabsTrigger value="tcth" className="flex-1 rounded-lg px-5 py-2 font-medium text-[14px] data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-sm relative">
 <ShieldCheck className="w-4 h-4 mr-2" /> Điều phối
 {schedules.filter(s => s.use_vehicle && !s.vehicle_id).length > 0 && (
 <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] md:text-xs text-white shadow-sm">
 {schedules.filter(s => s.use_vehicle && !s.vehicle_id).length}
 </span>
 )}
 </TabsTrigger>
 )}
 </TabsList>

 <TabsContent value="calendar" className="space-y-8 animate-in fade-in duration-500">
  {/* Smart Filters */}
  <div className="flex bg-slate-100/60 p-1 rounded-xl w-full">
  <button 
  type="button"
  onClick={() => setFilterType('all')}
  className={cn("flex-1 px-2 md:px-5 py-2 text-[12px] md:text-[14px] font-medium rounded-lg transition-all", filterType === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
  >Toàn chi nhánh</button>
  <button 
  type="button"
  onClick={() => setFilterType('bgd')}
  className={cn("flex-1 px-2 md:px-5 py-2 text-[12px] md:text-[14px] font-medium rounded-lg transition-all", filterType === 'bgd' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
  >Ban giám đốc</button>
  <button 
  type="button"
  onClick={() => setFilterType('dept')}
  className={cn("flex-1 px-2 md:px-5 py-2 text-[12px] md:text-[14px] font-medium rounded-lg transition-all", filterType === 'dept' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
  >Phòng của tôi</button>
  </div>

  {/* Schedule List */}
  <div className="space-y-4">
  <h3 className="text-[13px] font-medium text-slate-500 flex items-center gap-2 px-2">
  <Clock className="w-3.5 h-3.5 text-primary" /> Lịch trình ngày {format(selectedDate, 'dd/MM/yyyy')}
  </h3>

  {loading ? (
   <div className="flex h-48 items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm">
   <Loader2 className="h-6 w-6 animate-spin text-primary" />
   </div>
   ) : (
    filterType === 'bgd' ? (
      <div className="space-y-6 overflow-hidden animate-in fade-in duration-150">
        {/* Scrollable Container on Mobile - Được bọc nền trắng sang trọng, ẩn scrollbar xấu xí nhưng vẫn vuốt mượt mà */}
        <div 
          ref={timelineContainerRef}
          className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto pb-2 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="min-w-[850px] space-y-4">
            
            {/* Timeline Header Row (Hours Grid) */}
            <div className="relative h-6 text-[10px] font-bold text-slate-500 select-none w-full border-b border-slate-100 pb-2 mb-4">
              <span className="absolute left-[0%] -translate-x-1/2">08:00</span>
              <span className="absolute left-[11.11%] -translate-x-1/2">09:00</span>
              <span className="absolute left-[22.22%] -translate-x-1/2">10:00</span>
              <span className="absolute left-[33.33%] -translate-x-1/2">11:00</span>
              <span className="absolute left-[44.44%] -translate-x-1/2">12:00</span>
              <span className="absolute left-[55.55%] -translate-x-1/2">13:00</span>
              <span className="absolute left-[66.66%] -translate-x-1/2">14:00</span>
              <span className="absolute left-[77.77%] -translate-x-1/2">15:00</span>
              <span className="absolute left-[88.88%] -translate-x-1/2">16:00</span>
              <span className="absolute left-[100%] -translate-x-1/2">17:00</span>
            </div>

            {/* Directors Rows */}
            <div className="space-y-1.5">
              {allProfiles.filter(p => (p.role === 'director' || p.full_name?.toLowerCase().includes('giám đốc')) && !p.full_name?.toLowerCase().includes('admin') && p.role !== 'admin').map(dir => {
                const dirColor = getDirectorColor(dir.full_name);
                const dirSchedules = schedules.filter(s => {
                  const onDay = isSameDay(new Date(s.start_time), selectedDate);
                  if (!onDay) return false;
                  return s.participants?.some((p: any) => p.profile?.id === dir.id);
                });

                return (
                  <div key={dir.id} className="relative w-full h-8 flex items-center border-b border-slate-100/50 last:border-none">
                    


                    {/* 9 columns grid for hours 08:00 to 17:00 */}
                    <div className="absolute inset-0 pointer-events-none flex">
                      {Array.from({ length: 9 }).map((_, idx) => (
                        <div key={idx} className="flex-1 border-r border-slate-200/20 last:border-none" />
                      ))}
                    </div>

                    {/* Dynamic thin background line */}
                    <div className="absolute left-0 right-0 h-1 bg-slate-100 rounded-full mx-1 pointer-events-none" />

                    {/* Current time line marker */}
                    {isTodaySelected && currentTimePercent >= 0 && (
                      <div 
                        style={{ left: `${currentTimePercent}%` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-20 pointer-events-none"
                      >
                        <div className="absolute top-0 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-red-500/20 animate-pulse" />
                      </div>
                    )}

                    {/* Vẽ thanh xám phủ kín 100% dòng timeline nếu Giám đốc có lịch nghỉ phép được phê duyệt */}
                    {dirSchedules.some(s => s.type === 'leave' && s.status === 'approved') ? (() => {
                      const leaveSched = dirSchedules.find(s => s.type === 'leave' && s.status === 'approved');
                      return (
                        <div 
                          onClick={() => { setSelectedSchedule(leaveSched); setIsDetailOpen(true); }}
                          className="absolute inset-x-0 h-6 mx-1 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/50 rounded-lg z-10 flex items-center justify-center cursor-pointer transition-all select-none shadow-2xs"
                        >
                          <span className="text-[9px] font-black text-slate-500 tracking-widest flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> NGHỈ PHÉP
                          </span>
                        </div>
                      );
                    })() : dirSchedules.length > 0 && (
                      <div className="relative w-full h-full z-10 flex items-center">
                        {dirSchedules.map(sched => {
                          const sTime = new Date(sched.start_time);
                          const eTime = new Date(sched.end_time);
                          
                          const sMin = sTime.getHours() * 60 + sTime.getMinutes();
                          const eMin = eTime.getHours() * 60 + eTime.getMinutes();
                          
                          const leftPercent = Math.max(0, Math.min(100, ((sMin - startLimit) / duration) * 100));
                          const widthPercent = Math.max(4, Math.min(100 - leftPercent, ((eMin - sMin) / duration) * 100));
                          
                          // Line màu trùng khớp hoàn hảo với màu đại diện của từng thành viên BGĐ
                          const typeColor = dirColor.bullet;

                          return (
                            <div
                              key={sched.id}
                              onClick={() => { setSelectedSchedule(sched); setIsDetailOpen(true); }}
                              style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                              className={`absolute h-2.5 rounded-full cursor-pointer transition-all hover:scale-y-125 hover:shadow-xs active:scale-[0.95] select-none ${typeColor} border-none shadow-xs`}
                              title={`${sched.title} (${format(sTime, 'HH:mm')} - ${format(eTime, 'HH:mm')})`}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend Row below the table - Premium vertical symmetrical list bọc trong Card trắng đồng bộ */}
        <div className="max-w-md mx-auto bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-2">
          {allProfiles.filter(p => (p.role === 'director' || p.full_name?.toLowerCase().includes('giám đốc')) && !p.full_name?.toLowerCase().includes('admin') && p.role !== 'admin').map(dir => {
            const dirColor = getDirectorColor(dir.full_name);
            
            // Determine real-time status dynamically based on active schedules
            const now = new Date();
            const onTrip = schedules.some(s => 
              s.status === 'approved' && 
              s.type === 'trip' && 
              new Date(s.start_time) <= now && 
              new Date(s.end_time) >= now &&
              s.participants?.some((p: any) => p.profile_id === dir.id)
            );
            const onLeave = schedules.some(s => 
              s.status === 'approved' && 
              s.type === 'leave' && 
              new Date(s.start_time) <= now && 
              new Date(s.end_time) >= now &&
              s.participants?.some((p: any) => p.profile_id === dir.id)
            );

            return (
              <div key={dir.id} className="flex justify-between items-center py-2 border-b border-slate-100/50 last:border-none px-1">
                {/* Left: Name and Bullet */}
                <div className="flex items-center gap-2.5">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dirColor.bullet} shadow-xs ring-2 ring-white`} />
                  <span className="text-[13px] font-bold text-slate-800 tracking-tight">{dir.full_name}</span>
                </div>

                {/* Right: Symmetrical status badge */}
                <div>
                  {onLeave ? (
                    <Badge className="bg-slate-100 hover:bg-slate-100 text-slate-500 border border-slate-200/80 rounded-full font-extrabold text-[10px] px-3 py-1 shadow-2xs">
                      Nghỉ phép
                    </Badge>
                  ) : onTrip ? (
                    <Badge className="bg-orange-50 hover:bg-orange-50 text-orange-600 border border-orange-200/80 rounded-full font-extrabold text-[10px] px-3 py-1 shadow-2xs">
                      Công tác
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-50 hover:bg-emerald-50 text-emerald-600 border border-emerald-200/80 rounded-full font-extrabold text-[10px] px-3 py-1 shadow-2xs">
                      Chi nhánh
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {schedules
      .filter(s => {
      const onDay = isSameDay(new Date(s.start_time), selectedDate);
      if (!onDay) return false;
      if (filterType === 'dept') return s.department_id === profile?.department_id;
      return true;
      })
      .map((item) => {
        const type = typeLabels[item.type] || typeLabels.meeting;
        const status = statusLabels[item.status];
        const isTrip = item.type === 'trip';
        
        return (
        <Card key={item.id} className={cn(
        "rounded-2xl overflow-hidden border-none shadow-sm hover:shadow-xl transition-all duration-500 group",
        isTrip ? "hover:bg-orange-50/30" : "hover:bg-blue-50/30"
        )}>
        <CardContent className="p-0 cursor-pointer" onClick={() => { setSelectedSchedule(item); setIsDetailOpen(true); }}>
        <div className="flex">
        {/* Left color bar */}
        <div className={cn("w-2 transition-all duration-500 group-hover:w-3", isTrip ? "bg-orange-400" : "bg-blue-500")} />
        
        <div className="flex-1 p-4 space-y-3">
        <div className="flex items-start justify-between">
        <div className="space-y-1.5 flex-1 min-w-0 pr-2">
        <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
        <Badge variant="outline" className={cn("text-[10px] md:text-[11px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap", type.color)}>
        <type.icon className="w-3 h-3 mr-1 shrink-0" /> {type.label}
        </Badge>
        {item.use_vehicle && !item.vehicle_id && (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-bold text-[10px] md:text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap">
        <Car className="w-2.5 h-2.5 shrink-0" /> CHỜ ĐIỀU XE
        </Badge>
        )}
        <Badge className={cn("text-[10px] md:text-[11px] font-bold uppercase px-2 py-0.5 rounded-md whitespace-nowrap", status.color)}>
        {status.label}
        </Badge>
        </div>
        <h3 className="text-[15px] md:text-base font-bold text-slate-900 leading-tight line-clamp-2 pt-1">{item.title}</h3>
        </div>
        
        <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-white transition-colors">
        <MoreVertical className="w-3.5 h-3.5 text-slate-500" />
        </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-xl", isTrip ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600")}>
        <Clock className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
        <span className="text-[14px] font-medium text-slate-900">
        {format(new Date(item.start_time), 'HH:mm')}
        </span>
        <span className="text-[11px] text-slate-500 truncate">Bắt đầu</span>
        </div>
        </div>
        <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-100 text-slate-500 rounded-xl">
        <Clock className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
        <span className="text-[14px] font-medium text-slate-900">
        {format(new Date(item.end_time), 'HH:mm')}
        </span>
        <span className="text-[11px] text-slate-500 truncate">Kết thúc</span>
        </div>
        </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-50">
        <div className="flex items-center gap-2">
        <Users className="w-3.5 h-3.5 text-slate-500" />
        <div className="flex -space-x-2 overflow-hidden">
        {item.participants?.slice(0, 5).map((p: any, idx: number) => (
        <Avatar key={idx} className="h-6 w-6 border-2 border-white">
        <AvatarImage src={p.profile?.avatar_url} />
        <AvatarFallback className="text-[8px] font-bold">{p.profile?.full_name?.[0]}</AvatarFallback>
        </Avatar>
        ))}
        {item.participants?.length > 5 && (
        <div className="h-6 w-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-slate-500">
        +{item.participants.length - 5}
        </div>
        )}
        </div>
        </div>
        
        {item.room && (
        <div className="flex items-center gap-1.5 max-w-[140px]">
        <DoorOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span className="text-[11px] md:text-xs font-bold text-blue-600 truncate">{item.room.name}</span>
        </div>
        )}

        {item.vehicle && (
        <div className="flex items-center gap-1.5 max-w-[120px]">
        <Car className="w-3.5 h-3.5 text-orange-500 shrink-0" />
        <span className="text-[11px] md:text-xs font-bold text-orange-600 truncate">{item.vehicle.plate_number}</span>
        </div>
        )}

        {!item.room && !item.vehicle && item.location && (
        <div className="flex items-center gap-2">
        <MapPin className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">{item.location}</span>
        </div>
        )}
        </div>
        {isTCTH && item.status === 'pending' && (
        <div className="flex gap-2 pt-4 border-t border-slate-50">
        <Button 
        size="sm" 
        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(item.id, 'approved'); }}
        className="bg-emerald-500 hover:bg-emerald-600 h-10 md:h-9 rounded-xl font-bold text-xs md:text-[11px] shadow-lg shadow-emerald-500/20 px-4"
        >
        Duyệt lịch
        </Button>
        <Button 
        size="sm" 
        variant="outline" 
        onClick={(e) => { e.stopPropagation(); handleStatusUpdate(item.id, 'rejected'); }}
        className="h-10 md:h-9 rounded-xl font-bold text-xs md:text-[11px] border-red-100 text-red-500 hover:bg-red-50 hover:text-red-600 px-4"
        >
        Từ chối
        </Button>
        </div>
        )}
        </div>
        </div>
        </CardContent>
        </Card>
        );
      })}
      </div>
    )
  )}
  </div>
  </TabsContent>

 {/* TCTH Operational Dashboard */}
 {profile?.departments?.name === 'Tổ chức Tổng hợp' && (
 <TabsContent value="tcth" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
 {/* 1. Pending Requests Section */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3 tabular-nums tracking-tighter">
 <ShieldCheck className="w-6 h-6 text-orange-500" /> Danh sách yêu cầu cần xử lý
 </h2>
 <Badge className="bg-orange-100 text-orange-600 border-none font-bold px-4 py-1.5 rounded-xl">
 {schedules.filter(s => s.use_vehicle && !s.vehicle_id).length} YÊU CẦU MỚI
 </Badge>
 </div>

 <div className="grid grid-cols-1 gap-4">
 {schedules.filter(s => s.use_vehicle && !s.vehicle_id).length === 0 ? (
 <Card className="rounded-2xl border-dashed border-2 border-slate-200 bg-slate-50/30 p-10 flex flex-col items-center justify-center text-center">
 <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
 <CheckCircle2 className="w-8 h-8 text-emerald-500" />
 </div>
 <h3 className="text-base font-bold text-slate-800">Tuyệt vời!</h3>
 <p className="text-slate-500 font-bold text-xs max-w-xs mt-1">Hiện tại không còn yêu cầu gán xe nào đang bị treo.</p>
 </Card>
 ) : (
 schedules.filter(s => s.use_vehicle && !s.vehicle_id).map((s) => (
 <Card key={s.id} className="rounded-xl border-none shadow-sm hover:shadow-xl transition-all duration-500 group overflow-hidden bg-white">
 <div className="flex flex-col sm:flex-row items-center p-1">
 <div className="flex-1 p-4 space-y-3">
 <div className="flex items-center gap-3">
 <Avatar className="h-11 w-11 border-2 border-slate-50 shadow-sm">
 <AvatarImage src={s.creator?.avatar_url} />
 <AvatarFallback className="bg-slate-100 font-bold text-xs">{s.creator?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <div>
 <p className="text-sm font-bold text-slate-900">{s.creator?.full_name}</p>
 <p className="text-[13px] font-medium text-slate-500">{s.departments?.name || "Cán bộ nghiệp vụ"}</p>
 </div>
 </div>
 
 <div className="space-y-0.5">
 <h4 className="font-bold text-slate-800 text-sm">{s.title}</h4>
 <div className="flex items-center gap-3 text-[13px] font-medium text-slate-500">
 <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {format(new Date(s.start_time), 'dd/MM HH:mm')}</div>
 <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {s.location}</div>
 </div>
 </div>
 </div>

 <div className="w-px h-16 bg-slate-100 hidden sm:block" />

 <div className="p-4 flex items-center gap-6">
 <div className="flex flex-col items-center gap-1">
 <span className="text-[13px] font-medium text-slate-500">Yêu cầu xe</span>
 <Badge className="bg-orange-500 text-white border-none font-bold px-3 py-1 rounded-lg shadow-lg shadow-orange-500/20">
 {s.requested_vehicle_type}
 </Badge>
 </div>
 <Button 
 className="rounded-xl bg-slate-900 hover:bg-primary text-white h-12 md:h-10 px-6 font-bold text-xs uppercase transition-all shadow-xl active:scale-95 truncate whitespace-nowrap"
 onClick={() => {
 setSelectedSchedule(s);
 setIsDetailOpen(true);
 }}
 >
 Gán Xe & Lái xe
 </Button>
 </div>
 </div>
 </Card>
 ))
 )}
 </div>
 </div>

 {/* 2. Resource Status Monitoring Section (Integrated) */}
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
 <div className="space-y-4">
 <h3 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 pl-2 truncate whitespace-nowrap">
 <Car className="w-4 h-4 text-emerald-500" /> Giám sát Đội xe thời gian thực
 </h3>
 <div className="grid grid-cols-1 gap-3">
 {vehicles.map(v => {
 const currentTrip = schedules.find(s => s.vehicle_id === v.id && (s.status === 'approved' || s.status === 'pending') && isSameDay(new Date(s.start_time), selectedDate));
 const isBusy = currentTrip?.status === 'approved';
 const isPending = currentTrip?.status === 'pending';
 return (
 <Card key={v.id} className="rounded-xl border-none shadow-sm bg-white overflow-hidden group">
 <div className="p-4 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className={cn("p-4 rounded-2xl transition-all group-hover:scale-110 duration-500", isBusy ? "bg-orange-50 text-orange-500" : isPending ? "bg-amber-50 text-amber-500" : "bg-emerald-50 text-emerald-500")}>
 <Car className="w-6 h-6" />
 </div>
 <div>
 <p className="font-bold text-slate-900">{v.name}</p>
 <p className="text-[11px] text-slate-500 truncate">{v.plate_number}</p>
 </div>
 </div>
 <Badge className={cn("rounded-lg font-bold text-[9px] uppercase px-3 py-1", isBusy ? "bg-orange-500 text-white" : "bg-emerald-500 text-white")}>
 {isBusy ? "Bận" : "Sẵn sàng"}
 </Badge>
 </div>
 {isBusy && (
 <div className="px-6 py-4 bg-orange-50/50 border-t border-orange-100/50 flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Avatar className="h-6 w-6">
 <AvatarImage src={currentTrip.creator?.avatar_url} />
 <AvatarFallback className="text-[8px] font-bold">{currentTrip.creator?.full_name?.[0]}</AvatarFallback>
 </Avatar>
 <span className="text-xs font-bold text-slate-600">{currentTrip.creator?.full_name}</span>
 </div>
 <span className="text-[10px] font-bold text-orange-600 uppercase truncate whitespace-nowrap">{format(new Date(currentTrip.start_time), 'HH:mm')} - {format(new Date(currentTrip.end_time), 'HH:mm')}</span>
 </div>
 )}
 </Card>
 );
 })}
 </div>
 </div>

 <div className="space-y-4">
 <h3 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 pl-2 truncate whitespace-nowrap">
 <DoorOpen className="w-4 h-4 text-blue-500" /> Tình trạng Phòng họp
 </h3>
 <div className="grid grid-cols-1 gap-3">
 {rooms.map(r => {
 const currentMeeting = schedules.find(s => s.room_id === r.id && (s.status === 'approved' || s.status === 'pending') && isSameDay(new Date(s.start_time), selectedDate));
 const isBusy = currentMeeting?.status === 'approved';
 const isPending = currentMeeting?.status === 'pending';
 return (
 <Card key={r.id} className="rounded-xl border-none shadow-sm bg-white overflow-hidden group">
 <div className="p-4 flex items-center justify-between">
 <div className="flex items-center gap-4">
 <div className={cn("p-4 rounded-2xl transition-all group-hover:scale-110 duration-500", isBusy ? "bg-blue-50 text-blue-500" : "bg-emerald-50 text-emerald-500")}>
 <DoorOpen className="w-5 h-5" />
 </div>
 <div>
 <p className="font-bold text-slate-900 text-sm">{r.name}</p>
 <p className="text-[9px] font-bold text-slate-500 uppercase">{r.capacity} chỗ • {r.location}</p>
 </div>
 </div>
 <Badge className={cn("rounded-lg font-bold text-[9px] uppercase px-3 py-1", isBusy ? "bg-blue-600 text-white" : isPending ? "bg-amber-100 text-amber-600 shadow-none border-none" : "bg-emerald-500 text-white")}>
 {isBusy ? "Họp" : isPending ? "Chờ duyệt" : "Trống"}
 </Badge>
 </div>
 </Card>
 );
 })}
 </div>
 </div>
 </div>
 </TabsContent>
 )}
 </Tabs>

 {/* Legacy Admin Quick Status (Keep hidden from normal flow or remove if redundant) */}
 <div className="hidden grid grid-cols-1 lg:grid-cols-2 gap-8 mt-12">
 {/* Fleet Status */}
 <div className="space-y-6">
 <div className="flex items-center justify-between px-2">
 <h3 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 truncate whitespace-nowrap">
 <Car className="w-3.5 h-3.5 text-primary" /> GIÁM SÁT ĐỘI XE
 </h3>
 <Badge variant="outline" className="text-[9px] font-bold border-slate-100 text-slate-500">{vehicles.length} XE</Badge>
 </div>
 
 <div className="grid grid-cols-1 gap-3">
 {vehicles.map(v => {
 const currentTrip = schedules.find(s => s.vehicle_id === v.id && s.status === 'approved' && isSameDay(new Date(s.start_time), selectedDate));
 const isBusy = !!currentTrip;

 return (
 <div key={v.id} className="premium-card p-6 border-none hover:shadow-md transition-all group relative overflow-hidden">
 <div className="flex items-center justify-between relative z-10">
 <div className="flex items-center gap-4">
 <div className={cn("p-3 rounded-2xl transition-colors", isBusy ? "bg-orange-50 text-orange-500" : "bg-emerald-50 text-emerald-500")}>
 <Car className="w-5 h-5" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-bold text-slate-900">{v.name}</span>
 <Badge className={cn("text-[9px] font-bold px-2 py-0 h-4 rounded-md uppercase", isBusy ? "bg-orange-100 text-orange-600" : "bg-emerald-100 text-emerald-600")}>
 {isBusy ? "Đang đi" : "Sẵn sàng"}
 </Badge>
 </div>
 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5 truncate whitespace-nowrap">{v.plate_number}</p>
 </div>
 </div>
 
 {isBusy && (
 <div className="text-right">
 <p className="text-[11px] text-slate-500 truncate">Đang đi cùng:</p>
 <p className="text-[11px] font-bold text-slate-700">{currentTrip.creator?.full_name}</p>
 </div>
 )}
 </div>
 {/* Background decoration */}
 <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 transition-colors", isBusy ? "bg-orange-500" : "bg-emerald-500")} />
 </div>
 );
 })}
 </div>
 </div>

 {/* Rooms Status */}
 <div className="space-y-6">
 <div className="flex items-center justify-between px-2">
 <h3 className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2 truncate whitespace-nowrap">
 <DoorOpen className="w-3.5 h-3.5 text-primary" /> TRẠNG THÁI PHÒNG HỌP
 </h3>
 <Badge variant="outline" className="text-[9px] font-bold border-slate-100 text-slate-500">{rooms.length} PHÒNG</Badge>
 </div>

 <div className="grid grid-cols-1 gap-3">
 {rooms.map(r => {
 const currentMeeting = schedules.find(s => s.room_id === r.id && s.status === 'approved' && isSameDay(new Date(s.start_time), selectedDate));
 const isBusy = !!currentMeeting;

 return (
 <div key={r.id} className="premium-card p-6 border-none hover:shadow-md transition-all group relative overflow-hidden">
 <div className="flex items-center justify-between relative z-10">
 <div className="flex items-center gap-4">
 <div className={cn("p-3 rounded-2xl transition-colors", isBusy ? "bg-blue-50 text-blue-500" : "bg-emerald-50 text-emerald-500")}>
 <DoorOpen className="w-5 h-5" />
 </div>
 <div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-bold text-slate-900">{r.name}</span>
 <Badge className={cn("text-[9px] font-bold px-2 py-0 h-4 rounded-md uppercase", isBusy ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600")}>
 {isBusy ? "Đang họp" : "Trống"}
 </Badge>
 </div>
 <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5 truncate whitespace-nowrap">{r.capacity} chỗ - {r.location}</p>
 </div>
 </div>
 
 {isBusy && (
 <div className="text-right">
 <p className="text-[11px] text-slate-500 truncate">Chủ trì:</p>
 <p className="text-[11px] font-bold text-slate-700">{currentMeeting.creator?.full_name}</p>
 </div>
 )}
 </div>
 <div className={cn("absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-10 transition-colors", isBusy ? "bg-blue-500" : "bg-emerald-500")} />
 </div>
 );
 })}
 </div>
 </div>
 </div>
 {/* Detail Dialog */}
 <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
 <DialogContent className="rounded-2xl border-none shadow-2xl max-w-xl p-0 overflow-hidden">
 <DialogHeader className="sr-only">
 <DialogTitle className="text-[17px] font-semibold text-slate-900">Chi tiết lịch trình</DialogTitle>
 </DialogHeader>
 {selectedSchedule && (
 <div className="flex flex-col">
 <div className={cn("p-6 text-white relative overflow-hidden", selectedSchedule.type === 'trip' ? "bg-amber-600" : "bg-slate-900")}>
 <div className="relative z-10 space-y-2">
 <Badge className="bg-white text-slate-900 border-none font-bold text-[10px] px-3 py-1">
 {typeLabels[selectedSchedule.type]?.label.toUpperCase()}
 </Badge>
 <h2 className="text-2xl font-bold leading-tight tabular-nums tracking-tighter">{selectedSchedule.title}</h2>
 <div className="flex items-center gap-4 text-white/80 text-xs font-bold pt-2">
 <div className="flex items-center gap-1.5">
 <Clock className="w-3.5 h-3.5" />
 {format(new Date(selectedSchedule.start_time), 'HH:mm dd/MM')} - {format(new Date(selectedSchedule.end_time), 'HH:mm dd/MM')}
 </div>
 </div>
 </div>
 <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/80 rounded-full blur-3xl" />
 </div>

 <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
 {/* Description */}
 {selectedSchedule.description && (
 <div className="space-y-2">
 <p className="text-[11px] text-slate-500 truncate">Nội dung chi tiết</p>
 <p className="text-sm font-bold text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl">{selectedSchedule.description}</p>
 </div>
 )}

 {/* Resource Info */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-2">
 <p className="text-[11px] text-slate-500 truncate">Địa điểm / Phòng họp</p>
 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
 <div className="p-2 bg-white rounded-xl shadow-sm">
 <MapPin className="w-4 h-4 text-blue-600" />
 </div>
 <p className="text-xs font-bold text-slate-700">{selectedSchedule.room?.name || selectedSchedule.location || "Chưa xác định"}</p>
 </div>
 </div>

 {selectedSchedule.use_vehicle && (
 <div className="space-y-2">
 <p className="text-[11px] text-slate-500 truncate">Phương tiện</p>
 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
 <div className="p-2 bg-white rounded-xl shadow-sm">
 <Car className="w-4 h-4 text-orange-600" />
 </div>
 <p className="text-xs font-bold text-slate-700">
 {selectedSchedule.vehicle ? `${selectedSchedule.vehicle.name} (${selectedSchedule.vehicle.plate_number})` : `Yêu cầu: ${selectedSchedule.requested_vehicle_type}`}
 </p>
 </div>
 </div>
 )}
 </div>

 {/* Driver Info (If assigned) */}
 {selectedSchedule.vehicle_id && vehicles.find(v => v.id === selectedSchedule.vehicle_id) && (
 <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-3">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-white rounded-xl shadow-sm">
 <UserCheck className="w-4 h-4 text-emerald-600" />
 </div>
 <div>
 <p className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1 truncate whitespace-nowrap">Thông tin Lái xe</p>
 <p className="text-sm font-bold text-emerald-800">{vehicles.find(v => v.id === selectedSchedule.vehicle_id)?.driver_name}</p>
 </div>
 </div>
 <div className="text-right">
 <p className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-1 truncate whitespace-nowrap">Số điện thoại</p>
 <p className="text-sm font-bold text-emerald-600">{vehicles.find(v => v.id === selectedSchedule.vehicle_id)?.driver_phone}</p>
 </div>
 </div>
 </div>
 )}

 {/* TCTH Assignment UI */}
 {isTCTH && selectedSchedule.use_vehicle && !selectedSchedule.vehicle_id && (
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
 
 <Select onValueChange={(v) => handleAssignVehicle(selectedSchedule.id, v)}>
 <SelectTrigger className="h-10 bg-white border-none rounded-xl font-medium shadow-sm text-[13px]">
 <SelectValue placeholder={`Chọn xe ${selectedSchedule.requested_vehicle_type}...`} />
 </SelectTrigger>
 <SelectContent className="rounded-xl border-none shadow-lg">
 {vehicles
 .filter(v => selectedSchedule.requested_vehicle_type === 'Khác' ? !['4 chỗ', '7 chỗ'].includes(v.type) : v.type === selectedSchedule.requested_vehicle_type)
 .map(v => (
 <SelectItem key={v.id} value={v.id}>
 <div className="flex flex-col">
 <span className="font-bold text-slate-800">{v.name} - {v.plate_number}</span>
 <span className="text-[11px] text-slate-500 truncate">Lái xe: {v.driver_name}</span>
 </div>
 </SelectItem>
 ))
 }
 </SelectContent>
 </Select>
 </div>
 )}

 {/* Participants */}
  <div className="space-y-3">
    <p className="text-[13px] font-medium text-slate-500">Thành phần tham gia</p>
    {renderParticipants(selectedSchedule)}
  </div>
 </div>

 <DialogFooter className="pt-4 border-t border-slate-100 flex flex-row justify-between gap-4">
  <Button variant="ghost" className="rounded-xl font-medium text-slate-500 text-xs md:text-[11px]" onClick={() => setIsDetailOpen(false)}>Đóng cửa sổ</Button>
  {isTCTH && selectedSchedule.vehicle_id && (
  <Button 
  variant="outline" 
  className="rounded-xl font-semibold text-xs md:text-[11px] uppercase border-red-100 text-red-500 hover:bg-red-50 truncate whitespace-nowrap"
  onClick={() => handleAssignVehicle(selectedSchedule.id, null)}
  >
  Hủy gán xe
  </Button>
  )}
  </DialogFooter>
 </div>
 )}
 </DialogContent>
 </Dialog>
 </div>
 );
}
