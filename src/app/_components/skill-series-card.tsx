import Link from "next/link";
import type { SkillId, SkillProgressSeries } from "@/contracts";
import {
  LEVEL_MIN_ACCURACY,
  MIN_DISTINCT_ARCHETYPES,
} from "@/contracts/skill-series";
import {
  formatAverageAccuracy,
  formatDate,
  formatSkill,
} from "@/ui/lib/format";
import { Button } from "@/ui/primitives/button";

function blockerCopy(code: string, series: SkillProgressSeries) {
  switch (code) {
    case "insufficient_cases":
      return `Complete ${series.required} qualifying cases within ${series.windowDays} days.`;
    case "insufficient_archetypes":
      return `Practice at least ${MIN_DISTINCT_ARCHETYPES} different case scenarios.`;
    case "accuracy_below_threshold":
      return series.averageAccuracy === null
        ? `You need ${LEVEL_MIN_ACCURACY[1]}% average accuracy.`
        : `Average accuracy ${formatAverageAccuracy(series.averageAccuracy)}. You need ${LEVEL_MIN_ACCURACY[1]}%.`;
    case "left_case":
      return "Finish cases without the client leaving the conversation.";
    case "email_unverified":
      return "Verify your email to receive a skill certificate.";
    default:
      return "Continue practicing to meet this certificate’s requirements.";
  }
}

export function SkillSeriesCard({
  series,
  onPractice,
  disabled,
  pending,
}: {
  series: SkillProgressSeries;
  onPractice: (skill: SkillId) => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  const name = formatSkill(series.skill);
  const blockers = [
    ...new Set(series.blockers.map((blocker) => blockerCopy(blocker, series))),
  ];
  return (
    <div id={series.skill} className="scroll-mt-6 space-y-3">
      <h3 className="text-sm font-medium">
        {name} · {series.casesCounted.length} of {series.required} cases toward
        your certificate
      </h3>
      {series.casesCounted.length > 0 && (
        <ul className="space-y-2">
          {series.casesCounted.map((item) => (
            <li
              key={item.caseId}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <Link
                  href={`/review/${item.caseId}`}
                  className="underline underline-offset-4"
                >
                  {item.title}
                </Link>
                <time
                  dateTime={item.completedAt}
                  className="block text-xs text-muted-foreground"
                >
                  {formatDate(item.completedAt)}
                </time>
              </div>
              <span className="shrink-0 font-mono">
                {item.accuracy === null ? "Unscored" : `${item.accuracy}%`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {blockers.length > 0 && (
        <ul className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || pending}
          onClick={() => onPractice(series.skill)}
        >
          {pending ? "Preparing…" : "Practice this skill"}
        </Button>
        {series.certificate && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/s/${series.certificate.slug}`}>
              View Level {series.certificate.level} certificate
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
