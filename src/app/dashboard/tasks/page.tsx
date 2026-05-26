'use client';

// Trang chính module Tasks — list + detail dialog + create dialog.
// Đồng bộ với pattern Hồ sơ/Schedule: detail popup, create popup,
// URL deep-link qua ?id= (detail) và ?create=1 (create).

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus, Inbox, Building2, Globe, BarChart3, CalendarClock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

import { useAppData } from '@/hooks/use-app-data';
import { useTasksDashboard } from './_hooks/useTasksDashboard';
import { useOptimisticAction } from './_hooks/useOptimisticAction';
import { TaskListSection } from './_components/TaskListSection';
import { ResourceView } from './_components/ResourceView';
import { TaskDetailDialog } from './_components/TaskDetailDialog';
import { BatchTaskDetailDialog } from './_components/BatchTaskDetailDialog';
import { CreateTaskDialog } from './_components/CreateTaskDialog';
import { updateTaskStatus } from './_lib/taskActions';
import { canAccessTasksModule, canViewTaskAnalytics, canCreateRecurringTemplate } from '@/lib/permissions';
import type { TaskScope } from './_lib/types';

type TabValue = 'mine' | 'dept' | 'branch';

function tabToScope(tab: TabValue): TaskScope {
  if (tab === 'mine') return 'mine';
  if (tab === 'dept') return 'dept';
  return 'branch';
}

function TasksContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = (searchParams.get('q') ?? '').toLowerCase().trim();
  const statusFilter = searchParams.get('status') ?? 'all';
  const openId = searchParams.get('id');
  const createOpen = searchParams.get('create') === '1';

  const [profile, setProfile] = useState<any>(null);
  const [tab, setTab] = useState<TabValue>('mine');
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);

  const { currentProfile } = useAppData();

  // Chọn tab mặc định theo role — chạy 1 lần khi currentProfile sẵn sàng
  useEffect(() => {
    if (!currentProfile) return;
    setProfile(currentProfile);
    if (!canAccessTasksModule(currentProfile)) {
      router.replace('/dashboard');
      return;
    }
    if (currentProfile.role === 'admin' || currentProfile.role === 'director') setTab('branch');
    else if (currentProfile.role === 'manager') setTab('dept');
    else setTab('mine');
  }, [currentProfile?.id, router]);

  const scope = tabToScope(tab);
  const dash = useTasksDashboard({ scope, enabled: !!profile });

  const { run: runOptimistic } = useOptimisticAction(dash.items, dash.setItems);
  const handleSwipeDone = async (taskId: string) => {
    await runOptimistic(
      taskId,
      { status: 'done' } as any,
      () => updateTaskStatus(taskId, 'done'),
      'Không hoàn thành được',
    );
  };

  const setUrlParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key); else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleOpenTask = (taskId: string) => setUrlParam('id', taskId);
  const handleCloseDetail = () => setUrlParam('id', null);
  const handleOpenCreate = () => setUrlParam('create', '1');
  const handleCloseCreate = () => setUrlParam('create', null);

  const filteredItems = useMemo(() => {
    let list = dash.items;
    if (statusFilter !== 'all') {
      if (statusFilter === 'overdue') {
        list = list.filter(t => t.is_overdue);
      } else {
        list = list.filter(t => t.status === statusFilter);
      }
    }
    if (searchQuery) {
      list = list.filter(t =>
        t.title.toLowerCase().includes(searchQuery)
        || (t.description ?? '').toLowerCase().includes(searchQuery)
        || (t.creator?.full_name ?? '').toLowerCase().includes(searchQuery),
      );
    }
    return list;
  }, [dash.items, searchQuery, statusFilter]);

  const isManagerPlus = ['admin', 'director', 'manager'].includes(profile?.role);
  const isAdminOrDirector = ['admin', 'director'].includes(profile?.role);
  const showAnalyticsLink = canViewTaskAnalytics(profile);
  const showRecurringLink = canCreateRecurringTemplate(profile);

  return (
    <div className="page-container space-y-6 md:space-y-8 animate-fade-in-up">
      <PageHeader
        title="Công việc"
        description="Quản trị & theo dõi tiến độ"
        action={
          <div className="flex items-center gap-2">
            {showRecurringLink && (
              <Button variant="outline" asChild>
                <Link href="/dashboard/tasks/recurring">
                  <CalendarClock className="icon-sm" />
                  <span>Định kỳ</span>
                </Link>
              </Button>
            )}
            {showAnalyticsLink && (
              <Button variant="outline" asChild>
                <Link href="/dashboard/tasks/analytics">
                  <BarChart3 className="icon-sm" />
                  <span>Thống kê</span>
                </Link>
              </Button>
            )}
            <Button
              onClick={handleOpenCreate}
              className="px-5 font-semibold shadow-sm"
            >
              <Plus className="icon-sm" /> Tạo mới
            </Button>
          </div>
        }
      />

      {/* Mobile entry — PageHeader.action ẩn trên mobile, render strip riêng */}
      {(showRecurringLink || showAnalyticsLink) && (
        <div className="flex gap-2 sm:hidden">
          {showRecurringLink && (
            <Button variant="outline" asChild className="flex-1">
              <Link href="/dashboard/tasks/recurring">
                <CalendarClock className="icon-sm" /> Định kỳ
              </Link>
            </Button>
          )}
          {showAnalyticsLink && (
            <Button variant="outline" asChild className="flex-1">
              <Link href="/dashboard/tasks/analytics">
                <BarChart3 className="icon-sm" /> Thống kê
              </Link>
            </Button>
          )}
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="w-full">
        <TabsList className={`min-h-11 ${isManagerPlus ? 'grid grid-cols-2' : ''}`}>
          <TabsTrigger value="mine" className="rounded-lg py-1.5 font-semibold text-[13px] flex items-center justify-center gap-1.5">
            <span>Của tôi</span>
          </TabsTrigger>
          {isManagerPlus && (
            <TabsTrigger value={isAdminOrDirector ? 'branch' : 'dept'} className="rounded-lg py-1.5 font-semibold text-[13px] flex items-center justify-center gap-1.5">
              {isAdminOrDirector ? <Globe className="icon-sm" /> : <Building2 className="icon-sm" />}
              <span>{isAdminOrDirector ? 'Chi nhánh' : 'Phòng tôi'}</span>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {dash.loading ? (
        <ListSkeleton rows={6} variant="card" />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Inbox className="icon-lg" />}
          title="Không có công việc nào"
          description={searchQuery ? 'Thử tìm với từ khoá khác.' : 'Bấm "Tạo mới" để thêm công việc đầu tiên.'}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8">
              <TaskListSection
                items={filteredItems}
                onOpen={handleOpenTask}
                onOpenBatch={setOpenBatchId}
                onSwipeDone={handleSwipeDone}
                canSwipeDone
                currentProfile={profile}
              />
            </div>
            {isManagerPlus && (tab === 'dept' || tab === 'branch') && dash.resourceView.length > 0 && (
              <div className="lg:col-span-4">
                <ResourceView data={dash.resourceView} />
              </div>
            )}
          </div>
          {dash.hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={dash.loadMore}
                disabled={dash.loadingMore}
                className="min-h-11 px-6 rounded-xl font-medium"
              >
                {dash.loadingMore ? (
                  <><Loader2 className="icon-sm mr-1.5 animate-spin" /> Đang tải...</>
                ) : (
                  <>Tải thêm</>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Detail dialog */}
      <TaskDetailDialog
        taskId={openId}
        isOpen={!!openId}
        setIsOpen={(open) => { if (!open) handleCloseDetail(); }}
        currentProfile={profile}
        onChanged={dash.refetch}
      />

      {/* Create dialog */}
      <CreateTaskDialog
        isOpen={createOpen}
        setIsOpen={(open) => { if (!open) handleCloseCreate(); else handleOpenCreate(); }}
        onCreated={dash.refetch}
      />

      <BatchTaskDetailDialog
        isOpen={!!openBatchId}
        setIsOpen={(o) => { if (!o) setOpenBatchId(null); }}
        batchId={openBatchId}
        children={openBatchId ? dash.items.filter(t => t.batch_id === openBatchId) : []}
        onOpenTask={handleOpenTask}
        currentProfile={profile}
        onChanged={() => dash.refetch()}
      />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="page-container py-10"><ListSkeleton rows={5} variant="card" /></div>}>
      <TasksContent />
    </Suspense>
  );
}
