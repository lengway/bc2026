/** Public API contracts from the updated CONTEXT. No private rubric is exported here. */
import { z } from "zod";
import {
  Field,
  Level,
  CaseType,
  Outcome,
  MoveLabel,
  Percent,
  Count,
} from "./common";
import {
  PublicScoringGuide,
  ScoreEvidence,
  AssistanceProfile,
  AiUseSkill,
  AiUseSkillSummary,
  TrapResult,
  ScoreAudit,
  ScoringSummary,
  ProcessObservations,
} from "./scoring";
export * from "./common";
export * from "./scoring";
export * from "./telemetry";
export const Profile = z.object({
  field: Field,
  level: Level,
  subfield: z.string(),
  years: Count,
  pains: z.array(z.string()),
  goals: z.array(z.string()),
});
export const SessionView = z
  .object({
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      displayName: z.string(),
    }),
    expiresAt: z.string().datetime(),
  })
  .nullable();
export const MagicLinkResponse = z.object({ accepted: z.literal(true) });
export const LogoutResponse = z.object({ ok: z.literal(true) });
export const PersonaPublic = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  company: z.string(),
  location: z.string(),
  avatarSeed: z.string(),
  context: z.string(),
});
export const CaseDoc = z.object({
  id: z.string(),
  kind: z.enum(["email_thread", "crm_record", "slack_thread", "table", "note"]),
  title: z.string(),
  content: z.unknown(),
  arrivesAtTurn: Count.nullable(),
});
export const CaseBrief = z.object({
  title: z.string(),
  mission: z.string(),
  yourRole: z.string(),
  successLooksLike: z.string(),
  timeLimitSec: z.number().int().positive(),
});
export const PublicEventMeta = z.object({
  typingMs: Count.optional(),
  trustAfter: Percent.optional(),
  documentIds: z.array(z.string()).optional(),
});
export const PublicEvent = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  seq: Count,
  actor: z.enum(["user", "persona", "copilot", "system"]),
  personaId: z.string().nullable(),
  type: z.enum([
    "message",
    "copilot_prompt",
    "copilot_reply",
    "doc_open",
    "twist",
    "submit",
  ]),
  content: z.string(),
  createdAt: z.string().datetime(),
  clientMsgId: z.string().uuid().nullable(),
  draftId: z.string().uuid().nullable(),
  meta: PublicEventMeta,
});
export const EventsPage = z.object({
  events: z.array(PublicEvent),
  lastSeq: Count,
});
export const CaseView = z.object({
  id: z.string().uuid(),
  type: CaseType,
  workspace: z.enum(["chat", "board", "ide"]),
  status: z.enum(["ready", "in_progress", "evaluating", "evaluated"]),
  startedAt: z.string().datetime().nullable(),
  field: Field,
  subfield: z.string(),
  brief: CaseBrief,
  personas: z.array(PersonaPublic),
  docs: z.array(CaseDoc),
  scoringGuide: PublicScoringGuide,
});
export const CaseResponse = z.union([
  CaseView,
  z.object({ id: z.string().uuid(), status: z.enum(["generating", "failed"]) }),
]);
export const MoveReview = z.object({
  eventId: z.string().uuid(),
  seq: Count,
  userText: z.string(),
  label: MoveLabel,
  why: z.string(),
  betterMove: z.string().nullable(),
  innerThought: z.string(),
  trustAfter: Percent,
  rubricRef: z.string().nullable(),
  points: Percent.nullable(),
  evidence: z.array(ScoreEvidence),
  assessmentStatus: z.enum(["assessed", "insufficient_evidence"]),
});
export const Evaluation = z.object({
  caseId: z.string().uuid(),
  accuracy: Percent.nullable(),
  labelCounts: z.record(MoveLabel, Count),
  aiDependency: Percent.nullable(),
  trapCaught: z.boolean(),
  assistance: AssistanceProfile,
  aiUseSkill: AiUseSkill,
  trapResult: TrapResult,
  scoreAudit: ScoreAudit,
  processObservations: ProcessObservations,
  outcome: Outcome,
  topMoves: z.array(MoveReview).max(3),
  summary: z.string(),
  skills: z.array(z.object({ skill: z.string(), score: Percent })),
  trustCurve: z.array(z.object({ seq: Count, trust: Percent })),
});
export const PublicEvaluation = Evaluation.omit({ processObservations: true });
export const Review = z.object({
  evaluation: Evaluation,
  moves: z.array(MoveReview),
  certificateSlug: z.string().optional(),
});
export const CertificateLimited = z.object({
  slug: z.string(),
  holderName: z.string(),
  skill: z.string(),
  field: Field,
  level: Level,
  issuedAt: z.string().datetime(),
  caseTitle: z.string(),
  accuracy: Percent.nullable(),
  outcome: z.string(),
  headline: z.string(),
  verified: z.literal(true),
  verificationScope: z.literal("recorded_simulation"),
  assistance: AssistanceProfile,
  aiUseSkillSummary: AiUseSkillSummary,
  scoringSummary: ScoringSummary,
});
export const CertificateFull = CertificateLimited.extend({
  evaluation: PublicEvaluation,
  moves: z.array(MoveReview),
  personas: z.array(PersonaPublic),
  transcript: z.array(
    PublicEvent.pick({
      id: true,
      seq: true,
      actor: true,
      type: true,
      content: true,
      createdAt: true,
    }),
  ),
});
export const Certificate = z.union([CertificateFull, CertificateLimited]);
export const SkillPath = z.object({
  skills: z.array(
    z.object({
      skill: z.string(),
      level: Count,
      xp: Count,
      nextLevelXp: z.number().positive(),
    }),
  ),
  streak: z.object({ current: Count, best: Count }),
  today: z.object({ daily: CaseView.nullable(), weekly: CaseView.nullable() }),
  history: z.array(
    z.object({
      caseId: z.string(),
      title: z.string(),
      accuracy: Percent.nullable(),
      date: z.string(),
    }),
  ),
});
export const CreateCaseResponse = z.object({
  caseId: z.string().uuid(),
  status: z.literal("generating"),
});
export const StartResponse = z.object({ startedAt: z.string().datetime() });
export const MoveResponse = z.object({
  events: z.array(PublicEvent),
  trust: Percent,
  outcome: Outcome.nullable(),
});
export const CopilotResponse = z.object({ event: PublicEvent });
export const SubmitResponse = z.object({ status: z.literal("evaluating") });
export const CheckoutResponse = z.object({ url: z.string().url() });
export const ErrorResponse = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type CaseData = z.infer<typeof CaseView>;
export type CaseResponseData = z.infer<typeof CaseResponse>;
export type EventData = z.infer<typeof PublicEvent>;
export type EventsPageData = z.infer<typeof EventsPage>;
export type CaseKind = z.infer<typeof CaseType>;
export type MoveInput = {
  clientMsgId: string;
  personaId: string;
  text: string;
  draftId: string | null;
};
export type CopilotInput = { clientMsgId: string; text: string };

export type Profile = z.infer<typeof Profile>;

export type SessionView = z.infer<typeof SessionView>;

export type MagicLinkResponse = z.infer<typeof MagicLinkResponse>;

export type LogoutResponse = z.infer<typeof LogoutResponse>;

export type PersonaPublic = z.infer<typeof PersonaPublic>;

export type CaseDoc = z.infer<typeof CaseDoc>;

export type CaseBrief = z.infer<typeof CaseBrief>;

export type PublicEventMeta = z.infer<typeof PublicEventMeta>;

export type PublicEvent = z.infer<typeof PublicEvent>;

export type EventsPage = z.infer<typeof EventsPage>;

export type CaseView = z.infer<typeof CaseView>;

export type CaseResponse = z.infer<typeof CaseResponse>;

export type MoveReview = z.infer<typeof MoveReview>;

export type Evaluation = z.infer<typeof Evaluation>;

export type PublicEvaluation = z.infer<typeof PublicEvaluation>;

export type Review = z.infer<typeof Review>;

export type CertificateLimited = z.infer<typeof CertificateLimited>;

export type CertificateFull = z.infer<typeof CertificateFull>;

export type Certificate = z.infer<typeof Certificate>;

export type SkillPath = z.infer<typeof SkillPath>;

export type CreateCaseResponse = z.infer<typeof CreateCaseResponse>;

export type StartResponse = z.infer<typeof StartResponse>;

export type MoveResponse = z.infer<typeof MoveResponse>;

export type CopilotResponse = z.infer<typeof CopilotResponse>;

export type SubmitResponse = z.infer<typeof SubmitResponse>;

export type CheckoutResponse = z.infer<typeof CheckoutResponse>;

export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const WorkspaceType = z.enum(["chat", "board", "ide"]);
export type WorkspaceType = z.infer<typeof WorkspaceType>;
export const CaseDocKind = CaseDoc.shape.kind;
export type CaseDocKind = z.infer<typeof CaseDocKind>;
export const Event = PublicEvent;
export type Event = z.infer<typeof PublicEvent>;
export const EventActor = PublicEvent.shape.actor;
export type EventActor = z.infer<typeof EventActor>;
export const EventType = PublicEvent.shape.type;
export type EventType = z.infer<typeof EventType>;
export const CaseOutcome = Outcome;
export type CaseOutcome = z.infer<typeof Outcome>;
export const TranscriptEntry = PublicEvent.pick({
  id: true,
  seq: true,
  actor: true,
  type: true,
  content: true,
  createdAt: true,
});
export type TranscriptEntry = z.infer<typeof TranscriptEntry>;
