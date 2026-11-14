"use client";
import { useState } from "react";
import Link from "next/link";
import {
  CASES_REQUIRED,
  SKILL_IDS,
  WINDOW_DAYS,
  type SkillProgressSeries,
} from "@/contracts";
import {
  AppShell,
  EmptyState,
  HorizontalScroller,
  SectionHeader,
  SkillCard,
  StatCard,
} from "@/ui";
import { Button } from "@/ui/primitives/button";
import { ThemeToggle } from "@/ui/theme-toggle";

const situations = [
  "New user",
  "Two cases counted",
  "Certificate earned",
] as const;

export function AppUxGallery() {
  const [situation, setSituation] =
    useState<(typeof situations)[number]>("Two cases counted");
  const [collapsed, setCollapsed] = useState(false);
  const [target, setTarget] = useState("");
  const series: SkillProgressSeries[] = SKILL_IDS.map((skill) => ({
    skill,
    required: CASES_REQUIRED,
    windowDays: WINDOW_DAYS,
    averageAccuracy: null,
    casesCounted: [],
    eligible: false,
    blockers: ["insufficient_cases"],
  }));
  if (situation !== "New user") {
    const counted = situation === "Certificate earned" ? 3 : 2;
    series[1] = {
      ...series[1],
      casesCounted: [
        "A budget freeze",
        "The competing quote",
        "Procurement stalls",
      ]
        .slice(0, counted)
        .map((title, index) => ({
          caseId: `00000000-0000-4000-8000-00000000000${index + 1}`,
          title,
          archetypeId: ["budget-freeze", "competitor", "procurement"][index],
          accuracy: 84,
          outcome: "won",
          completedAt: "2026-11-14T12:00:00.000Z",
        })),
      blockers: counted === 3 ? [] : ["insufficient_cases"],
      averageAccuracy: 84,
      eligible: counted === 3,
      certificate: counted === 3 ? { slug: "Sample0001", level: 2 } : undefined,
    };
  }
  return (
    <AppShell
      pathname="/dashboard"
      breadcrumbs={[{ label: "Home" }]}
      collapsed={collapsed}
      onToggleSidebar={() => setCollapsed(!collapsed)}
      actions={<ThemeToggle />}
    >
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-medium">Application components</h1>
        <div className="flex flex-wrap gap-2">
          {situations.map((item) => (
            <Button
              key={item}
              type="button"
              aria-pressed={situation === item}
              variant={situation === item ? "default" : "outline"}
              onClick={() => {
                setSituation(item);
                setTarget("");
              }}
            >
              {item}
            </Button>
          ))}
        </div>
        <div className="grid max-w-sm gap-3">
          <StatCard
            label="Average accuracy"
            value={series[1].averageAccuracy === null ? null : "84%"}
            detail="Last five scored cases"
          />
        </div>
        <HorizontalScroller
          label="Skills"
          controls
          toolbar={
            <SectionHeader
              title="Skills"
              link={{ href: "/path", label: "All skills" }}
            />
          }
        >
          {series.map((item) => (
            <SkillCard
              className="w-64"
              key={item.skill}
              series={item}
              level={item.casesCounted.length ? 2 : undefined}
              onPractice={setTarget}
            />
          ))}
        </HorizontalScroller>
        {target && (
          <p role="status">
            Practice selected for {target.replaceAll("_", " ")}.
          </p>
        )}
        <EmptyState
          message="No cases match these filters."
          action={
            <Button asChild variant="outline">
              <Link href="/design">Back to design gallery</Link>
            </Button>
          }
        />
      </main>
    </AppShell>
  );
}
