'use client'

import React from "react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/notify";

import CreateScheduleDialog from "./_components/CreateScheduleDialog";
import ScheduleDetailDialog from "./_components/ScheduleDetailDialog";
import DateNavigator from "./_components/DateNavigator";
import CalendarView from "./_components/CalendarView";
import DriverDashboard from "./_components/DriverDashboard";
import { canApproveLeave, canUseDriverWorkspace } from "@/lib/permissions";
import { useSchedule } from "./_hooks/useSchedule";
import PageHeader from "@/components/layout/PageHeader";
import { ListSkeleton } from "@/components/ui/list-skeleton";

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
    timelineContainerRef, mounted,
    toast, supabase, pendingVehicleCount,
    canCoordinateResources, pendingLeavesCount,
    sendNotifications, weekDays, isTodaySelected,
    currentTimePercent, startLimit, duration,
    conflicts, resourceConflicts, fetchData,
    handleStatusUpdate, handleUpdateEndTime, handleUpdateSchedule, handleCreateSchedule, handleSelectSchedule
  } = scheduleProps;

  if (!mounted) {
    return (
      <div className="page-container py-10">
        <ListSkeleton variant="card" rows={6} />
      </div>
    );
  }

  // Driver có giao diện chuyên biệt — hiện DriverDashboard thay danh sách lịch chung
  if (canUseDriverWorkspace(profile)) {
    return (
      <div className="page-container space-y-8 animate-fade-in-up">
        <PageHeader
          title="Lịch trình"
          description="Lịch chạy xe & hành trình của bạn"
        />
        <DriverDashboard
          schedules={schedules}
          profile={profile}
          fetchData={fetchData}
          toast={toast}
        />
      </div>
    );
  }

  return (
    <div className="page-container space-y-10 animate-fade-in-up">
      <PageHeader
        title="Lịch trình"
        description="Điều phối lịch họp & công tác"
        action={
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
        }
      />

      {/* Chọn ngày */}
      <DateNavigator selectedDate={selectedDate} setSelectedDate={setSelectedDate} weekDays={weekDays} schedules={schedules} />

      {/* View duy nhất — Tablist phạm vi (Toàn chi nhánh / BGĐ / Phòng của tôi)
          đã nhúng sẵn "Điều phối tài nguyên" (cho TCTH) và "Duyệt nghỉ phép" (cho lãnh đạo) */}
      <CalendarView
        loading={loading}
        filterType={filterType} setFilterType={setFilterType}
        schedules={schedules} vehicles={vehicles} rooms={rooms}
        selectedDate={selectedDate}
        profile={profile} allProfiles={allProfiles}
        isTCTH={canCoordinateResources}
        canApproveLeavePermission={canApproveLeave(profile)}
        pendingVehicleCount={pendingVehicleCount}
        pendingLeavesCount={pendingLeavesCount}
        timelineContainerRef={timelineContainerRef}
        isTodaySelected={isTodaySelected} currentTimePercent={currentTimePercent}
        startLimit={startLimit} duration={duration}
        onSelectSchedule={handleSelectSchedule}
        onStatusUpdate={handleStatusUpdate}
      />

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
                title: "Bạn được phân công lịch chạy xe",
                content: `Bạn được phân công điều khiển xe ${vehicle?.name || ''} (${vehicle?.plate_number || ''}) cho chuyến: "${schedule.title}" – ${new Date(schedule.start_time).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`,
                link: "/dashboard/schedule"
              }]);
            } else if (!vId && schedule?.driver_id) {
              await sendNotifications([{
                user_id: schedule.driver_id,
                title: "Hủy phân công lịch chạy xe",
                content: `Lịch chạy xe "${schedule.title}" đã bị hủy phân công. Vui lòng liên hệ phòng Tổ chức Tổng hợp để biết thêm thông tin.`,
                link: "/dashboard/schedule"
              }]);
            }

            notifySuccess(vId ? "Đã gán xe và tài xế" : "Đã huỷ gán xe");
            fetchData();
          } catch (error) {
            notifyError(error, "Không gán được xe");
          }
        }}
        onUpdateEndTime={handleUpdateEndTime}
        onUpdateSchedule={handleUpdateSchedule}
      />
    </div>
  );
}
