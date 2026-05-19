'use client'

import React from "react";
import { Clock, MapPin, Car, DoorOpen, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TcthDashboardProps {
  schedules: any[];
  vehicles: any[];
  rooms: any[];
  selectedDate: Date;
  onSelectSchedule: (s: any) => void;
}

export default function TcthDashboard({ schedules, vehicles, rooms, selectedDate, onSelectSchedule }: TcthDashboardProps) {
  const pendingVehicles = schedules.filter(s => s.use_vehicle && !s.vehicle_id);

  return (
    <div className="space-y-6 md:space-y-10 animate-fade-in-up">
      {/* 1. Yêu cầu cần xử lý */}
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 tabular-nums tracking-tighter truncate">
            <ShieldCheck className="w-5 h-5 text-orange-500 shrink-0" /> DANH SÁCH YÊU CẦU CẦN XỬ LÝ
          </h2>
          <Badge className="bg-orange-100 text-orange-700 border-none font-bold px-3 py-1 rounded-full whitespace-nowrap shrink-0">
            {pendingVehicles.length} MỚI
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {pendingVehicles.length === 0 ? (
            <div className="premium-card p-6 flex flex-col items-center justify-center text-center border-dashed border-2 border-slate-200 bg-slate-50 shadow-none">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-[15px] font-bold text-slate-800">Tuyệt vời!</h3>
              <p className="text-slate-500 font-medium text-[13px] max-w-xs mt-1">Hiện tại không còn yêu cầu gán xe nào đang bị treo.</p>
            </div>
          ) : (
            pendingVehicles.map(s => (
              <div key={s.id} className="premium-card p-6 border-none flex flex-col sm:flex-row sm:items-center gap-6 group">
                {/* Info */}
                <div className="flex-1 space-y-4 min-w-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-100 shadow-sm shrink-0">
                      <AvatarImage src={s.creator?.avatar_url} />
                      <AvatarFallback className="bg-slate-100 font-bold text-xs">{s.creator?.full_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-slate-900 truncate">{s.creator?.full_name}</p>
                      <p className="text-[12px] font-medium text-slate-500 truncate">{s.departments?.name || "Cán bộ nghiệp vụ"}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <h4 className="font-bold text-slate-800 text-[15px] truncate">{s.title}</h4>
                    <div className="flex flex-wrap items-center gap-4 text-[12px] font-medium text-slate-500">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-slate-400" /> {format(new Date(s.start_time), 'dd/MM HH:mm')}
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" /> <span className="truncate">{s.location}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full h-px sm:w-px sm:h-16 bg-slate-100 shrink-0" />

                {/* Actions */}
                <div className="flex items-center sm:flex-col sm:items-end justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase whitespace-nowrap">Loại xe:</span>
                    <Badge className="bg-orange-50 text-orange-700 border border-orange-200 font-bold px-2 py-0.5 rounded-md whitespace-nowrap shadow-sm">
                      {s.requested_vehicle_type}
                    </Badge>
                  </div>
                  <Button
                    className="bg-primary hover:bg-primary/90 h-9 px-5 rounded-xl font-medium text-[13px] whitespace-nowrap active:scale-95 transition-all w-full sm:w-auto"
                    onClick={() => onSelectSchedule(s)}
                  >
                    Gán Xe & Lái xe
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 2. Giám sát tài nguyên */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Đội xe */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 truncate">
            <Car className="w-4 h-4 text-emerald-500 shrink-0" /> Giám sát Đội xe
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {vehicles.map(v => {
              const now = new Date();
              // Lịch đang diễn ra thực sự theo giờ hiện tại (không chỉ theo ngày)
              const currentTrip = schedules.find(s =>
                s.vehicle_id === v.id &&
                (s.status === 'approved' || s.status === 'pending') &&
                new Date(s.start_time) <= now &&
                new Date(s.end_time) >= now
              );
              const isBusy = currentTrip?.status === 'approved';
              const isPending = currentTrip?.status === 'pending';
              return (
                <div key={v.id} className="premium-card p-5 border-none group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("p-3 rounded-xl transition-all duration-300 shrink-0", isBusy ? "bg-orange-50 text-orange-600" : isPending ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                        <Car className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-[14px] truncate">{v.name}</p>
                        <p className="text-[11px] font-medium text-slate-500 truncate tabular-nums">{v.plate_number}</p>
                      </div>
                    </div>
                    <Badge className={cn("rounded-md font-bold text-[10px] uppercase px-2.5 py-1 whitespace-nowrap shrink-0 border-none", isBusy ? "bg-orange-500 text-white" : isPending ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-600")}>
                      {isBusy ? "Bận" : isPending ? "Chờ duyệt" : "Sẵn sàng"}
                    </Badge>
                  </div>
                  {isBusy && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={currentTrip.creator?.avatar_url} />
                          <AvatarFallback className="text-[8px] font-bold">{currentTrip.creator?.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-[12px] font-medium text-slate-600 truncate">{currentTrip.creator?.full_name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-orange-600 uppercase whitespace-nowrap shrink-0 tabular-nums bg-orange-50 px-2 py-0.5 rounded-md">
                        {format(new Date(currentTrip.start_time), 'HH:mm')} - {format(new Date(currentTrip.end_time), 'HH:mm')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Phòng họp */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2 truncate">
            <DoorOpen className="w-4 h-4 text-blue-500 shrink-0" /> Tình trạng Phòng họp
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {rooms.map(r => {
              const now = new Date();
              // Lịch đang diễn ra thực sự theo giờ hiện tại (không chỉ theo ngày)
              const currentMeeting = schedules.find(s =>
                s.room_id === r.id &&
                (s.status === 'approved' || s.status === 'pending') &&
                new Date(s.start_time) <= now &&
                new Date(s.end_time) >= now
              );
              const isBusy = currentMeeting?.status === 'approved';
              const isPending = currentMeeting?.status === 'pending';
              return (
                <div key={r.id} className="premium-card p-5 border-none group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("p-3 rounded-xl transition-all duration-300 shrink-0", isBusy ? "bg-blue-50 text-blue-600" : isPending ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                        <DoorOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-[14px] truncate">{r.name}</p>
                        <p className="text-[11px] font-medium text-slate-500 truncate">{r.capacity} chỗ • {r.location}</p>
                      </div>
                    </div>
                    <Badge className={cn("rounded-md font-bold text-[10px] uppercase px-2.5 py-1 whitespace-nowrap shrink-0 border-none", isBusy ? "bg-blue-600 text-white" : isPending ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-600")}>
                      {isBusy ? "Họp" : isPending ? "Chờ duyệt" : "Trống"}
                    </Badge>
                  </div>
                  {isBusy && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-5 w-5 shrink-0">
                          <AvatarImage src={currentMeeting.creator?.avatar_url} />
                          <AvatarFallback className="text-[8px] font-bold">{currentMeeting.creator?.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-[12px] font-medium text-slate-600 truncate">{currentMeeting.creator?.full_name}</span>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600 uppercase whitespace-nowrap shrink-0 tabular-nums bg-blue-50 px-2 py-0.5 rounded-md">
                        {format(new Date(currentMeeting.start_time), 'HH:mm')} - {format(new Date(currentMeeting.end_time), 'HH:mm')}
                      </span>
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
