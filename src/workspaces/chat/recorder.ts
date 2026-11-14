import type {
  EditorEvent,
  EditorBatch,
  EditorBatchAck,
  InputMode,
  InteractionWindow,
  IntervalSummary,
} from "@/contracts";

type EditMeta = {
  inputType: string | null;
  isComposing: boolean | null;
  isTrusted: boolean | null;
  inputMode: InputMode;
  sourceEventId?: string | null;
  explicitCopilot?: boolean;
};
/** DOM ranges are UTF-16 offsets. Record what actually changed, including undo/IME. */
export function appliedReplacement(before: string, after: string) {
  let start = 0;
  while (
    start < before.length &&
    start < after.length &&
    before[start] === after[start]
  )
    start++;
  let end = before.length,
    afterEnd = after.length;
  while (
    end > start &&
    afterEnd > start &&
    before[end - 1] === after[afterEnd - 1]
  ) {
    end--;
    afterEnd--;
  }
  return {
    rangeStart: start,
    rangeEnd: end,
    insertedText: after.slice(start, afterEnd),
  };
}
export class AppliedEdits {
  draftId = crypto.randomUUID();
  private seq = 0;
  private text = "";
  change(next: string, meta: EditMeta): EditorEvent | null {
    if (next === this.text) return null;
    const replacement = appliedReplacement(this.text, next);
    this.text = next;
    const type = meta.inputType ?? "";
    const kind: EditorEvent["kind"] = meta.explicitCopilot
      ? "copilot_insert"
      : type === "historyUndo"
        ? "undo"
        : type === "historyRedo"
          ? "redo"
          : meta.isComposing || type.toLowerCase().includes("composition")
            ? "composition"
            : type === "insertFromPaste"
              ? "paste"
              : type.startsWith("delete")
                ? "delete"
                : type === "insertText"
                  ? "insert"
                  : "other";
    return {
      id: crypto.randomUUID(),
      draftId: this.draftId,
      seq: ++this.seq,
      kind,
      ...replacement,
      clientAt: new Date().toISOString(),
      sourceEventId: meta.sourceEventId ?? null,
      inputMode: meta.isComposing ? "ime" : meta.inputMode,
      inputType: meta.inputType,
      isComposing: meta.isComposing,
      isTrusted: meta.isTrusted,
    };
  }
  rotate() {
    this.draftId = crypto.randomUUID();
    this.seq = 0;
    this.text = "";
  }
}
export class ClipboardEvidence {
  private last: { text: string; source: string | null; at: number } | null =
    null;
  remember(text: string, source: string | null) {
    this.last = { text, source, at: Date.now() };
  }
  clear() {
    this.last = null;
  }
  sourceFor(text: string) {
    return this.last &&
      Date.now() - this.last.at < 60_000 &&
      this.last.text === text
      ? this.last.source
      : null;
  }
}
class Intervals {
  private last: number | null = null;
  private values: number[] = [];
  add(at: number) {
    if (this.last !== null) {
      this.values.push(Math.max(0, at - this.last));
    }
    this.last = at;
  }
  summary(): IntervalSummary | null {
    if (!this.values.length) return null;
    const sorted = [...this.values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return {
      sampleCount: sorted.length,
      minMs: sorted[0],
      medianMs:
        sorted.length % 2
          ? sorted[middle]
          : (sorted[middle - 1] + sorted[middle]) / 2,
      maxMs: sorted[sorted.length - 1],
    };
  }
}
/** Only the previous normalized point is retained; finish discards it. */
export class ActivityWindow {
  private types = new Set<InteractionWindow["pointerTypes"][number]>();
  private samples = 0;
  private downs = 0;
  private clicks = 0;
  private wheels = 0;
  private length = 0;
  private turns = 0;
  private edits = 0;
  private focuses = 0;
  private trusted = 0;
  private untrusted = 0;
  private point: { x: number; y: number } | null = null;
  private direction: { x: number; y: number } | null = null;
  private lastSample = -Infinity;
  private movement = new Intervals();
  private inputs = new Intervals();
  private gaps = new Set<string>();
  constructor(
    private started: number,
    private pointerSupported: boolean,
    private webdriver: boolean | null,
  ) {
    if (!pointerSupported) this.gaps.add("pointer_events_unavailable");
    if (webdriver === null) this.gaps.add("webdriver_property_unavailable");
  }
  gap(reason: string) {
    this.gaps.add(reason);
  }
  private trust(trusted: boolean | null) {
    if (trusted === true) this.trusted++;
    else if (trusted === false) this.untrusted++;
    else this.gap("event_trust_unavailable");
  }
  pointer(
    kind: "move" | "down" | "click" | "wheel",
    x: number,
    y: number,
    type: string,
    trusted: boolean,
    at = Date.now(),
  ) {
    if (!this.pointerSupported) return;
    if (kind === "move" && at - this.lastSample < 100) return;
    if (type === "mouse" || type === "touch" || type === "pen")
      this.types.add(type);
    else this.gaps.add("pointer_type_unavailable");
    this.trust(trusted);
    if (kind === "down") this.downs++;
    else if (kind === "click") this.clicks++;
    else if (kind === "wheel") this.wheels++;
    else {
      this.lastSample = at;
      this.samples++;
      this.movement.add(at);
      this.gap("pointer_samples_limited_to_10hz");
      if (this.point) {
        const dx = x - this.point.x,
          dy = y - this.point.y;
        const distance = Math.hypot(dx, dy);
        this.length += distance;
        if (distance > 0) {
          const direction = { x: dx / distance, y: dy / distance };
          if (
            this.direction &&
            direction.x * this.direction.x + direction.y * this.direction.y <
              0.5
          )
            this.turns++;
          this.direction = direction;
        }
      }
      this.point = { x, y };
    }
  }
  input(trusted: boolean | null, edited: boolean, at = Date.now()) {
    this.inputs.add(at);
    this.trust(trusted);
    if (edited) this.edits++;
  }
  focus(at = Date.now()) {
    if (at >= this.started) this.focuses++;
  }
  finish(at = Date.now()): InteractionWindow {
    const duration = Math.max(0, at - this.started);
    const summary: InteractionWindow = {
      id: crypto.randomUUID(),
      startedAt: new Date(this.started).toISOString(),
      endedAt: new Date(at).toISOString(),
      durationMs: duration,
      pointerTypes: [...this.types],
      pointerMoveSamples: this.pointerSupported ? this.samples : null,
      pointerDownCount: this.pointerSupported ? this.downs : null,
      clickCount: this.pointerSupported ? this.clicks : null,
      wheelCount: this.pointerSupported ? this.wheels : null,
      pathLengthNormalized: this.pointerSupported ? this.length : null,
      directionChanges: this.pointerSupported ? this.turns : null,
      movementIntervalSummary: this.pointerSupported
        ? this.movement.summary()
        : null,
      inputIntervalSummary: this.inputs.summary(),
      editCount: this.edits,
      focusTransitionCount: this.focuses,
      visibleDurationMs: duration,
      trustedEventCount: this.trusted,
      untrustedEventCount: this.untrusted,
      webdriverReported: this.webdriver,
      capabilityGaps: [...this.gaps],
    };
    this.started = at;
    this.types.clear();
    this.samples =
      this.downs =
      this.clicks =
      this.wheels =
      this.length =
      this.turns =
      this.edits =
      this.focuses =
      this.trusted =
      this.untrusted =
        0;
    this.point = this.direction = null;
    this.lastSample = -Infinity;
    this.movement = new Intervals();
    this.inputs = new Intervals();
    return summary;
  }
}
type BatchSender = (
  batch: EditorBatch,
  signal: AbortSignal,
) => Promise<EditorBatchAck>;
/** RAM-only queue. Retries reuse batchId; expired drafts are never replayed into a review. */
export class BatchDelivery {
  private queue: EditorBatch[] = [];
  private closed = new Set<string>();
  private running: Promise<void> | null = null;
  private active: { draftId: string; controller: AbortController } | null =
    null;
  private attempts = 0;
  private retryAt = 0;
  private lost = false;
  constructor(
    private send: BatchSender,
    private status: (partial: boolean) => void,
    private now = Date.now,
  ) {}
  markPartial() {
    this.lost = true;
    this.status(true);
  }
  enqueue(
    draftId: string,
    events: EditorEvent[],
    windows: InteractionWindow[],
  ) {
    if (this.closed.has(draftId) || (!events.length && !windows.length)) return;
    let chunk: EditorEvent[] = [];
    let size = 0;
    const push = (interactionWindows: InteractionWindow[] = []) => {
      this.queue.push({
        draftId,
        batchId: crypto.randomUUID(),
        events: chunk,
        interactionWindows,
      });
      chunk = [];
      size = 0;
    };
    for (const event of events) {
      const bytes = JSON.stringify(event).length * 3;
      if (chunk.length && (chunk.length >= 25 || size + bytes > 24000)) push();
      chunk.push(event);
      size += bytes;
    }
    if (chunk.length || windows.length) push(windows);
    if (this.queue.length > 40) {
      this.queue.splice(0, this.queue.length - 40);
      this.lost = true;
      this.status(true);
    }
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    if (this.now() < this.retryAt) return Promise.resolve();
    this.running = this.drain().finally(() => {
      this.running = null;
    });
    return this.running;
  }
  private async drain() {
    while (this.queue.length) {
      const batch = this.queue[0];
      if (this.closed.has(batch.draftId)) {
        this.queue.shift();
        continue;
      }
      const controller = new AbortController();
      this.active = { draftId: batch.draftId, controller };
      try {
        await this.send(batch, controller.signal);
        this.queue = this.queue.filter(
          (item) => item.batchId !== batch.batchId,
        );
        this.attempts = 0;
        this.retryAt = 0;
        this.status(this.lost);
      } catch {
        if (!this.closed.has(batch.draftId)) {
          this.retryAt =
            this.now() + Math.min(30000, 1000 * 2 ** ++this.attempts);
          this.status(true);
        }
        break;
      } finally {
        this.active = null;
      }
    }
  }
  async flushWithin(ms = 350): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const complete = await Promise.race([
      this.flush().then(() => this.queue.length === 0),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), ms);
      }),
    ]);
    clearTimeout(timer);
    if (!complete) this.status(true);
    return complete;
  }
  closeDraft(id: string) {
    this.closed.add(id);
    if (this.queue.some((batch) => batch.draftId === id)) {
      this.lost = true;
      this.status(true);
    }
    this.queue = this.queue.filter((batch) => batch.draftId !== id);
    if (this.active?.draftId === id) this.active.controller.abort();
  }
  stop() {
    this.active?.controller.abort();
    this.queue = [];
  }
}
