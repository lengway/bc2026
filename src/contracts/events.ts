import { z } from "zod";

export const EventActor = z.enum(["user", "persona", "copilot", "system"]);
export type EventActor = z.infer<typeof EventActor>;

export const EventType = z.enum([
  "message",
  "copilot_prompt",
  "copilot_reply",
  "doc_open",
  "twist",
  "submit",
]);
export type EventType = z.infer<typeof EventType>;

export const Event = z.object({
  id: z.string().uuid(),
  caseId: z.string().uuid(),
  seq: z.number().int(),
  actor: EventActor,
  personaId: z.string().nullable(),
  type: EventType,
  content: z.string(),
  meta: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export type Event = z.infer<typeof Event>;
