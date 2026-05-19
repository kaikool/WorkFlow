import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X, Calendar, Clock, User } from "lucide-react";

interface LeaveApprovalDashboardProps {
  schedules: any[];
  profile: any;
  onStatusUpdate: (id: string, status: string) => Promise<void>;
}

export default function LeaveApprovalDashboard({ schedules, profile, onStatusUpdate }: LeaveApprovalDashboardProps) {
  const pendingLeaves = schedules.filter(s => {
    if (s.type !== 'leave' || s.status !== 'pending') return false;

    // Nếu người đăng nhập là Admin hoặc HR-Officer hoặc TCTH: Xem và duyệt toàn bộ đơn (quyết định cuối)
    if (profile?.role === 'admin' || profile?.role === 'hr_officer' || profile?.departments?.name === 'Tổ chức Tổng hợp') {
      return true;
    }

    // Nếu người đăng nhập là Ban Giám đốc (director): Chỉ duyệt đơn của các Trưởng phòng (is_department_head = true)
    if (profile?.role === 'director') {
      return s.creator?.is_department_head === true;
    }

    // Nếu người đăng nhập là Lãnh đạo phòng (manager): Xem và duyệt đơn của cán bộ thuộc phòng của mình
    if (profile?.role === 'manager') {
      return s.creator?.department_id === profile?.department_id;
    }

    // Các vai trò khác không có quyền duyệt đơn nghỉ phép
    return false;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pl-1">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> ĐƠN NGHỈ PHÉP CHỜ DUYỆT ({pendingLeaves.length})
        </h3>
      </div>

      {pendingLeaves.length === 0 ? (
        <div className="premium-card p-10 text-center border-none bg-slate-50/50">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
            <User className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-700">Không có đơn xin nghỉ phép nào cần duyệt</p>
          <p className="text-xs text-slate-400 mt-1">Tất cả các đơn xin nghỉ phép của cán bộ đều đã được xử lý.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {pendingLeaves.map((leave) => {
            const startDate = new Date(leave.start_time);
            const endDate = new Date(leave.end_time);
            return (
              <div key={leave.id} className="premium-card p-6 border border-slate-100 bg-white hover:shadow-premium-hover transition-all duration-300 flex flex-col justify-between group">
                <div className="space-y-4">
                  {/* Cán bộ */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-slate-100 shadow-sm">
                      <AvatarImage src={leave.creator?.avatar_url} />
                      <AvatarFallback className="font-bold text-xs bg-slate-100 text-slate-700">
                        {leave.creator?.full_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{leave.creator?.full_name || "Cán bộ"}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">CÁN BỘ XIN NGHỈ</p>
                    </div>
                  </div>

                  {/* Chi tiết đơn */}
                  <div className="space-y-1 bg-slate-50/50 p-4 rounded-2xl">
                    <p className="text-sm font-bold text-slate-950 line-clamp-1">{leave.title}</p>
                    {leave.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">{leave.description}</p>
                    )}
                  </div>

                  {/* Thời gian */}
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 pl-1">
                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {startDate.toLocaleDateString('vi-VN')} - {endDate.toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="flex items-center gap-3 pt-6 mt-6 border-t border-slate-50">
                  <Button
                    onClick={() => onStatusUpdate(leave.id, 'rejected')}
                    variant="ghost"
                    className="flex-1 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-2xl font-bold h-11 text-xs gap-1.5 transition-colors"
                  >
                    <X className="w-4 h-4" /> TỪ CHỐI
                  </Button>
                  <Button
                    onClick={() => onStatusUpdate(leave.id, 'approved')}
                    className="flex-1 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold h-11 text-xs gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    <Check className="w-4 h-4" /> PHÊ DUYỆT
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
