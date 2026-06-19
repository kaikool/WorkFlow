'use client'

import React from "react";
import { AlertTriangle, Car, CheckCircle2, Clock, MapPin, Navigation, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Props {
  trip: any;
  onConfirm: (trip: any) => void;
  onStart: (trip: any) => void;
  onEnd: (trip: any) => void;
  onReportIssue: (trip: any) => void;
}

const fmtDt = (d: Date) =>
  d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function MyTripCard({ trip, onConfirm, onStart, onEnd, onReportIssue }: Props) {
  const hasStarted = trip.status === 'in_progress' || trip.status === 'completed' || !!trip.metadata?.trip_started_at;
  const hasEnded = trip.status === 'completed' || !!trip.metadata?.trip_ended_at;
  const isConfirmed = !!trip.metadata?.driver_confirmed_at;
  const hasIssue = !!trip.metadata?.vehicle_issue;
  const startDt = new Date(trip.start_time);
  const endDt = new Date(trip.end_time);

  let borderStyle = "border-l-4 border-l-amber-500 border-slate-100";
  let statusBadgeBg = "bg-amber-50 text-amber-700 border-amber-100";
  let statusText = "Chờ khởi hành";
  let statusIcon: React.ReactNode = <Clock className="w-3.5 h-3.5 shrink-0" />;

  if (!isConfirmed && trip.status === 'approved' && !hasStarted) {
    statusText = "Chờ xác nhận";
    statusIcon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
  }

  if (hasEnded) {
    borderStyle = "border-l-4 border-l-slate-200 border-slate-100 opacity-80";
    statusBadgeBg = "bg-slate-50 text-slate-500 border-slate-100";
    statusText = "Đã hoàn thành";
    statusIcon = <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
  } else if (hasStarted) {
    borderStyle = "border-l-4 border-l-emerald-500 border-slate-100 ring-1 ring-emerald-500/10";
    statusBadgeBg = "bg-emerald-50 text-emerald-700 border-emerald-100";
    statusText = "Đang di chuyển";
    statusIcon = <Navigation className="w-3.5 h-3.5 shrink-0" />;
  }

  return (
    <div className={`bg-white rounded-2xl border ${borderStyle} shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50 bg-slate-50/20">
        <div className="flex items-center gap-2">
          <Badge className={`gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusBadgeBg}`}>
            {statusIcon}
            {statusText}
          </Badge>
          {hasIssue && (
            <Badge className="gap-1 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-600">
              <AlertTriangle className="w-3 h-3 shrink-0 animate-pulse" /> Sự cố
            </Badge>
          )}
        </div>
        <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
          {fmtDt(startDt).split(' ')[1]}
        </span>
      </div>

      <div className="flex flex-col gap-5 px-5 py-5 flex-1">
        <div className="space-y-1">
          <h4 className="text-[15px] font-bold text-slate-900 leading-snug group-hover:text-primary transition-colors">
            {trip.title}
          </h4>
          {trip.description && (
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{trip.description}</p>
          )}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100">
              <Car className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <span className="text-sm font-semibold text-slate-800">
              {(trip.vehicle as any)?.name
                ? `${(trip.vehicle as any).name} · ${(trip.vehicle as any).plate_number}`
                : <span className="text-slate-400 font-normal italic">Chờ phân công xe</span>}
            </span>
          </div>

          {trip.location && (
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5 border border-slate-100/30">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <span className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{trip.location}</span>
            </div>
          )}

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 mt-0.5 border border-slate-100/80">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-[13px] text-slate-500 space-y-0.5 font-medium">
              <div><span className="text-slate-400 text-xs font-semibold">Đi:</span> {fmtDt(startDt)}</div>
              {hasEnded ? (
                <div><span className="text-slate-400 text-xs font-semibold">Đến:</span> {fmtDt(new Date(trip.metadata?.trip_ended_at || endDt))}</div>
              ) : hasStarted ? (
                <div><span className="text-amber-600 text-xs font-semibold">Đang đến:</span> <span className="text-amber-600">{fmtDt(new Date())}</span></div>
              ) : null}
            </div>
          </div>
          
          {trip.metadata?.destinations && trip.metadata.destinations.length > 0 && (
            <div className="flex items-start gap-3 mt-2">
              <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100/30">
                <Navigation className="w-3 h-3 text-slate-500" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                  {trip.metadata.destinations.map((d: any) => d.location).join(' ➔ ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {trip.participants && trip.participants.length > 0 && (
          <div className="pt-3 mt-2 border-t border-slate-50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Người đi cùng ({trip.participants.filter((p: any) => p.profile?.role !== 'driver').length})</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {trip.participants.filter((p: any) => p.profile?.role !== 'driver').map((p: any) => (
                <div key={p.profile?.id} className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                  <Avatar className="w-5 h-5 shrink-0">
                    <AvatarImage src={p.profile?.avatar_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">
                      {p.profile?.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                    {p.profile?.full_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!hasEnded && (
        <div className="flex items-center gap-2 px-5 pb-5 pt-1 bg-slate-50/10">
          {!isConfirmed && trip.status === 'approved' && !hasStarted ? (
            <Button
              onClick={() => onConfirm(trip)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold min-h-11 text-sm gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Xác nhận lịch
            </Button>
          ) : !hasStarted ? (
            <Button
              onClick={() => onStart(trip)}
              className="flex-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold min-h-11 text-sm gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
            >
              <Navigation className="w-3.5 h-3.5" /> Bắt đầu chuyến
            </Button>
          ) : (
            <Button
              onClick={() => onEnd(trip)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold min-h-11 text-sm gap-1.5 shadow-sm active:scale-95 transition-all duration-150"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Kết thúc chuyến
            </Button>
          )}
          <Button
            onClick={() => onReportIssue(trip)}
            variant="ghost"
            title="Báo sự cố"
            className="h-11 w-11 p-0 shrink-0 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 active:scale-95 transition-all duration-150"
          >
            <AlertTriangle className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
