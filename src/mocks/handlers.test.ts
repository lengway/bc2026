import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { setupServer } from "msw/node";
import { createMockHandlers } from "./handlers";
import { api } from "@/app/_lib/api";
import { apiClient } from "@/app/_lib/api-client";
import {
  CaseHistoryPage,
  CreateCaseResponse,
  OwnedCertificates,
} from "@/contracts";
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
  const review = await api.review(created.caseId);
  expect(review.caseRecordSlug).toMatch(/^[A-Za-z0-9_-]{10}$/);
  expect(review.certificateSlug).toBe(review.caseRecordSlug);
  const certificate = await api.certificate(review.caseRecordSlug!);
  expect(certificate).toMatchObject({
    slug: review.caseRecordSlug,
    accuracy: 80,
    isDemo: true,
  });
  const historyPage = await apiClient(
    "/api/me/history?skill=discovery",
    CaseHistoryPage,
  );
  expect(historyPage.items).toEqual([
    expect.objectContaining({
      caseId: created.caseId,
      accuracy: 80,
      skill: "discovery",
    }),
  ]);
  expect(
    (await apiClient("/api/me/certificates", OwnedCertificates)).caseRecords,
  ).toEqual([
    expect.objectContaining({
      caseId: created.caseId,
      slug: review.caseRecordSlug,
    }),
  ]);
  expect((await api.path()).history[0]).toMatchObject({
    caseId: created.caseId,
    accuracy: 80,
    date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  });
  await expect(
    api.move(created.caseId, { ...input, clientMsgId: crypto.randomUUID() }),
  ).rejects.toMatchObject({ code: "VALIDATION", status: 409 });
});
it("launches Pressure practice and reveals the CFO email after the second reply", async () => {
  const previewOptions = { initialSession: true, persist: true, typingMs: 0 };
  server.resetHandlers(...createMockHandlers(previewOptions));
  sessionStorage.removeItem("bc2026.preview.cases.v2");
  const response = await fetch("http://localhost:3000/api/cases/pressure", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  expect(response.status).toBe(202);
  const { caseId } = CreateCaseResponse.parse(await response.json());
  const before = await api.case(caseId);
  expect(before.status).toBe("ready");
  if (!("brief" in before)) throw new Error("Missing Pressure case brief");
  expect(before.brief.title).toMatch(/Northstar Clinics/);
  expect(before.docs.map(({ id }) => id)).not.toContain("cfo-update");

  const personaId = before.personas[0].id;
  await api.start(caseId);
  const first = await api.move(caseId, {
    clientMsgId: crypto.randomUUID(),
    personaId,
    text: "Who owns the finance approval?",
    draftId: null,
  });
  expect(first.events.find(({ type }) => type === "twist")).toBeUndefined();
  server.resetHandlers(...createMockHandlers(previewOptions));
  const second = await api.move(caseId, {
    clientMsgId: crypto.randomUUID(),
    personaId,
    text: "Could we start with a one-clinic pilot?",
    draftId: null,
  });
  expect(second.events).toContainEqual(
    expect.objectContaining({
      type: "twist",
      content: expect.stringContaining("$60,000"),
      meta: {
        documentIds: ["cfo-update"],
        from: "Priya Shah, CFO",
        kind: "email",
      },
    }),
  );
  expect(second.events.filter(({ type }) => type === "message")).toEqual([
    expect.objectContaining({ actor: "user", personaId }),
    expect.objectContaining({ actor: "persona", personaId }),
  ]);
  expect(second.outcome).toBeNull();
  const after = await api.case(caseId);
  expect("docs" in after && after.docs).toContainEqual(
    expect.objectContaining({ id: "cfo-update", kind: "email_thread" }),
  );
  sessionStorage.removeItem("bc2026.preview.cases.v2");
});

it("returns a full profile from intake through the canonical API contract", async () => {
  const profile = await api.intake({
    text: "3 years in account management",
    field: "sales",
    level: "intermediate",
  });
  expect(profile).toMatchObject({
    userId: (await api.session())?.user.id,
    intakeText: "3 years in account management",
    field: "sales",
    level: "intermediate",
    years: 3,
    updatedAt: expect.any(String),
  });
});
it("uses the server request contract for case creation", async () => {
  const response = await fetch("http://localhost:3000/api/cases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "daily", unexpected: true }),
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { code: "VALIDATION" },
  });
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

it("counts targeted daily practice toward the requested skill series", async () => {
  const { caseId } = await api.createCase("daily", "objection_handling");
  await api.start(caseId);
  await api.move(caseId, {
    clientMsgId: crypto.randomUUID(),
    personaId: "dana",
    text: "What outcome would justify a renewal at this price?",
    draftId: null,
  });
  await api.submit(caseId);
  const series = (await api.path()).series.find(
    ({ skill }) => skill === "objection_handling",
  );
  expect(series).toMatchObject({
    casesCounted: [{ caseId, accuracy: 80 }],
    required: 3,
    blockers: ["insufficient_cases"],
  });
});
