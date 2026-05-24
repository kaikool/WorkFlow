// Loading skeleton cho /dashboard/profile — header + hero card + 2 info sections + activity.
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="page-container space-y-6 md:space-y-8 animate-fade-in-up">
      <header className="space-y-2 pt-4 sm:pt-0">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-4 w-80 rounded" />
      </header>

      {/* Hero card */}
      <section className="premium-card !p-0 overflow-hidden bg-slate-50/60">
        <div className="px-[var(--app-page-x)] py-5 sm:py-6 flex items-start gap-3 sm:gap-4">
          <Skeleton className="h-16 w-16 sm:h-20 sm:w-20 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-48 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </section>

      {/* 2 info sections */}
      <div className="group-stack">
        {Array.from({ length: 2 }).map((_, i) => (
          <section key={i} className="premium-card p-4 sm:p-5 item-stack">
            <Skeleton className="h-5 w-40 rounded" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3 py-2.5">
                <Skeleton className="h-5 w-5 rounded shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-4 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
