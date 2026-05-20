'use client'

import React from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { endOfDay, format, addDays, isSameDay, startOfDay } from "date-fns";
import { vi } from "date-fns/locale";

interface DateNavigatorProps {
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  weekDays: Date[];
  schedules?: any[];
}

export default function DateNavigator({ selectedDate, setSelectedDate, weekDays, schedules = [] }: DateNavigatorProps) {
  return (
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
            const dayStart = startOfDay(day);
            const dayEnd = endOfDay(day);
            const daySchedules = schedules.filter(s => {
              if (s.status === 'rejected') return false;
              return new Date(s.start_time) <= dayEnd && new Date(s.end_time) >= dayStart;
            });
            const hasPending = daySchedules.some(s => s.status === 'pending' || (s.use_vehicle && !s.vehicle_id));
            const hasApproved = daySchedules.some(s => s.status === 'approved');
            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "flex flex-col items-center py-2 rounded-xl transition-all relative h-14 justify-between",
                  isSelected
                    ? "bg-primary text-white ring-2 ring-primary/20"
                    : "hover:bg-slate-100 text-slate-500"
                )}
              >
                <span className={cn("text-[9px] font-bold", isSelected ? "text-white/70" : "text-slate-400")}>
                  {format(day, 'EEEEEE', { locale: vi })}
                </span>
                
                <span className={cn(
                  "text-[13px] font-bold flex items-center justify-center w-6 h-6 rounded-full transition-all mb-1",
                  isToday 
                    ? isSelected 
                      ? "bg-white text-primary font-extrabold shadow-sm" 
                      : "bg-primary/10 text-primary font-extrabold"
                    : ""
                )}>
                  {format(day, 'd')}
                </span>

                {(hasPending || hasApproved) && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                    {hasPending && (
                      <span className={cn(
                        "h-1 w-1 rounded-full shrink-0",
                        isSelected ? "bg-amber-300 ring-[0.5px] ring-white/40" : "bg-amber-400"
                      )} />
                    )}
                    {hasApproved && (
                      <span className={cn(
                        "h-1 w-1 rounded-full shrink-0",
                        isSelected ? "bg-emerald-300 ring-[0.5px] ring-white/40" : "bg-emerald-500"
                      )} />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
