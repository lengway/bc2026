import { render, screen, within } from "@testing-library/react";
import { vi, it, expect } from "vitest";
import type { SkillPath } from "@/contracts";
import { DashboardScreen } from "./dashboard-screen";

const props = {
  path: {
    skills: [],
    series: [],
    streak: { current: 0, best: 0 },
    today: { daily: null, weekly: null },
    history: [],
  },
  hour: 8,
  name: "Maya Chen",
  subfield: "account_management",
  history: [],
  onStart: vi.fn(),
  recentCases: null,
};

it("shows plan details on Free and exposes a weekly start on Pro", async () => {
  const { rerender } = render(<DashboardScreen {...props} plan="free" />);
  expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute(
    "href",
    "/settings/billing",
  );
  const weeklyCard = screen
    .getByRole("heading", { name: "Weekly case" })
    .closest("article")!;
  expect(
    within(weeklyCard).queryByRole("button", { name: "Start" }),
  ).toBeNull();
  rerender(<DashboardScreen {...props} plan="pro" />);
  expect(screen.queryByRole("link", { name: "See plans" })).toBeNull();
  within(weeklyCard).getByRole("button", { name: "Start" }).click();
  expect(props.onStart).toHaveBeenCalledWith({ type: "weekly" });
});

it("routes a user without an intake profile to setup and gives empty stats guidance", () => {
  render(<DashboardScreen {...props} subfield={null} plan="free" />);
  expect(
    screen.getByRole("heading", { name: "Good morning, Maya" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Start today's case" }),
  ).toHaveAttribute("href", "/onboarding");
  expect(screen.getAllByLabelText("No data")).toHaveLength(4);
});

it("links the completed daily case to its review without another daily start", () => {
  render(
    <DashboardScreen
      {...props}
      plan="pro"
      daily={{
        title: "Renewal at risk",
        subfield: "account_management",
        kind: "done",
        href: "/review/case-1",
      }}
    />,
  );
  expect(
    screen.getByText("Done today. Next case tomorrow."),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open review" })).toHaveAttribute(
    "href",
    "/review/case-1",
  );
  expect(
    screen.queryByRole("button", { name: "Start today's case" }),
  ).toBeNull();
});

it("shows each skill status and targets the suggested daily action", () => {
  const counted = [1, 2, 3].map((id) => ({
    caseId: String(id),
    title: "Renewal at risk",
    archetypeId: "renewal",
    accuracy: 80,
    outcome: "won" as const,
    completedAt: "2026-11-14T12:00:00Z",
  }));
  const base = {
    required: 3 as const,
    windowDays: 30 as const,
    eligible: false,
    blockers: ["insufficient_cases"],
  };
  const path: SkillPath = {
    ...props.path,
    series: [
      { ...base, skill: "discovery", casesCounted: [], averageAccuracy: null },
      {
        ...base,
        skill: "objection_handling",
        casesCounted: counted.slice(0, 2),
        averageAccuracy: 80,
      },
      {
        ...base,
        skill: "value_articulation",
        casesCounted: counted,
        averageAccuracy: 64,
        blockers: ["accuracy_below_threshold"],
      },
      {
        ...base,
        skill: "closing",
        casesCounted: counted,
        averageAccuracy: 80,
        eligible: true,
        blockers: [],
        certificate: { slug: "Sample0001", level: 2 },
      },
    ],
  };
  const onStart = vi.fn();
  render(
    <DashboardScreen {...props} path={path} plan="free" onStart={onStart} />,
  );
  expect(screen.getByText("Start a series")).toBeInTheDocument();
  expect(screen.getByText("1 more case to certify")).toBeInTheDocument();
  expect(screen.getByText("Average 64% — needs 70%")).toBeInTheDocument();
  expect(screen.getByText("Certified · Level 2")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "View certificate" }),
  ).toHaveAttribute("href", "/s/Sample0001");
  screen.getByRole("button", { name: "Start today's case" }).click();
  expect(onStart).toHaveBeenCalledWith({
    type: "daily",
    skill: "objection_handling",
  });
});
