// Loading skeleton cho /dashboard — match shape DefaultDashboardView:
// header chào + quote, 3 KPI card, grid 8/4 task list + pending docs.
// Hiện ngay khi user click nav, swap sang content khi server component sẵn sàng.
import { StatsSkeleton, ListSkeleton } from '@/components/ui/list-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container section-stack animate-fade-in-up">
      <header className="space-y-2 pt-4 sm:pt-0">
        <Skeleton className="h-8 w-72 rounded" />
        <Skeleton className="h-4 w-96 rounded" />
      </header>
      <StatsSkeleton count={3} className="md:grid-cols-3" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <ListSkeleton variant="list" rows={4} />
        </div>
        <div className="lg:col-span-4">
          <ListSkeleton variant="list" rows={3} />
        </div>
      </div>
    </div>
  );
}
