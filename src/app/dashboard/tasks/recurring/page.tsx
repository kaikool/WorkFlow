'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/layout/PageHeader';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { createClient } from '@/utils/supabase/client';
import { fetchCurrentProfile } from '@/lib/fetch-profile';
import { canCreateRecurringTemplate } from '@/lib/permissions';
import { useRecurringTemplates } from '../_hooks/useRecurringTemplates';
import { RecurringTemplateCard } from '../_components/RecurringTemplateCard';
import { RecurringTemplateDialog } from '../_components/RecurringTemplateDialog';
import type { RecurringTemplate } from '../_lib/recurringHelpers';

export default function RecurringPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState<RecurringTemplate | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await fetchCurrentProfile(supabase);
      if (!p) return;
      setProfile(p);
      if (!canCreateRecurringTemplate(p)) router.replace('/dashboard/tasks');
    })();
  }, [supabase, router]);

  const { loading, items, refetch } = useRecurringTemplates(!!profile);

  const handleNew = () => { setEditing(null); setOpen(true); };
  const handleEdit = (t: RecurringTemplate) => { setEditing(t); setOpen(true); };

  return (
    <div className="page-container group-stack animate-fade-in-up">
      <div>
        <Button variant="ghost" asChild className="p-0 hover:bg-transparent text-slate-500 hover:text-slate-900">
          <Link href="/dashboard/tasks" className="flex items-center gap-2 min-h-11">
            <ChevronLeft className="icon-sm" />
            <span className="text-subtitle font-medium">Công việc</span>
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Lịch định kỳ"
        description="Máy đóng vai 'kẻ đòi nợ' — tự sinh task định kỳ thay con người."
        action={
          <Button onClick={handleNew} className="bg-primary hover:bg-primary/90 min-h-11 px-5 rounded-xl font-semibold">
            <Plus className="icon-sm mr-1.5" /> Tạo template
          </Button>
        }
      />

      {loading ? (
        <ListSkeleton rows={4} variant="card" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="icon-lg" />}
          title="Chưa có template nào"
          description="Tạo template để máy tự sinh task định kỳ (vd: Thứ 6 15:00 hằng tuần)."
          actionLabel="Tạo template đầu tiên"
          onAction={handleNew}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map(t => (
            <RecurringTemplateCard key={t.id} template={t} onEdit={handleEdit} onChanged={refetch} />
          ))}
        </div>
      )}

      <RecurringTemplateDialog
        isOpen={open}
        setIsOpen={setOpen}
        editing={editing}
        onSaved={refetch}
      />
    </div>
  );
}
