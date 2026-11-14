import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { EventData, MoveInput } from "@/contracts";
import { api } from "@/app/_lib/api";
import { ApiError } from "@/app/_lib/api-client";
import { eventKey, type DisplayEvent } from "@/app/_hooks/case-hooks";
import { makeCase } from "@/mocks/scenarios/sales";
import type { EventStreamOptions } from "./realtime";
import { ChatWorkspace } from "./workspace";

let stream: EventStreamOptions;
vi.mock("./realtime", () => ({
  subscribeCaseEvents: (options: EventStreamOptions) => {
    stream = options;
    return () => {};
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("keeps an accepted message locked for exact retry when the later LLM operation fails", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const view = {
    ...makeCase(),
    status: "in_progress" as const,
    startedAt: new Date().toISOString(),
  };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const observed = vi
    .spyOn(api, "editorBatch")
    .mockImplementation(async (_id, batch) => ({
      acceptedCount: batch.events.length,
      acceptedWindowCount: batch.interactionWindows?.length ?? 0,
      lastDraftSeq: batch.events.at(-1)?.seq ?? 0,
    }));
  const received: MoveInput[] = [];
  let rejectFirst: (reason: Error) => void = () => {};
  const userEvent = (input: MoveInput): EventData => ({
    id: crypto.randomUUID(),
    caseId: view.id,
    seq: 2,
    actor: "user",
    type: "message",
    personaId: input.personaId,
    content: input.text,
    clientMsgId: input.clientMsgId,
    draftId: input.draftId,
    meta: {},
    createdAt: new Date().toISOString(),
  });
  vi.spyOn(api, "move").mockImplementation(async (_id, input) => {
    received.push({ ...input });
    if (received.length === 1)
      return new Promise((_resolve, reject) => {
        rejectFirst = reject;
      });
    return { events: [userEvent(input)], trust: 50, outcome: null };
  });
  const mounted = render(
    <QueryClientProvider client={client}>
      <ChatWorkspace caseView={view} />
    </QueryClientProvider>,
  );
  const original = "  What matters most?  ";
  const editor = screen.getByRole("textbox", { name: "Message Dana" });
  fireEvent.input(editor, {
    target: { value: original },
    inputType: "insertText",
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(received).toHaveLength(1);
  expect(received[0].text).toBe(original);
  const accepted = userEvent(received[0]);
  const advice: EventData = {
    ...accepted,
    id: crypto.randomUUID(),
    seq: 1,
    actor: "copilot",
    type: "copilot_reply",
    content: "Check the account record.",
    personaId: null,
    clientMsgId: null,
    draftId: null,
  };
  await act(async () => {
    stream.onEvents([advice, accepted]);
    rejectFirst(new ApiError("LLM_FAILED", "Retry the same message.", 502));
    await vi.advanceTimersByTimeAsync(20);
  });
  expect(
    client
      .getQueryData<DisplayEvent[]>(eventKey(view.id))
      ?.find((event) => event.id === accepted.id)?.delivery,
  ).toBe("sent");
  expect(editor).toHaveAttribute("readonly");
  expect(editor).toHaveValue(original);
  fireEvent.input(editor, {
    target: { value: "Changed while awaiting retry" },
  });
  expect(editor).toHaveValue(original);
  expect(
    screen.getByRole("button", { name: "Insert into reply" }),
  ).toBeDisabled();
  const uploadedBeforeRetry = observed.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(6000));
  expect(observed).toHaveBeenCalledTimes(uploadedBeforeRetry);
  fireEvent.click(screen.getByRole("button", { name: "Retry message" }));
  await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(received).toEqual([received[0], received[0]]);
  expect(editor).not.toHaveAttribute("readonly");
  expect(editor).toHaveValue("");
  expect(
    screen.getByRole("button", { name: "Insert into reply" }),
  ).toBeEnabled();
  fireEvent.input(editor, {
    target: { value: "A new answer" },
    inputType: "insertText",
  });
  fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(received[2]).toMatchObject({ text: "A new answer" });
  expect(received[2].clientMsgId).not.toBe(received[0].clientMsgId);
  expect(received[2].draftId).not.toBe(received[0].draftId);
  mounted.unmount();
  client.clear();
});
