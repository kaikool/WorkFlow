'use client';

// DefaultDashboardView — view chính cho admin/director/manager/staff.
// Gọi 1 RPC dashboard_summary() qua useDashboardSummary().
// 3 KPI card + grid 12 col (8 today list / 4 pending docs).
// Cuối trang: widget "Nhịp đập nhân sự" — sắp sinh nhật/anniversary/đang nghỉ.

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, ListChecks, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { StatsSkeleton, ListSkeleton } from '@/components/ui/list-skeleton';
import { useAppData } from '@/hooks/use-app-data';
import { useDashboardSummary } from '../_hooks/useDashboardSummary';
import TodayTaskList from './TodayTaskList';
import PendingDocsWidget from './PendingDocsWidget';
import PeopleAnalyticsWidget from '../team/_components/PeopleAnalyticsWidget';

const INSPIRATIONAL_QUOTES = [
  'Hôm nay là cơ hội để bạn bứt phá chỉ tiêu kinh doanh.',
  'Kiên trì nỗ lực, gặt hái kết quả xứng tầm.',
  'Làm việc chuyên nghiệp, kiến tạo giá trị bền vững.',
  'Mỗi con số đều minh chứng cho sự nỗ lực không ngừng.',
  'Chinh phục kế hoạch, khẳng định vị thế cán bộ.',
  'Năng lượng mới cho những thành công mới hôm nay.',
  'Tập trung tối đa để mang lại giá trị tốt nhất cho khách hàng.',
];

export default function DefaultDashboardView({ profile }: { profile: any }) {
  const { loading, data } = useDashboardSummary();
  const { profiles } = useAppData();
  // today_leaves đã được gộp vào RPC dashboard_summary() — không cần fetch riêng.

  // Quote ổn định theo session — không re-roll khi component re-render do realtime.
  const quote = useMemo(
    () => INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)],
    [],
  );

  const firstName = profile?.full_name?.split(' ').pop() ?? '';

  if (loading) {
    return (
      <div className="page-container section-stack pt-4">
        <header className="flex flex-col gap-4 pt-4 sm:pt-0 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="heading-page">Xin chào, {firstName}!</h1>
            <div className="flex items-center gap-2">
              <Sparkles className="icon-sm text-amber-400" />
              <p className="text-subtitle italic">{quote}</p>
            </div>
          </div>
        </header>
        <StatsSkeleton count={3} />
        <ListSkeleton variant="card" rows={4} />
      </div>
    );
  }

  const { counts, today_tasks, pending_docs, today_leaves } = data;
  const hasOverdue = counts.overdue > 0;

  return (
    <div className="page-container section-stack animate-fade-in-up">
      <header className="flex flex-col gap-4 pt-4 sm:pt-0 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="heading-page">Xin chào, {firstName}!</h1>
          <div className="flex items-center gap-2">
            <Sparkles className="icon-sm text-amber-400 animate-float" />
            <p className="text-subtitle italic">{quote}</p>
          </div>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground min-h-11 px-5 rounded-2xl font-medium text-sm shadow-primary-glow active:scale-95 transition-all">
          <Link href="/dashboard/tasks">
            Bắt đầu công việc <ArrowRight className="ml-2 icon-sm" />
          </Link>
        </Button>
      </header>

      {/* 3 KPI card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/dashboard/tasks?status=todo" className="premium-card p-5 group hover:shadow-md transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="tight-stack">
              <p className="text-subtitle">Đang xử lý</p>
              <div className="flex items-end gap-2">
                <span className="heading-section tabular-nums text-2xl leading-7">{counts.active}</span>
                {counts.urgent > 0 && (
                  <Badge className="status-danger-bg border-none rounded-full px-2 py-0 text-[11px] font-medium">
                    {counts.urgent} ưu tiên
                  </Badge>
                )}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <ListChecks className="icon-md" />
            </div>
          </div>
        </Link>

        <Link
          href="/dashboard/tasks?status=overdue"
          className={cn(
            'premium-card p-5 group hover:shadow-md transition-all',
            hasOverdue && 'status-danger-bg border-none',
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="tight-stack">
              <p className={cn('text-subtitle', hasOverdue && 'text-red-900')}>Quá hạn</p>
              <span className={cn(
                'heading-section tabular-nums text-2xl leading-7',
                hasOverdue && 'text-red-900',
              )}>
                {counts.overdue}
              </span>
            </div>
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              hasOverdue ? 'bg-red-200 text-red-700' : 'bg-slate-100 text-slate-500',
            )}>
              <AlertTriangle className="icon-md" />
            </div>
          </div>
        </Link>

        <div className="premium-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="tight-stack">
              <p className="text-subtitle">Xong hôm nay</p>
              <span className="heading-section tabular-nums text-2xl leading-7">{counts.done_today}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="icon-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid: today list (8) + pending docs (4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <TodayTaskList tasks={today_tasks} />
        </div>
        <div className="lg:col-span-4">
          <PendingDocsWidget docs={pending_docs} currentUserId={profile?.id ?? null} />
        </div>
      </div>

      {/* Nhịp đập nhân sự — sinh nhật/anniversary/đang nghỉ. Tự ẩn khi không có dữ liệu. */}
      <PeopleAnalyticsWidget members={profiles} todaySchedules={today_leaves} />
    </div>
  );
}
