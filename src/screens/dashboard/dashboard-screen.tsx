"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import type { GenerateCaseRequest, SkillId, SkillPath } from "@/contracts";
import {
  HorizontalScroller,
  PracticeRecord,
  SectionHeader,
  SkillCard,
  StatCard,
} from "@/ui";
import { firstName, formatAverageAccuracy, formatSkill } from "@/ui/lib/format";
import { Button } from "@/ui/primitives/button";
import { Skeleton } from "@/ui/primitives/skeleton";
import {
  accuracyStats,
  greetingAt,
  orderSkillSeries,
  practiceDays,
} from "./dashboard-model";

type ScheduledCase = {
  title: string;
  kind: "continue" | "evaluating" | "done";
  href: string;
  subfield: string;
};

type DashboardProps = {
  path: SkillPath;
  name: string | null;
  hour: number | null;
  plan: "free" | "pro";
  subfield: string | null;
  history: readonly { accuracy: number | null }[];
  recentCases: ReactNode;
  daily?: ScheduledCase;
  weekly?: ScheduledCase;
  pending?: GenerateCaseRequest;
  onStart: (input: GenerateCaseRequest) => void;
  startError?: ReactNode;
};

export const dashboardContainer =
  "mx-auto w-full max-w-6xl min-w-0 space-y-4 px-4 py-6 sm:px-8 sm:py-7";

function Sparkline({
  points,
}: {
  points: ReturnType<typeof accuracyStats>["points"];
}) {
  const position = (score: number, index: number) =>
    [4 + index * 21, 29 - score * 0.25] as const;
  const trace = points.flatMap((score, index) =>
    score === null
      ? []
      : [
          `${points[index - 1] == null ? "M" : "L"}${position(score, index).join(" ")}`,
        ],
  );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 92 32"
      className="h-8 w-[5.75rem] min-w-0 text-ink"
    >
      <path
        d={trace.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((score, index) => {
        if (score === null) return null;
        const [cx, cy] = position(score, index);
        return <circle key={index} cx={cx} cy={cy} r={2} fill="currentColor" />;
      })}
    </svg>
  );
}

function TodayCase({
  title,
  summary,
  timing,
  action,
  locked,
}: {
  title: string;
  summary: ReactNode;
  timing?: string;
  action: ReactNode;
  locked?: boolean;
}) {
  return (
    <article className="flex min-w-0 flex-col justify-between gap-2 rounded-xl border bg-card px-4 py-3">
      <div className="flex items-center gap-1.5">
        {locked && (
          <LockKeyhole
            strokeWidth={1.5}
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        )}
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {action}
        {timing && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {timing}
          </span>
        )}
      </div>
    </article>
  );
}

const shortAction = "min-h-11 lg:min-h-8";

function CaseAction({
  item,
  label,
  input,
  pending,
  onStart,
  setup = false,
  primary = false,
}: {
  item?: ScheduledCase;
  label: string;
  input: GenerateCaseRequest;
  pending?: GenerateCaseRequest;
  onStart: DashboardProps["onStart"];
  setup?: boolean;
  primary?: boolean;
}) {
  const variant = primary ? "default" : "outline";
  const size = primary ? "default" : "sm";
  const style = primary ? "min-h-11" : shortAction;
  if (item || setup) {
    return (
      <Button asChild variant={variant} size={size} className={style}>
        <Link href={item?.href ?? "/onboarding"}>{label}</Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={style}
      disabled={Boolean(pending)}
      onClick={() => onStart(input)}
    >
      {pending?.type === input.type && pending.skill === input.skill
        ? "Preparing…"
        : label}
    </Button>
  );
}

const dailyLabel = (item?: ScheduledCase) => {
  if (item?.kind === "done") return "Open review";
  if (item?.kind === "evaluating") return "View review status";
  return item ? "Continue" : "Start";
};

const heroLabel = (item?: ScheduledCase) => {
  if (item?.kind === "done" || item?.kind === "evaluating")
    return "Review today's case";
  return item ? "Continue today's case" : "Start today's case";
};

function dailySummary(
  item: ScheduledCase | undefined,
  subfield: string | null,
  skills: readonly SkillId[],
) {
  if (item?.kind === "done") return "Done today. Next case tomorrow.";
  if (item?.kind === "evaluating")
    return "Submitted today. Your review is being prepared.";
  if (!subfield && !item)
    return "Set up your learning profile to prepare a daily case.";
  const details = [
    formatSkill(item?.subfield ?? subfield ?? ""),
    skills.map(formatSkill).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  return item ? (
    <>
      {item.title}
      <span className="block text-xs">{details}</span>
    </>
  ) : (
    details
  );
}

export function DashboardScreen({
  path,
  name,
  hour,
  plan,
  subfield,
  history,
  recentCases,
  daily,
  weekly,
  pending,
  onStart,
  startError,
}: DashboardProps) {
  const sortedSkills = orderSkillSeries(path.series);
  const next = sortedSkills.find(
    (series) => !series.certificate && series.casesCounted.length > 0,
  );
  const target =
    next &&
    next.casesCounted.length < next.required &&
    next.blockers.every((blocker) => blocker === "insufficient_cases")
      ? next
      : undefined;
  const readyToFinish =
    target && target.casesCounted.length === target.required - 1;
  const dailyInput: GenerateCaseRequest = {
    type: "daily",
    ...(target && { skill: target.skill }),
  };
  const headline = hour === null ? "Welcome" : greetingAt(hour);
  const nextStep =
    !subfield && !daily
      ? "Set up your learning profile to start practicing."
      : readyToFinish
        ? `You're 1 case away from your ${formatSkill(target.skill)} certificate.`
        : next
          ? `Continue your ${formatSkill(next.skill)} series.`
          : sortedSkills.some(({ certificate }) => certificate)
            ? "Pick another skill to practice."
            : "Pick a skill to start your first series.";
  const { current, best } = path.streak;
  const activity = path.activity;
  const total = activity?.totalCompleted ?? path.history.length;
  const days = activity
    ? practiceDays(activity.today, activity.practicedDates)
    : [];
  const { average, delta, points } = accuracyStats(history);
  const earned = path.series.filter(({ certificate }) => certificate).length;
  const signedDelta = delta !== null ? `${delta > 0 ? "+" : ""}${delta}` : null;
  const skillLevels = new Map(
    path.skills.map(({ skill, level }) => [skill, level]),
  );

  return (
    <main className={dashboardContainer}>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pb-1">
        <div className="min-w-0">
          <h1 className="text-[2rem] font-medium leading-tight tracking-tight">
            {name ? `${headline}, ${firstName(name)}` : headline}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{nextStep}</p>
        </div>
        <CaseAction
          item={daily}
          label={heroLabel(daily)}
          input={dailyInput}
          pending={pending}
          onStart={onStart}
          setup={!subfield}
          primary
        />
      </header>

      <section aria-label="Practice statistics">
        <HorizontalScroller
          label="Practice statistics cards"
          className="w-full min-w-0 gap-3 [&>*]:w-52 lg:grid lg:grid-cols-4 lg:[&>*]:w-auto"
        >
          <StatCard
            label="Practice streak"
            value={
              best ? (
                <>
                  {current}
                  <span className="ml-1.5 font-sans text-sm text-muted-foreground">
                    {current === 1 ? "day" : "days"}
                  </span>
                </>
              ) : null
            }
            detail={
              best ? (
                <>
                  Best{" "}
                  <span className="font-mono text-foreground tabular-nums">
                    {best}
                  </span>
                </>
              ) : (
                "Practice to start a streak"
              )
            }
            graphic={
              best ? (
                <PracticeRecord
                  streak={path.streak}
                  variant="compact"
                  days={days}
                  className="w-[5.75rem] min-w-0 gap-0.5"
                />
              ) : null
            }
          />
          <StatCard
            label="Average accuracy"
            value={average === null ? null : formatAverageAccuracy(average)}
            detail={
              average === null ? (
                "Appears after a scored case"
              ) : signedDelta === null ? (
                "Last 5 cases"
              ) : (
                <>
                  <span className="font-mono text-foreground tabular-nums">
                    {signedDelta}
                  </span>{" "}
                  pts vs previous 5
                </>
              )
            }
            graphic={average !== null ? <Sparkline points={points} /> : null}
          />
          <StatCard
            label="Cases completed"
            value={total || null}
            detail={
              total && activity ? (
                <>
                  <span className="font-mono text-foreground tabular-nums">
                    {activity.completedThisWeek}
                  </span>{" "}
                  this week
                </>
              ) : total ? undefined : (
                "Finish a case to see your total"
              )
            }
          />
          <StatCard
            label="Certificates"
            value={earned || null}
            detail={
              earned ? "Skills certified" : "Earn one by qualifying a series"
            }
            action={
              <Link
                href="/certificates"
                className="inline-flex min-h-11 items-center gap-1 rounded-sm text-xs font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0"
              >
                View<span className="sr-only"> certificates</span>
                <ArrowRight
                  className="size-3"
                  aria-hidden="true"
                  strokeWidth={1.5}
                />
              </Link>
            }
          />
        </HorizontalScroller>
      </section>

      <section aria-label="Today" className="space-y-2">
        <SectionHeader title="Today" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TodayCase
            title="Daily case"
            timing={
              daily?.kind === "done" || daily?.kind === "evaluating"
                ? undefined
                : "10 min"
            }
            summary={dailySummary(
              daily,
              subfield,
              daily
                ? (path.today.dailySkills ?? [])
                : dailyInput.skill
                  ? [dailyInput.skill]
                  : [],
            )}
            action={
              <CaseAction
                item={daily}
                label={dailyLabel(daily)}
                input={dailyInput}
                pending={pending}
                onStart={onStart}
                setup={!subfield}
              />
            }
          />
          <TodayCase
            title="Weekly case"
            locked={plan === "free"}
            timing="30–40 min"
            summary={
              plan === "free"
                ? "Included in Pro"
                : (weekly?.title ??
                  "A longer sales conversation with changing priorities.")
            }
            action={
              plan === "free" ? (
                <Link
                  href="/settings/billing"
                  className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8"
                >
                  See plans
                </Link>
              ) : (
                <CaseAction
                  item={weekly}
                  label={dailyLabel(weekly)}
                  input={{ type: "weekly" }}
                  pending={pending}
                  onStart={onStart}
                  setup={!subfield}
                />
              )
            }
          />
        </div>
      </section>

      {startError}
      <section aria-label="Skills">
        <HorizontalScroller
          label="Skill cards"
          controls
          toolbar={
            <SectionHeader
              title="Skills"
              link={{ href: "/path", label: "All skills" }}
            />
          }
        >
          {sortedSkills.map((series) => (
            <SkillCard
              key={series.skill}
              series={series}
              level={skillLevels.get(series.skill) ?? 1}
              className="w-[17.5rem]"
              disabled={Boolean(pending)}
              pending={pending?.skill === series.skill}
              onPractice={(skill) => onStart({ type: "daily", skill })}
            />
          ))}
        </HorizontalScroller>
      </section>
      {recentCases}
    </main>
  );
}

export function DashboardSkeleton() {
  return (
    <main className={dashboardContainer} aria-busy="true">
      <p role="status" className="sr-only">
        Loading Home
      </p>
      <div className="flex h-[4.25rem] items-end justify-between gap-3">
        <div className="w-48 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-11 w-36" />
      </div>
      <div aria-hidden="true">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-4 mb-2 h-5 w-16" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="mt-4 mb-2 h-5 w-16" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="hidden h-52 rounded-xl sm:block" />
          <Skeleton className="hidden h-52 rounded-xl lg:block" />
        </div>
      </div>
    </main>
  );
}
