'use client'

import React, { useState } from "react";
import { Clock, Loader2, ChevronDown, ChevronUp, Plane, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, endOfDay, format, isSameDay, startOfDay } from "date-fns";
import ScheduleCard from "./ScheduleCard";
import DirectorTimeline from "./DirectorTimeline";
import ResourcesManagerDashboard from "./ResourcesManagerDashboard";
import LeaveApprovalDashboard from "./LeaveApprovalDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CalendarViewProps {
  loading: boolean;
  filterType: 'all' | 'bgd' | 'dept';
  setFilterType: (v: 'all' | 'bgd' | 'dept') => void;
  schedules: any[];
  vehicles: any[];
  rooms: any[];
  selectedDate: Date;
  profile: any;
  allProfiles: any[];
  isTCTH: boolean;
  canApproveLeavePermission: boolean;
  pendingVehicleCount: number;
  pendingLeavesCount: number;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  isTodaySelected: boolean;
  currentTimePercent: number;
  startLimit: number;
  duration: number;
  onSelectSchedule: (s: any) => void;
  onStatusUpdate: (id: string, status: string) => Promise<void>;
}

export default function CalendarView(props: CalendarViewProps) {
  const {
    loading, filterType, setFilterType, schedules, vehicles, rooms,
    selectedDate, profile, allProfiles, isTCTH,
    canApproveLeavePermission, pendingVehicleCount, pendingLeavesCount,
    timelineContainerRef, isTodaySelected, currentTimePercent, startLimit, duration,
    onSelectSchedule, onStatusUpdate
  } = props;

  const [showAllSchedules, setShowAllSchedules] = useState(false);
  const DEFAULT_LIMIT = 4;

  // Lọc lịch trình theo ngày và phòng ban
  const filteredSchedules = React.useMemo(() => {
    const selectedStart = startOfDay(selectedDate);
    const selectedEnd = endOfDay(selectedDate);
    return schedules.filter(s => {
      if (new Date(s.start_time) > selectedEnd || new Date(s.end_time) < selectedStart) return false;
      if (filterType === 'dept') return s.department_id === profile?.department_id;
      return true;
    });
  }, [schedules, selectedDate, filterType, profile]);

  const upcomingSchedules = React.useMemo(() => {
    const selectedEnd = endOfDay(selectedDate);
    const rangeEnd = endOfDay(addDays(selectedDate, 3));
    return schedules
      .filter(s => {
        const start = new Date(s.start_time);
        if (start <= selectedEnd || start > rangeEnd || s.status === 'rejected') return false;
        if (filterType === 'dept') return s.department_id === profile?.department_id;
        return true;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 6);
  }, [schedules, selectedDate, filterType, profile]);

  // Lọc danh sách nhân sự đang hoặc sắp nghỉ phép
  const leaveList = React.useMemo(() => {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    return schedules
      .filter(s => s.type === 'leave' && s.status === 'approved')
      .map(s => {
        const start = new Date(s.start_time);
        const end = new Date(s.end_time);
        // Đang nghỉ: thời gian hiện tại nằm giữa start và end
        const isCurrent = start <= todayEnd && end >= todayStart;
        return {
          ...s,
          isCurrent,
          startDate: start,
          endDate: end
        };
      })
      .filter(leave => leave.endDate >= todayStart)
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [schedules]);

  // Tra cứu phòng ban từ danh sách hồ sơ
  const getProfileDeptName = (profileId: string) => {
    const p = allProfiles.find(ap => ap.id === profileId);
    if (!p) return "";
    const dept = p.departments;
    return Array.isArray(dept) ? dept[0]?.name : dept?.name;
  };

  const displayedSchedules = showAllSchedules 
    ? filteredSchedules 
    : filteredSchedules.slice(0, DEFAULT_LIMIT);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Tablist phạm vi xem — gộp luôn chức năng điều phối/duyệt vào từng phạm vi tương ứng */}
      <Tabs value={filterType} onValueChange={(value) => setFilterType(value as 'all' | 'bgd' | 'dept')} className="w-full">
        <TabsList className="grid grid-cols-3 min-h-9">
          <TabsTrigger value="all" className="rounded-lg px-2 text-[12px] font-medium md:text-[14px] relative">
            <span className="truncate">Toàn chi nhánh</span>
            {isTCTH && pendingVehicleCount > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 shrink-0 justify-center rounded-full border-none bg-amber-600 px-1.5 text-[10px] font-bold leading-none text-white tabular-nums">
                {pendingVehicleCount > 9 ? "9+" : pendingVehicleCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bgd" className="rounded-lg px-2 text-[12px] font-medium md:text-[14px]">
            <span className="truncate">Ban giám đốc</span>
          </TabsTrigger>
          <TabsTrigger value="dept" className="rounded-lg px-2 text-[12px] font-medium md:text-[14px] relative">
            <span className="truncate">Phòng của tôi</span>
            {canApproveLeavePermission && pendingLeavesCount > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 shrink-0 justify-center rounded-full border-none bg-slate-900 px-1.5 text-[10px] font-bold leading-none text-white tabular-nums">
                {pendingLeavesCount > 9 ? "9+" : pendingLeavesCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* TAB: Toàn chi nhánh — nhúng điều phối tài nguyên nếu user có quyền */}
      {filterType === 'all' && isTCTH && (
        <section className="space-y-4">
          <h3 className="text-[13px] font-medium text-slate-500 flex items-center gap-2 px-2">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            Điều phối tài nguyên
            {pendingVehicleCount > 0 && (
              <Badge className="ml-auto h-5 rounded-full border border-amber-100 bg-amber-50 px-2.5 text-[10px] font-bold text-amber-700">
                {pendingVehicleCount} lịch cần xe
              </Badge>
            )}
          </h3>
          <ResourcesManagerDashboard
            schedules={schedules}
            vehicles={vehicles}
            rooms={rooms}
            selectedDate={selectedDate}
            onSelectSchedule={onSelectSchedule}
          />
        </section>
      )}

      {/* TAB: Phòng của tôi — nhúng đơn nghỉ phép cần duyệt */}
      {filterType === 'dept' && canApproveLeavePermission && pendingLeavesCount > 0 && (
        <section className="space-y-4">
          <h3 className="text-[13px] font-medium text-slate-500 flex items-center gap-2 px-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            Đơn nghỉ phép chờ duyệt
            <Badge className="ml-auto h-5 rounded-full border border-amber-100 bg-amber-50 px-2.5 text-[10px] font-bold text-amber-700">
              {pendingLeavesCount} đơn
            </Badge>
          </h3>
          <LeaveApprovalDashboard
            schedules={schedules}
            profile={profile}
            onStatusUpdate={onStatusUpdate}
          />
        </section>
      )}

      {/* Danh sách lịch */}
      <div className="space-y-4">
        <h3 className="text-[13px] font-medium text-slate-500 flex items-center gap-2 px-2">
          <Clock className="w-3.5 h-3.5 text-primary" /> Lịch trình ngày {format(selectedDate, 'dd/MM/yyyy')}
        </h3>

        {loading ? (
          <div className="flex h-48 items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filterType === 'bgd' ? (
          <DirectorTimeline
            allProfiles={allProfiles}
            schedules={schedules}
            selectedDate={selectedDate}
            timelineContainerRef={timelineContainerRef}
            isTodaySelected={isTodaySelected}
            currentTimePercent={currentTimePercent}
            startLimit={startLimit}
            duration={duration}
            onSelectSchedule={onSelectSchedule}
            currentProfile={profile}
          />
        ) : (
          <div className="space-y-6">
            {filteredSchedules.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-2xl border border-slate-100 shadow-sm">
                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-400">Không có lịch trình nào trong ngày</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {displayedSchedules.map(item => (
                    <ScheduleCard
                      key={item.id}
                      item={item}
                      isTCTH={isTCTH}
                      profile={profile}
                      onSelect={onSelectSchedule}
                      onStatusUpdate={onStatusUpdate}
                    />
                  ))}
                </div>

                {filteredSchedules.length > DEFAULT_LIMIT && (
                  <div className="flex justify-center pt-2">
                    <Button 
                      variant="ghost" 
                      onClick={() => setShowAllSchedules(!showAllSchedules)}
                      className="text-sm font-medium text-primary hover:bg-primary/5 rounded-full px-6 py-2 flex items-center gap-1.5"
                    >
                      {showAllSchedules ? (
                        <>Thu gọn <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>Xem thêm {filteredSchedules.length - DEFAULT_LIMIT} lịch trình <ChevronDown className="w-4 h-4" /></>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}

            {upcomingSchedules.length > 0 && (
              <div className="space-y-3 pt-2">
                <h3 className="text-[13px] font-medium text-slate-500 flex items-center gap-2 px-2">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Lịch sắp tới trong 3 ngày
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {upcomingSchedules.map(item => (
                    <ScheduleCard
                      key={`upcoming-${item.id}`}
                      item={item}
                      isTCTH={isTCTH}
                      profile={profile}
                      onSelect={onSelectSchedule}
                      onStatusUpdate={onStatusUpdate}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Danh sách người nghỉ phép (đang nghỉ/sắp nghỉ) */}
            {leaveList.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-slate-100 mt-8">
                <div className="flex items-center justify-between px-2">
                  <h3 className="flex items-center gap-2 text-[12px] font-bold text-slate-400">
                    <Plane className="w-4 h-4 text-blue-500 shrink-0" />
                    Nhân sự nghỉ phép ({leaveList.length})
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {leaveList.map(leave => {
                    const deptName = getProfileDeptName(leave.created_by);
                    const formattedRange = isSameDay(leave.startDate, leave.endDate)
                      ? format(leave.startDate, 'dd/MM/yyyy')
                      : `${format(leave.startDate, 'dd/MM')} - ${format(leave.endDate, 'dd/MM/yyyy')}`;

                    return (
                      <Card 
                        key={leave.id}
                        onClick={() => onSelectSchedule(leave)}
                        className="rounded-2xl overflow-hidden border-none shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer hover:-translate-y-0.5 hover:bg-slate-50/30"
                      >
                        <CardContent className="p-0">
                          <div className="flex h-full">
                            <div className={cn(
                              "w-2 transition-all duration-300 group-hover:w-2.5 shrink-0",
                              leave.isCurrent ? "bg-amber-400" : "bg-blue-400"
                            )} />
                            
                            <div className="flex-1 p-3.5 flex items-center gap-3.5 min-w-0">
                              <Avatar className="h-9 w-9 shrink-0 border border-slate-100 shadow-sm">
                                <AvatarImage src={leave.creator?.avatar_url} />
                                <AvatarFallback className="text-xs bg-slate-100 font-extrabold text-slate-600">
                                  {leave.creator?.full_name?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[13px] font-extrabold text-slate-800 truncate group-hover:text-primary transition-colors">
                                    {leave.creator?.full_name}
                                  </p>
                                  <span className={cn(
                                    "text-[9px] font-extrabold px-2 py-0.5 rounded-md tracking-normal shrink-0",
                                    leave.isCurrent 
                                      ? "bg-amber-50 text-amber-600 border border-amber-200/50" 
                                      : "bg-blue-50/50 text-blue-600 border border-blue-200/40"
                                  )}>
                                    {leave.isCurrent ? "Đang nghỉ" : "Sắp nghỉ"}
                                  </span>
                                </div>
                                
                                <p className="text-[10px] text-slate-400 font-bold truncate">
                                  {deptName || "Chưa phân phòng"}
                                </p>
                                
                                <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-100">
                                  <span className="text-[9.5px] font-medium text-slate-400">Thời gian nghỉ:</span>
                                  <span className="text-[10.5px] font-bold text-slate-700">{formattedRange}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
