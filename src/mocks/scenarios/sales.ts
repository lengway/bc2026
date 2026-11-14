import { previewAiChecks } from "../ai-checks";
import { previewAssistance } from "../projection";
import type { EditorBatch, Outcome } from "@/contracts";
import {
  CaseView,
  CertificateLimited,
  Review,
  PublicScoringGuide,
  type CaseData,
  type CaseKind,
  type EventData,
} from "@/app/_lib/contracts";
export const PREVIEW_CASE_ID = "00000000-0000-4000-8000-000000000001";
export const replies = [
  "Our dispatch team still has to update two systems. That's the part I need fixed.",
  "If the team can stop doing that twice, I can make the renewal case. Can you show me what changes?",
  "Send me a short plan for a two-week pilot. I'll bring our dispatch lead into the next call.",
];
export const scoringGuide = PublicScoringGuide.parse({
  version: "preview-v2",
  criteria: [
    {
      id: "discovery",
      title: "Understand the workflow",
      description:
        "Identify the customer's actual constraint and agree on a useful next step.",
    },
  ],
  labelPoints: {
    brilliant: 100,
    best: 100,
    good: 80,
    inaccuracy: 50,
    mistake: 20,
    blunder: 0,
  },
  accuracyFormula: "pointsSum / maxPoints × 100",
  aiUseFormula: "earnedPoints / assessedMaxPoints × 100",
  requiredCheckCount: 1,
  allowedTools: ["Case documents", "Built-in Copilot"],
  observationNotice:
    "During a case, editor changes and aggregate workspace interactions may be recorded. These observations do not prove authorship or change your score based on typing style. Raw drafts are not public. Interaction summaries include counts, timing intervals and normalized pointer movement, not raw trajectories. Recording pauses outside the visible workspace.",
});
export function makeCase(
  id = PREVIEW_CASE_ID,
  type: CaseKind = "onboarding",
): CaseData {
  return CaseView.parse({
    id,
    type,
    workspace: "chat",
    status: "ready",
    field: "sales",
    subfield: "account_management",
    startedAt: null,
    scoringGuide,
    brief: {
      title: "A renewal at risk",
      mission:
        "Understand why Brightline Logistics is considering leaving and agree on a useful next step.",
      yourRole: "Account manager at Waypoint Systems",
      successLooksLike:
        "Agree on a concrete next step that addresses the dispatch team's concern.",
      timeLimitSec: type === "weekly" ? 2400 : type === "daily" ? 600 : 480,
    },
    personas: [
      {
        id: "dana",
        name: "Dana Whitfield",
        role: "Operations Director",
        company: "Brightline Logistics",
        location: "Columbus, OH",
        avatarSeed: "dana-whitfield",
        context:
          "Dana is reviewing the renewal before next month's budget meeting.",
      },
    ],
    docs: [
      {
        id: "email",
        kind: "email_thread",
        title: "Renewal conversation",
        arrivesAtTurn: null,
        content: {
          subject: "Renewal",
          messages: [
            {
              from: "Dana Whitfield",
              to: "Account team",
              sentAt: "Nov 14, 9:10 AM",
              body: "Before we renew, I would like to understand what changes for our dispatch team. We still enter the same jobs twice.",
            },
          ],
        },
      },
      {
        id: "crm",
        kind: "crm_record",
        title: "Brightline account",
        arrivesAtTurn: null,
        content: {
          account: "Brightline Logistics",
          fields: [
            { label: "Seats", value: "24" },
            { label: "Annual value", value: "$18,000" },
            { label: "Renewal", value: "December 1, 2026" },
            { label: "Discount ceiling", value: "10%" },
          ],
          activity: [
            { at: "Nov 13", text: "Dispatch workflow review requested." },
          ],
        },
      },
    ],
  });
}
export const twistDoc = {
  id: "dispatch-update",
  kind: "note",
  title: "Dispatch lead's update",
  content: {
    body: "The dispatch lead reports that duplicate entry adds roughly 45 minutes each afternoon. A two-week pilot would need two dispatchers.",
  },
  arrivesAtTurn: 2,
};
export const unavailableAssistance = {
  copilotRequests: 0,
  knownCopilotRetainedChars: 0,
  totalSubmittedChars: 0,
  copilotRetainedPercent: null,
  copilotTextSimilarityPercent: null,
  unknownPasteCount: 0,
  unknownPasteChars: 0,
  observedInputModes: [],
  observationStatus: "unavailable",
  limitations: ["Editing history is not available for this example record."],
};
export const noAiChecks = {
  score: null,
  assessedChecks: 0,
  applicableChecks: 1,
  earnedPoints: 0,
  assessedMaxPoints: 0,
  applicableMaxPoints: 100,
};
const emptyScoringSummary = {
  rubricVersion: "preview-v2",
  scorerModel: "scenario-fixture",
  scorerPromptVersion: "preview-v2",
  caseLevel: "intermediate",
  scoredMoveCount: 0,
  totalUserMoveCount: 0,
  pointsSum: 0,
  maxPoints: 0,
  formula: "pointsSum / maxPoints × 100",
  completionStatus: "insufficient_evidence",
  limitations: ["Fictional preview; no professional certification."],
};
export function makeReview(
  view: CaseData,
  events: EventData[],
  batches: EditorBatch[] = [],
  outcome: Outcome = "incomplete",
) {
  const userEvents = events.filter(
    (event) => event.actor === "user" && event.type === "message",
  );
  // Fixture construction only; real scores and aggregates are always read from the backend.
  const moves = userEvents.map((event, index) => ({
    eventId: event.id,
    seq: event.seq,
    userText: event.content,
    label: "good",
    why: "Preview: this move is used to demonstrate the review layout.",
    betterMove: "Ask Dana how duplicate entry affects the dispatch team's day.",
    innerThought: "I need a practical change that my team will actually use.",
    trustAfter: Math.min(90, 55 + index * 11),
    rubricRef: "discovery",
    points: 80,
    evidence: [
      {
        source: "user_event",
        sourceId: event.id,
        quote: event.content,
        explanation: "The recorded message in this fictional scenario.",
      },
    ],
    assessmentStatus: "assessed",
  }));
  const aiChecks = previewAiChecks(events);
  const copilotRequests = events.filter(
    (event) => event.type === "copilot_prompt",
  ).length;
  return Review.parse({
    certificateSlug: `preview-${view.id}`,
    moves,
    evaluation: {
      caseId: view.id,
      accuracy: moves.length ? 80 : null,
      labelCounts: {
        brilliant: 0,
        best: 0,
        good: moves.length,
        inaccuracy: 0,
        mistake: 0,
        blunder: 0,
      },
      aiDependency: moves.length && !copilotRequests ? 0 : null,
      trapCaught: aiChecks.trap === "caught",
      trapResult: aiChecks.trap,
      assistance: previewAssistance(events, batches),
      aiUseSkill: aiChecks.skill,
      scoreAudit: {
        ...emptyScoringSummary,
        scoredMoveCount: moves.length,
        totalUserMoveCount: moves.length,
        pointsSum: moves.length * 80,
        maxPoints: moves.length * 100,
        completionStatus: moves.length ? "partial" : "insufficient_evidence",
        labelPoints: scoringGuide.labelPoints,
        criterionCoverage: [
          {
            criterionId: "discovery",
            status: moves.length ? "partially_met" : "not_observed",
          },
        ],
      },
      processObservations: {
        rulesVersion: "preview-v2",
        observationStatus: "unavailable",
        automationStatus: "insufficient_data",
        signals: [],
        textFeatures: [],
        limitations: [
          "The preview accepts interaction summaries but does not run automation or language analysis. Real diagnostics require the backend.",
        ],
      },
      outcome,
      topMoves: moves.slice(0, 3),
      summary:
        "Preview result: this illustrates a partial review of a recorded conversation, not an assessment of your real professional skill.",
      skills: [{ skill: "discovery", score: 80 }],
      trustCurve: moves.map((move) => ({
        seq: move.seq,
        trust: move.trustAfter,
      })),
    },
  });
}
export const previewCertificate = CertificateLimited.parse({
  slug: "preview-certificate",
  holderName: "Alex Morgan",
  skill: "Customer discovery",
  field: "sales",
  level: "intermediate",
  issuedAt: "2026-11-14T10:00:00.000Z",
  caseTitle: "A renewal at risk",
  accuracy: null,
  outcome: "incomplete",
  headline:
    "Sample record of a work simulation. Not enough evidence for a performance score.",
  verified: true,
  verificationScope: "recorded_simulation",
  assistance: unavailableAssistance,
  aiUseSkillSummary: noAiChecks,
  scoringSummary: emptyScoringSummary,
});
export function newEvent(
  view: CaseData,
  events: EventData[],
  partial: Pick<EventData, "actor" | "type" | "content"> & Partial<EventData>,
): EventData {
  return {
    id: crypto.randomUUID(),
    caseId: view.id,
    seq: (events.at(-1)?.seq ?? 0) + 1,
    personaId: null,
    clientMsgId: null,
    draftId: null,
    createdAt: new Date().toISOString(),
    meta: {},
    ...partial,
  };
}
