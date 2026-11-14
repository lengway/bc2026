import { z } from "zod";

export const MoveLabel = z.enum([
  "brilliant",
  "best",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
]);
export type MoveLabel = z.infer<typeof MoveLabel>;

export const MoveReview = z.object({
  eventId: z.string().uuid(),
  seq: z.number().int(),
  userText: z.string(),
  label: MoveLabel,
  why: z.string(),
  betterMove: z.string().nullable(),
  innerThought: z.string(),
  trustAfter: z.number().int(),
});
export type MoveReview = z.infer<typeof MoveReview>;

export const CaseOutcome = z.enum(["won", "lost", "left", "incomplete"]);
export type CaseOutcome = z.infer<typeof CaseOutcome>;

export const Evaluation = z.object({
  caseId: z.string().uuid(),
  accuracy: z.number().int().min(0).max(100),
  labelCounts: z.record(MoveLabel, z.number().int()),
  aiDependency: z.number().int().min(0).max(100),
  trapCaught: z.boolean(),
  outcome: CaseOutcome,
  topMoves: z.array(MoveReview).max(3),
  summary: z.string(),
  skills: z.array(z.object({ skill: z.string(), score: z.number().int() })),
  trustCurve: z.array(
    z.object({ seq: z.number().int(), trust: z.number().int() }),
  ),
});
export type Evaluation = z.infer<typeof Evaluation>;
