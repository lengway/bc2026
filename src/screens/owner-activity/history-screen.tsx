import type { ReactNode } from "react";
import type { CaseHistoryFilters, CaseHistoryPage } from "@/contracts";
import { SKILL_IDS } from "@/contracts";
import { EmptyState } from "@/ui/app-summary";
import { formatSkill } from "@/ui/lib/format";
import { Button } from "@/ui/primitives/button";
import { CaseResultsSkeleton, CaseResultsTable } from "@/ui/recent-cases";

type HistoryFilters = Pick<
  CaseHistoryFilters,
  "skill" | "outcome" | "period" | "sort"
>;

const filterClass =
  "h-11 w-full rounded-md border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function HistoryScreen({
  filters,
  onFiltersChange,
  page,
  onPageChange,
  result,
  loading,
  error,
  onStart,
}: {
  filters: HistoryFilters;
  onFiltersChange: (filters: HistoryFilters) => void;
  page: number;
  onPageChange: (page: number) => void;
  result?: CaseHistoryPage;
  loading?: boolean;
  error?: ReactNode;
  onStart?: ReactNode;
}) {
  const filtered = Boolean(filters.skill || filters.outcome || filters.period);
  const { skill, outcome, period, sort } = filters;

  return (
    <section className="mx-auto grid w-full min-w-0 max-w-6xl gap-5 p-4 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="grid min-w-0 gap-1.5 text-sm text-muted-foreground">
          Skill
          <select
            className={filterClass}
            value={skill ?? ""}
            onChange={({ target }) =>
              onFiltersChange({
                ...filters,
                skill: (target.value || undefined) as HistoryFilters["skill"],
              })
            }
          >
            <option value="">All skills</option>
            {SKILL_IDS.map((id) => (
              <option key={id} value={id}>
                {formatSkill(id)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm text-muted-foreground">
          Outcome
          <select
            className={filterClass}
            value={outcome ?? ""}
            onChange={({ target }) =>
              onFiltersChange({
                ...filters,
                outcome: (target.value ||
                  undefined) as HistoryFilters["outcome"],
              })
            }
          >
            <option value="">All outcomes</option>
            <option value="won">Deal won</option>
            <option value="lost">Deal lost</option>
            <option value="left">Client left</option>
            <option value="incomplete">Incomplete</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm text-muted-foreground">
          Period
          <select
            className={filterClass}
            value={period ?? ""}
            onChange={({ target }) =>
              onFiltersChange({
                ...filters,
                period: (target.value || undefined) as HistoryFilters["period"],
              })
            }
          >
            <option value="">All time</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </label>
        <label className="grid min-w-0 gap-1.5 text-sm text-muted-foreground">
          Sort by
          <select
            className={filterClass}
            value={sort ?? "date-desc"}
            onChange={({ target }) =>
              onFiltersChange({
                ...filters,
                sort: target.value as HistoryFilters["sort"],
              })
            }
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="accuracy-desc">Highest accuracy</option>
            <option value="accuracy-asc">Lowest accuracy</option>
          </select>
        </label>
      </div>
      {error}
      {loading ? (
        <CaseResultsSkeleton />
      ) : (
        result && (
          <>
            {result.items.length ? (
              <CaseResultsTable cases={result.items} />
            ) : (
              <EmptyState
                message={
                  filtered
                    ? "No cases match these filters."
                    : "Your completed cases will appear here."
                }
                action={
                  filtered ? (
                    <Button
                      className="min-h-11"
                      variant="outline"
                      onClick={() => onFiltersChange({ sort })}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    onStart
                  )
                }
              />
            )}
            {(page > 1 || result.hasMore) && (
              <nav
                aria-label="History pages"
                className="flex items-center justify-end gap-2"
              >
                <span className="mr-auto text-sm text-muted-foreground">
                  Page <span className="font-mono tabular-nums">{page}</span>
                </span>
                <Button
                  className="min-h-11"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => onPageChange(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  className="min-h-11"
                  variant="outline"
                  disabled={!result.hasMore}
                  onClick={() => onPageChange(page + 1)}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )
      )}
    </section>
  );
}
