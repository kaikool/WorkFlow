import React from 'react';
import Link from 'next/link';
import {
  Zap, ChevronRight, Briefcase, Target, Clock, Trophy,
  ChevronDown, ChevronUp, AlertCircle, FolderOpen, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';

// Tính nhanh trạng thái SLA cho 1 document — dùng riêng trong widget này,
// không phụ thuộc helper trong module handover để tránh import vòng tròn.
function getDocSlaLevel(doc: any): 'pending' | 'safe' | 'warn' | 'danger' {
  if (doc.status === 'PENDING_RECEIPT') return 'pending';
  const slaHours = doc.category?.sla_hours;
  if (!slaHours || slaHours <= 0) return 'safe';

  // Mốc bắt đầu: handover ACCEPTED gần nhất; fallback created_at
  const accepted = (doc.handovers || []).filter((h: any) => h.status === 'ACCEPTED');
  const startedAt = accepted.reduce((max: string | null, h: any) => {
    if (!h.received_at) return max;
    return !max || new Date(h.received_at) > new Date(max) ? h.received_at : max;
  }, null) || doc.created_at;

  const elapsedHours = (Date.now() - new Date(startedAt).getTime()) / 3_600_000;
  const used = elapsedHours / slaHours;
  if (used >= 1) return 'danger';
  if (used >= 0.7) return 'warn';
  return 'safe';
}

const SLA_DOT_CLASS: Record<string, string> = {
  pending: 'bg-amber-400 animate-pulse',
  safe:    'bg-emerald-500',
  warn:    'bg-amber-500',
  danger:  'bg-red-500 animate-pulse',
};

const SLA_LABEL: Record<string, string> = {
  pending: 'Chờ tôi nhận',
  safe:    'Trong SLA',
  warn:    'Sắp hết SLA',
  danger:  'Quá hạn',
};

export default function TaskOverview({
  stats,
  showAllActivities,
  setShowAllActivities
}: {
  stats: any;
  showAllActivities: boolean;
  setShowAllActivities: (v: boolean) => void;
}) {
  const pendingDocs: any[] = stats.pendingDocuments || [];

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
              <div className="flex items-center justify-between p-4 transition-all duration-300 rounded-2xl group border border-transparent bg-white hover:bg-slate-50 hover:border-slate-100 hover:shadow-sm">
                <div className="shrink-0 relative">
                  {t.type === 'task' ? (
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600">
                      <Briefcase className="w-5 h-5" />
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
                        ? 'Công việc mới'
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

      {/* Pending Documents Widget */}
      <div className="lg:col-span-4 space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-medium text-slate-500 flex items-center gap-2 truncate whitespace-nowrap">
            <FolderOpen className="w-4 h-4 text-primary" /> Hồ sơ cần xử lý
          </h3>
          {pendingDocs.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-2 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              {pendingDocs.length}
            </span>
          )}
        </div>

        <div className="premium-card p-4 border-none space-y-2">
          {pendingDocs.length === 0 ? (
            <EmptyState
              icon={<FolderOpen className="icon-lg" />}
              title="Bàn của bạn đang trống"
              description="Khi có hồ sơ vật lý chờ nhận hoặc đang giữ, hệ thống sẽ hiện tại đây."
              variant="subtle"
            />
          ) : (
            <>
              {pendingDocs.map((doc) => {
                const level = getDocSlaLevel(doc);
                return (
                  <Link
                    key={doc.id}
                    href={`/dashboard/handover?id=${doc.id}`}
                    className="block group"
                  >
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-transparent hover:bg-slate-50 hover:border-slate-100 transition-all">
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", SLA_DOT_CLASS[level])} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[11px] font-semibold text-slate-500 tabular-nums">
                          {doc.short_code}
                        </p>
                        <p className="text-[13px] font-semibold text-slate-900 truncate group-hover:text-primary transition-colors">
                          {doc.title}
                        </p>
                        <p className="text-[11px] font-medium text-slate-400">
                          {SLA_LABEL[level]}
                          {doc.category?.name && <span> · {doc.category.name}</span>}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  </Link>
                );
              })}
              <div className="pt-2">
                <Button asChild variant="ghost" className="w-full h-10 rounded-xl text-[13px] font-medium text-primary hover:bg-primary/5">
                  <Link href="/dashboard/handover">Xem tất cả hồ sơ <ChevronRight className="ml-1 w-3.5 h-3.5" /></Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
