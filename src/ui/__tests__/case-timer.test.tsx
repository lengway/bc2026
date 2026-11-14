import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CaseTimer, getCaseTimerState } from "@/ui/case-timer";
import { formatClock } from "@/ui/lib/format";

describe("formatClock", () => {
  it.each([
    [259, "04:19"],
    [600, "10:00"],
    [2400, "40:00"],
    [59, "00:59"],
    [0, "00:00"],
    [-5, "00:00"],
    [61.9, "01:01"],
  ])("formats %d seconds as %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });
});

describe("getCaseTimerState", () => {
  it("moves from running to warning to expired", () => {
    expect(getCaseTimerState(259, 60)).toBe("running");
    expect(getCaseTimerState(60, 60)).toBe("warning");
    expect(getCaseTimerState(1, 60)).toBe("warning");
    expect(getCaseTimerState(0, 60)).toBe("expired");
    expect(getCaseTimerState(-3, 60)).toBe("expired");
  });
});

describe("CaseTimer", () => {
  it("shows the remaining time and reads it out in words", () => {
    render(<CaseTimer remainingSec={259} />);

    const timer = screen.getByRole("timer", {
      name: "Time remaining: 4 minutes 19 seconds",
    });
    expect(timer).toHaveTextContent("04:19");
    expect(timer).toHaveAttribute("data-state", "running");
  });

  it("switches to the warning state in the last minute", () => {
    render(<CaseTimer remainingSec={45} />);

    expect(screen.getByRole("timer")).toHaveAttribute("data-state", "warning");
  });

  it("shows 00:00 and says time is up at zero", () => {
    render(<CaseTimer remainingSec={0} />);

    const timer = screen.getByRole("timer", { name: "Time is up" });
    expect(timer).toHaveTextContent("00:00");
    expect(timer).toHaveTextContent("Time is up");
    expect(timer).toHaveAttribute("data-state", "expired");
  });
});
