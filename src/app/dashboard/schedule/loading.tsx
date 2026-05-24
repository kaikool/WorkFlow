// Loading skeleton cho /dashboard/schedule — header + filter tabs + calendar block lớn.
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container section-stack animate-fade-in-up">
      <header className="space-y-2 pt-4 sm:pt-0">
        <Skeleton className="h-8 w-56 rounded" />
        <Skeleton className="h-4 w-80 rounded" />
      </header>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[460px] w-full rounded-2xl" />
    </div>
  );
}
