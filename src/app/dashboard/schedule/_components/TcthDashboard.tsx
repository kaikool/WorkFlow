'use client'

import React from "react";
import { Clock, MapPin, Car, DoorOpen, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { format, isSameDay } from "date-fns";

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 1. Yêu cầu cần xử lý */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3 tabular-nums tracking-tighter">
            <ShieldCheck className="w-6 h-6 text-orange-500" /> Danh sách yêu cầu cần xử lý
          </h2>
          <Badge className="bg-orange-100 text-orange-600 border-none font-bold px-4 py-1.5 rounded-xl">
            {pendingVehicles.length} YÊU CẦU MỚI
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {pendingVehicles.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-2 border-slate-200 bg-slate-50/30 p-10 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Tuyệt vời!</h3>
              <p className="text-slate-500 font-bold text-xs max-w-xs mt-1">Hiện tại không còn yêu cầu gán xe nào đang bị treo.</p>
            </Card>
          ) : (
            pendingVehicles.map(s => (
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
                      onClick={() => onSelectSchedule(s)}
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

      {/* 2. Giám sát tài nguyên */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Đội xe */}
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
                      <span className="text-[10px] font-bold text-orange-600 uppercase truncate whitespace-nowrap">
                        {format(new Date(currentTrip.start_time), 'HH:mm')} - {format(new Date(currentTrip.end_time), 'HH:mm')}
                      </span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Phòng họp */}
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
    </div>
  );
}
