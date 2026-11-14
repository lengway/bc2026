import { SKILL_IDS } from "@/contracts";
import { Skeleton } from "@/ui/primitives/skeleton";

export function SkillSkeleton({ detail = false }: { detail?: boolean }) {
  return (
    <main
      role="status"
      aria-busy="true"
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8"
    >
      <span className="sr-only">
        {detail ? "Loading skill…" : "Loading skills…"}
      </span>
      <div aria-hidden="true" className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-32" />
        {detail && <Skeleton className="h-4 w-full max-w-md" />}
      </div>
      {detail ? (
        <div
          aria-hidden="true"
          className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
        >
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-2 w-full" />
          <div className="grid gap-2.5 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SKILL_IDS.map((skill) => (
            <div
              key={skill}
              className="space-y-3 rounded-xl border bg-card p-4"
            >
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-9" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
              <Skeleton className="h-1.5 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
