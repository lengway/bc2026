import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import type { EventData, MoveInput } from "@/contracts";
import { CaseDoc } from "@/contracts";
import { api } from "@/app/_lib/api";
import { ApiError } from "@/app/_lib/api-client";
import { eventKey, type DisplayEvent } from "@/app/_hooks/case-hooks";
import { makePressureCase } from "@/mocks/scenarios/pressure";
import { makeCase, twistDoc } from "@/mocks/scenarios/sales";
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

it("makes the case mission available in a compact disclosure", () => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const view = makeCase();
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ChatWorkspace caseView={view} />
    </QueryClientProvider>,
  );
  const objective = screen.getByText("Your objective").closest("details");
  expect(objective).not.toHaveAttribute("open");
  expect(objective).toHaveTextContent(view.brief.mission);
});

it("uses Morgan's given name in the conversation and reply field", async () => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const view = makePressureCase(crypto.randomUUID());
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ChatWorkspace caseView={view} />
    </QueryClientProvider>,
  );
  await act(async () =>
    stream.onEvents([
      {
        id: crypto.randomUUID(),
        caseId: view.id,
        seq: 1,
        actor: "persona",
        type: "message",
        personaId: view.personas[0].id,
        content: "What would you want to measure?",
        clientMsgId: null,
        draftId: null,
        meta: {},
        createdAt: new Date().toISOString(),
      },
    ]),
  );

  const log = await screen.findByRole("log", {
    name: "Conversation with Morgan",
  });
  expect(within(log).getByText("Morgan", { exact: true })).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Message Morgan" })).toBeVisible();
});

it.each(["daily", "weekly"] as const)(
  "announces the matching participant by name when a %s persona twist arrives",
  async (type) => {
    vi.stubGlobal("matchMedia", (media: string) => ({
      media,
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const seed = makeCase(undefined, type);
    const senderId = crypto.randomUUID();
    const view = {
      ...seed,
      personas: [
        seed.personas[0],
        { ...seed.personas[0], id: senderId, name: "Morgan Lee" },
      ],
    };
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <ChatWorkspace caseView={view} />
      </QueryClientProvider>,
    );
    const twist: EventData = {
      id: crypto.randomUUID(),
      caseId: view.id,
      seq: 1,
      actor: "system",
      type: "twist",
      personaId: null,
      content: "The pilot needs finance approval.",
      clientMsgId: null,
      draftId: null,
      meta: { kind: "persona_message", from: senderId },
      createdAt: new Date().toISOString(),
    };
    await act(async () =>
      stream.onEvents([
        twist,
        {
          ...twist,
          id: crypto.randomUUID(),
          seq: 2,
          content: "The ceiling is $60,000.",
          meta: { kind: "email", from: "Priya Shah, CFO" },
        },
      ]),
    );

    expect(
      await screen.findByRole("status", {
        name: "New message from Morgan Lee",
      }),
    ).toHaveTextContent("from Morgan Lee");
    expect(
      screen.getByRole("status", { name: "New email from Priya Shah, CFO" }),
    ).toHaveTextContent("from Priya Shah, CFO");
  },
);

it("clears the unread marker when a new document is opened on mobile", async () => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: media.includes("max-width"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  const seed = makeCase();
  const view = {
    ...seed,
    docs: [...seed.docs, CaseDoc.parse(twistDoc)],
    status: "in_progress" as const,
    startedAt: new Date().toISOString(),
  };
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <ChatWorkspace caseView={view} />
    </QueryClientProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Documents, 1 new" }));
  const dialog = within(screen.getByRole("dialog", { name: "Case documents" }));
  fireEvent.click(
    dialog.getByRole("button", { name: `${twistDoc.title}, new` }),
  );
  await waitFor(() =>
    expect(
      dialog.getByRole("button", { name: twistDoc.title }),
    ).toHaveAttribute("aria-pressed", "true"),
  );
});

it("submits Copilot on Enter while preserving Shift+Enter, composition and pending guards", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: media.includes("1024"),
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
  const copilot = vi
    .spyOn(api, "copilot")
    .mockImplementation(() => new Promise(() => {}));
  vi.spyOn(api, "editorBatch").mockResolvedValue({
    acceptedCount: 0,
    acceptedWindowCount: 0,
    lastDraftSeq: 0,
  });
  const mounted = render(
    <QueryClientProvider client={client}>
      <ChatWorkspace caseView={view} />
    </QueryClientProvider>,
  );
  const editor = screen.getByRole("textbox", { name: "Ask Copilot" });
  fireEvent.keyDown(editor, { key: "Enter" });
  await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(copilot).not.toHaveBeenCalled();
  fireEvent.change(editor, { target: { value: "What should I verify?" } });
  expect(fireEvent.keyDown(editor, { key: "Enter", shiftKey: true })).toBe(
    true,
  );
  expect(fireEvent.keyDown(editor, { key: "Enter", isComposing: true })).toBe(
    true,
  );
  expect(fireEvent.keyDown(editor, { key: "Enter", keyCode: 229 })).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(copilot).not.toHaveBeenCalled();
  fireEvent.keyDown(editor, { key: "Enter" });
  await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(copilot).toHaveBeenCalledTimes(1);
  expect(copilot).toHaveBeenCalledWith(
    view.id,
    expect.objectContaining({ text: "What should I verify?" }),
  );
  fireEvent.keyDown(editor, { key: "Enter" });
  await act(async () => vi.advanceTimersByTimeAsync(20));
  expect(copilot).toHaveBeenCalledTimes(1);
  mounted.unmount();
  client.clear();
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

it("confirms leaving the case with a way home and keeps the workspace open on cancel", async () => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.spyOn(api, "editorBatch").mockResolvedValue({
    acceptedCount: 0,
    acceptedWindowCount: 0,
    lastDraftSeq: 0,
  });
  const client = new QueryClient();
  const mounted = render(
    <QueryClientProvider client={client}>
      <ChatWorkspace
        caseView={{
          ...makeCase(),
          status: "in_progress",
          startedAt: new Date().toISOString(),
        }}
      />
    </QueryClientProvider>,
  );

  const leave = screen.getByRole("button", { name: "Leave case" });
  fireEvent.click(leave);
  expect(
    screen.getByRole("dialog", { name: "Leave this case?" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Leave case" })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  fireEvent.click(screen.getByRole("button", { name: "Stay" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await waitFor(() => expect(leave).toHaveFocus());
  expect(screen.getByRole("textbox", { name: "Message Dana" })).toBeEnabled();
  mounted.unmount();
  client.clear();
});
