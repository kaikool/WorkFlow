import React from 'react';
import { TrendingUp, TrendingDown, Clock, Briefcase, Target, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function QuickStats({ stats }: { stats: any }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
      <div className="premium-card border border-slate-200 bg-white p-4 sm:p-5 min-h-[104px] transition-all hover:shadow-premium-hover">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold text-slate-500 truncate">Năng suất tuần</p>
          <Trophy className="h-5 w-5 shrink-0 text-amber-600" />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{stats.productivity}</p>
          <span className={cn(
            "flex items-center gap-1 text-xs font-bold whitespace-nowrap",
            stats.productivityChange >= 0 ? "text-emerald-700" : "text-rose-700"
          )}>
            {stats.productivityChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(stats.productivityChange)}%
          </span>
        </div>
      </div>

      <div className="premium-card border border-slate-200 bg-white p-4 sm:p-5 min-h-[104px] transition-all hover:shadow-premium-hover">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold text-slate-500 truncate">Đang xử lý</p>
          <Clock className="h-5 w-5 shrink-0 text-blue-700" />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{stats.activeTasks}</p>
          {stats.urgentTasks > 0 && (
            <span className="text-xs font-bold text-amber-700 whitespace-nowrap">
              {stats.urgentTasks} khẩn
            </span>
          )}
        </div>
      </div>

      <div className="premium-card border border-slate-200 bg-white p-4 sm:p-5 min-h-[104px] transition-all hover:shadow-premium-hover">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold text-slate-500 truncate">Nhiệm vụ</p>
          <Briefcase className="h-5 w-5 shrink-0 text-slate-700" />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{stats.totalCompleted}/{stats.totalAssigned}</p>
          <span className="text-xs font-bold text-amber-700 whitespace-nowrap">
            Trễ {stats.totalLate}
          </span>
        </div>
      </div>

      <div className="premium-card border border-slate-200 bg-white p-4 sm:p-5 min-h-[104px] transition-all hover:shadow-premium-hover">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold text-slate-500 truncate">Kế hoạch</p>
          <Target className="h-5 w-5 shrink-0 text-emerald-700" />
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{stats.kpiProgress}%</p>
          <span className="text-xs font-bold text-blue-700 whitespace-nowrap">
            {stats.kpiCount} chỉ tiêu
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-amber-500" style={{ width: Math.min(100, stats.kpiProgress) + '%' }} />
        </div>
      </div>
    </div>
  );
}
