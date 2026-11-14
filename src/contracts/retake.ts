import { z } from "zod";
import { MoveRequest } from "./api";
import { Id, NonEmpty, Timestamp } from "./primitives";

export const RetakeParams = z.strictObject({ id: Id, eventId: Id });
export const RetakeRequest = MoveRequest.pick({ text: true });
export type RetakeRequest = z.infer<typeof RetakeRequest>;

const Exchange = z.object({ answer: NonEmpty, reaction: NonEmpty });

export const RetakeResult = z.object({
  personaName: NonEmpty,
  criterionTitle: NonEmpty,
  before: Exchange,
  after: Exchange,
  feedback: NonEmpty.nullable(),
});
export type RetakeResult = z.infer<typeof RetakeResult>;

export const RetakeStatus = z.object({
  status: z.enum([
    "available",
    "upgrade",
    "exhausted",
    "pending",
    "completed",
    "unavailable",
  ]),
  remaining: z.int().min(0).max(3),
  nextAvailableAt: Timestamp.nullable(),
  result: RetakeResult.nullable(),
});
export type RetakeStatus = z.infer<typeof RetakeStatus>;
