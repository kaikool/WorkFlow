import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X, Calendar, Clock, User } from "lucide-react";
import { canViewLeaveDetails } from "@/lib/utils";
import { canApproveLeave } from "@/lib/permissions";

interface LeaveApprovalDashboardProps {
  schedules: any[];
  profile: any;
  onStatusUpdate: (id: string, status: string) => Promise<void>;
}

export default function LeaveApprovalDashboard({ schedules, profile, onStatusUpdate }: LeaveApprovalDashboardProps) {
  const pendingLeaves = schedules.filter(s =>
    s.type === "leave" && s.status === "pending" && canApproveLeave(profile, s)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pl-1">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-700" /> Đơn nghỉ phép chờ duyệt ({pendingLeaves.length})
        </h3>
      </div>

      {pendingLeaves.length === 0 ? (
        <div className="premium-card text-center border border-slate-200 bg-white">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <User className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-700">Không có đơn cần duyệt</p>
          <p className="text-sm text-slate-500 mt-1">Tất cả các đơn nghỉ phép đều đã được xử lý.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pendingLeaves.map((leave) => {
            const startDate = new Date(leave.start_time);
            const endDate = new Date(leave.end_time);

            return (
              <div key={leave.id} className="premium-card border border-slate-200 bg-white hover:shadow-premium-hover transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-100 shadow-sm">
                      <AvatarImage src={leave.creator?.avatar_url} />
                      <AvatarFallback className="font-medium text-sm bg-slate-100 text-slate-700">
                        {leave.creator?.full_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{leave.creator?.full_name || "Cán bộ"}</p>
                      <p className="text-sm font-medium text-slate-500">Cán bộ xin nghỉ</p>
                    </div>
                  </div>

                  <div className="space-y-1 bg-slate-50/80 p-4 rounded-xl">
                    <p className="text-sm font-bold text-slate-950 line-clamp-1">
                      {canViewLeaveDetails(leave, profile) ? leave.title : "Nghỉ phép"}
                    </p>
                    {leave.description && canViewLeaveDetails(leave, profile) && (
                      <p className="text-sm text-slate-500 line-clamp-2 mt-1">{leave.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500 pl-1">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {startDate.toLocaleDateString("vi-VN")} - {endDate.toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-6 mt-6 border-t border-slate-100">
                  <Button
                    onClick={() => onStatusUpdate(leave.id, "rejected")}
                    variant="outline"
                    className="flex-1 border-slate-200 hover:bg-slate-100 hover:text-slate-900 text-slate-600 rounded-xl font-semibold min-h-11 text-sm gap-1.5 transition-colors"
                  >
                    <X className="w-4 h-4" /> Từ chối
                  </Button>
                  <Button
                    onClick={() => onStatusUpdate(leave.id, "approved")}
                    className="flex-1 bg-slate-900 hover:bg-black text-white rounded-xl font-semibold min-h-11 text-sm gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <Check className="w-4 h-4" /> Phê duyệt
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
