import { Suspense } from "react";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import TeamPage from "./_components/TeamPage";

export default function Page() {
  return (
    <Suspense fallback={
      <div className="page-container space-y-6 md:space-y-8 animate-fade-in-up">
        <ListSkeleton variant="card" rows={6} />
      </div>
    }>
      <TeamPage />
    </Suspense>
  );
}
