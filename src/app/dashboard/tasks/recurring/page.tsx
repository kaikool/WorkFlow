'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Plus, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useAppData } from '@/hooks/use-app-data';
import { canCreateRecurringTemplate, canAssignTaskToOthers, canRequestReport } from '@/lib/permissions';
import { useRecurringTemplates } from '../_hooks/useRecurringTemplates';
import { RecurringTemplateCard } from '../_components/RecurringTemplateCard';
import { RecurringTemplateDialog } from '../_components/RecurringTemplateDialog';
import type { RecurringTemplate } from '../_lib/recurringHelpers';

type TypeFilter = 'all' | 'task' | 'report';

function RecurringContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const createParam = searchParams.get('create') === '1';

  const { currentProfile } = useAppData();
  const profile = currentProfile;
  const [editing, setEditing] = useState<RecurringTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TypeFilter>('all');

  useEffect(() => {
    if (!profile) return;
    if (!canCreateRecurringTemplate(profile)) router.replace('/dashboard/tasks');
  }, [profile?.id, router]);

  // Mobile FAB / deep-link: mở dialog khi URL có ?create=1
  useEffect(() => {
    if (createParam && !open) { setEditing(null); setOpen(true); }
  }, [createParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const { loading, items, refetch } = useRecurringTemplates(!!profile);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter(t => t.task_type === filter);
  }, [items, filter]);

  const counts = useMemo(() => ({
    all: items.length,
    task: items.filter(t => t.task_type === 'task').length,
    report: items.filter(t => t.task_type === 'report').length,
  }), [items]);

  const showTaskFilter = canAssignTaskToOthers(profile);
  const showReportFilter = canRequestReport(profile);
  const showFilterTabs = showTaskFilter && showReportFilter;

  const cleanCreateParam = () => {
    if (!createParam) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('create');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleEdit = (t: RecurringTemplate) => { setEditing(t); setOpen(true); };
  const handleSetOpen = (v: boolean) => {
    setOpen(v);
    if (!v) cleanCreateParam();
  };

  return (
    <div className="page-container group-stack animate-fade-in-up">
      <PageHeader
        title="Lịch định kỳ"
        description="Máy đóng vai 'kẻ đòi nợ' — tự sinh việc/báo cáo định kỳ thay con người."
        action={
          <Button onClick={handleNew} className="px-5 font-semibold shadow-sm">
            <Plus className="icon-sm" /> Tạo template
          </Button>
        }
      />

      {showFilterTabs && items.length > 0 && (
        <Tabs value={filter} onValueChange={(v) => setFilter(v as TypeFilter)} className="w-full">
          <TabsList className="grid grid-cols-3 min-h-11">
            <TabsTrigger value="all" className="rounded-lg font-semibold text-[13px] flex items-center justify-center gap-1.5">
              <span>Tất cả</span>
              <span className="text-meta">({counts.all})</span>
            </TabsTrigger>
            <TabsTrigger value="task" className="rounded-lg font-semibold text-[13px] flex items-center justify-center gap-1.5">
              <span>Giao việc</span>
              <span className="text-meta">({counts.task})</span>
            </TabsTrigger>
            <TabsTrigger value="report" className="rounded-lg font-semibold text-[13px] flex items-center justify-center gap-1.5">
              <span>Báo cáo</span>
              <span className="text-meta">({counts.report})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {loading ? (
        <ListSkeleton rows={4} variant="card" />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="icon-lg" />}
          title={
            filter === 'task' ? 'Chưa có lịch giao việc nào'
            : filter === 'report' ? 'Chưa có lịch báo cáo nào'
            : 'Chưa có template nào'
          }
          description="Tạo template để máy tự sinh việc/báo cáo định kỳ (vd: Thứ 6 15:00 hằng tuần)."
          actionLabel="Tạo template đầu tiên"
          onAction={handleNew}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredItems.map(t => (
            <RecurringTemplateCard key={t.id} template={t} onEdit={handleEdit} onChanged={refetch} />
          ))}
        </div>
      )}

      <RecurringTemplateDialog
        isOpen={open}
        setIsOpen={handleSetOpen}
        editing={editing}
        onSaved={refetch}
      />
    </div>
  );
}

export default function RecurringPage() {
  return (
    <Suspense fallback={<div className="page-container py-10"><ListSkeleton rows={4} variant="card" /></div>}>
      <RecurringContent />
    </Suspense>
  );
}
