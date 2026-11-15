"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  FileText,
  LockKeyhole,
  MessageSquare,
  Zap,
} from "lucide-react";
import type { GenerateCaseRequest, SkillPath } from "@/contracts";
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
  freeDailyRemaining: number;
  subfield: string | null;
  history: readonly { accuracy: number | null }[];
  recentCases: ReactNode;
  daily?: ScheduledCase;
  weekly?: ScheduledCase;
  pending?: GenerateCaseRequest;
  onStart: (input: GenerateCaseRequest) => void;
  startError?: ReactNode;
  weeklyUpsell?: ReactNode;
};

export const dashboardContainer =
  "mx-auto w-full max-w-6xl min-w-0 space-y-6 px-4 py-6 sm:px-8 sm:py-8";

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
  featured,
}: {
  title: string;
  summary: ReactNode;
  timing?: string;
  action: ReactNode;
  locked?: boolean;
  featured?: boolean;
}) {
  return (
    <article
      className={`flex min-w-0 flex-col justify-between gap-3 rounded-xl border bg-card p-5 ${featured ? "border-ink-border" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        {locked && (
          <LockKeyhole
            strokeWidth={1.5}
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        )}
        {featured && (
          <BriefcaseBusiness
            aria-hidden="true"
            className="size-4 text-ink"
            strokeWidth={1.5}
          />
        )}
        <h3 className="text-base font-medium">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{summary}</p>
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        {action}
        {timing && (
          <span className="text-xs text-muted-foreground tabular-nums">
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

function caseLabel(item: ScheduledCase | undefined, startLabel: string) {
  if (item?.kind === "done") return "Open review";
  if (item?.kind === "evaluating") return "View review status";
  return item ? "Resume case" : startLabel;
}

const activities = [
  {
    href: "/challenge",
    title: "Check Copilot’s advice",
    description: "Find the evidence before you answer a buyer.",
    Icon: FileText,
  },
  {
    href: "/prepare",
    title: "Rehearse a real conversation",
    description: "Practice for a sales conversation you have coming up.",
    Icon: MessageSquare,
  },
  {
    href: "/pressure",
    title: "Handle a CFO curveball",
    description: "Adjust your plan when the buyer changes the terms.",
    Icon: Zap,
  },
] as const;

export function DashboardScreen({
  path,
  name,
  hour,
  plan,
  freeDailyRemaining,
  subfield,
  history,
  recentCases,
  daily,
  weekly,
  pending,
  onStart,
  startError,
  weeklyUpsell,
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
  const free = plan === "free";
  const allowanceUsed = free && freeDailyRemaining === 0;
  const setup = !subfield && !daily;
  const practiceTitle = daily?.title ?? "Sales practice case";
  const practiceSummary =
    daily?.kind === "done"
      ? "Your review is ready."
      : daily?.kind === "evaluating"
        ? "Your review is being prepared."
        : setup
          ? "Tell us about your role to get a case tailored to you."
          : allowanceUsed && !daily
            ? "Your free practice case is used for this 7-day period."
            : target
              ? readyToFinish
                ? `One qualifying case to earn your ${formatSkill(target.skill)} certificate.`
                : `Practice ${formatSkill(target.skill).toLowerCase()}.`
              : "Work through a buyer conversation using the case documents.";
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
      <header>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">
          {name ? `${headline}, ${firstName(name)}` : headline}
        </h1>
      </header>

      <section aria-label="Practice" className="space-y-3">
        <SectionHeader title="Practice" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TodayCase
            featured
            title={practiceTitle}
            summary={
              <>
                {practiceSummary}
                {free && !daily && !setup && !allowanceUsed && (
                  <span className="mt-1 block text-xs">
                    One free practice case every 7 days
                  </span>
                )}
              </>
            }
            timing={!daily && !setup && !allowanceUsed ? "10 min" : undefined}
            action={
              allowanceUsed && !daily && !setup ? (
                <Button asChild>
                  <Link href="/challenge">
                    Try the free challenge
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <CaseAction
                  item={daily}
                  label={
                    setup
                      ? "Set up your profile"
                      : caseLabel(daily, "Start practice case")
                  }
                  input={dailyInput}
                  pending={pending}
                  onStart={onStart}
                  setup={setup}
                  primary
                />
              )
            }
          />
          <TodayCase
            title="Weekly simulation"
            locked={free}
            timing="30–40 min"
            summary={
              weekly?.title ??
              "A longer deal with multiple stakeholders and shifting priorities."
            }
            action={
              free ? (
                weeklyUpsell ?? <Link
                  href="/settings/billing"
                  className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring lg:min-h-8"
                >
                  See plans
                </Link>
              ) : (
                <CaseAction
                  item={weekly}
                  label={caseLabel(weekly, "Start weekly simulation")}
                  input={{ type: "weekly" }}
                  pending={pending}
                  onStart={onStart}
                  setup={!subfield}
                />
              )
            }
          />
        </div>
        {startError}
        <ul className="grid gap-2 sm:grid-cols-3">
          {activities.map(({ href, title, description, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex h-full items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-ink-border focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Icon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-ink"
                  strokeWidth={1.5}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {description}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-ink"
                  strokeWidth={1.5}
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>

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
              disabled={Boolean(pending) || allowanceUsed}
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
