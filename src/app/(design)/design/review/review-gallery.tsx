"use client";

import { useState } from "react";
import type { Evaluation, MoveReview } from "@/contracts";
import { ReviewScreen } from "@/screens/review";
import { cn } from "@/ui/lib/utils";
import { evaluation, moves, persona } from "../fixtures";
import { noAiChecks } from "@/mocks/scenarios/sales";

const CASE_TITLE = "Renewal at risk: Brightline Logistics";

/** Story 6: pressure, the client leaves after three moves. */
const lostMoves: MoveReview[] = [
  { ...moves[0], trustAfter: 40 },
  {
    ...moves[5],
    seq: 3,
    userText: "I can take 10% off today if you sign before Friday.",
    label: "mistake",
    points: 20,
    evidence: [{ source: "user_event", sourceId: moves[5].eventId, quote: "I can take 10% off today if you sign before Friday.", explanation: "The gallery example discounts before discovery." }],
    why: "You discounted before you knew what the problem was. It tells Dana the list price was never real.",
    betterMove: "Before we talk numbers: what happened in March?",
    innerThought: "So the price has air in it. Good to know.",
    trustAfter: 28,
  },
  {
    ...moves[5],
    eventId: moves[6].eventId,
    seq: 5,
    userText: "I really need an answer today. The offer expires at five.",
    label: "blunder",
    points: 0,
    evidence: [{ source: "user_event", sourceId: moves[6].eventId, quote: "I really need an answer today. The offer expires at five.", explanation: "The gallery example applies pressure with an invented deadline." }],
    why: "Pressure with an invented deadline, to a client who was already looking elsewhere. Her patience ran out here.",
    betterMove: "Take the time you need. What would you have to see from us to stay?",
    innerThought: "I do not negotiate with a countdown. We are done.",
    trustAfter: 9,
  },
];

const lostEvaluation: Evaluation = {
  ...evaluation,
  accuracy: 33,
  labelCounts: { brilliant: 0, best: 0, good: 1, inaccuracy: 0, mistake: 1, blunder: 1 },
  aiDependency: 85,
  assistance: { ...evaluation.assistance, copilotTextSimilarityPercent: 85, totalSubmittedChars: lostMoves.reduce((sum, move) => sum + move.userText.length, 0) },
  scoreAudit: { ...evaluation.scoreAudit, scoredMoveCount: 3, totalUserMoveCount: 3, pointsSum: 100, maxPoints: 300 },
  trapCaught: false,
  trapResult: "not_presented",
  aiUseSkill: { ...noAiChecks, checks: [] },
  outcome: "left",
  topMoves: [lostMoves[2], lostMoves[1]],
  summary:
    "Went to price and pressure before understanding the problem. The client left after three moves. Most messages followed Copilot closely.",
  skills: [
    { skill: "discovery", score: 18 },
    { skill: "objection_handling", score: 22 },
    { skill: "critical_ai_use", score: 10 },
  ],
  trustCurve: lostMoves.map((move) => ({ seq: move.seq, trust: move.trustAfter })),
};

const STATES = [
  { id: "ready", label: "Ready" },
  { id: "sharing", label: "Sharing" },
  { id: "lost", label: "Client left" },
  { id: "analyzing", label: "Analyzing" },
] as const;

type StateId = (typeof STATES)[number]["id"];

export function ReviewGallery() {
  const [state, setState] = useState<StateId>("ready");

  return (
    <div className="flex min-h-full flex-col">
      <div
        role="group"
        aria-label="Screen state"
        className="flex flex-wrap items-center gap-1 border-b bg-surface px-4 py-2 sm:px-8"
      >
        <span className="mr-2 font-mono text-xs text-muted-foreground uppercase">Review</span>
        {STATES.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={state === option.id}
            onClick={() => setState(option.id)}
            className={cn(
              "h-8 rounded-md px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              state === option.id
                ? "bg-card font-medium ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {state === "analyzing" ? (
        <ReviewScreen state="analyzing" caseTitle={CASE_TITLE} />
      ) : state === "lost" ? (
        <ReviewScreen
          key="lost"
          state="ready"
          caseTitle={CASE_TITLE}
          persona={persona}
          evaluation={lostEvaluation}
          moves={lostMoves}
          onShare={() => undefined}
          onNextCase={() => undefined}
        />
      ) : (
        <ReviewScreen
          key="ready"
          state="ready"
          caseTitle={CASE_TITLE}
          persona={persona}
          evaluation={evaluation}
          moves={moves}
          sharePending={state === "sharing"}
          onShare={() => undefined}
          onNextCase={() => undefined}
        />
      )}
    </div>
  );
}
