// Loading skeleton cho /dashboard/team — header + search + grid card variant.
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container section-stack animate-fade-in-up">
      <header className="space-y-2 pt-4 sm:pt-0">
        <Skeleton className="h-8 w-44 rounded" />
        <Skeleton className="h-4 w-80 rounded" />
      </header>
      <Skeleton className="h-11 w-full sm:w-80 rounded-xl" />
      <ListSkeleton variant="card" rows={6} />
    </div>
  );
}
