import Link from "next/link";
import {
  BrainCircuit,
  Handshake,
  MessageCircleQuestion,
  Search,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import {
  CASES_REQUIRED,
  LEVEL_MIN_ACCURACY,
  MIN_DISTINCT_ARCHETYPES,
  MIN_CASE_SKILL_SCORE,
  type SkillId,
  type SkillProgressSeries,
} from "@/contracts";
import { VerifiedMark } from "./certificate-card";
import { formatAverageAccuracy, formatSkill } from "./lib/format";
import { cn } from "./lib/utils";
import { Button } from "./primitives/button";

export const SKILL_ICONS = {
  discovery: Search,
  objection_handling: MessageCircleQuestion,
  value_articulation: TrendingUp,
  critical_ai_use: BrainCircuit,
  closing: Handshake,
} satisfies Record<SkillId, LucideIcon>;

export function SeriesProgress({
  count,
  required = CASES_REQUIRED,
  size = "sm",
}: {
  count: number;
  required?: number;
  size?: "sm" | "lg";
}) {
  return (
    <div
      role="img"
      aria-label={`${count} of ${required} cases`}
      className="flex gap-1.5"
    >
      {Array.from({ length: required }, (_, index) => (
        <span
          key={index}
          aria-hidden="true"
          className={cn(
            "flex-1 rounded-sm",
            size === "lg" ? "h-2" : "h-1.5",
            index < count ? "bg-ink" : "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

export function skillSeriesStatus(series: SkillProgressSeries) {
  const remaining = series.required - series.casesCounted.length;
  if (series.certificate)
    return {
      text: `Certified · Level ${series.certificate.level}`,
      problem: false,
    };
  if (remaining === series.required)
    return { text: "Start a series", problem: false };
  if (series.blockers.includes("left_case"))
    return { text: "Client left a counted case", problem: true };
  if (
    series.blockers.includes("accuracy_below_threshold") &&
    series.averageAccuracy !== null
  )
    return {
      text: `Average ${formatAverageAccuracy(series.averageAccuracy)} — needs ${LEVEL_MIN_ACCURACY[1]}%`,
      problem: true,
    };
  if (series.blockers.includes("insufficient_archetypes") && !remaining)
    return {
      text: `Practice ${MIN_DISTINCT_ARCHETYPES} different scenarios`,
      problem: true,
    };
  if (series.blockers.includes("skill_evidence_missing"))
    return { text: "Demonstrate the skill in a case", problem: true };
  if (series.blockers.includes("skill_score_below_threshold"))
    return { text: `Aim for ${MIN_CASE_SKILL_SCORE}% in the skill per case`, problem: true };
  if (remaining)
    return {
      text: `${remaining} more ${remaining === 1 ? "case" : "cases"} to certify`,
      problem: false,
    };
  if (series.blockers.includes("email_unverified"))
    return { text: "Confirm your email to certify", problem: false };
  return { text: "Series complete", problem: false };
}

export function SkillCard({
  series,
  level,
  onPractice,
  pending,
  disabled,
  className,
}: {
  series: SkillProgressSeries;
  level?: number;
  onPractice?: (skill: SkillId) => void;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const Icon = SKILL_ICONS[series.skill];
  const name = formatSkill(series.skill);
  const { text, problem } = skillSeriesStatus(series);
  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-colors duration-150 ease-out hover:border-border-strong focus-within:border-ink-border",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-surface">
          <Icon className="size-[18px]" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="font-medium leading-tight">
            <Link
              href={`/path/${series.skill}`}
              className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {name}
            </Link>
          </h3>
          {level !== undefined && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Level {level}
            </p>
          )}
        </div>
      </div>
      <SeriesProgress
        count={series.casesCounted.length}
        required={series.required}
      />
      <p className="flex justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {series.casesCounted.length} of {series.required} cases
        </span>
        {series.averageAccuracy !== null && (
          <span className="font-mono tabular-nums">
            {formatAverageAccuracy(series.averageAccuracy)} avg.
          </span>
        )}
      </p>
      <div
        className={cn(
          "flex min-h-7 items-center gap-2 text-xs",
          problem ? "text-label-mistake" : "text-muted-foreground",
        )}
      >
        {text}
        {series.certificate && <VerifiedMark>Verified</VerifiedMark>}
      </div>
      <div className="relative z-10 mt-auto self-start">
        {series.certificate ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="min-h-11 lg:min-h-8"
          >
            <Link
              href={
                series.certificate.revokedAt
                  ? "/certificates"
                  : `/s/${series.certificate.slug}`
              }
            >
              View certificate
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 lg:min-h-8"
            disabled={disabled || pending || !onPractice}
            onClick={() => onPractice?.(series.skill)}
          >
            {pending ? "Preparing…" : "Practice"}
          </Button>
        )}
      </div>
    </article>
  );
}
