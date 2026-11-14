import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { AppShell } from "@/ui/app-shell";
import { EmptyState, SectionHeader, StatCard } from "@/ui/app-summary";
import { HorizontalScroller } from "@/ui/horizontal-scroller";
import { SeriesProgress, SkillCard } from "@/ui/skill-card";

it("marks the active navigation destination and exposes breadcrumbs", () => {
  render(
    <AppShell
      pathname="/path/discovery"
      breadcrumbs={[{ label: "Skills", href: "/path" }, { label: "Discovery" }]}
    >
      <p>Content</p>
    </AppShell>,
  );
  expect(
    screen.getAllByRole("link", { name: "Skills", current: "page" }),
  ).toHaveLength(2);
  expect(
    screen.getByRole("navigation", { name: "Breadcrumb" }),
  ).toHaveTextContent("Discovery");
  expect(screen.getByText("Content")).toBeVisible();
});

it("renders an accessible empty stat and links its detail", () => {
  render(
    <StatCard
      label="Certificates"
      value={null}
      detail="No certificates yet"
      action={<a href="/certificates">View</a>}
    />,
  );
  expect(screen.getByText("No certificates yet")).toBeVisible();
  expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
    "href",
    "/certificates",
  );
});

it("names the number of counted cases", () => {
  render(<SeriesProgress count={2} required={3} size="lg" />);
  expect(screen.getByRole("img", { name: "2 of 3 cases" })).toBeInTheDocument();
});

it("links details and targets practice independently", async () => {
  const practice = vi.fn();
  render(
    <SkillCard
      series={{
        skill: "discovery",
        casesCounted: [],
        required: 3,
        windowDays: 30,
        averageAccuracy: null,
        eligible: false,
        blockers: ["insufficient_cases"],
      }}
      onPractice={practice}
    />,
  );
  expect(screen.getByRole("link", { name: "Discovery" })).toHaveAttribute(
    "href",
    "/path/discovery",
  );
  await userEvent.click(screen.getByRole("button", { name: "Practice" }));
  expect(practice).toHaveBeenCalledWith("discovery");
});

it("exposes a keyboard scroll region and controls", () => {
  render(
    <HorizontalScroller label="Skills" controls>
      <p>Discovery</p>
    </HorizontalScroller>,
  );
  expect(screen.getByRole("region", { name: "Skills" })).toHaveAttribute(
    "tabindex",
    "0",
  );
  expect(screen.getByRole("button", { name: "Scroll left" })).toBeDisabled();
});

it("provides a section heading, action and link", () => {
  render(
    <SectionHeader
      title="Skills"
      link={{ href: "/path", label: "All skills" }}
      actions={<button>Sort</button>}
    />,
  );
  expect(screen.getByRole("heading", { name: "Skills" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Sort" })).toBeVisible();
  expect(screen.getByRole("link", { name: "All skills" })).toHaveAttribute(
    "href",
    "/path",
  );
});

it("provides one clear action for an empty state", () => {
  render(
    <EmptyState
      message="No cases yet."
      action={<a href="/dashboard">Start a case</a>}
    />,
  );
  expect(screen.getByText("No cases yet.")).toBeVisible();
  expect(screen.getByRole("link", { name: "Start a case" })).toBeVisible();
});
