import { z } from 'zod';
import { CaseBrief, CaseDoc, CaseType, EditorEvent, Event, Field, InteractionWindow, Level, PersonaOutcome, PersonaPublic, PublicScoringGuide, WorkspaceType } from '@/contracts';
import { PersonaHidden } from '@/contracts/case';
import { Rubric } from '@/contracts/rubric';

const Timestamp = z.iso.datetime({ offset: true });
export const StoredEventSnapshot = Event.omit({ meta: true }).extend({ meta: z.record(z.string(),z.json()),isPublic: z.boolean() });
export const PersonaStateSnapshot = z.object({ turn: z.int().nonnegative(),trust: z.int().min(0).max(100),patience: z.int().nonnegative(),
  mood: z.string(),revealed: z.array(z.string()),outcome: PersonaOutcome.nullable() });
export const DraftSnapshot = z.object({ draftId: z.uuid(),messageEventId: z.uuid().nullable(),closedAt: Timestamp.nullable(),
  limitations: z.array(z.string()),events: z.array(EditorEvent.safeExtend({ receivedAt: Timestamp })),
  interactionWindows: z.array(InteractionWindow.safeExtend({ receivedAt: Timestamp })) });

/** Server-only immutable evaluation input, never an API or certificate projection. */
export const SubmittedSnapshot = z.object({
  version: z.literal(1),
  case: z.object({
    id: z.uuid(),userId: z.uuid(),field: Field,subfield: z.string(),type: CaseType,level: Level,isDemo: z.boolean(),isGuest: z.boolean(),
    workspace: WorkspaceType,brief: CaseBrief,docs: z.array(CaseDoc),
    personas: z.array(z.object({ public: PersonaPublic,hidden: PersonaHidden,state: PersonaStateSnapshot })),
    rubric: Rubric,scoringGuide: PublicScoringGuide,startedAt: Timestamp,timeLimitSec: z.int().positive(),
    model: z.string().nullable(),promptVersion: z.string().nullable(),
  }),
  events: z.array(StoredEventSnapshot),drafts: z.array(DraftSnapshot),submittedAt: Timestamp,
  reason: z.enum(['user','outcome','timeout']),limitations: z.array(z.string()),
});
export type SubmittedSnapshot = z.infer<typeof SubmittedSnapshot>;
