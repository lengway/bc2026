import { z } from 'zod';
import { CaseType, PersonaOutcome } from './case';
import { CertificateSlug } from './certificate';
import { Evaluation, MoveReview } from './evaluation';
import { Event } from './events';
import { Id, NonEmpty, NonNegativeInt, Percent, Timestamp } from './primitives';

export { CaseResponse } from './case';
export { CertificateResponse } from './certificate';
export { EventsPage } from './events';
export { EditorBatch, EditorBatchAck } from './telemetry';
export { IntakeRequest, Profile as IntakeResponse } from './profile';
export { SkillPath as SkillPathResponse } from './progress';
export { LogoutResponse, MagicLinkRequest, MagicLinkResponse, MagicLinkVerifyQuery, MagicLinkVerifyResponse, SessionView } from './auth';

export const ApiErrorCode = z.enum(['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'PAYWALL', 'RATE_LIMIT', 'LLM_FAILED', 'VALIDATION']);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiError = z.object({
  error: z.object({ code: ApiErrorCode, message: NonEmpty }),
});
export type ApiError = z.infer<typeof ApiError>;

export const CaseParams = z.strictObject({ id: Id });
export type CaseParams = z.infer<typeof CaseParams>;

export const CertificateParams = z.strictObject({ slug: CertificateSlug });
export type CertificateParams = z.infer<typeof CertificateParams>;

export const GenerateCaseRequest = z.strictObject({ type: CaseType });
export type GenerateCaseRequest = z.infer<typeof GenerateCaseRequest>;

export const GenerateCaseResponse = z.object({ caseId: Id, status: z.literal('generating') });
export type GenerateCaseResponse = z.infer<typeof GenerateCaseResponse>;

export const StartCaseResponse = z.object({ startedAt: Timestamp });
export type StartCaseResponse = z.infer<typeof StartCaseResponse>;

const MessageText = z.string().max(8_000).refine((text) => text.trim().length > 0, {
  message: 'Message text cannot be blank',
});

export const MoveRequest = z.strictObject({
  clientMsgId: Id,
  personaId: NonEmpty.max(128),
  text: MessageText,
  draftId: Id.nullable().default(null),
});
export type MoveRequest = z.infer<typeof MoveRequest>;

export const MoveResponse = z.object({
  events: z.array(Event),
  trust: Percent,
  outcome: PersonaOutcome.nullable(),
});
export type MoveResponse = z.infer<typeof MoveResponse>;

export const CopilotRequest = z.strictObject({ clientMsgId: Id, text: MessageText });
export type CopilotRequest = z.infer<typeof CopilotRequest>;

export const CopilotResponse = z.object({ event: Event });
export type CopilotResponse = z.infer<typeof CopilotResponse>;

const SequenceCursor = z.union([
  NonNegativeInt,
  z.string().regex(/^\d+$/).transform(Number).pipe(NonNegativeInt),
]);

export const EventsQuery = z.strictObject({ afterSeq: SequenceCursor.default(0) });
export type EventsQuery = z.infer<typeof EventsQuery>;

export const StreamQuery = EventsQuery;
export type StreamQuery = z.infer<typeof StreamQuery>;

export const LastEventId = SequenceCursor;
export type LastEventId = z.infer<typeof LastEventId>;

export const CaseEventStreamMessage = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
  event: z.literal('case_event'),
  data: Event,
}).refine(({ id, data }) => id === String(data.seq), {
  path: ['id'],
  message: 'SSE id must identify the event sequence',
});
export type CaseEventStreamMessage = z.infer<typeof CaseEventStreamMessage>;

export const SubmitCaseResponse = z.object({ status: z.literal('evaluating') });
export type SubmitCaseResponse = z.infer<typeof SubmitCaseResponse>;

export const ReviewResponse = z.object({
  evaluation: Evaluation,
  moves: z.array(MoveReview),
  certificateSlug: CertificateSlug.optional(),
});
export type ReviewResponse = z.infer<typeof ReviewResponse>;

export const CheckoutRequest = z.strictObject({ plan: z.enum(['monthly', 'yearly']) });
export type CheckoutRequest = z.infer<typeof CheckoutRequest>;

export const CheckoutResponse = z.object({ url: z.url({ protocol: /^https?$/ }) });
export type CheckoutResponse = z.infer<typeof CheckoutResponse>;

// Stripe signature verification uses the unmodified raw body, before JSON parsing.
export const StripeWebhookRequest = NonEmpty;
export type StripeWebhookRequest = z.infer<typeof StripeWebhookRequest>;

export const StripeWebhookResponse = z.object({ received: z.literal(true) });
export type StripeWebhookResponse = z.infer<typeof StripeWebhookResponse>;
