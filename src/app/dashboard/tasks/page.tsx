'use client';

// Trang chính module Tasks — list + detail dialog + create dialog.
// Đồng bộ với pattern Hồ sơ/Schedule: detail popup, create popup,
// URL deep-link qua ?id= (detail) và ?create=1 (create).

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus, Inbox, Building2, Globe, BarChart3, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { EmptyState } from '@/components/ui/empty-state';

import { createClient } from '@/utils/supabase/client';
import { useTasksDashboard } from './_hooks/useTasksDashboard';
import { useOptimisticAction } from './_hooks/useOptimisticAction';
import { TaskListSection } from './_components/TaskListSection';
import { ResourceView } from './_components/ResourceView';
import { ManagerInboxView } from './_components/ManagerInboxView';
import { TaskDetailDialog } from './_components/TaskDetailDialog';
import { CreateTaskDialog } from './_components/CreateTaskDialog';
import { updateTaskStatus } from './_lib/taskActions';
import { canViewTaskAnalytics, canCreateRecurringTemplate } from '@/lib/permissions';
import type { TaskScope } from './_lib/types';

type TabValue = 'inbox' | 'mine' | 'dept' | 'branch';

function tabToScope(tab: TabValue): TaskScope {
  if (tab === 'mine' || tab === 'inbox') return 'mine';
  if (tab === 'dept') return 'dept';
  return 'branch';
}

function TasksContent() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = (searchParams.get('q') ?? '').toLowerCase().trim();
  const openId = searchParams.get('id');
  const createOpen = searchParams.get('create') === '1';

  const [profile, setProfile] = useState<any>(null);
  const [tab, setTab] = useState<TabValue>('mine');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase
        .from('profiles')
        .select('*, departments(name, code)')
        .eq('id', user.id)
        .single();
      setProfile(p);
      if (p?.role === 'admin' || p?.role === 'director') setTab('branch');
      else if (p?.role === 'manager') setTab('inbox');
      else setTab('mine');
    })();
  }, [supabase]);

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
    if (!searchQuery) return dash.items;
    return dash.items.filter(t =>
      t.title.toLowerCase().includes(searchQuery)
      || (t.description ?? '').toLowerCase().includes(searchQuery)
      || (t.creator?.full_name ?? '').toLowerCase().includes(searchQuery),
    );
  }, [dash.items, searchQuery]);

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
              <Button variant="outline" asChild className="min-h-11 rounded-xl font-medium hidden sm:inline-flex">
                <Link href="/dashboard/tasks/recurring">
                  <CalendarClock className="icon-sm mr-1.5" /> Định kỳ
                </Link>
              </Button>
            )}
            {showAnalyticsLink && (
              <Button variant="outline" asChild className="min-h-11 rounded-xl font-medium hidden sm:inline-flex">
                <Link href="/dashboard/tasks/analytics">
                  <BarChart3 className="icon-sm mr-1.5" /> Báo cáo
                </Link>
              </Button>
            )}
            <Button
              onClick={handleOpenCreate}
              className="bg-primary hover:bg-primary/90 min-h-11 px-5 rounded-xl font-semibold shadow-sm"
            >
              <Plus className="mr-2 icon-sm" /> Tạo mới
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="w-full">
        <TabsList className={`min-h-11 ${isManagerPlus ? 'grid grid-cols-3' : ''}`}>
          {isManagerPlus && (
            <TabsTrigger value="inbox" className="rounded-lg py-1.5 font-semibold text-[13px] flex items-center justify-center gap-1.5">
              <Inbox className="icon-sm" />
              <span>Chờ tôi duyệt</span>
              {dash.counts.awaiting_approval + dash.counts.extensions_pending > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {dash.counts.awaiting_approval + dash.counts.extensions_pending}
                </span>
              )}
            </TabsTrigger>
          )}
          <TabsTrigger value="mine" className="rounded-lg py-1.5 font-semibold text-[13px] flex items-center justify-center gap-1.5">
            <span>Của tôi</span>
          </TabsTrigger>
          {isManagerPlus && (
            <TabsTrigger value={isAdminOrDirector ? 'branch' : 'dept'} className="rounded-lg py-1.5 font-semibold text-[13px] flex items-center justify-center gap-1.5">
              {isAdminOrDirector ? <Globe className="icon-sm" /> : <Building2 className="icon-sm" />}
              <span>{isAdminOrDirector ? 'Toàn chi nhánh' : 'Phòng tôi'}</span>
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {dash.loading ? (
        <ListSkeleton rows={6} variant="card" />
      ) : tab === 'inbox' ? (
        <ManagerInboxView items={dash.items} onOpen={handleOpenTask} onChanged={dash.refetch} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Inbox className="icon-lg" />}
          title="Không có công việc nào"
          description={searchQuery ? 'Thử tìm với từ khoá khác.' : 'Bấm "Tạo mới" để thêm công việc đầu tiên.'}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <TaskListSection
              items={filteredItems}
              onOpen={handleOpenTask}
              onSwipeDone={handleSwipeDone}
              canSwipeDone
            />
          </div>
          {isManagerPlus && (tab === 'dept' || tab === 'branch') && dash.resourceView.length > 0 && (
            <div className="lg:col-span-4">
              <ResourceView data={dash.resourceView} />
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
