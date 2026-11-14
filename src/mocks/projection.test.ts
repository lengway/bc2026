import { expect, it } from "vitest";
import { previewAssistance } from "./projection";
import { AppliedEdits } from "@/workspaces/chat/recorder";
import { makeCase, newEvent } from "./scenarios/sales";
it("counts unknown paste without calling it AI and retains only observed Copilot characters after editing", () => {
  const view = makeCase(),
    copilot = newEvent(view, [], {
      actor: "copilot",
      type: "copilot_reply",
      content: "Offer 30%",
    });
  const edits = new AppliedEdits();
  const meta = {
    inputType: "insertFromPaste",
    isComposing: false,
    isTrusted: true,
    inputMode: "keyboard" as const,
  };
  const first = edits.change("My own draft. ", meta);
  const insert = edits.change("My own draft. Offer 30%", {
    ...meta,
    explicitCopilot: true,
    sourceEventId: copilot.id,
  });
  const correction = edits.change("My own draft. Offer 10%", {
    ...meta,
    inputType: "insertText",
  });
  if (!first || !insert || !correction) throw new Error("Missing edits");
  const message = newEvent(view, [copilot], {
    actor: "user",
    type: "message",
    content: "My own draft. Offer 10%",
    draftId: edits.draftId,
  });
  const result = previewAssistance(
    [copilot, message],
    [
      {
        draftId: edits.draftId,
        batchId: crypto.randomUUID(),
        events: [first, insert, correction],
      },
    ],
  );
  expect(result).toMatchObject({
    unknownPasteCount: 1,
    unknownPasteChars: 14,
    knownCopilotRetainedChars: 8,
    observationStatus: "available",
  });
  expect(result.copilotRetainedPercent).toBe(35);
});
it("returns null attribution after a missing batch instead of zero", () => {
  const view = makeCase(),
    message = newEvent(view, [], {
      actor: "user",
      type: "message",
      content: "My work",
      draftId: crypto.randomUUID(),
    });
  const result = previewAssistance([message], []);
  expect(result.copilotRetainedPercent).toBeNull();
  expect(result.copilotTextSimilarityPercent).toBe(0);
  expect(result.observationStatus).toBe("unavailable");
});
