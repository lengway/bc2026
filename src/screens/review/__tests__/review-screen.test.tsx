import { render, screen, within } from "@testing-library/react";
import { Evaluation, MoveReview } from "@/contracts";
import insufficientReview from "@/mocks/fixtures/insufficient-review.json";
import backendCertificate from "@/mocks/fixtures/certificate-full.json";
import { CertificateFull } from "@/contracts";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { evaluation, moves, persona } from "@/app/design/fixtures";
import { ReviewScreen } from "@/screens/review";

const CASE_TITLE = "Renewal at risk: Brightline Logistics";

function renderReady(overrides: { onShare?: () => void; sharePending?: boolean } = {}) {
  return render(
    <ReviewScreen
      state="ready"
      caseTitle={CASE_TITLE}
      persona={persona}
      evaluation={evaluation}
      moves={moves}
      {...overrides}
    />,
  );
}

describe("ReviewScreen", () => {
  it("shows the progress checklist while the review is being prepared", () => {
    render(<ReviewScreen state="analyzing" caseTitle={CASE_TITLE} />);

    expect(screen.getByRole("heading", { name: "Analyzing your moves…" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Progress" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Result" })).not.toBeInTheDocument();
  });

  it("opens on the first key move", () => {
    renderReady();

    const detail = screen.getByRole("region", { name: "Selected move" });
    expect(within(detail).getByRole("heading", { name: "Move 5 of 9" })).toBeInTheDocument();
    expect(within(detail).getByRole("img", { name: "Brilliant move" })).toBeInTheDocument();
  });

  it("switches the detail when a move is picked in the timeline or on the curve", async () => {
    renderReady();
    const detail = screen.getByRole("region", { name: "Selected move" });

    const timeline = screen.getByRole("list", { name: "Moves" });
    await userEvent.click(within(timeline).getAllByRole("button")[5]);
    expect(within(detail).getByRole("heading", { name: "Move 6 of 9" })).toBeInTheDocument();
    expect(within(detail).getByText("Better move")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Move 8, Best/ }));
    expect(within(detail).getByRole("heading", { name: "Move 8 of 9" })).toBeInTheDocument();
    expect(within(detail).queryByText("Better move")).not.toBeInTheDocument();
  });

  it("steps through moves with the previous and next buttons", async () => {
    renderReady();
    const detail = screen.getByRole("region", { name: "Selected move" });

    await userEvent.click(screen.getByRole("button", { name: "Next move" }));
    expect(within(detail).getByRole("heading", { name: "Move 6 of 9" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Previous move" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous move" }));
    expect(within(detail).getByRole("heading", { name: "Move 4 of 9" })).toBeInTheDocument();
  });

  it("states the outcome, AI dependency and the missed trap", () => {
    renderReady();

    const result = screen.getByRole("region", { name: "Result" });
    expect(within(result).getByText("Deal won")).toBeInTheDocument();
    expect(within(result).getByRole("meter", { name: "AI dependency" })).toHaveAttribute(
      "aria-valuenow",
      "31",
    );
    expect(within(result).getByText("Copilot trap missed")).toBeInTheDocument();
  });

  it("calls onShare, and blocks it while the certificate is being issued", async () => {
    const onShare = vi.fn();
    const { rerender } = renderReady({ onShare });

    await userEvent.click(screen.getAllByRole("button", { name: "Share certificate" })[0]);
    expect(onShare).toHaveBeenCalledTimes(1);

    rerender(
      <ReviewScreen
        state="ready"
        caseTitle={CASE_TITLE}
        persona={persona}
        evaluation={evaluation}
        moves={moves}
        onShare={onShare}
        sharePending
      />,
    );
    for (const button of screen.getAllByRole("button", { name: "Preparing certificate" })) {
      expect(button).toBeDisabled();
    }
  });
});

it("shows unavailable scoring without inventing zero scores", () => {
  const unavailable = Evaluation.parse({ ...insufficientReview.evaluation,
    aiDependency: null,
    assistance: { ...insufficientReview.evaluation.assistance, copilotTextSimilarityPercent: null },
  });
  render(<ReviewScreen state="ready" caseTitle={CASE_TITLE} persona={persona} evaluation={unavailable} moves={[]} />);
  const result = screen.getByRole("region", { name: "Result" });
  expect(within(result).getAllByText("Unavailable")).toHaveLength(2);
  expect(within(result).queryByText("0%")).not.toBeInTheDocument();
  expect(within(result).queryByRole("meter", { name: "AI dependency" })).not.toBeInTheDocument();
  expect(within(result).getByText("Copilot trap not presented")).toBeInTheDocument();
});

it("shows an unassessed backend move without presenting its fallback label as a score", async () => {
  const value = Evaluation.parse(insufficientReview.evaluation);
  const unassessedMoves = MoveReview.array().parse(insufficientReview.moves);
  render(<ReviewScreen state="ready" caseTitle={CASE_TITLE} persona={persona} evaluation={value} moves={unassessedMoves} />);

  const timeline = screen.getByRole("list", { name: "Moves" });
  const moveButton = within(timeline).getByRole("button", { name: /Unassessed move.*Hi, Dana/ });
  expect(moveButton).toBeEnabled();
  expect(screen.getByRole("button", { name: "Move 1, Unassessed, trust 45" })).toBeEnabled();
  await userEvent.click(moveButton);
  const detail = screen.getByRole("region", { name: "Selected move" });
  expect(within(detail).getByRole("img", { name: "Unassessed move" })).toBeInTheDocument();
  expect(within(detail).getByText(/too little evidence/)).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: "Good move" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Move 1, Good/ })).not.toBeInTheDocument();
});

it("renders a public certificate evaluation without private observations", () => {
  const certificate = CertificateFull.parse(backendCertificate);
  render(<ReviewScreen state="ready" caseTitle={certificate.caseTitle} persona={certificate.personas[0]} evaluation={certificate.evaluation} moves={certificate.moves} />);
  expect(screen.getByRole("region", { name: "Result" })).toBeInTheDocument();
});

it.each([
  ["caught", "Copilot trap caught"],
  ["missed", "Copilot trap missed"],
  ["not_presented", "Copilot trap not presented"],
  ["insufficient_evidence", "Copilot trap: insufficient evidence"],
] as const)("distinguishes the %s trap result", (trapResult, label) => {
  const value = Evaluation.parse({ ...evaluation, trapResult, trapCaught: trapResult === "caught" });
  render(<ReviewScreen state="ready" caseTitle={CASE_TITLE} persona={persona} evaluation={value} moves={moves} />);
  expect(screen.getByText(label)).toBeInTheDocument();
});
