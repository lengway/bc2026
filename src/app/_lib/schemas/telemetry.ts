import { z } from "zod";
import { Count } from "./common";
export const InputMode = z.enum([
  "keyboard",
  "ime",
  "dictation",
  "assistive",
  "unknown",
]);
export const EditorEvent = z.object({
  id: z.string().uuid(),
  draftId: z.string().uuid(),
  seq: Count,
  kind: z.enum([
    "insert",
    "delete",
    "paste",
    "copilot_insert",
    "undo",
    "redo",
    "composition",
    "other",
  ]),
  inputMode: InputMode,
  clientAt: z.string().datetime(),
  rangeStart: Count,
  rangeEnd: Count,
  insertedText: z.string(),
  sourceEventId: z.string().uuid().nullable(),
  inputType: z.string().nullable(),
  isComposing: z.boolean().nullable(),
  isTrusted: z.boolean().nullable(),
});
// Concrete interval summary shape remains a frontend proposal until backend T0.
export const IntervalSummary = z.object({
  count: Count,
  minMs: z.number().nonnegative().nullable(),
  maxMs: z.number().nonnegative().nullable(),
  meanMs: z.number().nonnegative().nullable(),
});
export const InteractionWindow = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationMs: z.number().nonnegative(),
  pointerTypes: z.array(z.enum(["mouse", "touch", "pen", "unknown"])),
  pointerMoveSamples: Count.nullable(),
  pointerDownCount: Count.nullable(),
  clickCount: Count.nullable(),
  wheelCount: Count.nullable(),
  pathLengthNormalized: z.number().nonnegative().nullable(),
  directionChanges: Count.nullable(),
  movementIntervalSummary: IntervalSummary.nullable(),
  inputIntervalSummary: IntervalSummary.nullable(),
  editCount: Count.nullable(),
  focusTransitionCount: Count.nullable(),
  visibleDurationMs: z.number().nonnegative().nullable(),
  trustedEventCount: Count.nullable(),
  untrustedEventCount: Count.nullable(),
  webdriverReported: z.boolean().nullable(),
  capabilityGaps: z.array(z.string()),
});
export const EditorBatch = z.object({
  draftId: z.string().uuid(),
  batchId: z.string().uuid(),
  events: z.array(EditorEvent),
  interactionWindows: z.array(InteractionWindow).optional(),
});
export const EditorBatchAck = z.object({
  acceptedCount: Count,
  lastDraftSeq: Count,
  acceptedWindowCount: Count,
});
export type EditorBatchData = z.infer<typeof EditorBatch>;
