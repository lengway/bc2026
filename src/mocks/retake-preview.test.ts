import { setupServer } from "msw/node";
import { afterAll, beforeAll, expect, it } from "vitest";
import { api } from "@/app/_lib/api";
import { apiClient } from "@/app/_lib/api-client";
import { RetakeStatus } from "@/contracts/retake";
import { simulateBrowserOrigin } from "../../tests/browser-fetch";
import { createMockHandlers } from "./handlers";

const server = setupServer(
  ...createMockHandlers({
    typingMs: 0,
    generationMs: 0,
    evaluationMs: 0,
    initialSession: true,
  }),
);
let restoreOrigin = () => {};
beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
  restoreOrigin = simulateBrowserOrigin();
});
afterAll(() => {
  restoreOrigin();
  server.close();
});

it("offers the free upgrade state only for an evaluated learner move", async () => {
  const { caseId } = await api.createCase("onboarding");
  await api.start(caseId);
  const { events } = await api.move(caseId, {
    clientMsgId: crypto.randomUUID(),
    personaId: "dana",
    text: "What needs to change?",
    draftId: null,
  });
  const [move, reaction] = events;
  const path = `/api/cases/${caseId}/review/retake`;
  const movePath = `${path}/${move.id}`;
  const submit = (url: string) =>
    apiClient(url, RetakeStatus, {
      method: "POST",
      body: { text: "What should the new workflow achieve?" },
    });

  expect(await apiClient(movePath, RetakeStatus)).toMatchObject({
    status: "unavailable",
  });
  await api.submit(caseId);
  expect(await apiClient(movePath, RetakeStatus)).toEqual({
    status: "upgrade",
    remaining: 0,
    nextAvailableAt: null,
    result: null,
  });
  expect(await apiClient(`${path}/${reaction.id}`, RetakeStatus)).toMatchObject(
    {
      status: "unavailable",
    },
  );
  await expect(submit(movePath)).rejects.toMatchObject({
    code: "PAYWALL",
    status: 403,
  });
});
