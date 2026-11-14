import { describe, expect, it, vi } from "vitest";
import {
  AppliedEdits,
  ClipboardEvidence,
  ActivityWindow,
  BatchDelivery,
} from "./recorder";
import type { EditorBatch } from "@/contracts";

describe("workspace observations", () => {
  it("records the applied replacement for composition, undo and deletion", () => {
    const edits = new AppliedEdits();
    const meta = {
      inputType: "insertCompositionText",
      isComposing: true,
      isTrusted: true,
      inputMode: "ime" as const,
    };
    expect(edits.change("你好", meta)).toMatchObject({
      kind: "composition",
      rangeStart: 0,
      rangeEnd: 0,
      insertedText: "你好",
      seq: 1,
    });
    expect(
      edits.change("你", {
        ...meta,
        inputType: "historyUndo",
        isComposing: false,
      }),
    ).toMatchObject({
      kind: "undo",
      rangeStart: 1,
      rangeEnd: 2,
      insertedText: "",
      seq: 2,
    });
    expect(
      edits.change("", {
        ...meta,
        inputType: "deleteContentBackward",
        isComposing: false,
      }),
    ).toMatchObject({ kind: "delete", rangeStart: 0, rangeEnd: 1, seq: 3 });
  });
  it("links only observed transfers, never Copy by itself or a document copy", () => {
    const clipboard = new ClipboardEvidence();
    const source = crypto.randomUUID();
    expect(clipboard.sourceFor("external text")).toBeNull();
    clipboard.remember("advice", source);
    expect(clipboard.sourceFor("advice")).toBe(source);
    clipboard.remember("my document", null);
    expect(clipboard.sourceFor("advice")).toBeNull();
    const edits = new AppliedEdits();
    expect(
      edits.change("advice", {
        inputType: "insertReplacementText",
        isComposing: false,
        isTrusted: null,
        inputMode: "unknown",
        sourceEventId: source,
        explicitCopilot: true,
      }),
    ).toMatchObject({ kind: "copilot_insert", sourceEventId: source });
  });
  it("throttles pointer sampling, stores aggregates and resets points after a window", () => {
    const window = new ActivityWindow(1000, true, false);
    window.pointer("move", 0.1, 0.1, "touch", true, 1000);
    window.pointer("move", 0.2, 0.2, "touch", true, 1050);
    window.pointer("move", 0.3, 0.1, "touch", true, 1100);
    window.input(true, true, 1200);
    window.focus(1250);
    const summary = window.finish(2000);
    expect(summary).toMatchObject({
      pointerMoveSamples: 2,
      pointerTypes: ["touch"],
      editCount: 1,
      focusTransitionCount: 1,
      webdriverReported: false,
      durationMs: 1000,
    });
    expect(summary.pathLengthNormalized).toBeCloseTo(0.2);
    expect(JSON.stringify(summary)).not.toContain('"x"');
    expect(window.finish(3000).pathLengthNormalized).toBe(0);
  });
  it("preserves unavailable browser capabilities as null", () => {
    const summary = new ActivityWindow(0, false, null).finish(1000);
    expect(summary.pointerMoveSamples).toBeNull();
    expect(summary.webdriverReported).toBeNull();
    expect(summary.capabilityGaps.length).toBeGreaterThan(0);
  });
  it("retries the same batch without duplicating IDs and abandons closed drafts", async () => {
    let now = 0;
    const sent: EditorBatch[] = [];
    const send = vi.fn(async (batch: EditorBatch) => {
      sent.push(batch);
      if (sent.length === 1) throw new Error("offline");
      return {
        acceptedCount: batch.events.length,
        lastDraftSeq: 1,
        acceptedWindowCount: 0,
      };
    });
    const delivery = new BatchDelivery(
      send,
      () => {},
      () => now,
    );
    const edits = new AppliedEdits();
    const event = edits.change("a", {
      inputType: "insertText",
      isComposing: false,
      isTrusted: true,
      inputMode: "keyboard",
    });
    if (!event) throw new Error("Missing edit");
    delivery.enqueue(edits.draftId, [event], []);
    await delivery.flush();
    now = 3000;
    await delivery.flush();
    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual(sent[1]);
    delivery.enqueue(edits.draftId, [event], []);
    delivery.closeDraft(edits.draftId);
    await delivery.flush();
    expect(sent).toHaveLength(2);
  });
  it("does not hold a send indefinitely when the telemetry connection stalls", async () => {
    vi.useFakeTimers();
    const delivery = new BatchDelivery(
      () => new Promise(() => {}),
      () => {},
    );
    const edits = new AppliedEdits();
    const event = edits.change("hello", {
      inputType: null,
      isComposing: null,
      isTrusted: null,
      inputMode: "unknown",
    });
    if (!event) throw new Error("Missing edit");
    delivery.enqueue(edits.draftId, [event], []);
    const pending = delivery.flushWithin(250);
    await vi.advanceTimersByTimeAsync(251);
    expect(await pending).toBe(false);
    delivery.closeDraft(edits.draftId);
    vi.useRealTimers();
  });
});
