import { z } from 'zod';
import { Id, NonEmpty, NonNegativeInt, PositiveInt, Timestamp } from './primitives';

export const ObservationStatus = z.enum(['available', 'partial', 'unavailable']);
export type ObservationStatus = z.infer<typeof ObservationStatus>;

export const InputMode = z.enum(['keyboard', 'ime', 'dictation', 'assistive', 'unknown']);
export type InputMode = z.infer<typeof InputMode>;

export const EditorEvent = z.strictObject({
  id: Id,
  draftId: Id,
  seq: PositiveInt,
  kind: z.enum(['insert', 'delete', 'paste', 'copilot_insert', 'undo', 'redo', 'composition', 'other']),
  inputMode: InputMode,
  clientAt: Timestamp,
  rangeStart: NonNegativeInt,
  rangeEnd: NonNegativeInt,
  insertedText: z.string().max(16_000),
  sourceEventId: Id.nullable(),
  inputType: z.string().max(100).nullable(),
  isComposing: z.boolean().nullable(),
  isTrusted: z.boolean().nullable(),
}).refine(({ rangeStart, rangeEnd }) => rangeStart <= rangeEnd, {
  path: ['rangeEnd'],
  message: 'Edit range must end at or after its start',
});
export type EditorEvent = z.infer<typeof EditorEvent>;

export const PointerType = z.enum(['mouse', 'touch', 'pen']);
export type PointerType = z.infer<typeof PointerType>;

export const IntervalSummary = z.strictObject({
  sampleCount: PositiveInt,
  minMs: z.number().nonnegative(),
  medianMs: z.number().nonnegative(),
  maxMs: z.number().nonnegative(),
}).refine(({ minMs, medianMs, maxMs }) => minMs <= medianMs && medianMs <= maxMs, {
  message: 'Interval summary must have minMs <= medianMs <= maxMs',
});
export type IntervalSummary = z.infer<typeof IntervalSummary>;

export const InteractionWindow = z.strictObject({
  id: Id,
  startedAt: Timestamp,
  endedAt: Timestamp,
  durationMs: NonNegativeInt,
  pointerTypes: z.array(PointerType).max(3),
  pointerMoveSamples: NonNegativeInt.nullable(),
  pointerDownCount: NonNegativeInt.nullable(),
  clickCount: NonNegativeInt.nullable(),
  wheelCount: NonNegativeInt.nullable(),
  pathLengthNormalized: z.number().nonnegative().nullable(),
  directionChanges: NonNegativeInt.nullable(),
  movementIntervalSummary: IntervalSummary.nullable(),
  inputIntervalSummary: IntervalSummary.nullable(),
  editCount: NonNegativeInt.nullable(),
  focusTransitionCount: NonNegativeInt.nullable(),
  visibleDurationMs: NonNegativeInt.nullable(),
  trustedEventCount: NonNegativeInt.nullable(),
  untrustedEventCount: NonNegativeInt.nullable(),
  webdriverReported: z.boolean().nullable(),
  capabilityGaps: z.array(NonEmpty.max(200)).max(20),
}).refine(({ startedAt, endedAt }) => Date.parse(endedAt) >= Date.parse(startedAt), {
  path: ['endedAt'],
  message: 'An interaction window cannot end before it starts',
}).refine(({ durationMs, visibleDurationMs }) => visibleDurationMs === null || visibleDurationMs <= durationMs, {
  path: ['visibleDurationMs'],
  message: 'Visible time cannot exceed the window duration',
});
export type InteractionWindow = z.infer<typeof InteractionWindow>;

export const EditorBatch = z.strictObject({
  draftId: Id,
  batchId: Id,
  events: z.array(EditorEvent).max(100),
  interactionWindows: z.array(InteractionWindow).max(20).optional(),
}).refine(({ events, interactionWindows }) => events.length > 0 || (interactionWindows?.length ?? 0) > 0, {
  message: 'An editor batch needs editor events or interaction windows',
}).refine(({ draftId, events }) => events.every((event) => event.draftId === draftId), {
  path: ['events'],
  message: 'All editor events must belong to the batch draft',
});
export type EditorBatch = z.infer<typeof EditorBatch>;

export const EditorBatchAck = z.object({
  acceptedCount: NonNegativeInt,
  lastDraftSeq: NonNegativeInt,
  acceptedWindowCount: NonNegativeInt,
});
export type EditorBatchAck = z.infer<typeof EditorBatchAck>;

export const AutomationStatus = z.enum(['signals_observed', 'no_signals_observed', 'insufficient_data']);
export type AutomationStatus = z.infer<typeof AutomationStatus>;

export const AutomationSignal = z.object({
  code: NonEmpty,
  observedValue: z.json(),
  windowId: Id.optional(),
  messageId: Id.optional(),
  explanation: NonEmpty,
  limitation: NonEmpty,
});
export type AutomationSignal = z.infer<typeof AutomationSignal>;

export const TextFeatures = z.object({
  messageId: Id,
  charCount: NonNegativeInt,
  punctuationCounts: z.record(NonEmpty, NonNegativeInt),
  listMarkerCount: NonNegativeInt,
  editCount: NonNegativeInt.nullable(),
  languageIssues: z.object({
    count: NonNegativeInt,
    method: NonEmpty,
    version: NonEmpty,
  }).nullable(),
});
export type TextFeatures = z.infer<typeof TextFeatures>;

export const ProcessObservations = z.object({
  rulesVersion: NonEmpty,
  observationStatus: ObservationStatus,
  automationStatus: AutomationStatus,
  signals: z.array(AutomationSignal),
  textFeatures: z.array(TextFeatures),
  limitations: z.array(NonEmpty),
});
export type ProcessObservations = z.infer<typeof ProcessObservations>;
