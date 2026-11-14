import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { evaluation, moves } from "@/app/(design)/design/fixtures";
import { TrustCurveChart } from "@/ui/trust-curve-chart";

describe("TrustCurveChart", () => {
  it("calls onSelectMove with the seq of the clicked point", async () => {
    const onSelectMove = vi.fn();
    render(
      <TrustCurveChart curve={evaluation.trustCurve} moves={moves} onSelectMove={onSelectMove} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Move 6, Blunder, trust 38" }));

    expect(onSelectMove).toHaveBeenCalledTimes(1);
    expect(onSelectMove).toHaveBeenCalledWith(moves[5].seq);
  });

  it("renders one point per move and marks the selected one", () => {
    render(
      <TrustCurveChart
        curve={evaluation.trustCurve}
        moves={moves}
        selectedSeq={moves[4].seq}
        onSelectMove={() => undefined}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(moves.length);
    expect(screen.getByRole("button", { name: /^Move 5, Brilliant/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Move 6, Blunder/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("is read-only without onSelectMove", () => {
    render(<TrustCurveChart curve={evaluation.trustCurve} moves={moves} />);

    for (const point of screen.getAllByRole("button")) {
      expect(point).toBeDisabled();
    }
  });

  it("shows an empty state when there are no moves", () => {
    render(<TrustCurveChart curve={[]} moves={[]} />);

    expect(screen.getByText("No moves to chart yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
