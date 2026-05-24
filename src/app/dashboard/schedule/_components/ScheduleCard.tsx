'use client'

import React from "react";
import { Clock, MapPin, Users, Car, DoorOpen, MoreVertical, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, compareProfilesByHierarchy, canViewLeaveDetails } from "@/lib/utils";
import { format, isSameDay } from "date-fns";
import { typeLabels, statusLabels } from "../_lib/constants";
import { AvatarStack } from "@/components/ui/people-picker";
import { canCoordinateSharedResources } from "@/lib/permissions";
import RejectScheduleDialog from "./RejectScheduleDialog";

interface ScheduleCardProps {
  item: any;
  profile?: any;
  onSelect: (item: any) => void;
  onStatusUpdate: (id: string, status: string, reason?: string) => void | Promise<void>;
}

export default function ScheduleCard({ item, profile, onSelect, onStatusUpdate }: ScheduleCardProps) {
  const isCoordinator = canCoordinateSharedResources(profile);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const type = typeLabels[item.type] || typeLabels.meeting;
  const status = statusLabels[item.status] ?? { label: item.status ?? "Không rõ", color: "bg-slate-100 text-slate-500" };
  const isTrip = item.type === 'trip';
  const isRejected = item.status === 'rejected';
  const isOwnRejected = isRejected && profile?.id && item.created_by === profile.id;
  const sortedParticipants = [...(item.participants || [])].sort((a: any, b: any) => compareProfilesByHierarchy(a.profile, b.profile));
  const startTime = new Date(item.start_time);
  const endTime = new Date(item.end_time);
  const sameDay = isSameDay(startTime, endTime);

  const isAllowedToView = canViewLeaveDetails(item, profile);
  const displayTitle = isAllowedToView ? item.title : `Nghỉ phép (${item.creator?.full_name || 'Cán bộ'})`;

  return (
    <Card className={cn(
      "rounded-2xl overflow-hidden border-none shadow-sm hover:shadow-xl active:scale-[0.98] transition-all duration-300 ease-in-out group relative",
      isTrip ? "hover:bg-amber-50/40" : "hover:bg-slate-50"
    )}>
      <CardContent className="p-0">
        <button
          type="button"
          className="absolute inset-0 w-full h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-2xl z-0"
          onClick={() => onSelect(item)}
          aria-label={`Chi tiết lịch: ${displayTitle}`}
        />
        <div className="flex">
          <div className={cn("w-2 transition-all duration-500 group-hover:w-3", isTrip ? "bg-amber-600" : "bg-slate-700")} />

          <div className="flex-1 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                  <Badge variant="outline" className={cn("text-xs font-semibold px-2.5 py-1 rounded-md whitespace-nowrap", type.color)}>
                    <type.icon className="w-3 h-3 mr-1 shrink-0" /> {type.label}
                  </Badge>
                  {item.use_vehicle && !item.vehicle_id && (
                    <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border border-amber-100 font-semibold text-xs px-2.5 py-1 rounded-md flex items-center gap-1 whitespace-nowrap">
                      <Car className="w-2.5 h-2.5 shrink-0" /> Chờ điều xe
                    </Badge>
                  )}
                  {isOwnRejected && (
                    <Badge className="status-danger-bg border font-semibold text-xs px-2.5 py-1 rounded-md flex items-center gap-1 whitespace-nowrap">
                      <XCircle className="w-2.5 h-2.5 shrink-0" /> Cần sửa &amp; đẩy lại
                    </Badge>
                  )}
                  <Badge className={cn("text-xs font-semibold px-2.5 py-1 rounded-md whitespace-nowrap", status.color)}>
                    {status.label}
                  </Badge>
                </div>
                <h3 className="text-[17px] font-semibold text-slate-900 leading-tight line-clamp-2 pt-1">{displayTitle}</h3>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl group-hover:bg-white transition-colors relative z-10">
                <MoreVertical className="w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl", isTrip ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700")}>
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-medium text-slate-900">{format(startTime, sameDay ? 'HH:mm' : 'dd/MM HH:mm')}</span>
                  <span className="text-xs text-slate-500 truncate">Bắt đầu</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 text-slate-500 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-medium text-slate-900">{format(endTime, sameDay ? 'HH:mm' : 'dd/MM HH:mm')}</span>
                  <span className="text-xs text-slate-500 truncate">Kết thúc</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <AvatarStack
                  people={sortedParticipants.map((p: any) => ({
                    id: p.profile?.id ?? '',
                    full_name: p.profile?.full_name ?? null,
                    avatar_url: p.profile?.avatar_url ?? null,
                  }))}
                  max={5}
                  size="sm"
                />
              </div>
              {item.room && (
                <div className="flex items-center gap-1.5 max-w-[140px]">
                  <DoorOpen className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span className="text-sm font-medium text-slate-700 truncate">{item.room.name}</span>
                </div>
              )}
              {item.vehicle && (
                <div className="flex items-center gap-1.5 max-w-[120px]">
                  <Car className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-sm font-medium text-amber-700 truncate">{item.vehicle.plate_number}</span>
                </div>
              )}
              {!item.room && !item.vehicle && item.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600 truncate max-w-[150px]">{item.location}</span>
                </div>
              )}
            </div>

            {isCoordinator && item.status === 'pending' && (
              <div className="flex gap-2 pt-4 border-t border-slate-50 relative z-10">
                <Button size="sm" disabled={item.use_vehicle && !item.vehicle_id}
                  onClick={(e) => { e.stopPropagation(); onStatusUpdate(item.id, 'approved'); }}
                  className="bg-slate-900 hover:bg-black min-h-11 rounded-xl font-semibold text-sm shadow-sm px-4"
                >{item.use_vehicle && !item.vehicle_id ? "Cần gán xe trước" : "Duyệt lịch"}</Button>
                <Button size="sm" variant="outline"
                  onClick={(e) => { e.stopPropagation(); setRejectOpen(true); }}
                  className="min-h-11 rounded-xl font-semibold text-sm border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 px-4"
                >Từ chối</Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <RejectScheduleDialog
        isOpen={rejectOpen}
        setIsOpen={setRejectOpen}
        scheduleTitle={item.title}
        onConfirm={async (reason) => { await onStatusUpdate(item.id, 'rejected', reason); }}
      />
    </Card>
  );
}
