// Loading skeleton cho /dashboard/settings — header + sections list.
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container section-stack animate-fade-in-up">
      <header className="space-y-2 pt-4 sm:pt-0">
        <Skeleton className="h-8 w-36 rounded" />
        <Skeleton className="h-4 w-80 rounded" />
      </header>
      <div className="group-stack">
        {Array.from({ length: 4 }).map((_, i) => (
          <section key={i} className="premium-card p-4 sm:p-5 item-stack">
            <Skeleton className="h-5 w-44 rounded" />
            <Skeleton className="h-4 w-80 rounded" />
            <Skeleton className="h-11 w-full sm:w-48 rounded-xl" />
          </section>
        ))}
      </div>
    </div>
  );
}
