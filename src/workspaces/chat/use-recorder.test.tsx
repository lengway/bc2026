import { StrictMode, useRef } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRecorder } from "./use-recorder";
import { api } from "@/app/_lib/api";
import type { EditorBatchData } from "@/contracts";

afterEach(() => vi.restoreAllMocks());
function RecorderHarness() {
  const root = useRef<HTMLDivElement>(null);
  const recorder = useRecorder(
    "00000000-0000-4000-8000-000000000001",
    root,
    true,
  );
  return (
    <div ref={root}>
      <textarea
        aria-label="Editor"
        onChange={recorder.change}
        onPaste={recorder.onPaste}
      />
      <button onClick={() => void recorder.flush()}>Flush</button>
      <span>{recorder.partial ? "partial" : "available"}</span>
    </div>
  );
}
it("preserves real edits across Strict Mode cleanup and records only applied composition", async () => {
  const batches: EditorBatchData[] = [];
  let release: (() => void) | undefined;
  vi.spyOn(api, "editorBatch").mockImplementation(async (_id, batch) => {
    batches.push(batch);
    if (batches.length === 1)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    return {
      acceptedCount: batch.events.length,
      lastDraftSeq: batch.events.at(-1)?.seq ?? 0,
      acceptedWindowCount: batch.interactionWindows?.length ?? 0,
    };
  });
  const mounted = render(
    <StrictMode>
      <RecorderHarness />
    </StrictMode>,
  );
  const editor = screen.getByLabelText("Editor");
  fireEvent.input(editor, {
    target: { value: "你好" },
    inputType: "insertCompositionText",
    isComposing: true,
  });
  fireEvent.click(screen.getByText("Flush"));
  await act(async () => release?.());
  await waitFor(() =>
    expect(batches.flatMap((batch) => batch.events)).toHaveLength(1),
  );
  expect(batches.flatMap((batch) => batch.events)[0]).toMatchObject({
    kind: "composition",
    insertedText: "你好",
    inputMode: "ime",
  });
  mounted.unmount();
});
