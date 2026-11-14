import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { SkillPath } from "@/contracts";
import { SkillPathScreen } from "./skill-path-screen";

it("renders all five skills even when the path has no recorded progress", () => {
  const path: SkillPath = {
    skills: [],
    series: [],
    streak: { current: 0, best: 0 },
    today: { daily: null, weekly: null },
    history: [],
  };
  render(<SkillPathScreen path={path} onPractice={() => {}} />);
  expect(screen.getByText("0 of 5")).toBeVisible();
  expect(screen.getAllByRole("article")).toHaveLength(5);
  expect(screen.getByRole("link", { name: "Critical AI use" })).toHaveAttribute(
    "href",
    "/path/critical_ai_use",
  );
});

it("keeps the certificate earned when its public link is disabled", () => {
  const path: SkillPath = {
    skills: [{ skill: "discovery", level: 2, xp: 210, nextLevelXp: 250 }],
    series: [
      {
        skill: "discovery",
        casesCounted: [],
        required: 3,
        windowDays: 30,
        averageAccuracy: null,
        eligible: false,
        blockers: ["insufficient_cases"],
        certificate: {
          level: 2,
          slug: "Sample0001",
          revokedAt: "2026-11-14T12:00:00.000Z",
        },
      },
    ],
    streak: { current: 0, best: 0 },
    today: { daily: null, weekly: null },
    history: [],
  };
  render(<SkillPathScreen path={path} onPractice={() => {}} />);
  expect(screen.getByText("1 of 5")).toBeVisible();
  expect(
    screen.getByRole("link", { name: "View certificate" }),
  ).toHaveAttribute("href", "/certificates");
});
