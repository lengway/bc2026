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

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
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

it("keeps editing and interaction windows within the server rate after tab visibility changes", async () => {
  vi.useFakeTimers();
  const batches: EditorBatchData[] = [];
  vi.spyOn(api, "editorBatch").mockImplementation(async (_id, batch) => {
    batches.push(batch);
    return {
      acceptedCount: batch.events.length,
      lastDraftSeq: batch.events.at(-1)?.seq ?? 0,
      acceptedWindowCount: batch.interactionWindows?.length ?? 0,
    };
  });
  const mounted = render(<RecorderHarness />);
  const editor = screen.getByLabelText("Editor");
  const visibility = vi
    .spyOn(document, "visibilityState", "get")
    .mockReturnValue("visible");
  for (let second = 1; second <= 60; second++) {
    fireEvent.input(editor, {
      target: { value: "a".repeat(second) },
      inputType: "insertText",
    });
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    if (second === 5) {
      visibility.mockReturnValue("hidden");
      fireEvent(document, new Event("visibilitychange"));
      visibility.mockReturnValue("visible");
      fireEvent(document, new Event("visibilitychange"));
    }
  }
  expect(batches.length).toBeLessThanOrEqual(30);
  expect(batches.flatMap((batch) => batch.events)).toHaveLength(60);
  expect(
    batches.flatMap((batch) => batch.interactionWindows ?? []).length,
  ).toBeGreaterThan(0);
  mounted.unmount();
});

it("drops an oversized interaction window without blocking its editor events", async () => {
  vi.useFakeTimers();
  const batches: EditorBatchData[] = [];
  vi.spyOn(api, "editorBatch").mockImplementation(async (_id, batch) => {
    batches.push(batch);
    return {
      acceptedCount: batch.events.length,
      lastDraftSeq: batch.events.at(-1)?.seq ?? 0,
      acceptedWindowCount: batch.interactionWindows?.length ?? 0,
    };
  });
  const mounted = render(<RecorderHarness />);
  vi.setSystemTime(Date.now() + 11_000);
  fireEvent.input(screen.getByLabelText("Editor"), {
    target: { value: "After browser suspension" },
    inputType: "insertText",
  });
  fireEvent.click(screen.getByText("Flush"));
  await act(async () => {});
  expect(batches.flatMap((batch) => batch.interactionWindows ?? [])).toEqual(
    [],
  );
  expect(batches.flatMap((batch) => batch.events)).toHaveLength(1);
  expect(screen.getByText("partial")).toBeInTheDocument();
  mounted.unmount();
});
