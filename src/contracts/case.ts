import { z } from 'zod';
import { CaseDoc } from './docs';
import { Id, NonEmpty, Percent, PositiveInt, Timestamp } from './primitives';
import { PublicScoringGuide } from './scoring';

export { CaseDoc, CaseDocKind } from './docs';
export { Level } from './primitives';

export const Field = z.enum(['sales', 'project_management', 'software']);
export type Field = z.infer<typeof Field>;

export const CaseType = z.enum(['onboarding', 'daily', 'weekly', 'prep']);
export type CaseType = z.infer<typeof CaseType>;

export const WorkspaceType = z.enum(['chat', 'board', 'ide']);
export type WorkspaceType = z.infer<typeof WorkspaceType>;

export const CaseStatus = z.enum(['ready', 'in_progress', 'evaluating', 'evaluated']);
export type CaseStatus = z.infer<typeof CaseStatus>;

export const PersonaOutcome = z.enum(['won', 'lost', 'left']);
export type PersonaOutcome = z.infer<typeof PersonaOutcome>;

export const PersonaPublic = z.object({
  id: NonEmpty,
  name: NonEmpty,
  role: NonEmpty,
  company: NonEmpty,
  location: NonEmpty,
  avatarSeed: NonEmpty,
  context: NonEmpty,
});
export type PersonaPublic = z.infer<typeof PersonaPublic>;

export const PersonaHidden = z.object({
  personality: NonEmpty,
  style: NonEmpty,
  realMotive: NonEmpty,
  constraints: z.array(NonEmpty),
  triggersOpen: z.array(NonEmpty),
  triggersClose: z.array(NonEmpty),
  knows: z.array(NonEmpty),
  willNeverSayFirst: z.array(NonEmpty),
  patience: z.int().min(3).max(10),
  initialTrust: Percent,
});
export type PersonaHidden = z.infer<typeof PersonaHidden>;

export const CaseBrief = z.object({
  title: NonEmpty,
  mission: NonEmpty,
  yourRole: NonEmpty,
  successLooksLike: NonEmpty,
  timeLimitSec: PositiveInt,
});
export type CaseBrief = z.infer<typeof CaseBrief>;

export const CaseView = z.object({
  id: Id,
  // Pressure is a curated case served through a dedicated endpoint.
  type: CaseType.or(z.literal('pressure')),
  workspace: WorkspaceType,
  status: CaseStatus,
  startedAt: Timestamp.nullable(),
  field: Field,
  subfield: NonEmpty,
  brief: CaseBrief,
  personas: z.array(PersonaPublic),
  docs: z.array(CaseDoc),
  scoringGuide: PublicScoringGuide,
});
export type CaseView = z.infer<typeof CaseView>;

export const CaseResponse = z.union([
  CaseView,
  z.object({ id: Id, status: z.enum(['generating', 'failed']), type: z.unknown().optional() })
    .transform(({ id, status, type }) => ({
      id, status, ...(type === 'prep' && { type }),
    })),
]);
export type CaseResponse = z.infer<typeof CaseResponse>;

// A deliberately small, owner-only projection used to resume recent prep work.
// It never includes the buyer, offering, objection, generated docs, or rubric.
export const RecoverablePrepStatus = z.enum(['generating', 'ready', 'in_progress', 'evaluating', 'evaluated']);
export const RecoverablePrep = z.object({ id: Id, status: RecoverablePrepStatus });
export const RecoverablePrepResponse = RecoverablePrep.nullable();
export type RecoverablePrep = z.infer<typeof RecoverablePrep>;
