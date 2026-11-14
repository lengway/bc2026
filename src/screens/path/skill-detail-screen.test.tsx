import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { SkillProgressSeries } from "@/contracts";
import { SkillDetailScreen } from "./skill-detail-screen";

const series: SkillProgressSeries = {
  skill: "objection_handling",
  casesCounted: [
    {
      caseId: "05b07ca5-0572-4c76-8a78-5775cd1f5f6a",
      title: "A budget freeze",
      archetypeId: "budget-freeze",
      accuracy: 83,
      outcome: "won",
      completedAt: "2026-11-14T12:00:00.000Z",
    },
  ],
  required: 3,
  windowDays: 30,
  averageAccuracy: 83,
  eligible: false,
  blockers: ["insufficient_cases"],
};

it("links counted slots to their reviews and shows a placeholder for each open slot", () => {
  render(<SkillDetailScreen series={series} level={2} onPractice={() => {}} />);
  const slots = within(screen.getByRole("list", { name: "Series cases" }));
  expect(slots.getAllByRole("listitem")).toHaveLength(3);
  const review = slots.getByRole("link", { name: /A budget freeze/ });
  expect(review).toHaveAttribute(
    "href",
    "/review/05b07ca5-0572-4c76-8a78-5775cd1f5f6a",
  );
  expect(review).toHaveTextContent("83%");
  expect(review).toHaveTextContent("November 14, 2026");
  expect(slots.getAllByText("Next case")).toHaveLength(2);
});

it("shows every action that blocks certification", () => {
  render(
    <SkillDetailScreen
      series={{
        ...series,
        blockers: ["accuracy_below_threshold", "left_case", "email_unverified"],
        averageAccuracy: 64.5,
      }}
      level={2}
      onPractice={() => {}}
    />,
  );
  const blockers = within(screen.getByRole("list", { name: "Blockers" }));
  expect(blockers.getByText(/64.5%.*70%/)).toBeVisible();
  expect(blockers.getByText(/client leaving/)).toBeVisible();
  expect(blockers.getByText(/verify your email/i)).toBeVisible();
});

it("passes the current skill to targeted practice", () => {
  const onPractice = vi.fn();
  render(
    <SkillDetailScreen series={series} level={2} onPractice={onPractice} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Practice this skill" }));
  expect(onPractice).toHaveBeenCalledExactlyOnceWith("objection_handling");
});
