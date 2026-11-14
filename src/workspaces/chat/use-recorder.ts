"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import type { EditorEvent, InputMode } from "@/contracts";
import { api } from "@/app/_lib/api";
import {
  ActivityWindow,
  AppliedEdits,
  BatchDelivery,
  ClipboardEvidence,
} from "./recorder";

export function useRecorder(
  caseId: string,
  workspace: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const [partial, setPartial] = useState(false);
  const [mode, setMode] = useState<InputMode>("unknown");
  const [edits] = useState(() => new AppliedEdits());
  const [clipboard] = useState(() => new ClipboardEvidence());
  const [delivery] = useState(
    () =>
      new BatchDelivery(
        (batch, signal) => api.editorBatch(caseId, batch, signal),
        setPartial,
      ),
  );
  const buffer = useRef<EditorEvent[]>([]);
  const activity = useRef<ActivityWindow | null>(null);
  const paste = useRef<{ source: string | null } | null>(null);
  const lastKey = useRef(0);
  const paused = useRef(false);
  const gap = useCallback(
    (reason: string) => {
      activity.current?.gap(reason);
      delivery.markPartial();
    },
    [delivery],
  );
  const makeWindow = useCallback(
    () =>
      new ActivityWindow(
        Date.now(),
        typeof PointerEvent !== "undefined",
        typeof navigator !== "undefined" &&
          typeof navigator.webdriver === "boolean"
          ? navigator.webdriver
          : null,
      ),
    [],
  );
  const capture = useCallback(
    (window = false) => {
      const summary =
        window && activity.current ? activity.current.finish() : null;
      // Browser suspension can delay timers. Do not send a window the server rejects.
      if (summary && summary.durationMs > 10_000) {
        activity.current?.gap("interaction_window_exceeded_limit");
        delivery.markPartial();
      }
      delivery.enqueue(
        edits.draftId,
        buffer.current,
        summary && summary.durationMs <= 10_000 ? [summary] : [],
      );
      buffer.current = [];
    },
    [delivery, edits],
  );
  useEffect(() => {
    if (!enabled) return;
    const element = workspace.current;
    if (!element) return;
    const visible = () => document.visibilityState !== "hidden";
    activity.current = visible() ? makeWindow() : null;
    const summarize = () => {
      if (activity.current) {
        capture(true);
        void delivery.flush();
      }
    };
    // Flush edits and their interaction window together, leaving headroom under
    // the backend limit of 30 batches per minute for sends and visibility changes.
    const timer = setInterval(summarize, 5000);
    function visibility() {
      if (!visible()) {
        summarize();
        activity.current = null;
        clipboard.clear();
      } else if (!activity.current && !paused.current) {
        activity.current = makeWindow();
        activity.current.gap("background_activity_not_observed");
      }
    }
    const point = (
      kind: "move" | "down" | "click" | "wheel",
      event: MouseEvent | PointerEvent | WheelEvent,
    ) => {
      if (!visible() || !activity.current) return;
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) {
        activity.current.gap("workspace_geometry_unavailable");
        return;
      }
      const type = "pointerType" in event ? event.pointerType : "unknown";
      activity.current.pointer(
        kind,
        Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
        Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
        type,
        event.isTrusted,
      );
    };
    const move = (e: PointerEvent) => point("move", e),
      down = (e: PointerEvent) => point("down", e),
      click = (e: MouseEvent) => point("click", e),
      wheel = (e: WheelEvent) => point("wheel", e),
      focus = () => activity.current?.focus();
    const copy = () => {
      const selection = window.getSelection();
      const source =
        selection?.anchorNode?.parentElement?.closest<HTMLElement>(
          "[data-copy-source]",
        );
      const end =
        selection?.focusNode?.parentElement?.closest<HTMLElement>(
          "[data-copy-source]",
        );
      clipboard.remember(
        selection?.toString() ?? "",
        source && source === end ? (source.dataset.copySource ?? null) : null,
      );
    };
    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerdown", down, { passive: true });
    element.addEventListener("click", click);
    element.addEventListener("wheel", wheel, { passive: true });
    element.addEventListener("focusin", focus);
    element.addEventListener("focusout", focus);
    element.addEventListener("copy", copy);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("click", click);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("focusin", focus);
      element.removeEventListener("focusout", focus);
      element.removeEventListener("copy", copy);
      document.removeEventListener("visibilitychange", visibility);
      summarize();
      activity.current = null;
    };
  }, [enabled, workspace, makeWindow, capture, delivery, clipboard]);
  useEffect(
    () => () => {
      void delivery.flushWithin().finally(() => delivery.stop());
    },
    [delivery],
  );
  function change(event: ChangeEvent<HTMLTextAreaElement>) {
    const native = event.nativeEvent;
    const input = native instanceof InputEvent ? native : null;
    const inputMode =
      mode !== "unknown"
        ? mode
        : input?.isComposing
          ? "ime"
          : Date.now() - lastKey.current < 1000
            ? "keyboard"
            : "unknown";
    const observed = edits.change(event.target.value, {
      inputType: paste.current ? "insertFromPaste" : (input?.inputType ?? null),
      isComposing: input?.isComposing ?? null,
      isTrusted: native.isTrusted,
      inputMode,
      sourceEventId: paste.current?.source ?? null,
    });
    paste.current = null;
    if (observed) buffer.current.push(observed);
    activity.current?.input(native.isTrusted, Boolean(observed));
    if (buffer.current.length >= 100) {
      capture();
      void delivery.flush();
    }
  }
  function insert(value: string, source: string) {
    const observed = edits.change(value, {
      inputType: "insertReplacementText",
      isComposing: false,
      isTrusted: null,
      inputMode: mode,
      sourceEventId: source,
      explicitCopilot: true,
    });
    if (observed) buffer.current.push(observed);
    activity.current?.input(null, Boolean(observed));
  }
  return {
    partial,
    mode,
    setMode,
    edits,
    clipboard,
    change,
    insert,
    onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => {
      paste.current = {
        source: clipboard.sourceFor(event.clipboardData.getData("text/plain")),
      };
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!event.metaKey && !event.ctrlKey) lastKey.current = Date.now();
    },
    flush: async () => {
      capture(true);
      paused.current = true;
      activity.current = null;
      return delivery.flushWithin();
    },
    resume: () => {
      paused.current = false;
      activity.current =
        enabled && document.visibilityState !== "hidden" ? makeWindow() : null;
    },
    rotate: () => {
      delivery.closeDraft(edits.draftId);
      edits.rotate();
      paused.current = false;
      activity.current =
        enabled && document.visibilityState !== "hidden" ? makeWindow() : null;
    },
    gap,
  };
}
