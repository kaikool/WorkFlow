// Loading skeleton cho /dashboard/tasks — header + filter chips + list rows.
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container section-stack animate-fade-in-up">
      <header className="space-y-2 pt-4 sm:pt-0">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-4 w-80 rounded" />
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-xl shrink-0" />
        ))}
      </div>
      <ListSkeleton variant="list" rows={6} />
    </div>
  );
}
