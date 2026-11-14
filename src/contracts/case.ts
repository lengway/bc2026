import { z } from "zod";

export const Field = z.enum(["sales", "project_management", "software"]);
export type Field = z.infer<typeof Field>;

export const Level = z.enum(["beginner", "intermediate", "advanced"]);
export type Level = z.infer<typeof Level>;

export const CaseType = z.enum(["onboarding", "daily", "weekly"]);
export type CaseType = z.infer<typeof CaseType>;

export const WorkspaceType = z.enum(["chat", "board", "ide"]);
export type WorkspaceType = z.infer<typeof WorkspaceType>;

export const CaseDocKind = z.enum([
  "email_thread",
  "crm_record",
  "slack_thread",
  "table",
  "note",
]);
export type CaseDocKind = z.infer<typeof CaseDocKind>;

export const CaseDoc = z.object({
  id: z.string(),
  kind: CaseDocKind,
  title: z.string(),
  /** Shape depends on `kind`, see ./docs.ts */
  content: z.unknown(),
  /** null = available from the start */
  arrivesAtTurn: z.number().int().nullable(),
});
export type CaseDoc = z.infer<typeof CaseDoc>;

export const PersonaPublic = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  company: z.string(),
  location: z.string(),
  avatarSeed: z.string(),
  context: z.string(),
});
export type PersonaPublic = z.infer<typeof PersonaPublic>;

/** Server only. Never sent to the client. */
export const PersonaHidden = z.object({
  personality: z.string(),
  style: z.string(),
  realMotive: z.string(),
  constraints: z.array(z.string()),
  triggersOpen: z.array(z.string()),
  triggersClose: z.array(z.string()),
  knows: z.array(z.string()),
  willNeverSayFirst: z.array(z.string()),
  patience: z.number().int().min(3).max(10),
  initialTrust: z.number().int().min(0).max(100),
});
export type PersonaHidden = z.infer<typeof PersonaHidden>;

export const CaseBrief = z.object({
  title: z.string(),
  mission: z.string(),
  yourRole: z.string(),
  successLooksLike: z.string(),
  timeLimitSec: z.number().int(),
});
export type CaseBrief = z.infer<typeof CaseBrief>;

/** What the client receives. `docs` holds only documents already available. */
export const CaseView = z.object({
  id: z.string().uuid(),
  type: CaseType,
  workspace: WorkspaceType,
  status: z.string(),
  field: Field,
  subfield: z.string(),
  brief: CaseBrief,
  personas: z.array(PersonaPublic),
  docs: z.array(CaseDoc),
});
export type CaseView = z.infer<typeof CaseView>;
