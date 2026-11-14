import { expect, it } from "vitest";
import { PublicEvent, CaseView } from "./contracts";
it("strips hidden persona data and internal event metadata", () => {
  const result = PublicEvent.parse({
    id: "00000000-0000-4000-8000-000000000001",
    caseId: "00000000-0000-4000-8000-000000000002",
    seq: 1,
    actor: "persona",
    personaId: "dana",
    type: "message",
    clientMsgId: null,
    draftId: null,
    content: "Hello",
    createdAt: "2026-11-14T10:00:00.000Z",
    hidden: "secret",
    meta: { typingMs: 500, innerThought: "secret", trapId: "secret" },
  });
  expect(result.meta).toEqual({ typingMs: 500 });
  expect(result).not.toHaveProperty("hidden");
});
it("rejects a ready case with no usable brief", () => {
  expect(
    CaseView.safeParse({
      id: "00000000-0000-4000-8000-000000000002",
      type: "daily",
      workspace: "chat",
      status: "ready",
      field: "sales",
      subfield: "sdr_outbound",
      personas: [],
      docs: [],
    }).success,
  ).toBe(false);
});
