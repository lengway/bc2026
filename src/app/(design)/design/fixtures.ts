import { PublicEvaluation } from "@/contracts";
import { makeCase, makeReview, scoringGuide } from "@/mocks/scenarios/sales";
import type {
  CaseDoc,
  CertificateFull,
  CertificateLimited,
  Evaluation,
  MoveReview,
  PersonaPublic,
  SkillPath,
  TranscriptEntry,
} from "@/contracts";
import type { ChecklistStep } from "@/ui";

/*
 * Gallery fixtures: one complete, internally consistent case.
 * Accuracy 74 = (100 + 2×100 + 4×80 + 50 + 0) / 9, per CONTEXT.md §12.
 * Replace with /src/mocks/fixtures once frontend adds them.
 */

const CASE_ID = "00000000-0000-4000-8000-000000000100";
const eventId = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const persona: PersonaPublic = {
  id: "dana-whitfield",
  name: "Dana Whitfield",
  role: "Operations Director",
  company: "Brightline Logistics",
  location: "Columbus, OH",
  avatarSeed: "dana-whitfield",
  context:
    "Runs dispatch for a regional carrier with 140 trucks. Her routing contract renews in three weeks and she has told your manager she is looking at a cheaper vendor.",
};

const originalMoves: Omit<
  MoveReview,
  "rubricRef" | "points" | "evidence" | "assessmentStatus"
>[] = [
  {
    eventId: eventId(1),
    seq: 1,
    userText:
      "Hi Dana, thanks for making time. Before we get into the renewal, I would like to hear how the last quarter went on your side.",
    label: "good",
    why: "A reasonable open. It invites her to talk, but it is broad enough to answer with a pleasantry.",
    betterMove: "I saw dispatch tickets doubled in March. What happened there?",
    innerThought: "Fine. At least he is not opening with a slide deck.",
    trustAfter: 40,
  },
  {
    eventId: eventId(2),
    seq: 3,
    userText:
      "Understood. You mentioned you are looking at other vendors. What is driving that?",
    label: "good",
    why: "Direct and fair. You asked for the reason instead of defending the product.",
    betterMove: "Is this about the March dispatch issues, or about price?",
    innerThought: "He asked. Most of them start discounting right here.",
    trustAfter: 46,
  },
  {
    eventId: eventId(3),
    seq: 5,
    userText:
      "So the March migration is when the dispatch errors started. How many loads were affected, and what did that cost you with your carriers?",
    label: "best",
    why: "This is the key moment of the case: quantify the operational problem before any commercial terms.",
    betterMove: null,
    innerThought: "Finally someone asks about the actual problem.",
    trustAfter: 55,
  },
  {
    eventId: eventId(4),
    seq: 7,
    userText:
      "That sounds frustrating. I can loop in our support team to look at it.",
    label: "inaccuracy",
    why: "Right instinct, but you handed the problem off instead of staying with it. She gave you a number and you did not use it.",
    betterMove:
      "212 misrouted loads in a month is serious. Walk me through one of them so I can see where our system let you down.",
    innerThought: "Loop in support. I have had a ticket open since April.",
    trustAfter: 52,
  },
  {
    eventId: eventId(5),
    seq: 9,
    userText:
      "Before we talk price at all: if the renewal came with a named engineer and a fix date for the routing bug, would the competitor quote still matter to your CFO?",
    label: "brilliant",
    why: "You found the real motive. Dana does not need a cheaper vendor, she needs something concrete to show her CFO. Nothing in the documents says this directly.",
    betterMove: null,
    innerThought: "That is exactly the conversation I need to have upstairs.",
    trustAfter: 66,
  },
  {
    eventId: eventId(6),
    seq: 13,
    userText:
      "Good news, your contract already qualifies you for the 15% volume tier, so I can apply that today.",
    label: "blunder",
    why: "The 15% figure came from Copilot and is not in the contract. The MSA in your documents sets the volume tier at 8% above 400 shipments a month. You repeated the number without checking it, and Dana knows her own agreement.",
    betterMove:
      "Let me check the volume tier against your MSA before I quote a number. It is 8% above 400 shipments a month. You ran 430 in April, so you are already in it.",
    innerThought:
      "Fifteen. That is not what I signed. Either he has not read the agreement or he is making it up.",
    trustAfter: 38,
  },
  {
    eventId: eventId(7),
    seq: 15,
    userText:
      "You are right, and I apologize. I quoted that without checking the agreement.",
    label: "good",
    why: "Owning the error quickly stopped the slide. It would have been stronger with the correct figure in the same message.",
    betterMove:
      "You are right, I had that wrong. The MSA says 8% above 400 shipments a month. You ran 430 in April, so it already applies.",
    innerThought: "At least he did not argue.",
    trustAfter: 49,
  },
  {
    eventId: eventId(8),
    seq: 17,
    userText:
      "The correct tier is 8% above 400 shipments a month, and you ran 430 in April, so it already applies. I will put that in writing today, with the engineer's name and a fix date.",
    label: "best",
    why: "The corrected number, checked against the MSA and tied to the commitment she actually cares about.",
    betterMove: null,
    innerThought: "Numbers match what I signed. Good.",
    trustAfter: 60,
  },
  {
    eventId: eventId(9),
    seq: 19,
    userText:
      "Can I send the summary by 3 pm, so you have it before your Thursday meeting with your CFO?",
    label: "good",
    why: "A clear next step with a time. It does not yet ask for a decision.",
    betterMove:
      "If the summary matches what we discussed, are you comfortable taking a renewal to your CFO on Thursday?",
    innerThought: "Thursday works. Send it.",
    trustAfter: 72,
  },
];

export const moves: MoveReview[] = originalMoves.map((move) => ({
  ...move,
  rubricRef: "discovery",
  points: scoringGuide.labelPoints[move.label],
  assessmentStatus: "assessed",
  evidence: [
    {
      source: "user_event",
      sourceId: move.eventId,
      quote: move.userText,
      explanation: move.why,
    },
  ],
}));
const sampleEvaluation = makeReview(makeCase(), []).evaluation;
export const evaluation: Evaluation = {
  ...sampleEvaluation,
  trapResult: "missed",
  assistance: {
    ...sampleEvaluation.assistance,
    copilotRequests: 2,
    totalSubmittedChars: moves.reduce(
      (total, move) => total + move.userText.length,
      0,
    ),
    copilotTextSimilarityPercent: 31,
  },
  aiUseSkill: {
    score: 0,
    assessedChecks: 1,
    applicableChecks: 1,
    earnedPoints: 0,
    assessedMaxPoints: 100,
    applicableMaxPoints: 100,
    checks: [
      {
        id: "sample-pricing",
        criterionId: "verify_pricing",
        status: "failed",
        earnedPoints: 0,
        maxPoints: 100,
        reason:
          "The 15% claim repeats AI advice without checking the agreement's 8% volume tier.",
        evidence: [
          {
            source: "user_event",
            sourceId: moves[5].eventId,
            quote: moves[5].userText,
            explanation: "The unsupported discount quoted to the customer.",
          },
          {
            source: "case_doc",
            sourceId: "doc-note",
            quote: "Customer receives a discount of eight percent (8%)",
            explanation: "The MSA excerpt supplies the actual volume tier.",
          },
        ],
      },
    ],
  },
  scoreAudit: {
    ...sampleEvaluation.scoreAudit,
    scoredMoveCount: moves.length,
    totalUserMoveCount: moves.length,
    pointsSum: 670,
    maxPoints: 900,
    completionStatus: "partial",
    criterionCoverage: [
      { criterionId: "discovery", status: "partially_met" },
      { criterionId: "verify_pricing", status: "not_met" },
    ],
    limitations: ["Fictional example; only part of the rubric is shown."],
  },
  caseId: CASE_ID,
  accuracy: 74,
  labelCounts: {
    brilliant: 1,
    best: 2,
    good: 4,
    inaccuracy: 1,
    mistake: 0,
    blunder: 1,
  },
  aiDependency: 31,
  trapCaught: false,
  outcome: "won",
  topMoves: [moves[4], moves[5], moves[7]],
  summary:
    "Finds the real problem behind a price objection and recovers well from an unverified claim. Should check AI-suggested figures against source documents.",
  skills: [
    { skill: "discovery", score: 82 },
    { skill: "objection_handling", score: 71 },
    { skill: "value_articulation", score: 68 },
    { skill: "critical_ai_use", score: 35 },
    { skill: "closing", score: 74 },
  ],
  trustCurve: moves.map((move) => ({ seq: move.seq, trust: move.trustAfter })),
};

export const certificateLimited: CertificateLimited = {
  slug: "7f3k-22910",
  holderName: "Maya Okafor",
  skill: "objection_handling",
  field: "sales",
  level: "intermediate",
  issuedAt: "2026-11-14T15:42:00Z",
  caseTitle: "Renewal at risk: Brightline Logistics",
  accuracy: evaluation.accuracy,
  outcome: evaluation.outcome,
  headline: evaluation.summary,
  verified: true,
  verificationScope: "recorded_simulation",
  isDemo: true,
  assistance: evaluation.assistance,
  aiUseSkillSummary: evaluation.aiUseSkill,
  scoringSummary: evaluation.scoreAudit,
};

// Fictional conversation for the design gallery; never used as a live transcript.
const galleryReplies = [
  "Busy. March was rough. What do you need from me today?",
  "Since the March migration, our dispatch team has been fixing routing mistakes by hand.",
  "212 loads were misrouted. We paid carrier penalties and lost hours fixing them.",
  "We already have a support ticket. I need someone to own the fix.",
  "Yes. A named engineer and a date would give me something concrete for our CFO.",
  "Fifteen percent? That is not the volume tier in our agreement.",
  "Please check it before you send the proposal.",
  "That matches the agreement. Put the commitments in writing too.",
  "Send it by three. I can take that to Thursday's meeting.",
];
export const transcript: TranscriptEntry[] = moves.flatMap((move, index) => [
  {
    id: move.eventId,
    seq: move.seq,
    actor: "user" as const,
    type: "message" as const,
    content: move.userText,
    createdAt: "2026-11-14T15:31:08Z",
  },
  {
    id: eventId(100 + index),
    seq: move.seq + 1,
    actor: "persona" as const,
    type: "message" as const,
    content: galleryReplies[index],
    createdAt: "2026-11-14T15:31:21Z",
  },
]);

export const certificateFull: CertificateFull = {
  ...certificateLimited,
  evaluation: PublicEvaluation.parse(evaluation),
  moves,
  personas: [persona],
  transcript,
};

export const docs: CaseDoc[] = [
  {
    id: "doc-email",
    kind: "email_thread",
    title: "Re: Renewal quote",
    arrivesAtTurn: null,
    content: {
      subject: "Re: Renewal quote",
      messages: [
        {
          from: "Dana Whitfield",
          to: ["you"],
          sentAt: "2026-11-12T16:18:00.000Z",
          body: "Got the renewal quote. Before I take anything upstairs I need to understand why I am paying the same rate after the spring we had.\n\nI have a competing quote that is 11% lower.\n\nDana Whitfield\nOperations Director, Brightline Logistics\n614-555-0142",
        },
        {
          from: "You",
          to: ["Dana Whitfield"],
          sentAt: "2026-11-12T17:02:00.000Z",
          body: "Dana, understood. Can we take 10 minutes on Thursday? I would rather hear what happened than send you a revised number blind.",
        },
      ],
    },
  },
  {
    id: "doc-crm",
    kind: "crm_record",
    title: "Brightline Logistics",
    arrivesAtTurn: null,
    content: {
      account: "Brightline Logistics",
      contact: "Dana Whitfield, Operations Director",
      stage: "Renewal at risk",
      fields: [
        { label: "Plan", value: "Routing Pro, 140 vehicles" },
        { label: "Annual contract value", value: "$86,400" },
        { label: "Renewal date", value: "Dec 5, 2026" },
        {
          label: "Primary contact",
          value: "Dana Whitfield, Operations Director",
        },
        { label: "Health", value: "At risk" },
      ],
      notes: [
        "Apr 02: Support ticket #4471 opened: misrouted loads after v4 migration",
        "Jun 18: Ticket #4471 still open. Escalation requested by customer",
        "Nov 12: Customer mentions competing quote, 11% lower",
      ],
    },
  },
  {
    id: "doc-slack",
    kind: "slack_thread",
    title: "#acct-brightline",
    arrivesAtTurn: null,
    content: {
      channel: "acct-brightline",
      messages: [
        {
          author: "Priya Raman",
          sentAt: "2026-11-14T09:14:00.000Z",
          text: "Heads up before your call. Ticket 4471 is a real bug in zone assignment, not user error. Eng has a fix scoped but nobody has told the customer.",
        },
        {
          author: "Tom Becker",
          sentAt: "2026-11-14T09:20:00.000Z",
          text: "I can put a named engineer on it if that helps the renewal. Need a yes by Friday.",
        },
      ],
    },
  },
  {
    id: "doc-table",
    kind: "table",
    title: "Shipments by month",
    arrivesAtTurn: null,
    content: {
      caption:
        "Source: Brightline account export. Misrouted counts are customer-reported.",
      columns: ["Month", "Shipments", "Misrouted", "Rate"],
      rows: [
        ["February", "402", "38", "9.5%"],
        ["March", "418", "212", "50.7%"],
        ["April", "430", "97", "22.6%"],
        ["May", "411", "61", "14.8%"],
      ],
    },
  },
  {
    id: "doc-note",
    kind: "note",
    title: "MSA excerpt, section 4.2",
    arrivesAtTurn: null,
    content: {
      text: "4.2 Volume tier. Customer receives a discount of eight percent (8%) on per-vehicle fees for any calendar month in which completed shipments exceed four hundred (400).\n\n4.3 No other discounts apply unless agreed in writing by both parties.",
    },
  },
];

export const skillPath: SkillPath = {
  skills: [
    { skill: "discovery", level: 4, xp: 310, nextLevelXp: 400 },
    { skill: "objection_handling", level: 3, xp: 240, nextLevelXp: 400 },
    { skill: "value_articulation", level: 3, xp: 120, nextLevelXp: 400 },
    { skill: "critical_ai_use", level: 1, xp: 60, nextLevelXp: 200 },
    { skill: "closing", level: 2, xp: 170, nextLevelXp: 300 },
  ],
  streak: { current: 12, best: 19 },
  today: { daily: null, weekly: null },
  history: [
    {
      caseId: CASE_ID,
      title: "Renewal at risk: Brightline Logistics",
      accuracy: 74,
      date: "2026-11-14",
    },
    {
      caseId: "00000000-0000-4000-8000-000000000101",
      title: "Cold outreach: Halvorsen Freight",
      accuracy: 81,
      date: "2026-11-13",
    },
  ],
};

export const practiceDays = [
  "Nov 1",
  "Nov 2",
  "Nov 3",
  "Nov 4",
  "Nov 5",
  "Nov 6",
  "Nov 7",
  "Nov 8",
  "Nov 9",
  "Nov 10",
  "Nov 11",
  "Nov 12",
  "Nov 13",
  "Nov 14",
].map((label, index) => ({ label, practiced: index >= 2 }));

export const preparingSteps: ChecklistStep[] = [
  {
    id: "profile",
    label: "Reading your profile",
    status: "done",
    detail: "Sales · SDR · 3 years",
  },
  {
    id: "scenario",
    label: "Choosing a scenario",
    status: "done",
    detail: "Renewal under price pressure",
  },
  {
    id: "counterpart",
    label: "Writing your counterpart",
    status: "active",
    detail: "Role, history and what they will not say first",
  },
  { id: "documents", label: "Preparing the documents", status: "pending" },
  { id: "review", label: "Setting the review criteria", status: "pending" },
];
