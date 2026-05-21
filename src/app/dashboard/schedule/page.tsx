'use client'

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar as CalendarIcon,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { addDays, endOfDay, isSameDay, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

import { resolveParticipantIds, checkConflicts, checkResourceConflicts } from "./_lib/utils";
import CreateScheduleDialog from "./_components/CreateScheduleDialog";
import ScheduleDetailDialog from "./_components/ScheduleDetailDialog";
import DateNavigator from "./_components/DateNavigator";
import CalendarView from "./_components/CalendarView";
import ResourcesManagerDashboard from "./_components/ResourcesManagerDashboard";
import LeaveApprovalDashboard from "./_components/LeaveApprovalDashboard";
import DriverDashboard from "./_components/DriverDashboard";
import { Car } from "lucide-react";
import { canApproveLeave, canCoordinateSharedResources, canUseDriverWorkspace } from "@/lib/permissions";
import { useSchedule } from "./_hooks/useSchedule";

export default function SchedulePage() {
  const scheduleProps = useSchedule();
  const {
    schedules, vehicles, rooms, loading, profile, allProfiles, departments,
    selectedDate, setSelectedDate, filterType, setFilterType,
    isCreateOpen, setIsCreateOpen, newSchedule, setNewSchedule,
    startDate, setStartDate, endDate, setEndDate, startTime, setStartTime, endTime, setEndTime,
    isStartOpen, setIsStartOpen, isEndOpen, setIsEndOpen,
    bgdMode, setBgdMode, selectedBGD, setSelectedBGD,
    deptMode, setDeptMode, filterDepts, setFilterDepts,
    participantMode, setParticipantMode, selectedParticipants, setSelectedParticipants,
    selectedSchedule, isDetailOpen, setIsDetailOpen,
    timelineContainerRef, mounted, setMounted, searchParams,
    toast, supabase, defaultTab, pendingVehicleCount, pendingVehicleBadge,
    canCoordinateResources, getPendingLeavesCount, pendingLeavesCount, pendingLeavesBadge,
    getDepartmentName, isScheduleApprover, sendNotifications, weekDays, isTodaySelected,
    now, currentMinutes, startLimit, endLimit, duration, isWithinWorkingHours, currentTimePercent,
    conflicts, resourceConflicts, fetchData, findParticipantConflicts,
    handleStatusUpdate, handleAssignVehicle, handleDeleteSchedule, handleUpdateEndTime, handleUpdateSchedule, handleCreateSchedule, handleSelectSchedule
  } = scheduleProps;

  if (!mounted) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10 animate-fade-in-up pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:pt-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Lịch trình</h1>
          <p className="text-[13px] text-slate-500 font-medium">Điều phối lịch họp & công tác</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs value={filterType} onValueChange={(value) => setFilterType(value as 'all' | 'bgd' | 'dept')}>
            <TabsList className="grid min-h-9 w-full grid-cols-3 rounded-xl bg-slate-100/70 p-0.5 sm:w-[360px]">
              <TabsTrigger value="all" className="rounded-lg px-2 text-[12px] font-medium">Toàn chi nhánh</TabsTrigger>
              <TabsTrigger value="bgd" className="rounded-lg px-2 text-[12px] font-medium">Ban giám đốc</TabsTrigger>
              <TabsTrigger value="dept" className="rounded-lg px-2 text-[12px] font-medium">Phòng của tôi</TabsTrigger>
            </TabsList>
          </Tabs>
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
            profile={profile}
          />
        </div>
      </div>

      {/* Chọn ngày */}
      <DateNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} weekDays={weekDays} schedules={schedules} />

      {/* Tabs */}
      <Tabs defaultValue={canUseDriverWorkspace(profile) ? "driver-trips" : canCoordinateResources ? "tcth" : "calendar"} className="space-y-8 w-full">
        <TabsList className="bg-slate-100/60 p-1 rounded-xl min-h-11 w-full flex gap-1">
          <TabsTrigger value="calendar" className="flex-1 rounded-lg py-2 font-medium text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm flex items-center justify-center">
            <CalendarIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
            <span className="hidden sm:inline">Lịch biểu</span>
            <span className="inline sm:hidden">Lịch</span>
          </TabsTrigger>
          {canCoordinateResources && (
            <TabsTrigger value="tcth" className="flex-1 rounded-lg py-2 font-medium text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
              <span>Điều phối</span>
              {pendingVehicleCount > 0 && (
                <Badge className="ml-1.5 min-h-6 min-w-6 shrink-0 justify-center rounded-full border-none bg-amber-600 px-2 text-xs font-medium leading-none text-white tabular-nums">
                  {pendingVehicleBadge}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {canApproveLeave(profile) && (
            <TabsTrigger value="leave-approval" className="flex-1 rounded-lg py-2 font-medium text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm flex items-center justify-center">
              <CalendarIcon className="w-3.5 h-3.5 mr-1.5 shrink-0" /> 
              <span className="hidden sm:inline">Phê duyệt nghỉ phép</span>
              <span className="inline sm:hidden">Duyệt phép</span>
              {pendingLeavesCount > 0 && (
                <Badge className="ml-1.5 min-h-6 min-w-6 shrink-0 justify-center rounded-full border-none bg-slate-900 px-2 text-xs font-medium leading-none text-white tabular-nums">
                  {pendingLeavesBadge}
                </Badge>
              )}
            </TabsTrigger>
          )}
          {canUseDriverWorkspace(profile) && (
            <TabsTrigger value="driver-trips" className="flex-1 rounded-lg py-2 font-medium text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm flex items-center justify-center">
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
            profile={profile} allProfiles={allProfiles} isTCTH={canCoordinateResources}
            timelineContainerRef={timelineContainerRef}
            isTodaySelected={isTodaySelected} currentTimePercent={currentTimePercent}
            startLimit={startLimit} duration={duration}
            onSelectSchedule={handleSelectSchedule}
            onStatusUpdate={handleStatusUpdate}
          />
        </TabsContent>

        {canCoordinateResources && (
          <TabsContent value="tcth">
            <ResourcesManagerDashboard
              schedules={schedules} vehicles={vehicles} rooms={rooms}
              selectedDate={selectedDate} onSelectSchedule={handleSelectSchedule}
            />
          </TabsContent>
        )}
        {canApproveLeave(profile) && (
          <TabsContent value="leave-approval">
            <LeaveApprovalDashboard
              schedules={schedules}
              profile={profile}
              onStatusUpdate={handleStatusUpdate}
            />
          </TabsContent>
        )}
        {canUseDriverWorkspace(profile) && (
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
        schedule={selectedSchedule} schedules={schedules} vehicles={vehicles} rooms={rooms}
        isTCTH={canCoordinateResources} allProfiles={allProfiles} departments={departments}
        currentProfile={profile}
        onAssignVehicle={async (id, vId, dId) => {
          try {
            const schedule = schedules.find(s => s.id === id);
            const { error } = await supabase.from('schedules').update({ vehicle_id: vId, driver_id: dId, status: vId ? 'approved' : 'pending' }).eq('id', id);
            if (error) throw error;

            // Thông báo riêng cho tài xế được gán
            if (vId && dId && schedule) {
              const vehicle = vehicles.find(v => v.id === vId);
              await sendNotifications([{
                user_id: dId,
                title: "🚗 Bạn được phân công lịch chạy xe",
                content: `Bạn được phân công điều khiển xe ${vehicle?.name || ''} (${vehicle?.plate_number || ''}) cho chuyến: "${schedule.title}" – ${new Date(schedule.start_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
                link: "/dashboard/schedule"
              }]);
            } else if (!vId && schedule?.driver_id) {
              // Thông báo hủy gán xe cho tài xế cũ
              await sendNotifications([{
                user_id: schedule.driver_id,
                title: "Hủy phân công lịch chạy xe",
                content: `Lịch chạy xe "${schedule.title}" đã bị hủy phân công. Vui lòng liên hệ phòng Tổ chức Tổng hợp để biết thêm thông tin.`,
                link: "/dashboard/schedule"
              }]);
            }

            toast({ title: "Thành công", description: vId ? "Đã gán xe và tài xế thành công" : "Đã hủy gán xe" });
            fetchData();
          } catch (error: any) {
            toast({ variant: "destructive", title: "Lỗi", description: error.message });
          }
        }}
        onUpdateEndTime={handleUpdateEndTime}
        onUpdateSchedule={handleUpdateSchedule}
      />
    </div>
  );
}
