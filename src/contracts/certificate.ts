import { z } from "zod";
import { Field, Level, PersonaPublic } from "./case";
import { Evaluation, MoveReview } from "./evaluation";
import { Event } from "./events";

export const CertificateLimited = z.object({
  slug: z.string(),
  holderName: z.string(),
  skill: z.string(),
  field: Field,
  level: Level,
  issuedAt: z.string(),
  caseTitle: z.string(),
  accuracy: z.number().int(),
  outcome: z.string(),
  /** Short characterization, 1–2 sentences. */
  headline: z.string(),
  verified: z.literal(true),
});
export type CertificateLimited = z.infer<typeof CertificateLimited>;

export const TranscriptEntry = Event.pick({
  seq: true,
  actor: true,
  type: true,
  content: true,
  createdAt: true,
});
export type TranscriptEntry = z.infer<typeof TranscriptEntry>;

export const CertificateFull = CertificateLimited.extend({
  evaluation: Evaluation,
  moves: z.array(MoveReview),
  personas: z.array(PersonaPublic),
  transcript: z.array(TranscriptEntry),
});
export type CertificateFull = z.infer<typeof CertificateFull>;
