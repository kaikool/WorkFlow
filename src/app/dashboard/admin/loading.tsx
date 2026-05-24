// Loading skeleton cho /dashboard/admin — header + tab bar + bảng dữ liệu.
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container section-stack animate-fade-in-up">
      <header className="space-y-2 pt-4 sm:pt-0">
        <Skeleton className="h-8 w-40 rounded" />
        <Skeleton className="h-4 w-80 rounded" />
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-xl shrink-0" />
        ))}
      </div>
      <ListSkeleton variant="table" rows={6} />
    </div>
  );
}
