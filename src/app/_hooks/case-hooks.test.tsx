import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { http, HttpResponse, delay } from "msw";
import { setupServer } from "msw/node";
import type { ReactNode } from "react";
import {
  useSendMove,
  useCopilot,
  eventKey,
  type DisplayEvent,
} from "./case-hooks";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
const caseId = "00000000-0000-4000-8000-000000000001";
const input = {
  clientMsgId: "00000000-0000-4000-8000-000000000002",
  personaId: "dana",
  draftId: null,
  text: "What matters most?",
};
function setup<T>(hook: () => T) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(hook, { wrapper }) };
}
it("shows an optimistic message and confirms it only once", async () => {
  server.use(
    http.post("*/api/cases/:id/move", async () => {
      await delay(60);
      return HttpResponse.json({
        events: [
          {
            id: "00000000-0000-4000-8000-000000000003",
            caseId,
            seq: 1,
            actor: "user",
            personaId: "dana",
            type: "message",
            content: input.text,
            meta: {},
            createdAt: new Date().toISOString(),
            clientMsgId: input.clientMsgId,
            draftId: null,
          },
        ],
        trust: 50,
        outcome: null,
      });
    }),
  );
  const { result, client } = setup(() => useSendMove(caseId));
  act(() => result.current.mutate(input));
  await waitFor(() =>
    expect(
      client.getQueryData<DisplayEvent[]>(eventKey(caseId))?.[0].delivery,
    ).toBe("pending"),
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(client.getQueryData<DisplayEvent[]>(eventKey(caseId))).toHaveLength(1);
  expect(client.getQueryData<DisplayEvent[]>(eventKey(caseId))?.[0].id).toBe(
    "00000000-0000-4000-8000-000000000003",
  );
});
it("keeps failed text and retries with the original idempotency key", async () => {
  let attempts = 0;
  const received: unknown[] = [];
  server.use(
    http.post("*/api/cases/:id/move", async ({ request }) => {
      received.push(await request.json());
      attempts += 1;
      if (attempts === 1)
        return HttpResponse.json(
          { error: { code: "LLM_FAILED", message: "Please retry." } },
          { status: 503 },
        );
      return HttpResponse.json({
        events: [
          {
            id: "00000000-0000-4000-8000-000000000004",
            caseId,
            seq: 1,
            actor: "user",
            personaId: "dana",
            type: "message",
            content: input.text,
            meta: {},
            createdAt: new Date().toISOString(),
            clientMsgId: input.clientMsgId,
            draftId: null,
          },
        ],
        trust: 50,
        outcome: null,
      });
    }),
  );
  const { result, client } = setup(() => useSendMove(caseId));
  await act(async () => {
    await result.current.mutateAsync(input).catch(() => undefined);
  });
  expect(
    client.getQueryData<DisplayEvent[]>(eventKey(caseId))?.[0],
  ).toMatchObject({ content: "What matters most?", delivery: "failed" });
  await act(async () => {
    await result.current.mutateAsync(input);
  });
  expect(received).toEqual([input, input]);
  expect(client.getQueryData<DisplayEvent[]>(eventKey(caseId))).toHaveLength(1);
});
it("keeps a Copilot question before its reply while history reconciliation is pending", async () => {
  server.use(
    http.post("*/api/cases/:id/copilot", () =>
      HttpResponse.json({
        event: {
          id: "00000000-0000-4000-8000-000000000005",
          caseId,
          seq: 12,
          actor: "copilot",
          personaId: null,
          type: "copilot_reply",
          content: "Check the account record.",
          meta: {},
          createdAt: new Date().toISOString(),
          clientMsgId: null,
          draftId: null,
        },
      }),
    ),
  );
  const { result, client } = setup(() => useCopilot(caseId));
  await act(async () => {
    await result.current.mutateAsync(input);
  });
  expect(
    client
      .getQueryData<DisplayEvent[]>(eventKey(caseId))
      ?.map((event) => event.content),
  ).toEqual([input.text, "Check the account record."]);
});
