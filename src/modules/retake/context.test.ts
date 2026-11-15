import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MOVE_LABEL_POINTS } from "@/contracts";
import { createCatalogService } from "@/modules/catalog";
import type { SubmittedSnapshot } from "@/modules/simulation";
import { buildRetakeContext } from "./context";

async function setup() {
  const demo = await createCatalogService().getDemoCase(
    "sales",
    "sdr_outbound",
  );
  const caseId = randomUUID(),
    userId = randomUUID();
  const persona = demo.personas[0],
    at = "2026-11-14T11:50:00.000Z";
  const firstDoc = demo.case.docs[0],
    lateDoc = demo.case.docs[1];
  const criterion = {
    id: demo.rubric.criteria[0].id,
    title: "Discovery",
    description: "Identify a need",
  };
  const guide = {
    version: "1",
    criteria: [criterion],
    labelPoints: MOVE_LABEL_POINTS,
    accuracyFormula: "Test",
    aiUseFormula: "Test",
    requiredCheckCount: 0,
    allowedTools: [],
    observationNotice: "Test",
  };
  const previous = {
    id: randomUUID(),
    actor: "copilot" as const,
    type: "copilot_reply" as const,
    content: "EARLIER_COPILOT",
    meta: {},
  };
  const move = {
    id: randomUUID(),
    actor: "user" as const,
    type: "message" as const,
    content: "ORIGINAL_ANSWER",
    meta: { availableDocumentIds: [firstDoc.id] },
  };
  const buyer = {
    id: randomUUID(),
    actor: "persona" as const,
    type: "message" as const,
    content: "ORIGINAL_REPLY",
    meta: { replyToEventId: move.id },
  };
  const twist = {
    id: randomUUID(),
    actor: "system" as const,
    type: "twist" as const,
    content: "LATER_TWIST",
    meta: {},
  };
  const state = {
    turn: 0,
    trust: 40,
    patience: 4,
    mood: "neutral",
    revealed: [],
    outcome: null,
  };
  const snapshot = {
    case: {
      ...demo.case,
      id: caseId,
      userId,
      level: "beginner",
      startedAt: at,
      isGuest: false,
      isDemo: false,
      model: "test-model",
      promptVersion: "1",
      timeLimitSec: 600,
      rubric: demo.rubric,
      scoringGuide: guide,
      docs: [firstDoc, { ...lateDoc, title: "LATER_DOC" }],
      personas: [{ ...persona, state: { ...state, trust: 90, turn: 2 } }],
    },
    events: [previous, move, twist, buyer].map((event, i) => ({
      ...event,
      caseId,
      personaId:
        event.actor === "user" || event.actor === "persona"
          ? persona.public.id
          : null,
      isPublic: true,
      seq: i + 1,
      createdAt: at,
      clientMsgId: null,
      draftId: null,
    })),
    version: 1,
    drafts: [],
    reason: "user",
    submittedAt: at,
    limitations: [],
  } satisfies SubmittedSnapshot;
  return { snapshot, move, criterion, state, persona, firstDoc };
}
describe("retake historical cutoff", () => {
  it("builds a buyer prompt as of the selected move with only a replacement user event", async () => {
    const { snapshot, move, criterion, state, persona, firstDoc } =
      await setup();
    const result = buildRetakeContext(snapshot, move.id, criterion.id, state);
    expect(result?.before).toEqual({
      answer: "ORIGINAL_ANSWER",
      reaction: "ORIGINAL_REPLY",
    });
    expect(result?.personaInput("REPLACEMENT", "practice-event")).toEqual({
      persona: persona.public,
      hidden: persona.hidden,
      state,
      availableDocs: [firstDoc],
      history: [
        {
          id: "practice-event",
          seq: 2,
          actor: "user",
          personaId: persona.public.id,
          type: "message",
          content: "REPLACEMENT",
        },
      ],
    });
    const scoringInput = result?.feedbackInput("REPLACEMENT");
    expect(scoringInput).toMatchObject({
      criterion,
      originalAnswer: "ORIGINAL_ANSWER",
      revisedAnswer: "REPLACEMENT",
      history: [{ content: "EARLIER_COPILOT" }],
      availableDocs: [firstDoc],
    });
    expect(JSON.stringify(scoringInput)).not.toMatch(
      /LATER_|ORIGINAL_REPLY|hidden/,
    );
  });

  it("declines to invent a reaction, criterion or buyer state from incomplete evidence", async () => {
    const { snapshot, move, criterion, state } = await setup();
    expect(
      buildRetakeContext(snapshot, move.id, criterion.id, null),
    ).toBeNull();
    expect(buildRetakeContext(snapshot, move.id, "unknown", state)).toBeNull();
    expect(
      buildRetakeContext(
        { ...snapshot, events: snapshot.events.slice(0, 3) },
        move.id,
        criterion.id,
        state,
      ),
    ).toBeNull();
  });
});
