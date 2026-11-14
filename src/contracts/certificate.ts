import { z } from 'zod';
import { Field, Level, PersonaPublic } from './case';
import { EvaluationOutcome, MoveReview, PublicEvaluation } from './evaluation';
import { Event } from './events';
import { NonEmpty, Percent, Timestamp } from './primitives';
import { AiUseSkillSummary, AssistanceProfile, ScoringSummary } from './scoring';

export { PublicEvaluation } from './evaluation';

export const CertificateSlug = z.string().regex(/^[A-Za-z0-9_-]{10}$/);
export type CertificateSlug = z.infer<typeof CertificateSlug>;

export const CertificateLimited = z.object({
  slug: CertificateSlug,
  holderName: NonEmpty,
  skill: NonEmpty,
  field: Field,
  level: Level,
  issuedAt: Timestamp,
  caseTitle: NonEmpty,
  accuracy: Percent.nullable(),
  outcome: EvaluationOutcome,
  headline: NonEmpty,
  verified: z.literal(true),
  verificationScope: z.literal('recorded_simulation'),
  assistance: AssistanceProfile,
  aiUseSkillSummary: AiUseSkillSummary,
  scoringSummary: ScoringSummary,
});
export type CertificateLimited = z.infer<typeof CertificateLimited>;

export const CertificateTranscriptEvent = Event.pick({
  id: true,
  seq: true,
  actor: true,
  type: true,
  content: true,
  createdAt: true,
});
export type CertificateTranscriptEvent = z.infer<typeof CertificateTranscriptEvent>;

export const CertificateFull = CertificateLimited.extend({
  evaluation: PublicEvaluation,
  moves: z.array(MoveReview),
  personas: z.array(PersonaPublic),
  transcript: z.array(CertificateTranscriptEvent),
});
export type CertificateFull = z.infer<typeof CertificateFull>;

// Full is first because the limited schema projects away its additional fields.
export const CertificateResponse = z.union([CertificateFull, CertificateLimited]);
export type CertificateResponse = z.infer<typeof CertificateResponse>;
