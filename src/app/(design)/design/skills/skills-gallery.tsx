"use client";

import { useState } from "react";
import {
  CASES_REQUIRED,
  WINDOW_DAYS,
  type CaseRef,
  type HistoryCase,
  type OwnedSkillCertificate,
  type SkillId,
  type SkillPath,
} from "@/contracts";
import { SkillDetailScreen } from "@/screens/path/skill-detail-screen";
import {
  seriesForSkill,
  skillLevel,
  SkillPathScreen,
} from "@/screens/path/skill-path-screen";
import { EmptyState } from "@/ui/app-summary";
import { AppShell } from "@/ui/app-shell";
import { formatSkill } from "@/ui/lib/format";
import { OwnedSkillCertificateCard } from "@/ui/owned-certificate-card";
import { Button } from "@/ui/primitives/button";
import { Toaster } from "@/ui/primitives/sonner";
import { CaseResultsTable } from "@/ui/recent-cases";

const skill = "objection_handling";
const states = ["New user", "Mid-series", "Certified"] as const;
const attempts = [
  {
    caseId: "190f37e6-cae7-4204-9544-251f3a38d820",
    title: "A budget freeze",
    archetypeId: "budget-freeze",
    outcome: "won",
    accuracy: 92,
    completedAt: "2026-11-14T12:00:00.000Z",
  },
  {
    caseId: "7a8e9d06-5fff-4aaa-a037-c3b58016aae2",
    title: "The competing quote",
    archetypeId: "competitor",
    outcome: "lost",
    accuracy: 80,
    completedAt: "2026-11-10T12:00:00.000Z",
  },
  {
    caseId: "416471b8-ff68-424f-9d7c-ffdd0876ac7a",
    title: "A stalled purchase",
    archetypeId: "procurement",
    outcome: "won",
    accuracy: 82,
    completedAt: "2026-11-04T12:00:00.000Z",
  },
] satisfies CaseRef[];

const exampleCertificates: OwnedSkillCertificate[] = [
  {
    skill,
    slug: "Sample0002",
    level: 2,
    averageAccuracy: 84.7,
    issuedAt: "2026-11-14T12:00:00.000Z",
    hasPublicLink: true,
    revokedAt: null,
    supersededBy: null,
  },
  {
    skill,
    slug: "Sample0001",
    level: 1,
    averageAccuracy: 74.3,
    issuedAt: "2026-10-24T12:00:00.000Z",
    hasPublicLink: true,
    revokedAt: null,
    supersededBy: "Sample0002",
  },
];

export function SkillsGallery() {
  const [state, setState] = useState<(typeof states)[number]>("Mid-series");
  const [detail, setDetail] = useState(true);
  const [dark, setDark] = useState(false);
  const [target, setTarget] = useState<SkillId | null>(null);
  const certified = state === "Certified";
  const cases = attempts.slice(0, state === "New user" ? 0 : certified ? 3 : 2);
  const history: HistoryCase[] = cases.map((item) => ({
    caseId: item.caseId,
    title: item.title,
    skill,
    accuracy: item.accuracy,
    outcome: item.outcome,
    date: item.completedAt.slice(0, 10),
    labelCounts: { brilliant: 2, blunder: item.outcome === "lost" ? 1 : 0 },
  }));
  const path: SkillPath = {
    skills: cases.length
      ? [{ skill, level: 2, xp: 172, nextLevelXp: 250 }]
      : [],
    series: [
      {
        skill,
        casesCounted: cases,
        required: CASES_REQUIRED,
        windowDays: WINDOW_DAYS,
        averageAccuracy: certified ? 84.7 : cases.length ? 86 : null,
        eligible: certified,
        blockers: certified ? [] : ["insufficient_cases"],
        certificate: certified ? { slug: "Sample0002", level: 2 } : undefined,
      },
    ],
    history,
    streak: { current: 0, best: 0 },
    today: { daily: null, weekly: null },
  };

  return (
    <div className={dark ? "dark" : undefined}>
      <div className="bg-background text-foreground">
        <AppShell
          pathname={detail ? `/path/${skill}` : "/path"}
          breadcrumbs={
            detail
              ? [
                  { label: "Skills", href: "/path" },
                  { label: formatSkill(skill) },
                ]
              : [{ label: "Skills" }]
          }
          actions={
            <Button
              variant="outline"
              aria-pressed={dark}
              onClick={() => setDark(!dark)}
            >
              {dark ? "Light theme" : "Dark theme"}
            </Button>
          }
        >
          <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pt-6 sm:px-8">
            {states.map((item) => (
              <Button
                key={item}
                type="button"
                aria-pressed={state === item}
                variant={state === item ? "default" : "outline"}
                onClick={() => {
                  setState(item);
                  setTarget(null);
                }}
              >
                {item}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetail(!detail)}
            >
              {detail ? "Show skills grid" : "Show skill detail"}
            </Button>
          </div>
          {target && (
            <p
              className="mx-auto max-w-6xl px-4 pt-4 text-sm sm:px-8"
              role="status"
            >
              Practice selected for {formatSkill(target)}.
            </p>
          )}
          {detail ? (
            <SkillDetailScreen
              series={seriesForSkill(path, skill)}
              level={skillLevel(path, skill)}
              onPractice={setTarget}
              history={
                history.length ? (
                  <CaseResultsTable cases={history} />
                ) : (
                  <EmptyState message="No completed cases for this skill." />
                )
              }
              certificates={
                certified ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {exampleCertificates.map((certificate) => (
                      <OwnedSkillCertificateCard
                        key={certificate.slug}
                        certificate={certificate}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No certificates for this skill yet." />
                )
              }
            />
          ) : (
            <SkillPathScreen path={path} onPractice={setTarget} />
          )}
        </AppShell>
        <Toaster theme={dark ? "dark" : "light"} />
      </div>
    </div>
  );
}
