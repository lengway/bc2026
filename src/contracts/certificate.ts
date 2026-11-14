import { z } from 'zod';
import { Field, Level, PersonaPublic } from './case';
import { EvaluationOutcome, MoveReview, PublicEvaluation, SkillCertificateMove } from './evaluation';
import { Event } from './events';
import { Id, NonEmpty, Percent, PositiveInt, Timestamp } from './primitives';
import { AiUseSkillSummary, AssistanceProfile, ScoringSummary, TrapResult } from './scoring';
import { AveragePercent, CASES_REQUIRED, CaseRef, SkillCertificateLevel, SkillId } from './skill-series';

export { PublicEvaluation } from './evaluation';

export const CaseRecordSlug = z.string().regex(/^[A-Za-z0-9_-]{10}$/);
export type CaseRecordSlug = z.infer<typeof CaseRecordSlug>;

export const CaseRecordLimited = z.object({
  slug: CaseRecordSlug,
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
  isDemo: z.boolean().default(false),
  skillCertificate: z.object({ skill: SkillId, slug: CaseRecordSlug }).optional(),
  assistance: AssistanceProfile,
  aiUseSkillSummary: AiUseSkillSummary,
  scoringSummary: ScoringSummary,
});
export type CaseRecordLimited = z.infer<typeof CaseRecordLimited>;

export const CaseRecordTranscriptEvent = Event.pick({
  id: true,
  seq: true,
  actor: true,
  type: true,
  content: true,
  createdAt: true,
});
export type CaseRecordTranscriptEvent = z.infer<typeof CaseRecordTranscriptEvent>;

export const TranscriptEntry = CaseRecordTranscriptEvent;
export type TranscriptEntry = CaseRecordTranscriptEvent;

export const CaseRecordFull = CaseRecordLimited.extend({
  evaluation: PublicEvaluation,
  moves: z.array(MoveReview),
  personas: z.array(PersonaPublic),
  transcript: z.array(CaseRecordTranscriptEvent),
});
export type CaseRecordFull = z.infer<typeof CaseRecordFull>;

// Full is first because the limited schema projects away its additional fields.
export const CaseRecordResponse = z.union([CaseRecordFull, CaseRecordLimited]);
export type CaseRecordResponse = z.infer<typeof CaseRecordResponse>;

// Existing imports and public URLs remain compatible.
export const CertificateSlug = CaseRecordSlug;
export type CertificateSlug = CaseRecordSlug;
export const CertificateLimited = CaseRecordLimited;
export type CertificateLimited = CaseRecordLimited;
export const CertificateFull = CaseRecordFull;
export type CertificateFull = CaseRecordFull;
export const CertificateResponse = CaseRecordResponse;
export type CertificateResponse = CaseRecordResponse;
export const CertificateTranscriptEvent = CaseRecordTranscriptEvent;
export type CertificateTranscriptEvent = CaseRecordTranscriptEvent;

export const SkillCertificateSlug = CaseRecordSlug;
export type SkillCertificateSlug = z.infer<typeof SkillCertificateSlug>;

export const SkillCertificateLimited = CaseRecordLimited.pick({
  holderName: true,
  field: true,
  issuedAt: true,
  verified: true,
  verificationScope: true,
  isDemo: true,
}).extend({
  slug: SkillCertificateSlug,
  skill: SkillId,
  level: SkillCertificateLevel,
  cases: z.array(CaseRef).length(CASES_REQUIRED),
  averageAccuracy: AveragePercent,
  aiDependencyAverage: AveragePercent.nullable(),
  trapResults: z.array(z.object({ caseId: Id, trapResult: TrapResult })).length(CASES_REQUIRED),
  supersededBy: SkillCertificateSlug.nullable(),
});
export type SkillCertificateLimited = z.infer<typeof SkillCertificateLimited>;

export const SkillCertificateFull = SkillCertificateLimited.extend({
  keyMoves: z.array(z.object({ caseId: Id, move: SkillCertificateMove })).length(CASES_REQUIRED),
  trustCurves: z.array(z.object({
    caseId: Id,
    points: z.array(z.object({ seq: PositiveInt, trust: Percent })),
  })).length(CASES_REQUIRED),
});
export type SkillCertificateFull = z.infer<typeof SkillCertificateFull>;

// Parse full responses first so the limited projection does not strip the evidence.
export const SkillCertificateResponse = z.union([SkillCertificateFull, SkillCertificateLimited]);
export type SkillCertificateResponse = z.infer<typeof SkillCertificateResponse>;
