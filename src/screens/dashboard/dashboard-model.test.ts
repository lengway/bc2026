import { expect, it } from "vitest";
import {
  CASES_REQUIRED,
  WINDOW_DAYS,
  type SkillProgressSeries,
} from "@/contracts";
import {
  accuracyStats,
  greetingAt,
  orderSkillSeries,
  practiceDays,
} from "./dashboard-model";

function series(
  skill: SkillProgressSeries["skill"],
  count: number,
  certified = false,
): SkillProgressSeries {
  return {
    skill,
    required: CASES_REQUIRED,
    windowDays: WINDOW_DAYS,
    casesCounted: Array.from({ length: count }, (_, index) => ({
      caseId: String(index),
      title: "Practice case",
      archetypeId: "account",
      accuracy: 84,
      outcome: "won",
      completedAt: "2026-11-14T12:00:00Z",
    })),
    averageAccuracy: count ? 84 : null,
    eligible: certified,
    blockers: [],
    certificate: certified ? { slug: "Sample0001", level: 2 } : undefined,
  };
}

it("shows the closest unfinished series first and earned certificates last", () => {
  const items = [
    series("discovery", 0),
    series("critical_ai_use", 3, true),
    series("closing", 1),
    series("objection_handling", 2),
    series("value_articulation", 0),
  ];
  expect(orderSkillSeries(items).map(({ skill }) => skill)).toEqual([
    "objection_handling",
    "closing",
    "discovery",
    "value_articulation",
    "critical_ai_use",
  ]);
});

it("compares consecutive five-case periods without counting missing accuracy as zero", () => {
  const cases = [90, null, 70, 80, 80, 75, 75, 70, 70, 80].map((accuracy) => ({
    accuracy,
  }));
  expect(accuracyStats(cases)).toEqual({
    average: 80,
    delta: 6,
    points: [80, 80, 70, null, 90],
  });
  expect(accuracyStats(cases.slice(0, 9)).delta).toBeNull();
  expect(accuracyStats([{ accuracy: null }]).average).toBeNull();
});

it("labels 14 account-calendar days through today across a month boundary", () => {
  const days = practiceDays("2026-11-02", ["2026-10-20", "2026-11-01"]);
  expect(days).toHaveLength(14);
  expect(days[0]).toEqual({ label: "Oct 20", practiced: true });
  expect(days.slice(-2)).toEqual([
    { label: "Nov 1", practiced: true },
    { label: "Nov 2", practiced: false },
  ]);
});

it("uses the provided local hour for the greeting", () => {
  expect([11, 12, 18].map(greetingAt)).toEqual([
    "Good morning",
    "Good afternoon",
    "Good evening",
  ]);
});
