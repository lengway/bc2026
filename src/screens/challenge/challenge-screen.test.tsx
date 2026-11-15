import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChallengeScreen } from "./challenge-screen";

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

describe("ChallengeScreen", () => {
  it("server-renders the opening exercise, its document and the home link", () => {
    const html = renderToStaticMarkup(<ChallengeScreen />);
    const serverDocument = new DOMParser().parseFromString(html, "text/html");

    expect(serverDocument.querySelector("h1")?.textContent).toBe("Spot the mismatch");
    expect(serverDocument.querySelector("article")?.textContent).toContain("Executed order form");
    expect(serverDocument.querySelector("header a[href='/']")?.textContent).toBe("Gambit");
  });

  it("reveals the supporting record and practical consequence after a choice", () => {
    render(<ChallengeScreen />);

    expect(screen.getByRole("heading", { name: /the terms don't match/i })).toBeInTheDocument();
    expect(screen.getByText(/Executed order form/i)).toBeInTheDocument();
    expect(screen.getByText("Net 30 from invoice date").parentElement).not.toHaveClass("bg-ink-soft");
    fireEvent.click(screen.getByRole("button", { name: /reassure them that net 60 is fine/i }));

    expect(screen.getByRole("region", { name: /what the record says/i })).toBeInTheDocument();
    expect(screen.getByText("Net 30 from invoice date").parentElement).toHaveClass("bg-ink-soft");
    expect(screen.getAllByText(/Net 30 from invoice date/i).length).toBeGreaterThan(1);
    expect(screen.getByText(/customer may rely on a concession you cannot approve/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next exercise/i })).toBeInTheDocument();
  });

  it("does not allow skipping or recording more than one answer per exercise", () => {
    render(<ChallengeScreen />);

    expect(screen.queryByRole("button", { name: /next exercise/i })).not.toBeInTheDocument();
    const firstChoice = screen.getByRole("button", { name: /reassure them that net 60 is fine/i });
    fireEvent.click(firstChoice);
    fireEvent.click(firstChoice);

    expect(screen.getAllByRole("button", { name: /reassure them that net 60 is fine/i })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /reassure them that net 60 is fine/i })).toBeDisabled();
    expect(screen.getByText(/your choice: reassure them/i)).toBeInTheDocument();
    expect(screen.getByText("Incorrect", { exact: true })).toBeInTheDocument();
    expect(firstChoice).toHaveClass("bg-label-mistake-soft");
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("keeps the final answer feedback visible until See results is chosen", () => {
    render(<ChallengeScreen />);

    fireEvent.click(screen.getByRole("button", { name: /reassure them that net 60 is fine/i }));
    fireEvent.click(screen.getByRole("button", { name: /next exercise/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm the cancellation immediately/i }));
    fireEvent.click(screen.getByRole("button", { name: /next exercise/i }));
    fireEvent.click(screen.getByRole("button", { name: /tell them the payroll integration is included/i }));

    expect(screen.getByRole("region", { name: /what the record says/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /see results/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /your challenge score/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /see results/i }));
    expect(screen.getByRole("heading", { name: /your challenge score/i })).toBeInTheDocument();
  });

  it("only offers sharing after all three answers and resets on replay", async () => {
    render(<ChallengeScreen />);

    fireEvent.click(screen.getByRole("button", { name: /reassure them that net 60 is fine/i }));
    fireEvent.click(screen.getByRole("button", { name: /next exercise/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm the cancellation immediately/i }));
    fireEvent.click(screen.getByRole("button", { name: /next exercise/i }));
    fireEvent.click(screen.getByRole("button", { name: /tell them the payroll integration is included/i }));
    fireEvent.click(screen.getByRole("button", { name: /see results/i }));

    expect(screen.getByRole("heading", { name: /your challenge score/i })).toBeInTheDocument();
    expect(screen.getByText(/Gambit Challenge: 0\/3 correct/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /copy score/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringMatching(/Gambit Challenge: 0\/3[\s\S]*challenge/i)));
    expect(screen.getByRole("status")).toHaveTextContent(/copied/i);

    fireEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(screen.getByRole("heading", { name: /the terms don't match/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copy score/i })).not.toBeInTheDocument();
  });

  it("explains the manual fallback when clipboard access fails", async () => {
    writeText.mockRejectedValueOnce(new Error("Clipboard permission denied"));
    render(<ChallengeScreen />);

    fireEvent.click(screen.getByRole("button", { name: /reassure them that net 60 is fine/i }));
    fireEvent.click(screen.getByRole("button", { name: /next exercise/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirm the cancellation immediately/i }));
    fireEvent.click(screen.getByRole("button", { name: /next exercise/i }));
    fireEvent.click(screen.getByRole("button", { name: /tell them the payroll integration is included/i }));
    fireEvent.click(screen.getByRole("button", { name: /see results/i }));
    fireEvent.click(screen.getByRole("button", { name: /copy score/i }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/copy isn't available here/i));
    expect(screen.getByLabelText("Shareable score")).toBeInTheDocument();
  });
});
