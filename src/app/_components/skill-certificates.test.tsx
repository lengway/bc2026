import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  CaseRef,
  SkillCertificateLimited,
  SkillProgressSeries,
} from "@/contracts";
import { moves } from "@/app/(design)/design/fixtures";
import { SkillCertificateCard } from "./skill-certificate-card";
import { SkillSeriesCard } from "./skill-series-card";

const results: CaseRef[] = [
  "Renewal review",
  "Budget question",
  "Contract terms",
].map((title, index) => ({
  caseId: `8ef55bb0-bec4-4f4b-a94e-ae64ca30171${index}`,
  title,
  archetypeId: index === 0 ? "renewal" : "procurement",
  accuracy: 84 + index,
  outcome: "won",
  completedAt: `2026-11-1${index}T12:00:00.000Z`,
}));

const series: SkillProgressSeries = {
  skill: "objection_handling",
  casesCounted: results.slice(0, 1),
  required: 3,
  windowDays: 30,
  averageAccuracy: 84,
  eligible: false,
  blockers: ["insufficient_cases", "insufficient_archetypes"],
};

const certificate: SkillCertificateLimited = {
  slug: "Sample0001",
  holderName: "Dana Whitfield",
  skill: "objection_handling",
  field: "sales",
  level: 2,
  cases: results,
  averageAccuracy: 85,
  aiDependencyAverage: 12,
  trapResults: results.map(({ caseId }) => ({ caseId, trapResult: "caught" })),
  supersededBy: null,
  issuedAt: "2026-11-13T12:00:00.000Z",
  isDemo: false,
  verified: true,
  verificationScope: "recorded_simulation",
};

describe("Skill series progress", () => {
  it("shows one counted case out of three and starts practice for the skill", async () => {
    const practice = vi.fn();
    render(<SkillSeriesCard series={series} onPractice={practice} />);
    expect(
      screen.getByRole("heading", {
        name: "Objection handling · 1 of 3 cases toward your certificate",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Renewal review" }),
    ).toHaveAttribute("href", `/review/${results[0].caseId}`);
    expect(screen.getByText("84%")).toBeInTheDocument();
    expect(screen.getByText("November 10, 2026")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Practice this skill" }),
    );
    expect(practice).toHaveBeenCalledWith("objection_handling");
  });

  it("describes the blockers and links a previously issued certificate", () => {
    render(
      <SkillSeriesCard
        series={{
          ...series,
          certificate: { slug: certificate.slug, level: 1 },
          averageAccuracy: 64,
          blockers: [...series.blockers, "accuracy_below_threshold"],
        }}
        onPractice={() => {}}
      />,
    );
    expect(
      screen.getByText("Complete 3 qualifying cases within 30 days."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Practice at least 2 different case scenarios."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Average accuracy 64%. You need 70%."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View Level 1 certificate" }),
    ).toHaveAttribute("href", "/s/Sample0001");
  });
});

describe("Public skill certificate", () => {
  it("shows all three results without exposing key moves in Limited", () => {
    render(<SkillCertificateCard certificate={certificate} />);
    expect(screen.getByText("Dana Whitfield")).toBeInTheDocument();
    expect(screen.getByText("85% average accuracy")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    for (const { title, accuracy } of results) {
      expect(screen.getByText(title)).toBeInTheDocument();
      expect(screen.getByText(`${accuracy}%`)).toBeInTheDocument();
    }
    expect(screen.queryByText("Key move")).not.toBeInTheDocument();
  });

  it("shows one key move per case in Full", () => {
    render(
      <SkillCertificateCard
        certificate={{
          ...certificate,
          keyMoves: results.map(({ caseId }, index) => ({
            caseId,
            move: moves[index],
          })),
          trustCurves: results.map(({ caseId }, index) => ({
            caseId,
            points: [{ seq: moves[index].seq, trust: moves[index].trustAfter }],
          })),
        }}
      />,
    );
    expect(screen.getAllByText("Key move")).toHaveLength(3);
    expect(screen.getAllByText("Trust")).toHaveLength(3);
    expect(screen.getByText(moves[0].why)).toBeInTheDocument();
  });
});
