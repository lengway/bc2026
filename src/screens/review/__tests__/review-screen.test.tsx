import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { evaluation, moves, persona } from "@/app/design/fixtures";
import { ReviewScreen } from "@/screens/review";

const CASE_TITLE = "Renewal at risk: Brightline Logistics";

function renderReady(
  overrides: { onShare?: () => void; sharePending?: boolean } = {},
) {
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

    expect(
      screen.getByRole("heading", { name: "Analyzing your moves…" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Progress" })).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Result" }),
    ).not.toBeInTheDocument();
  });

  it("opens on the first key move", () => {
    renderReady();

    const detail = screen.getByRole("region", { name: "Selected move" });
    expect(
      within(detail).getByRole("heading", { name: "Move 5 of 9" }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByRole("img", { name: "Brilliant move" }),
    ).toBeInTheDocument();
  });

  it("switches the detail when a move is picked in the timeline or on the curve", async () => {
    renderReady();
    const detail = screen.getByRole("region", { name: "Selected move" });

    const timeline = screen.getByRole("list", { name: "Moves" });
    await userEvent.click(within(timeline).getAllByRole("button")[5]);
    expect(
      within(detail).getByRole("heading", { name: "Move 6 of 9" }),
    ).toBeInTheDocument();
    expect(within(detail).getByText("Better move")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /^Move 8, Best/ }),
    );
    expect(
      within(detail).getByRole("heading", { name: "Move 8 of 9" }),
    ).toBeInTheDocument();
    expect(within(detail).queryByText("Better move")).not.toBeInTheDocument();
  });

  it("steps through moves with the previous and next buttons", async () => {
    renderReady();
    const detail = screen.getByRole("region", { name: "Selected move" });

    await userEvent.click(screen.getByRole("button", { name: "Next move" }));
    expect(
      within(detail).getByRole("heading", { name: "Move 6 of 9" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Previous move" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Previous move" }),
    );
    expect(
      within(detail).getByRole("heading", { name: "Move 4 of 9" }),
    ).toBeInTheDocument();
  });

  it("separates case performance, observed assistance and the trap result", () => {
    renderReady();
    expect(
      within(screen.getByRole("region", { name: "Result" })).getByText(
        "Deal won",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Observed assistance" }),
    ).toHaveTextContent("Similarity to earlier Copilot replies");
    expect(
      screen.getByRole("region", { name: "Checking and applying AI advice" }),
    ).toHaveTextContent("Missed");
    expect(screen.queryByText("AI dependency")).not.toBeInTheDocument();
  });

  it("calls onShare, and blocks it while the certificate is being issued", async () => {
    const onShare = vi.fn();
    const { rerender } = renderReady({ onShare });

    await userEvent.click(
      screen.getAllByRole("button", { name: "Share certificate" })[0],
    );
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
    for (const button of screen.getAllByRole("button", {
      name: "Preparing certificate",
    })) {
      expect(button).toBeDisabled();
    }
  });
});
