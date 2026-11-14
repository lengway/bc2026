import { z } from 'zod';
import { Id, NonEmpty, NonNegativeInt, Percent, PositiveInt, Timestamp } from './primitives';

export const EventActor = z.enum(['user', 'persona', 'copilot', 'system']);
export type EventActor = z.infer<typeof EventActor>;

export const EventType = z.enum(['message', 'copilot_prompt', 'copilot_reply', 'doc_open', 'twist', 'submit']);
export type EventType = z.infer<typeof EventType>;

export const PublicEventMeta = z.object({
  typingMs: NonNegativeInt.optional(),
  trustAfter: Percent.optional(),
  documentIds: z.array(NonEmpty).optional(),
  kind: z.enum(['email', 'slack', 'persona_message']).optional(),
  from: NonEmpty.optional(),
});
export type PublicEventMeta = z.infer<typeof PublicEventMeta>;

export const Event = z.object({
  id: Id,
  caseId: Id,
  seq: PositiveInt,
  actor: EventActor,
  personaId: NonEmpty.nullable(),
  type: EventType,
  content: z.string(),
  meta: PublicEventMeta,
  createdAt: Timestamp,
  clientMsgId: Id.nullable(),
  draftId: Id.nullable(),
});
export type Event = z.infer<typeof Event>;

export const EventsPage = z.object({
  events: z.array(Event),
  lastSeq: NonNegativeInt,
}).refine(({ events, lastSeq }) => events.every((event, index) => (
  event.seq <= lastSeq && (index === 0 || event.seq > events[index - 1].seq)
)), { path: ['events'], message: 'Events must appear in sequence order up to lastSeq' });
export type EventsPage = z.infer<typeof EventsPage>;
