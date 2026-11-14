import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { CertificateTranscriptEvent } from "@/contracts";
import { evaluation, moves, persona } from "@/app/(design)/design/fixtures";
import { ReviewScreen } from "../review-screen";

const transcript: CertificateTranscriptEvent[] = moves.flatMap(
  (move, index) => [
    {
      id: move.eventId,
      seq: move.seq,
      actor: "user",
      type: "message",
      content: move.userText,
      createdAt: "2026-11-14T10:00:00Z",
    },
    {
      id: `reply-${index}`,
      seq: move.seq + 1,
      actor: "persona",
      type: "message",
      content: `Recorded response ${index + 1}`,
      createdAt: "2026-11-14T10:00:01Z",
    },
  ],
);
const scroll = vi.fn();
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("1024"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Element.prototype.scrollIntoView = scroll;
  scroll.mockClear();
});
afterEach(() => vi.unstubAllGlobals());
function show(
  overrides: Partial<
    Extract<React.ComponentProps<typeof ReviewScreen>, { state: "ready" }>
  > = {},
) {
  return render(
    <ReviewScreen
      state="ready"
      caseTitle="Renewal review"
      persona={persona}
      evaluation={evaluation}
      moves={moves}
      transcript={transcript}
      {...overrides}
    />,
  );
}
function counter() {
  return screen.getByRole("status", { name: "Move position" });
}

it("replays saved dialogue and starts at the first key move", () => {
  show();
  expect(counter()).toHaveTextContent("5 / 9");
  const conversation = screen.getByRole("region", {
    name: "Conversation replay",
  });
  expect(
    within(conversation).getByText("Recorded response 1"),
  ).toBeInTheDocument();
  expect(conversation.querySelector('[data-selected="true"]')).toHaveAttribute(
    "data-event-id",
    moves[4].eventId,
  );
  expect(
    conversation.querySelector('[data-future="true"]'),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Selected move" })).queryByText(
      "Your move",
    ),
  ).not.toBeInTheDocument();
});
it("keeps arrows, first/last and boundaries synchronized", async () => {
  show();
  await userEvent.click(screen.getByRole("button", { name: "First move" }));
  expect(counter()).toHaveTextContent("1 / 9");
  expect(screen.getByRole("button", { name: "Previous move" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "First move" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Next move" }));
  expect(counter()).toHaveTextContent("2 / 9");
  await userEvent.click(screen.getByRole("button", { name: "Last move" }));
  expect(counter()).toHaveTextContent("9 / 9");
  expect(screen.getByRole("button", { name: "Next move" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Last move" })).toBeDisabled();
});
it("uses one selected move for timeline and trust chart", async () => {
  show();
  await userEvent.click(
    within(screen.getByRole("list", { name: "Moves" })).getAllByRole(
      "button",
    )[1],
  );
  expect(counter()).toHaveTextContent("2 / 9");
  await userEvent.click(
    within(screen.getByRole("region", { name: "Trust curve" })).getByRole(
      "button",
      { name: /^Move 3,/ },
    ),
  );
  expect(counter()).toHaveTextContent("3 / 9");
});
it("handles arrow keys but leaves editing and modified shortcuts alone", () => {
  show();
  fireEvent.keyDown(document.body, { key: "ArrowRight" });
  expect(counter()).toHaveTextContent("6 / 9");
  fireEvent.keyDown(document.body, { key: "ArrowLeft" });
  expect(counter()).toHaveTextContent("5 / 9");
  fireEvent.keyDown(document.body, { key: "ArrowRight", ctrlKey: true });
  expect(counter()).toHaveTextContent("5 / 9");
  const input = document.createElement("textarea");
  document.body.append(input);
  fireEvent.keyDown(input, { key: "ArrowRight" });
  expect(counter()).toHaveTextContent("5 / 9");
  input.remove();
});
it("hides diagnostic reports and uses a collapsed plain-language explanation", () => {
  show();
  for (const text of [
    "Activity observations",
    "Observed assistance",
    "Descriptive text characteristics",
    "Why this score?",
    "Observation coverage",
    "Evidence and criterion",
  ])
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  const explanation = screen
    .getByText("How this was scored")
    .closest("details");
  expect(explanation).not.toHaveAttribute("open");
  expect(
    within(screen.getByRole("region", { name: "Result" })).getByText(
      /AI dependency/,
    ),
  ).toHaveTextContent("31%");
});
it("offers an understandable no-score state while retaining the conversation", async () => {
  const onNextCase = vi.fn();
  show({
    evaluation: {
      ...evaluation,
      accuracy: null,
      aiDependency: null,
      trapResult: "insufficient_evidence",
    },
    moves: moves.map((move) => ({
      ...move,
      points: null,
      assessmentStatus: "insufficient_evidence",
    })),
    onNextCase,
  });
  expect(
    screen.getByText(
      "We couldn’t score this case. Your conversation is saved below.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText("AI dependency")).not.toBeInTheDocument();
  expect(screen.queryByText("Copilot trap missed")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Try a new case" }));
  expect(onNextCase).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Recorded response 1")).toBeInTheDocument();
});
it("keeps twists in replay and excludes Copilot from the main dialogue", () => {
  show({
    transcript: [
      ...transcript,
      {
        id: "twist",
        seq: 100,
        actor: "system",
        type: "twist",
        content: "New procurement note",
        createdAt: "2026-11-14T10:00:10Z",
      },
      {
        id: "copilot",
        seq: 101,
        actor: "copilot",
        type: "copilot_reply",
        content: "Advice outside dialogue",
        createdAt: "2026-11-14T10:00:11Z",
      },
    ],
  });
  expect(screen.getByText("New procurement note")).toBeInTheDocument();
  expect(screen.queryByText("Advice outside dialogue")).not.toBeInTheDocument();
});
it("uses an inline move detail and accessible All moves sheet on mobile", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  show();
  const selected = screen
    .getByRole("region", { name: "Conversation replay" })
    .querySelector('[data-selected="true"]');
  expect(selected?.querySelector("details")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "All moves" }));
  const sheet = screen.getByRole("dialog", { name: "All moves" });
  await userEvent.click(within(sheet).getAllByRole("button")[0]);
  expect(counter()).toHaveTextContent("1 / 9");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "All moves" })).toHaveFocus(),
  );
});

it("restores focus to All moves after Escape closes the mobile sheet", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  show();
  const launcher = screen.getByRole("button", { name: "All moves" });
  await userEvent.click(launcher);
  expect(screen.getByRole("dialog", { name: "All moves" })).toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(launcher).toHaveFocus());
});

it("keeps mobile replay controls at least 44px high and arrow targets 44px wide", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  show();
  const controls = screen.getByRole("navigation", { name: "Replay controls" });
  for (const button of within(controls).getAllByRole("button"))
    expect(button).toHaveClass("min-h-11");
  for (const label of [
    "First move",
    "Previous move",
    "Next move",
    "Last move",
  ]) {
    expect(within(controls).getByRole("button", { name: label })).toHaveClass(
      "min-w-11",
    );
  }
});

it("resumes arrow-key navigation when an open mobile sheet is hidden by desktop layout", async () => {
  let desktop = false;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("1024") && desktop,
    media: query,
    addEventListener: (_event: string, listener: () => void) => {
      if (query.includes("1024")) listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));
  show();
  await userEvent.click(screen.getByRole("button", { name: "All moves" }));
  fireEvent.keyDown(document.body, { key: "ArrowRight" });
  expect(
    within(screen.getByRole("dialog")).getByRole("list"),
  ).toBeInTheDocument();
  act(() => {
    desktop = true;
    listeners.forEach((listener) => listener());
  });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(counter()).toHaveTextContent("5 / 9");
  fireEvent.keyDown(document.body, { key: "ArrowRight" });
  expect(counter()).toHaveTextContent("6 / 9");
});
