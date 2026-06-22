'use client'

import React from "react";
import { CalendarDays } from "lucide-react";
import { cn, canViewLeaveDetails } from "@/lib/utils";
import { endOfDay, format, startOfDay } from "date-fns";
import { filterBGD, getDirectorColor } from "../_lib/utils";

interface DirectorTimelineProps {
  allProfiles: any[];
  schedules: any[];
  selectedDate: Date;
  timelineContainerRef: React.RefObject<HTMLDivElement | null>;
  isTodaySelected: boolean;
  currentTimePercent: number;
  startLimit: number;
  duration: number;
  onSelectSchedule: (s: any) => void;
  currentProfile?: any;
}

export default function DirectorTimeline({
  allProfiles, schedules, selectedDate, timelineContainerRef,
  isTodaySelected, currentTimePercent, startLimit, duration,
  onSelectSchedule, currentProfile
}: DirectorTimelineProps) {
  const bgdProfiles = filterBGD(allProfiles);
  const selectedStart = startOfDay(selectedDate);
  const selectedEnd = endOfDay(selectedDate);

  return (
    <div className="space-y-6 overflow-hidden animate-in fade-in duration-150">
      {/* Timeline */}
      <div
        ref={timelineContainerRef}
        className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm overflow-x-auto pb-2 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="min-w-[850px] space-y-4">
          {/* Tiêu đề giờ */}
          <div className="relative h-5 text-[10px] font-semibold text-slate-400 select-none w-full border-b border-slate-100 pb-1 mb-3">
            {['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'].map((label, i) => (
              <span key={label} className="absolute -translate-x-1/2 text-[10px] font-semibold text-slate-400" style={{ left: `${(i / 12) * 100}%` }}>{label}</span>
            ))}
          </div>

          {/* Dòng timeline cho từng Giám đốc */}
          <div className="space-y-2">
            {bgdProfiles.map(dir => {
              const dirColor = getDirectorColor(dir.full_name, allProfiles);
              const dirSchedules = schedules.filter(s => {
                if (new Date(s.start_time) > selectedEnd || new Date(s.end_time) < selectedStart) return false;
                // Meeting tại chi nhánh (có phòng họp) không vẽ lên timeline BGĐ
                if (s.type === 'meeting' && (s.location === 'Chi nhánh' || s.room_id)) return false;
                return s.participants?.some((p: any) => p.profile?.id === dir.id);
              });

              return (
                <div key={dir.id} className="relative w-full h-11 flex items-center border-b border-slate-100/50 last:border-none">
                  {/* Lưới giờ */}
                  <div className="absolute inset-0 pointer-events-none flex">
                    {Array.from({ length: 12 }).map((_, idx) => (
                      <div key={idx} className="flex-1 border-r border-slate-200/20 last:border-none" />
                    ))}
                  </div>

                  <div className="absolute left-0 right-0 h-1 bg-slate-100 rounded-full mx-1 pointer-events-none" />

                  {/* Vạch thời gian hiện tại */}
                  {isTodaySelected && currentTimePercent >= 0 && (
                    <div style={{ left: `${currentTimePercent}%` }} className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-20 pointer-events-none">
                      <div className="absolute top-0 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-red-500/20 animate-pulse" />
                    </div>
                  )}

                  {/* Thanh nghỉ phép */}
                  {dirSchedules.some(s => s.type === 'leave' && s.status === 'approved') ? (() => {
                    const leaveSched = dirSchedules.find(s => s.type === 'leave' && s.status === 'approved');
                    return (
                      <div
                        onClick={() => onSelectSchedule(leaveSched)}
                        className="absolute inset-x-0 h-7 mx-1 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/50 rounded-lg z-10 flex items-center justify-center cursor-pointer transition-all select-none shadow-sm"
                      >
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" /> {dir.full_name}
                        </span>
                      </div>
                    );
                  })() : dirSchedules.length > 0 && (
                    <div className="relative w-full h-full z-10 flex items-center">
                      {dirSchedules.map(sched => {
                        const rawStart = new Date(sched.start_time);
                        const rawEnd = new Date(sched.end_time);
                        const sTime = rawStart < selectedStart ? selectedStart : rawStart;
                        const eTime = rawEnd > selectedEnd ? selectedEnd : rawEnd;
                        const sMin = sTime.getHours() * 60 + sTime.getMinutes();
                        const eMin = eTime.getHours() * 60 + eTime.getMinutes();
                        const visualStartMin = Math.max(startLimit, sMin);
                        const visualEndMin = Math.min(startLimit + duration, Math.max(visualStartMin, eMin));
                        
                        const leftPercent = ((visualStartMin - startLimit) / duration) * 100;
                        const widthPercent = Math.max(6, ((visualEndMin - visualStartMin) / duration) * 100);
                        const typeColor = dirColor.bullet;
                        // Phát hiện lịch bị cắt bớt ngoài khung 7-19h
                        const isCutLeft = rawStart < selectedStart || sMin < startLimit;
                        const isCutRight = rawEnd > selectedEnd || eMin > (startLimit + duration);
                        const isCompleted = sched.status === 'completed';

                        const isAllowedToView = canViewLeaveDetails(sched, currentProfile);
                        const displayTitle = isAllowedToView ? sched.title : `Nghỉ phép (${sched.creator?.full_name || 'Cán bộ'})`;

                        const isAutoGeneratedEndTime = format(new Date(sched.end_time), 'HH:mm') === '23:59';
                        const showEndTime = isCompleted || !isAutoGeneratedEndTime;

                        return (
                          <div
                            key={sched.id}
                            onClick={() => onSelectSchedule(sched)}
                            style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                            className={cn(
                              "absolute h-7 rounded-lg cursor-pointer transition-all hover:brightness-110 active:scale-[0.97] select-none border-none shadow-sm overflow-hidden flex items-center justify-center px-2",
                              typeColor,
                              isCompleted && "opacity-70",
                              (isCutLeft || isCutRight) && "opacity-60"
                            )}
                            title={`${displayTitle}${isCompleted ? ' ✅ Đã xong' : ''} (${showEndTime ? `${format(sTime, 'HH:mm')} - ${format(eTime, 'HH:mm')}` : `Từ ${format(sTime, 'HH:mm')}`})${isCutLeft ? ' ◀' : ''}${isCutRight ? ' ▶' : ''}`}
                          >
                            <span className="text-[10px] font-bold text-white truncate leading-none">
                              {dir.full_name}
                            </span>
                          </div>
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
    </div>
  );
}