import React from 'react';
import Link from 'next/link';
import { Zap, ChevronRight, Briefcase, Target, Clock, Trophy, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export default function TaskOverview({ 
  stats, 
  showAllActivities, 
  setShowAllActivities 
}: { 
  stats: any; 
  showAllActivities: boolean; 
  setShowAllActivities: (v: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4">
      {/* Feed Section */}
      <div className="lg:col-span-8 space-y-6">
        <div className="flex items-center justify-between px-2 mb-4">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 truncate whitespace-nowrap">
            <Zap className="w-4 h-4 text-primary fill-primary/10" /> Luồng hoạt động
          </h3>
          <Button variant="ghost" asChild className="text-sm font-medium text-primary h-10 md:h-8 hover:bg-primary/5 rounded-full px-4 truncate whitespace-nowrap">
            <Link href="/dashboard/tasks">Tất cả <ChevronRight className="ml-1 w-3 h-3" /></Link>
          </Button>
        </div>

        <div className="space-y-3">
          {(showAllActivities ? stats.recentTasks : stats.recentTasks.slice(0, 4)).map((t: any) => (
            <Link
              key={`${t.type}-${t.id}`}
              href={t.type === 'recognition' ? `/dashboard/team` : `/dashboard/tasks/${t.type === 'comment' ? t.task_id : t.id}`}
              className="block group"
            >
              <div className="flex items-center justify-between p-4 transition-all duration-300 rounded-[24px] group border border-transparent bg-white hover:bg-slate-50 hover:border-slate-100 hover:shadow-sm">
                <div className="shrink-0 relative">
                  {t.type === 'task' ? (
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center",
                      t.task_type === 'kpi' ? "text-amber-600" : "text-slate-600"
                    )}>
                      {t.task_type === 'kpi' ? <Target className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                    </div>
                  ) : (
                    <div className="relative">
                      <Avatar className={cn(
                        "h-11 w-11 border-2 shadow-sm",
                        t.type === 'recognition'
                          ? (t.rec_type === 'remind' ? "border-slate-200" : "border-amber-200")
                          : "border-transparent"
                      )}>
                        <AvatarImage src={t.type === 'recognition' ? t.receiver?.avatar_url : t.user?.avatar_url} />
                        <AvatarFallback className={cn(
                          "font-medium text-sm",
                          t.type === 'recognition'
                            ? (t.rec_type === 'remind' ? "bg-white text-slate-700" : "bg-white text-amber-700")
                            : "bg-white text-slate-700"
                        )}>
                          {(t.type === 'recognition' ? t.receiver?.full_name : t.user?.full_name)?.[0]}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1 ml-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                      {t.type === 'task' ? t.title : (t.type === 'comment' ? `"${t.content}"` : (t.rec_type === 'remind' ? `Nhắc nhở: ${t.content}` : `Vinh danh: ${t.content}`))}
                    </p>
                    <span className="hidden sm:inline-block text-xs md:text-sm font-medium text-slate-500 shrink-0 truncate whitespace-nowrap">
                      {new Date(t.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn(
                      "text-sm font-medium flex items-center gap-1.5 line-clamp-1",
                      t.type === 'recognition'
                        ? (t.rec_type === 'remind' ? "text-slate-500" : "text-amber-600")
                        : "text-slate-500"
                    )}>
                      {t.type === 'recognition' && (
                        t.rec_type === 'remind'
                          ? <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          : <Trophy className="w-3 h-3 fill-amber-500 shrink-0" />
                      )}
                      {t.type === 'task'
                        ? (t.task_type === 'kpi' ? 'Chỉ tiêu mới' : 'Công việc mới')
                        : (t.type === 'comment'
                          ? `Phản hồi: ${t.task?.title}`
                          : (t.rec_type === 'remind'
                            ? `Chấn chỉnh: ${t.receiver?.full_name}`
                            : `Vinh danh: ${t.receiver?.full_name}`
                          )
                        )}
                    </p>
                    <span className="inline-block sm:hidden text-sm font-medium text-slate-400">
                      • {new Date(t.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}

          {stats.recentTasks.length > 4 && (
            <div className="flex justify-center pt-2">
              <Button
                variant="ghost"
                onClick={() => setShowAllActivities(!showAllActivities)}
                className="text-sm font-medium text-primary hover:bg-primary/5 rounded-full px-6 py-2 flex items-center gap-1.5"
              >
                {showAllActivities ? (
                  <>Thu gọn <ChevronUp className="w-4 h-4" /></>
                ) : (
                  <>Xem thêm {stats.recentTasks.length - 4} hoạt động <ChevronDown className="w-4 h-4" /></>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Focus Section */}
      <div className="lg:col-span-4 space-y-6">
        <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 px-2 truncate whitespace-nowrap">
          <AlertCircle className="w-4 h-4 text-primary" /> Ưu tiên hàng đầu
        </h3>
        <div className="premium-card p-6 border-none relative overflow-hidden group">
          {stats.topKpi ? (
            <div className="space-y-6">
              <div className="text-amber-600 w-fit transition-transform duration-500 group-hover:scale-110">
                <Target className="w-8 h-8" />
              </div>
              <div className="space-y-3">
                <h4 className="text-base md:text-lg font-bold text-slate-900 leading-tight line-clamp-2">{stats.topKpi.title}</h4>
                <p className="text-xs md:text-sm text-slate-500 font-medium leading-relaxed line-clamp-3">
                  {stats.topKpi.description || "Nỗ lực hoàn thành chỉ tiêu đề ra."}
                </p>
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between text-xs md:text-sm font-medium truncate whitespace-nowrap">
                  <span className="text-slate-500">Tiến độ nhiệm vụ</span>
                  <span className="text-primary">
                    {stats.topKpi.target_value
                      ? Math.round(((stats.topKpi.current_value || 0) / stats.topKpi.target_value) * 100)
                      : (stats.topKpi.progress || 0)}%
                  </span>
                </div>
                <Progress
                  value={Math.min(100, stats.topKpi.target_value
                    ? Math.round(((stats.topKpi.current_value || 0) / stats.topKpi.target_value) * 100)
                    : (stats.topKpi.progress || 0))}
                  className="h-1.5 bg-slate-100"
                />
              </div>
              <Button asChild className="w-full bg-slate-900 hover:bg-black text-white h-11 md:h-12 rounded-xl font-medium text-sm mt-2 truncate whitespace-nowrap">
                <Link href={`/dashboard/tasks/${stats.topKpi.id}`}>Chi tiết lộ trình</Link>
              </Button>
            </div>
          ) : (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 flex items-center justify-center mx-auto text-slate-500">
                <Target className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-500 truncate whitespace-nowrap">Chưa có chỉ tiêu trọng tâm</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
