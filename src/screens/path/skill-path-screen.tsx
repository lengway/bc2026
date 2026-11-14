import type { ReactNode } from "react";
import {
  CASES_REQUIRED,
  SKILL_IDS,
  WINDOW_DAYS,
  type SkillId,
  type SkillPath,
  type SkillProgressSeries,
} from "@/contracts";
import { SkillCard } from "@/ui/skill-card";

export function seriesForSkill(
  path: SkillPath,
  skill: SkillId,
): SkillProgressSeries {
  return (
    path.series.find((item) => item.skill === skill) ?? {
      skill,
      casesCounted: [],
      required: CASES_REQUIRED,
      windowDays: WINDOW_DAYS,
      averageAccuracy: null,
      eligible: false,
      blockers: ["insufficient_cases"],
    }
  );
}

export function skillLevel(path: SkillPath, skill: SkillId) {
  return path.skills.find((item) => item.skill === skill)?.level ?? 1;
}

export function SkillPathScreen({
  path,
  onPractice,
  pendingSkill,
  practiceError,
}: {
  path: SkillPath;
  onPractice: (skill: SkillId) => void;
  pendingSkill?: SkillId;
  practiceError?: ReactNode;
}) {
  const series = SKILL_IDS.map((skill) => seriesForSkill(path, skill));
  const certified = series.filter((item) => item.certificate).length;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-medium tracking-tight sm:text-display-sm">
          Skills
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">
            {certified} of {series.length}
          </span>{" "}
          skills certified
        </p>
      </header>
      {practiceError}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <h2 className="sr-only">All skills</h2>
        {series.map((item) => (
          <SkillCard
            key={item.skill}
            series={item}
            level={skillLevel(path, item.skill)}
            disabled={Boolean(pendingSkill)}
            pending={pendingSkill === item.skill}
            onPractice={onPractice}
          />
        ))}
      </section>
      <footer>
        <p className="text-xs text-muted-foreground">
          Progress reflects recorded practice and does not predict performance
          at work.
        </p>
      </footer>
    </main>
  );
}
