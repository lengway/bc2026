import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { createMockHandlers } from "./handlers";
import { api } from "@/app/_lib/api";
import { simulateBrowserOrigin } from "../../tests/browser-fetch";
const server = setupServer();
let restoreOrigin = () => {};
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
  restoreOrigin = simulateBrowserOrigin();
});
beforeEach(() =>
  server.resetHandlers(
    ...createMockHandlers({
      typingMs: 0,
      generationMs: 0,
      evaluationMs: 0,
      initialSession: true,
    }),
  ),
);
afterAll(() => {
  restoreOrigin();
  server.close();
});
it("plays the Sales scenario and repeats a request without duplicating a turn", async () => {
  const created = await api.createCase("onboarding");
  expect((await api.case(created.caseId)).status).toBe("ready");
  await api.start(created.caseId);
  const input = {
    clientMsgId: "10000000-0000-4000-8000-000000000001",
    personaId: "dana",
    text: "What needs to change?",
    draftId: null,
  };
  const response = await api.move(created.caseId, input);
  const retry = await api.move(created.caseId, input);
  expect(retry.events.map((event) => event.id)).toEqual(
    response.events.map((event) => event.id),
  );
  expect(
    (await api.events(created.caseId)).events.filter(
      (event) => event.actor === "user",
    ),
  ).toHaveLength(1);
  const next = await api.move(created.caseId, {
    ...input,
    clientMsgId: "10000000-0000-4000-8000-000000000002",
    text: "Let's review the workflow.",
  });
  expect(next.events.some((event) => event.type === "twist")).toBe(true);
  expect(await api.submit(created.caseId)).toEqual({ status: "evaluating" });
  expect(
    (await api.review(created.caseId)).evaluation.assistance
      .copilotTextSimilarityPercent,
  ).toBe(0);
  await expect(
    api.move(created.caseId, { ...input, clientMsgId: crypto.randomUUID() }),
  ).rejects.toMatchObject({ code: "VALIDATION", status: 409 });
});
it("returns a typed paywall for a free user's weekly case", async () => {
  await expect(api.createCase("weekly")).rejects.toMatchObject({
    code: "PAYWALL",
  });
});
it("rejects a mismatched CSRF Origin", async () => {
  server.resetHandlers(
    ...createMockHandlers({
      initialSession: true,
      browserOrigin: "http://localhost:3000",
    }),
  );
  const response = await fetch("http://localhost:3000/api/cases", {
    method: "POST",
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "daily" }),
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({
    error: {
      code: "FORBIDDEN",
      message:
        "This request could not be verified. Reload the page and try again.",
    },
  });
});
it("simulates the browser-added Origin only when explicitly configured by the preview", async () => {
  restoreOrigin();
  try {
    await expect(api.magicLink("alex@example.com")).rejects.toMatchObject({
      status: 403,
    });
    server.resetHandlers(
      ...createMockHandlers({ browserOrigin: "http://localhost:3000" }),
    );
    expect(await api.magicLink("alex@example.com")).toEqual({ accepted: true });
  } finally {
    restoreOrigin = simulateBrowserOrigin();
  }
});
it("handles a single-use magic link, session lookup and logout through the API", async () => {
  server.resetHandlers(...createMockHandlers());
  expect(await api.session()).toBeNull();
  await expect(api.path()).rejects.toMatchObject({ status: 401 });
  expect(await api.magicLink("alex@example.com")).toEqual({ accepted: true });
  const response = await fetch(
    "http://localhost:3000/api/auth/verify?token=preview-link",
    { redirect: "manual" },
  );
  expect(response.status).toBe(303);
  expect((await api.session())?.user.email).toBe("alex@example.com");
  expect(
    (
      await fetch("http://localhost:3000/api/auth/verify?token=preview-link", {
        redirect: "manual",
      })
    ).status,
  ).toBe(401);
  await api.logout();
  expect(await api.session()).toBeNull();
});
it("returns only id and status while a case is being generated", async () => {
  server.resetHandlers(
    ...createMockHandlers({ generationMs: 60_000, initialSession: true }),
  );
  const created = await api.createCase("onboarding");
  expect(await api.case(created.caseId)).toEqual({
    id: created.caseId,
    status: "generating",
  });
});
it("acknowledges editor batches idempotently and rejects activity after submission", async () => {
  const created = await api.createCase("onboarding");
  await api.start(created.caseId);
  const draftId = crypto.randomUUID();
  const batch = {
    draftId,
    batchId: crypto.randomUUID(),
    events: [
      {
        id: crypto.randomUUID(),
        draftId,
        seq: 1,
        kind: "paste" as const,
        inputMode: "unknown" as const,
        clientAt: new Date().toISOString(),
        rangeStart: 0,
        rangeEnd: 0,
        insertedText: "My own notes",
        sourceEventId: null,
        inputType: "insertFromPaste",
        isComposing: false,
        isTrusted: true,
      },
    ],
  };
  expect(await api.editorBatch(created.caseId, batch)).toEqual({
    acceptedCount: 1,
    lastDraftSeq: 1,
    acceptedWindowCount: 0,
  });
  expect(await api.editorBatch(created.caseId, batch)).toEqual({
    acceptedCount: 1,
    lastDraftSeq: 1,
    acceptedWindowCount: 0,
  });
  expect(
    (
      await api.editorBatch(created.caseId, {
        ...batch,
        batchId: crypto.randomUUID(),
      })
    ).acceptedCount,
  ).toBe(0);
  await api.submit(created.caseId);
  await expect(
    api.editorBatch(created.caseId, { ...batch, batchId: crypto.randomUUID() }),
  ).rejects.toMatchObject({ status: 409 });
});
