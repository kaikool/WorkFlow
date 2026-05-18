'use client'

import React from "react";
import { Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";
import ScheduleCard from "./ScheduleCard";
import DirectorTimeline from "./DirectorTimeline";

interface CalendarViewProps {
  loading: boolean;
  filterType: 'all' | 'bgd' | 'dept';
  setFilterType: (v: 'all' | 'bgd' | 'dept') => void;
  schedules: any[];
  selectedDate: Date;
  profile: any;
  allProfiles: any[];
  isTCTH: boolean;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  isTodaySelected: boolean;
  currentTimePercent: number;
  startLimit: number;
  duration: number;
  onSelectSchedule: (s: any) => void;
  onStatusUpdate: (id: string, status: string) => void;
}

export default function CalendarView(props: CalendarViewProps) {
  const {
    loading, filterType, setFilterType, schedules, selectedDate, profile,
    allProfiles, isTCTH, timelineContainerRef,
    isTodaySelected, currentTimePercent, startLimit, duration,
    onSelectSchedule, onStatusUpdate
  } = props;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Bộ lọc nhanh */}
      <div className="flex bg-slate-100/60 p-1 rounded-xl w-full">
        <button type="button" onClick={() => setFilterType('all')}
          className={cn("flex-1 px-2 md:px-5 py-2 text-[12px] md:text-[14px] font-medium rounded-lg transition-all", filterType === 'all' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
        >Toàn chi nhánh</button>
        <button type="button" onClick={() => setFilterType('bgd')}
          className={cn("flex-1 px-2 md:px-5 py-2 text-[12px] md:text-[14px] font-medium rounded-lg transition-all", filterType === 'bgd' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
        >Ban giám đốc</button>
        <button type="button" onClick={() => setFilterType('dept')}
          className={cn("flex-1 px-2 md:px-5 py-2 text-[12px] md:text-[14px] font-medium rounded-lg transition-all", filterType === 'dept' ? "bg-white text-primary shadow-sm" : "text-slate-500")}
        >Phòng của tôi</button>
      </div>

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
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {schedules
              .filter(s => {
                if (!isSameDay(new Date(s.start_time), selectedDate)) return false;
                if (filterType === 'dept') return s.department_id === profile?.department_id;
                return true;
              })
              .map(item => (
                <ScheduleCard
                  key={item.id}
                  item={item}
                  isTCTH={isTCTH}
                  onSelect={onSelectSchedule}
                  onStatusUpdate={onStatusUpdate}
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
