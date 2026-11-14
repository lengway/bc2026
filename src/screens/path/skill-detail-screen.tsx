import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import {
  LEVEL_MIN_ACCURACY,
  MIN_DISTINCT_ARCHETYPES,
  MIN_CASE_SKILL_SCORE,
  type SkillId,
  type SkillProgressSeries,
} from "@/contracts";
import descriptions from "@/field-packs/sales/skill-descriptions.json";
import { SectionHeader } from "@/ui/app-summary";
import {
  formatAverageAccuracy,
  formatDate,
  formatSkill,
} from "@/ui/lib/format";
import { SeriesProgress, SKILL_ICONS } from "@/ui/skill-card";
import { Button } from "@/ui/primitives/button";

function blockerMessage(code: string, series: SkillProgressSeries) {
  const minimum = LEVEL_MIN_ACCURACY[1];
  const remaining = series.required - series.casesCounted.length;
  switch (code) {
    case "insufficient_cases":
      return `Complete ${remaining} more qualifying ${remaining === 1 ? "case" : "cases"} within the series window.`;
    case "insufficient_archetypes":
      return `Practice at least ${MIN_DISTINCT_ARCHETYPES} different scenarios.`;
    case "accuracy_below_threshold":
      return series.averageAccuracy === null
        ? `Reach ${minimum}% average accuracy.`
        : `Raise average accuracy from ${formatAverageAccuracy(series.averageAccuracy)} to at least ${minimum}%.`;
    case "skill_evidence_missing":
      return `In your next case, demonstrate ${formatSkill(series.skill).toLowerCase()} in a submitted move so the review can score it.`;
    case "skill_score_below_threshold":
      return `Reach ${MIN_CASE_SKILL_SCORE}% in ${formatSkill(series.skill).toLowerCase()} on each counted case. Open your review to see what to improve.`;
    case "left_case":
      return "Complete the series without the client leaving any case.";
    case "email_unverified":
      return "Verify your email to receive a skill certificate.";
    default:
      return "Continue practicing to meet the certificate requirements.";
  }
}

export function SkillDetailScreen({
  series,
  level,
  onPractice,
  pending,
  practiceError,
  history,
  certificates,
}: {
  series: SkillProgressSeries;
  level: number;
  onPractice: (skill: SkillId) => void;
  pending?: boolean;
  practiceError?: ReactNode;
  history?: ReactNode;
  certificates?: ReactNode;
}) {
  const Icon = SKILL_ICONS[series.skill];
  const blockers = [
    ...new Set(series.blockers.map((code) => blockerMessage(code, series))),
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-card">
            <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-medium tracking-tight sm:text-display-sm">
              {formatSkill(series.skill)}
            </h1>
            <p className="font-mono text-xs text-muted-foreground tabular-nums">
              Level {level}
            </p>
            <p className="max-w-xl pt-1 text-sm text-muted-foreground">
              {descriptions[series.skill]}
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="min-h-11 scroll-mt-20"
          id="practice-skill"
          disabled={pending}
          onClick={() => onPractice(series.skill)}
        >
          {pending ? "Preparing…" : "Practice this skill"}
        </Button>
      </header>
      {practiceError}
      <section
        id="series"
        className="scroll-mt-20 space-y-4 rounded-xl border bg-card p-4 sm:p-5"
      >
        <SectionHeader title="Certificate series" />
        <p className="flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-sm tabular-nums">
          <span>
            {series.casesCounted.length} of {series.required} cases
          </span>
          {series.averageAccuracy !== null && (
            <span>
              {formatAverageAccuracy(series.averageAccuracy)} average accuracy
            </span>
          )}
        </p>
        <SeriesProgress
          count={series.casesCounted.length}
          required={series.required}
          size="lg"
        />
        <ol aria-label="Series cases" className="grid gap-2.5 md:grid-cols-3">
          {series.casesCounted.map((item) => (
            <li key={item.caseId} className="min-w-0">
              <Link
                href={`/review/${item.caseId}`}
                className="flex h-full min-h-24 flex-col justify-between gap-2 rounded-lg border bg-surface p-3 text-sm outline-none transition-colors duration-150 ease-out hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-start justify-between gap-2 font-medium">
                  <span className="break-words [overflow-wrap:anywhere]">
                    {item.title}
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                    strokeWidth={1.5}
                  />
                </span>
                <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <time
                    dateTime={item.completedAt}
                    className="font-mono text-xs text-muted-foreground tabular-nums"
                  >
                    {formatDate(item.completedAt)}
                  </time>
                  <span className="font-mono tabular-nums">
                    {item.accuracy === null ? "Unscored" : `${item.accuracy}% Accuracy`}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.skillAssessment
                    ? `${item.skillAssessment.score}% in ${formatSkill(series.skill)}`
                    : "Skill evidence unavailable"}
                </span>
              </Link>
            </li>
          ))}
          {Array.from(
            { length: series.required - series.casesCounted.length },
            (_, index) => (
              <li
                key={index}
                className="flex min-h-24 items-center justify-center gap-2 rounded-lg border border-dashed bg-surface p-3 text-sm text-muted-foreground"
              >
                <Plus aria-hidden="true" className="size-4" strokeWidth={1.5} />
                Next case
              </li>
            ),
          )}
        </ol>
        <div className="space-y-1.5 text-sm">
          <h3 className="font-medium">How cases qualify</h3>
          <p className="text-muted-foreground">
            Your last {series.required} scored cases within {series.windowDays}{" "}
            days must include {MIN_DISTINCT_ARCHETYPES} different scenarios,
            average {LEVEL_MIN_ACCURACY[1]}% case Accuracy or higher, and have no
            client walkouts. Each case must show rubric evidence for the skill
            and score at least {MIN_CASE_SKILL_SCORE}% in it.
          </p>
        </div>
        {blockers.length > 0 && (
          <div className="space-y-1.5 border-t pt-4 text-sm">
            <h3 className="font-medium">Blockers</h3>
            <ul
              aria-label="Blockers"
              className="list-disc space-y-1 pl-5 text-muted-foreground"
            >
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
      {history && (
        <section className="space-y-3">
          <SectionHeader title="Case history" />
          {history}
        </section>
      )}
      {certificates && (
        <section className="space-y-3">
          <SectionHeader title="Certificates" />
          {certificates}
        </section>
      )}
    </main>
  );
}
