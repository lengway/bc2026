"use client";

import { useState } from "react";
import { SKILL_IDS, type HistoryCase, type SkillPath } from "@/contracts";
import { DashboardScreen } from "@/screens/dashboard/dashboard-screen";
import { AppShell } from "@/ui/app-shell";
import { Button } from "@/ui/primitives/button";
import { RecentCases } from "@/ui/recent-cases";
import { cn } from "@/ui/lib/utils";

const states = ["New user", "Two cases counted", "Certificate earned"] as const;

const fixtureRows: Omit<HistoryCase, "caseId">[] = [
  {
    title: "Renewal at risk",
    skill: "objection_handling",
    accuracy: 84,
    outcome: "won",
    date: "2026-11-13",
    labelCounts: { brilliant: 3, blunder: 0 },
  },
  {
    title: "A competing proposal",
    skill: "objection_handling",
    accuracy: 80,
    outcome: "won",
    date: "2026-11-12",
    labelCounts: { brilliant: 1, blunder: 0 },
  },
  {
    title: "The stalled handoff",
    skill: "objection_handling",
    accuracy: 82,
    outcome: "lost",
    date: "2026-11-11",
    labelCounts: { brilliant: 2, blunder: 1 },
  },
  {
    title: "A budget reset",
    skill: "discovery",
    accuracy: 73,
    outcome: "lost",
    date: "2026-11-09",
    labelCounts: { brilliant: 1, blunder: 1 },
  },
  {
    title: "A shorter pilot",
    skill: "value_articulation",
    accuracy: 81,
    outcome: "won",
    date: "2026-11-07",
    labelCounts: { brilliant: 1, blunder: 0 },
  },
  ...[71, 70, 75, 73, 81].map(
    (accuracy, index) =>
      ({
        title: "Account planning",
        skill: "discovery",
        outcome: "won",
        date: `2026-10-${30 - index}`,
        labelCounts: { brilliant: 0, blunder: 1 },
        accuracy,
      }) as const,
  ),
];
const history: HistoryCase[] = fixtureRows.map((entry, index) => ({
  ...entry,
  caseId: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
}));

function fixture(state: (typeof states)[number]): SkillPath {
  const empty = state === "New user";
  const certified = state === "Certificate earned";
  return {
    skills: empty
      ? []
      : [{ skill: "objection_handling", level: 2, xp: 164, nextLevelXp: 250 }],
    series: SKILL_IDS.map((skill) => {
      const relevant = !empty && skill === "objection_handling";
      return {
        skill,
        required: 3,
        windowDays: 30,
        casesCounted: relevant
          ? history
              .slice(0, certified ? 3 : 2)
              .map(({ caseId, title, date, accuracy, outcome }, index) => ({
                caseId,
                title,
                accuracy,
                outcome,
                archetypeId: `account-${index}`,
                completedAt: `${date}T12:00:00Z`,
              }))
          : [],
        averageAccuracy: relevant ? 82 : null,
        blockers: relevant && certified ? [] : ["insufficient_cases"],
        eligible: relevant && certified,
        certificate:
          relevant && certified ? { slug: "Sample0001", level: 2 } : undefined,
      };
    }),
    history: empty ? [] : history,
    streak: empty ? { current: 0, best: 0 } : { current: 3, best: 5 },
    activity: {
      totalCompleted: empty ? 0 : 10,
      completedThisWeek: empty ? 0 : 4,
      today: "2026-11-14",
      practicedDates: empty
        ? []
        : [
            "2026-11-01",
            "2026-11-02",
            "2026-11-03",
            "2026-11-04",
            "2026-11-05",
            "2026-11-07",
            "2026-11-09",
            "2026-11-11",
            "2026-11-12",
            "2026-11-13",
          ],
    },
    today: { daily: null, weekly: null },
  };
}

export function HomeGallery() {
  const [state, setState] =
    useState<(typeof states)[number]>("Two cases counted");
  const [dark, setDark] = useState(false);
  const [request, setRequest] = useState("");
  const path = fixture(state);
  const cases = state === "New user" ? [] : history;
  return (
    <div
      className={cn("min-h-dvh bg-background text-foreground", dark && "dark")}
    >
      <AppShell pathname="/dashboard" breadcrumbs={[{ label: "Home" }]}>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 pt-4 sm:px-8">
          {states.map((item) => (
            <Button
              key={item}
              size="sm"
              type="button"
              className="min-h-11 lg:min-h-8"
              variant={state === item ? "default" : "outline"}
              aria-pressed={state === item}
              onClick={() => {
                setState(item);
                setRequest("");
              }}
            >
              {item}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 lg:min-h-8"
            onClick={() => setDark((value) => !value)}
          >
            {dark ? "Light theme" : "Dark theme"}
          </Button>
        </div>
        <DashboardScreen
          path={path}
          history={cases}
          recentCases={
            <RecentCases
              cases={cases.slice(0, 5)}
              onStart={() => setRequest("Start a daily case")}
            />
          }
          name="Maya Chen"
          hour={8}
          subfield="account_management"
          freeDailyRemaining={1}
          plan={state === "Certificate earned" ? "pro" : "free"}
          onStart={({ type, skill }) =>
            setRequest(`Prepare ${type}${skill ? ` · ${skill}` : ""}`)
          }
        />
        {request && (
          <p className="mx-auto w-full max-w-6xl px-8" role="status">
            {request}
          </p>
        )}
      </AppShell>
    </div>
  );
}
