import {
  AssistanceProfile,
  type EditorBatch,
  type PublicEvent,
} from "@/contracts";
/** A deterministic preview projection, never imported by the product scoring path.
 * Real retained-character attribution and all evaluative checks belong to the backend.
 */
export function previewAssistance(
  events: PublicEvent[],
  batches: EditorBatch[],
) {
  const submitted = events.filter(
    (event) => event.actor === "user" && event.type === "message",
  );
  const edits = [
    ...new Map(
      batches
        .flatMap((batch) => batch.events)
        .map((event) => [event.id, event]),
    ).values(),
  ];
  const replies = events.filter((event) => event.type === "copilot_reply");
  let retained = 0,
    covered = 0;
  for (const message of submitted) {
    const draft = edits
      .filter((event) => event.draftId === message.draftId)
      .sort((a, b) => a.seq - b.seq);
    let text = "";
    const sources: boolean[] = [];
    let contiguous = true;
    for (const [index, edit] of draft.entries()) {
      if (
        edit.seq !== index + 1 ||
        edit.rangeStart > text.length ||
        edit.rangeEnd > text.length ||
        edit.rangeEnd < edit.rangeStart
      ) {
        contiguous = false;
        break;
      }
      const known = Boolean(
        edit.sourceEventId &&
        replies.some(
          (reply) => reply.id === edit.sourceEventId && reply.seq < message.seq,
        ),
      );
      text =
        text.slice(0, edit.rangeStart) +
        edit.insertedText +
        text.slice(edit.rangeEnd);
      sources.splice(
        edit.rangeStart,
        edit.rangeEnd - edit.rangeStart,
        ...Array.from({ length: edit.insertedText.length }, () => known),
      );
    }
    if (draft.length && contiguous && text.trim() === message.content) {
      covered++;
      const leading = text.length - text.trimStart().length;
      retained += sources
        .slice(leading, leading + message.content.length)
        .filter(Boolean).length;
    }
  }
  const total = submitted.reduce((sum, event) => sum + event.content.length, 0);
  const complete = submitted.length > 0 && covered === submitted.length;
  const unknown = edits.filter(
    (event) => event.kind === "paste" && !event.sourceEventId,
  );
  const requests = events.filter(
    (event) => event.type === "copilot_prompt",
  ).length;
  return AssistanceProfile.parse({
    copilotRequests: requests,
    knownCopilotRetainedChars: retained,
    totalSubmittedChars: total,
    copilotRetainedPercent:
      complete && total ? Math.round((retained / total) * 100) : null,
    copilotTextSimilarityPercent: total && !requests ? 0 : null,
    unknownPasteCount: unknown.length,
    unknownPasteChars: unknown.reduce(
      (sum, event) => sum + event.insertedText.length,
      0,
    ),
    observedInputModes: [...new Set(edits.map((event) => event.inputMode))],
    observationStatus: complete
      ? "available"
      : edits.length
        ? "partial"
        : "unavailable",
    limitations: [
      "Preview-only editing projection; real analysis is performed by the backend.",
      ...(!complete
        ? [
            "Editing history is incomplete or unavailable. Missing evidence is not a zero score.",
          ]
        : []),
      ...(requests
        ? ["Text similarity is not calculated in this preview."]
        : []),
      "An unknown paste source does not imply AI use.",
    ],
  });
}
