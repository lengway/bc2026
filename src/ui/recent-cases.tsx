import Link from "next/link";
import type { HistoryCase } from "@/contracts";
import { EmptyState, SectionHeader } from "./app-summary";
import { formatSkill } from "./lib/format";
import { MoveLabelBadge } from "./move-label-badge";
import { OutcomeBadge } from "./outcome-badge";
import { Button } from "./primitives/button";
import { Skeleton } from "./primitives/skeleton";

const compactDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function CaseDate({ date }: { date: string }) {
  return (
    <time className="font-mono tabular-nums" dateTime={date}>
      {compactDate.format(new Date(date))}
    </time>
  );
}

function Accuracy({ value }: { value: number | null }) {
  return (
    <span className="font-mono tabular-nums">
      {value === null ? <span aria-label="Unscored">—</span> : `${value}%`}
    </span>
  );
}

function MoveSummary({ counts }: { counts: HistoryCase["labelCounts"] }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs tabular-nums">
      <span className="inline-flex items-center gap-1">
        <MoveLabelBadge label="brilliant" variant="glyph" size="sm" />
        {counts.brilliant}
      </span>
      <span className="inline-flex items-center gap-1">
        <MoveLabelBadge label="blunder" variant="glyph" size="sm" />
        {counts.blunder}
      </span>
    </span>
  );
}

export function CaseResultsTable({ cases }: { cases: readonly HistoryCase[] }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card text-sm">
      <table
        role="table"
        className="block min-w-0 border-collapse text-left lg:table lg:w-full"
      >
        <caption className="sr-only">Case results</caption>
        <thead className="sr-only lg:not-sr-only lg:table-header-group">
          <tr className="border-b text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2 font-medium">
              Case
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Skill
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Moves
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Accuracy
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Date
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Outcome
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="block lg:table-row-group">
          {cases.map(
            ({
              caseId,
              title,
              skill,
              labelCounts,
              accuracy,
              date,
              outcome,
            }) => (
              <tr
                role="row"
                key={caseId}
                className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b p-3 last:border-b-0 hover:bg-muted/50 lg:table-row lg:p-0"
              >
                <th
                  role="rowheader"
                  scope="row"
                  className="col-span-2 row-start-1 text-left font-medium lg:px-3 lg:py-3"
                >
                  <Link
                    href={`/review/${caseId}`}
                    className="block w-fit rounded-sm break-words text-foreground outline-none after:absolute after:inset-0 hover:underline focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {title}
                  </Link>
                </th>
                <td
                  role="cell"
                  className="col-start-1 row-start-2 text-muted-foreground lg:px-3 lg:py-3"
                >
                  {skill ? formatSkill(skill) : "—"}
                </td>
                <td
                  role="cell"
                  className="col-start-1 row-start-4 text-muted-foreground lg:px-3 lg:py-3"
                >
                  <MoveSummary counts={labelCounts} />
                </td>
                <td
                  role="cell"
                  className="col-start-2 row-start-2 text-right lg:px-3 lg:py-3"
                >
                  <Accuracy value={accuracy} />
                </td>
                <td
                  role="cell"
                  className="col-start-1 row-start-3 text-xs whitespace-nowrap text-muted-foreground lg:px-3 lg:py-3"
                >
                  <CaseDate date={date} />
                </td>
                <td
                  role="cell"
                  className="col-start-2 row-start-4 justify-self-end lg:px-3 lg:py-3"
                >
                  <OutcomeBadge outcome={outcome} />
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

export function CaseResultsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading case results"
      className="divide-y rounded-xl border bg-card"
    >
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          aria-hidden="true"
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3 p-3 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]"
        >
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="hidden h-5 w-3/4 lg:block" />
          <Skeleton className="hidden h-5 w-3/4 lg:block" />
        </div>
      ))}
    </div>
  );
}

export function RecentCases({
  cases,
  onStart,
}: {
  cases: readonly HistoryCase[];
  onStart?: () => void;
}) {
  return (
    <section className="grid gap-3">
      <SectionHeader
        title="Recent cases"
        link={{ href: "/history", label: "All history" }}
      />
      {cases.length ? (
        <CaseResultsTable cases={cases} />
      ) : (
        <EmptyState
          message="Your completed cases will appear here."
          action={
            onStart && (
              <Button className="min-h-11" onClick={onStart}>
                Start a case
              </Button>
            )
          }
        />
      )}
    </section>
  );
}
