"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, CalendarDays } from "lucide-react";
import { useCreateCase, useSkillPath } from "@/app/_hooks/case-hooks";
import { ErrorPanel } from "./error-panel";
import { LoadingState } from "./providers";
import { PageHeading, Surface } from "./product";
import { Button } from "@/ui/primitives/button";
import { SkillProgress } from "@/ui/skill-progress";
import { PracticeRecord } from "@/ui/practice-record";
import { SkillSeriesCard } from "./skill-series-card";
import type { CaseView, CaseKind, GenerateCaseRequest } from "@/contracts";

export function PracticeOverview({ progress = false }: { progress?: boolean }) {
  const path = useSkillPath();
  const create = useCreateCase();
  const router = useRouter();
  if (path.isPending) return <LoadingState label="Loading your practice…" />;
  if (path.isError)
    return <ErrorPanel error={path.error} retry={() => void path.refetch()} />;
  const data = path.data;
  const open = (type: CaseKind, existing: CaseView | null) => {
    if (existing) {
      router.push(
        `/${existing.status === "evaluated" || existing.status === "evaluating" ? "review" : "case"}/${existing.id}`,
      );
      return;
    }
    prepare({ type });
  };
  function prepare(input: GenerateCaseRequest) {
    create.mutate(input, {
      onSuccess: ({ caseId }) => {
        const params = new URLSearchParams({ type: input.type });
        if (input.skill) params.set("skill", input.skill);
        router.push(`/case/${caseId}?${params}`);
      },
    });
  }
  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
      <PageHeading
        eyebrow="One conversation at a time"
        title={progress ? "Your progress" : "Your practice"}
        action={
          <Button asChild variant="outline">
            <Link href={progress ? "/dashboard" : "/path"}>
              {progress ? "Back to practice" : "View your progress"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        A focused conversation. A useful next step for your working day.
      </PageHeading>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {!data.history.length && !data.today.daily && (
            <Surface className="space-y-4 border-ink-border bg-ink-soft">
              <p className="font-mono text-xs uppercase tracking-wider text-ink">
                Start here
              </p>
              <h2 className="text-xl font-medium">Make the first case yours</h2>
              <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                Tell us about your work, choose your experience level, and get a
                realistic conversation to practice.
              </p>
              <Button asChild>
                <Link href="/onboarding">
                  Set up your practice
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </Surface>
          )}
          <section aria-labelledby="today-heading" className="space-y-4">
            <h2
              id="today-heading"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
              Today
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["daily", "weekly"] as const).map((type) => {
                const item = data.today[type];
                return (
                  <Surface key={type} className="flex flex-col gap-4">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      {type === "daily"
                        ? "Daily · 5–10 minutes"
                        : "Weekly · 30–40 minutes"}
                    </p>
                    <h3 className="text-lg font-medium">
                      {item?.brief.title ??
                        (type === "daily"
                          ? "One small step forward"
                          : "A deeper challenge")}
                    </h3>
                    <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                      {item?.brief.mission ??
                        (type === "daily"
                          ? "Practice a moment that matters, then learn from your next move."
                          : "More context, changing priorities, and a longer conversation. Included in Pro.")}
                    </p>
                    <Button
                      variant={type === "weekly" ? "outline" : "default"}
                      className="w-full"
                      disabled={create.isPending}
                      onClick={() => open(type, item)}
                    >
                      {type === "weekly" && !item && (
                        <LockKeyhole aria-hidden="true" />
                      )}
                      {create.isPending &&
                      create.variables?.type === type &&
                      !create.variables.skill
                        ? "Preparing…"
                        : item
                          ? item.status === "evaluated" ||
                            item.status === "evaluating"
                            ? "Open review"
                            : "Continue case"
                          : type === "daily"
                            ? "Start daily case"
                            : "Open weekly case"}
                    </Button>
                  </Surface>
                );
              })}
            </div>
          </section>
          {create.isError && (
            <ErrorPanel
              error={create.error}
              retry={() => create.variables && prepare(create.variables)}
            />
          )}
          {data.series.length > 0 && (
            <Surface>
              <h2 className="mb-5 text-base font-medium">Skill certificates</h2>
              <div className="grid gap-6 [&>div+div]:border-t [&>div+div]:pt-6">
                {data.series.map((series) => (
                  <SkillSeriesCard
                    key={series.skill}
                    series={series}
                    disabled={create.isPending}
                    pending={
                      create.isPending &&
                      create.variables?.skill === series.skill
                    }
                    onPractice={(skill) => prepare({ type: "daily", skill })}
                  />
                ))}
              </div>
            </Surface>
          )}
          <Surface>
            <h2 className="mb-5 text-base font-medium">
              {progress ? "Case history" : "Recent results"}
            </h2>
            {!data.history.length ? (
              <div className="space-y-2 py-6 text-sm">
                <p>Your first result starts here.</p>
                <p className="text-muted-foreground">
                  Complete a case to see your review, strengths and next steps.
                </p>
              </div>
            ) : (
              <ul className="divide-y">
                {(progress ? data.history : data.history.slice(0, 5)).map(
                  (item) => (
                    <li key={item.caseId}>
                      <Link
                        href={`/review/${item.caseId}`}
                        className="flex min-h-20 items-center justify-between gap-4 rounded-md py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <div>
                          <p className="text-sm font-medium">{item.title}</p>
                          <time
                            dateTime={item.date}
                            className="mt-1 block text-xs text-muted-foreground"
                          >
                            {new Intl.DateTimeFormat("en-US", {
                              dateStyle: "medium",
                              timeZone: "UTC",
                            }).format(new Date(item.date))}
                          </time>
                        </div>
                        <span className="text-right font-mono text-sm">
                          {item.accuracy === null ? (
                            <span className="font-sans text-xs text-muted-foreground">
                              Not enough evidence
                            </span>
                          ) : (
                            `${item.accuracy}%`
                          )}
                          <ArrowRight
                            aria-hidden="true"
                            className="ml-2 inline size-4"
                          />
                        </span>
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            )}
          </Surface>
        </div>
        <aside className="space-y-6">
          <Surface>
            <PracticeRecord streak={data.streak} />
          </Surface>
          <Surface>
            <h2 className="mb-6 text-base font-medium">Your skills</h2>
            <div className="space-y-6">
              {data.skills.length ? (
                data.skills.map((skill) => (
                  <SkillProgress key={skill.skill} skill={skill} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Complete your first case to start building your skill path.
                </p>
              )}
            </div>
          </Surface>
          <p className="px-1 text-xs leading-relaxed text-muted-foreground">
            Progress reflects recorded practice. It is a learning signal, not a
            guarantee of performance at work.
          </p>
        </aside>
      </div>
    </main>
  );
}
