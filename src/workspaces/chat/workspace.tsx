"use client";
import "./workspace.css";
import type { WorkspacePlugin } from "../types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  FileText,
  MessageSquare,
  Send,
  ArrowDown,
  ArrowLeft,
  Check,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import type { CaseView, CopilotInput, MoveInput, Outcome } from "@/contracts";
import {
  CaseTimer,
  ChatMessage,
  DocViewer,
  Meter,
  PersonaCard,
  TypingIndicator,
  TwistNotice,
  firstName,
  formatOutcome,
} from "@/ui";
import { Button } from "@/ui/primitives/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/ui/primitives/sheet";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/ui/primitives/dialog";
import { inputClass } from "@/app/_components/product";
import { ErrorPanel } from "@/app/_components/error-panel";
import {
  useCaseEvents,
  useSendMove,
  useCopilot,
  useSubmitCase,
  type DisplayEvent,
} from "@/app/_hooks/case-hooks";
import { recordDocumentOpen } from "@/app/_lib/integration-api";
import { useDeadline } from "./deadline";
import { useRecorder } from "./use-recorder";

type CopilotPanelProps = {
  events: DisplayEvent[];
  question: string;
  pending: boolean;
  disabled: boolean;
  id: string;
  onQuestion: (text: string) => void;
  onSend: () => void;
  onCopy: (event: DisplayEvent) => void;
  onInsert: (event: DisplayEvent) => void;
  onRetry: (event: DisplayEvent) => void;
  error: Error | null;
};
function CopilotPanel({
  events,
  question,
  pending,
  disabled,
  id,
  onQuestion,
  onSend,
  onCopy,
  onInsert,
  onRetry,
  error,
}: CopilotPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="space-y-2 border-b p-4">
        <h2 className="text-sm font-medium">Copilot</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Copilot is allowed. We review how you check and use its advice.
        </p>
      </header>
      <div
        role="log"
        aria-label="Copilot conversation"
        aria-live="polite"
        aria-relevant="additions text"
        className="min-h-24 flex-1 space-y-5 overflow-y-auto p-4"
      >
        {events.length === 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ask for another perspective. Verify facts against your documents
            before using a suggestion.
          </p>
        )}
        {events.map((event) => (
          <div
            key={event.id}
            data-copy-source={
              event.type === "copilot_reply" ? event.id : undefined
            }
            className="space-y-2 [overflow-wrap:anywhere]"
          >
            <ChatMessage
              actor={event.actor}
              content={event.content}
              pending={event.delivery === "pending"}
            />
            {event.type === "copilot_reply" && (
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => onCopy(event)}>
                  <Copy aria-hidden="true" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  onClick={() => onInsert(event)}
                >
                  Insert into reply
                </Button>
              </div>
            )}
            {event.delivery === "failed" && (
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onRetry(event)}
              >
                Retry question
              </Button>
            )}
          </div>
        ))}
        {pending && (
          <p role="status" className="text-xs text-muted-foreground">
            Thinking…
          </p>
        )}
      </div>
      <form
        className="grid gap-3 border-t p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        <label className="text-xs font-medium" htmlFor={id}>
          Ask Copilot
        </label>
        <textarea
          id={id}
          rows={3}
          className={inputClass}
          value={question}
          maxLength={5000}
          disabled={disabled}
          onChange={(e) => onQuestion(e.target.value)}
          placeholder="What should I verify?"
        />
        <Button disabled={disabled || !question.trim()} type="submit">
          {pending ? "Thinking…" : "Ask Copilot"}
        </Button>
        {error && <ErrorPanel error={error} />}
      </form>
    </div>
  );
}

export function ChatWorkspace({ caseView: view }: { caseView: CaseView }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement | null>(null);
  const editor = useRef<HTMLTextAreaElement | null>(null);
  const log = useRef<HTMLDivElement | null>(null);
  const nearBottom = useRef(true);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const bindRoot = useCallback((node: HTMLDivElement | null) => {
    root.current = node;
    setHost(node);
  }, []);
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const focusEditor = useRef(false);
  const [selectedDoc, setSelectedDoc] = useState(view.docs[0]?.id ?? null);
  const [openedDocs, setOpenedDocs] = useState<Set<string>>(
    () => new Set(view.docs[0] ? [view.docs[0].id] : []),
  );
  const remaining = useDeadline(view.startedAt, view.brief.timeLimitSec);
  const active =
    view.status === "in_progress" &&
    remaining !== null &&
    remaining > 0 &&
    !outcome;
  const recorder = useRecorder(view.id, root, active);
  const send = useSendMove(view.id, recorder.flush);
  const copilot = useCopilot(view.id);
  const submit = useSubmitCase(view.id, recorder.flush);
  const events = useCaseEvents(view.id);
  const pending = send.isPending || copilot.isPending || submit.isPending;
  const busy = !active || pending;
  const [retryInput, setRetryInput] = useState<MoveInput | null>(null);
  const retryQuestion = useRef<CopilotInput | null>(null);
  const autoSubmitted = useRef(false);
  const noticedTwists = useRef(new Set<string>());
  const persona = view.personas[0];
  const name = persona?.name ?? "Your counterpart";
  const transcript = events.data.filter(
    (e) => e.type === "message" || e.type === "twist" || e.type === "submit",
  );
  const assistance = events.data.filter(
    (e) => e.type === "copilot_prompt" || e.type === "copilot_reply",
  );
  const failedMessage = transcript.find(
    (event) =>
      event.actor === "user" &&
      event.delivery === "failed" &&
      event.clientMsgId,
  );
  // The server can publish a user event before the response-generating operation
  // finishes. A delivered event does not resolve a failed mutation's exact retry.
  const failedMove = send.isError ? retryInput : null;
  const replyLocked = Boolean(failedMove || failedMessage);
  const trust =
    send.data?.trust ??
    [...events.data].reverse().find((e) => e.meta.trustAfter !== undefined)
      ?.meta.trustAfter;
  const selected =
    view.docs.find((doc) => doc.id === selectedDoc) ?? view.docs[0];
  const visibleDocument = useRef<string | null>(null);
  const documentId = selected?.id;
  const reportGap = recorder.gap;
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const observe = () => {
      const visible =
        active &&
        document.visibilityState !== "hidden" &&
        (desktop.matches || documentsOpen);
      if (!visible) {
        visibleDocument.current = null;
        return;
      }
      if (documentId && visibleDocument.current !== documentId) {
        visibleDocument.current = documentId;
        void recordDocumentOpen(view.id, documentId).catch(() =>
          reportGap("document_open_transport_unavailable"),
        );
      }
    };
    observe();
    desktop.addEventListener("change", observe);
    document.addEventListener("visibilitychange", observe);
    return () => {
      desktop.removeEventListener("change", observe);
      document.removeEventListener("visibilitychange", observe);
    };
  }, [active, documentId, documentsOpen, view.id, reportGap]);
  const newDocs = view.docs.filter(
    (doc) => doc.arrivesAtTurn !== null && !openedDocs.has(doc.id),
  );
  useEffect(() => {
    if (nearBottom.current && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [events.data, send.isPending]);
  useEffect(() => {
    for (const event of events.data)
      if (event.type === "twist" && !noticedTwists.current.has(event.id)) {
        noticedTwists.current.add(event.id);
        toast("New information arrived", { description: event.content });
      }
  }, [events.data]);
  useEffect(() => {
    if ((remaining === 0 || outcome) && !autoSubmitted.current) {
      autoSubmitted.current = true;
      submit.mutate(undefined, {
        onSuccess: () => router.replace(`/review/${view.id}`),
      });
    }
  }, [remaining, outcome, submit, router, view.id]);
  function finish() {
    submit.mutate(undefined, {
      onSuccess: () => router.replace(`/review/${view.id}`),
    });
  }
  function sendReply(input?: MoveInput) {
    if (busy || (!draft.trim() && !input && !replyLocked)) return;
    const failedInput = failedMessage?.clientMsgId
      ? {
          text: failedMessage.content,
          clientMsgId: failedMessage.clientMsgId,
          draftId: failedMessage.draftId,
          personaId: failedMessage.personaId ?? persona?.id ?? "dana",
        }
      : null;
    const move = input ??
      retryInput ??
      failedInput ?? {
        text: draft,
        clientMsgId: crypto.randomUUID(),
        draftId: recorder.edits.draftId,
        personaId: persona?.id ?? "dana",
      };
    setRetryInput(move);
    send.mutate(move, {
      onSuccess: (result) => {
        setDraft("");
        setRetryInput(null);
        recorder.rotate();
        setOutcome(result.outcome);
        if (!result.outcome) {
          nearBottom.current = true;
          requestAnimationFrame(() => {
            if (log.current) log.current.scrollTop = log.current.scrollHeight;
            editor.current?.focus();
          });
        }
      },
      // A failed response may already have closed this draft on the server.
      // Keep observations paused until the same request succeeds and rotates it.
    });
  }
  function ask(input?: CopilotInput) {
    if (busy || replyLocked || (!question.trim() && !input)) return;
    const text = question.trim();
    const request =
      input ??
      (retryQuestion.current?.text === text
        ? retryQuestion.current
        : { text, clientMsgId: crypto.randomUUID() });
    retryQuestion.current = request;
    copilot.mutate(request, {
      onSuccess: () => {
        if (!input || question.trim() === request.text) setQuestion("");
        retryQuestion.current = null;
      },
    });
  }
  async function copy(event: DisplayEvent) {
    try {
      await navigator.clipboard.writeText(event.content);
      recorder.clipboard.remember(event.content, event.id);
      toast("Copied. Nothing is inserted until you paste.");
    } catch {
      toast("Select the text to copy it with your keyboard.");
    }
  }
  function insert(event: DisplayEvent) {
    if (busy || replyLocked) return;
    const node = editor.current;
    const start = node?.selectionStart ?? draft.length,
      end = node?.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + event.content + draft.slice(end);
    if (next.length > 5000) {
      toast("Your reply can contain up to 5,000 characters.");
      return;
    }
    recorder.insert(next, event.id);
    setDraft(next);
    focusEditor.current = true;
    setCopilotOpen(false);
    requestAnimationFrame(() => {
      node?.focus();
      node?.setSelectionRange(
        start + event.content.length,
        start + event.content.length,
      );
    });
  }
  function openDoc(id: string) {
    setSelectedDoc(id);
    setOpenedDocs((previous) => new Set([...previous, id]));
    if (window.matchMedia("(max-width: 1023px)").matches)
      setDocumentsOpen(true);
  }
  const documents = (suffix: string) => (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b p-4">
        <h2 className="mb-3 text-sm font-medium">Documents</h2>
        <div role="group" aria-label="Case documents" className="grid gap-1">
          {view.docs.map((doc) => (
            <button
              aria-pressed={selected?.id === doc.id}
              aria-controls={`document-panel-${suffix}`}
              key={doc.id}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-md px-3 text-left text-xs focus-visible:ring-2 focus-visible:ring-ring ${selected?.id === doc.id ? "bg-ink-soft text-ink" : "text-muted-foreground hover:bg-muted"}`}
              onClick={() => openDoc(doc.id)}
            >
              {doc.title}
              {newDocs.some((item) => item.id === doc.id) && (
                <span className="font-mono text-[10px]">New</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div
        id={`document-panel-${suffix}`}
        role="region"
        aria-label={selected?.title ?? "Document"}
        className="min-h-0 flex-1 overflow-auto p-4"
      >
        {selected ? (
          <DocViewer doc={selected} isNew={false} />
        ) : (
          <p className="text-sm text-muted-foreground">
            No documents have been added to this case.
          </p>
        )}
      </div>
    </div>
  );
  const copilotProps = {
    events: assistance,
    question,
    pending: copilot.isPending,
    disabled: busy || replyLocked,
    onQuestion: setQuestion,
    onSend: () => ask(),
    onCopy: copy,
    onInsert: insert,
    onRetry: (event: DisplayEvent) => {
      if (event.clientMsgId)
        ask({ text: event.content, clientMsgId: event.clientMsgId });
    },
    error: copilot.error,
  };
  return (
    <main data-workspace="chat" className="flex min-h-0 flex-1 flex-col">
      <div ref={bindRoot} className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <div className="min-w-0 space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Sales · {view.type} case
            </p>
            <h1 className="text-lg font-medium tracking-tight">
              {view.brief.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {remaining !== null ? (
              <CaseTimer remainingSec={remaining} />
            ) : (
              <span role="alert" className="text-xs text-destructive">
                Timer unavailable. Refresh to reconnect.
              </span>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Submit case
            </Button>
          </div>
        </header>
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDocumentsOpen(true)}
          >
            <FileText aria-hidden="true" />
            Documents
            {newDocs.length > 0 && (
              <span className="font-mono">({newDocs.length} new)</span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCopilotOpen(true)}
          >
            <MessageSquare aria-hidden="true" />
            Copilot
          </Button>
        </div>
        {(remaining === 0 || outcome) && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 border-b bg-surface px-5 py-3 text-sm"
          >
            <p>
              {remaining === 0
                ? "Time is up. Your conversation has ended."
                : outcome === "left"
                  ? `${firstName(name)} left the conversation.`
                  : formatOutcome(outcome ?? "incomplete")}
            </p>
            <span className="text-muted-foreground">
              {submit.isError
                ? "Your review could not be requested yet."
                : "Preparing your review…"}
            </span>
            {submit.isError && (
              <Button size="sm" onClick={finish}>
                Retry submission
              </Button>
            )}
          </div>
        )}
        {events.streamError && (
          <div className="px-4">
            <ErrorPanel error={events.streamError} retry={events.reconnect} />
          </div>
        )}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(15rem,.85fr)_minmax(0,1.8fr)_minmax(17rem,1fr)]">
          <aside
            aria-label="Case documents"
            className="hidden min-h-0 border-r bg-surface lg:block"
          >
            {documents("desktop")}
          </aside>
          <section aria-label="Conversation" className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              {persona && <PersonaCard persona={persona} variant="compact" />}
              {trust !== undefined && (
                <div className="hidden w-28 shrink-0 sm:block">
                  <Meter label="Simulated trust" value={trust} />
                </div>
              )}
            </div>
            <div
              ref={log}
              role="log"
              aria-label={`Conversation with ${firstName(name)}`}
              aria-live="polite"
              aria-relevant="additions text"
              onScroll={() => {
                const element = log.current;
                if (element)
                  nearBottom.current =
                    element.scrollHeight -
                      element.scrollTop -
                      element.clientHeight <
                    100;
              }}
              className="min-h-56 max-h-[45dvh] flex-1 space-y-5 lg:min-h-0 lg:max-h-none overflow-y-auto p-4 sm:p-6"
            >
              {transcript.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {firstName(name)} is ready. Open the conversation in your own
                  words.
                </p>
              )}
              {transcript.map((event) =>
                event.type === "twist" ? (
                  <TwistNotice
                    key={event.id}
                    kind="email"
                    from="Your case team"
                    content={event.content}
                    onOpen={
                      event.meta.documentIds?.[0]
                        ? () => openDoc(event.meta.documentIds![0])
                        : undefined
                    }
                  />
                ) : (
                  <div
                    key={event.id}
                    className="space-y-2 [overflow-wrap:anywhere]"
                  >
                    <ChatMessage
                      actor={event.actor}
                      authorName={
                        event.actor === "persona" ? firstName(name) : undefined
                      }
                      content={event.content}
                      pending={event.delivery === "pending"}
                    />
                    {event.delivery === "failed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => sendReply(retryInput ?? undefined)}
                      >
                        <RotateCcw aria-hidden="true" />
                        Retry message
                      </Button>
                    )}
                  </div>
                ),
              )}
              {send.isPending && <TypingIndicator name={name} />}
            </div>
            <div className="flex justify-end px-3">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (log.current)
                    log.current.scrollTop = log.current.scrollHeight;
                  nearBottom.current = true;
                }}
              >
                <ArrowDown aria-hidden="true" />
                Latest messages
              </Button>
            </div>
            <form
              className="space-y-3 border-t p-4"
              onSubmit={(event) => {
                event.preventDefault();
                sendReply();
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium" htmlFor="reply">
                  Message {firstName(name)}
                </label>
                <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  Input mode
                  <select
                    aria-label="Input mode"
                    className="min-h-9 rounded border bg-background px-2 text-xs"
                    value={recorder.mode}
                    onChange={(event) => {
                      const mode = event.target.value;
                      if (
                        mode === "unknown" ||
                        mode === "keyboard" ||
                        mode === "dictation" ||
                        mode === "assistive"
                      )
                        recorder.setMode(mode);
                    }}
                  >
                    <option value="unknown">Not specified</option>
                    <option value="keyboard">Keyboard</option>
                    <option value="dictation">Dictation</option>
                    <option value="assistive">Assistive input</option>
                  </select>
                </label>
              </div>
              <textarea
                ref={editor}
                id="reply"
                className={`${inputClass} min-h-28 resize-y`}
                maxLength={5000}
                value={failedMove?.text ?? failedMessage?.content ?? draft}
                disabled={busy}
                readOnly={replyLocked}
                onChange={(event) => {
                  if (replyLocked) return;
                  recorder.change(event);
                  setDraft(event.target.value);
                }}
                onPaste={recorder.onPaste}
                onKeyDown={(event) => {
                  recorder.onKeyDown(event);
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing &&
                    event.keyCode !== 229
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder="Write your response…"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  Enter to send · Shift+Enter for a new line
                </p>
                <Button
                  disabled={busy || (!draft.trim() && !replyLocked)}
                  type="submit"
                >
                  <Send aria-hidden="true" />
                  {send.isPending
                    ? "Sending…"
                    : replyLocked
                      ? "Retry message"
                      : "Send message"}
                </Button>
              </div>
              {send.isError && <ErrorPanel error={send.error} />}
              <p
                role="status"
                className="text-[11px] leading-relaxed text-muted-foreground"
              >
                {recorder.partial
                  ? "Some editing activity could not be recorded. You can continue your case."
                  : "Editing activity and workspace interaction summaries are being recorded."}
              </p>
            </form>
          </section>
          <aside
            aria-label="Copilot"
            className="hidden min-h-0 border-l bg-surface lg:block"
          >
            <CopilotPanel {...copilotProps} id="copilot-desktop" />
          </aside>
        </div>
        <Sheet open={documentsOpen} onOpenChange={setDocumentsOpen}>
          <SheetContent
            portalContainer={host ?? undefined}
            side="left"
            className="w-[min(100%,26rem)] max-w-none gap-0 p-0"
          >
            <SheetHeader className="border-b p-4">
              <SheetTitle>Case documents</SheetTitle>
              <SheetDescription>
                Use the source material to check your assumptions.
              </SheetDescription>
            </SheetHeader>
            {documents("mobile")}
          </SheetContent>
        </Sheet>
        <Sheet open={copilotOpen} onOpenChange={setCopilotOpen}>
          <SheetContent
            portalContainer={host ?? undefined}
            className="w-[min(100%,26rem)] max-w-none gap-0 p-0"
            onCloseAutoFocus={(event) => {
              if (focusEditor.current) {
                event.preventDefault();
                editor.current?.focus();
                focusEditor.current = false;
              }
            }}
          >
            <SheetHeader className="border-b p-4">
              <SheetTitle>Copilot workspace</SheetTitle>
              <SheetDescription>
                Help is allowed. Check it before you act.
              </SheetDescription>
            </SheetHeader>
            <CopilotPanel {...copilotProps} id="copilot-mobile" />
          </SheetContent>
        </Sheet>
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent>
            <DialogTitle>Finish this conversation?</DialogTitle>
            <DialogDescription>
              You won’t be able to send more messages after submitting. Your
              review will explain what was observed.
            </DialogDescription>
            {submit.isError && <ErrorPanel error={submit.error} />}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={submit.isPending}>
                  <ArrowLeft aria-hidden="true" />
                  Keep practicing
                </Button>
              </DialogClose>
              <Button disabled={submit.isPending} onClick={finish}>
                <Check aria-hidden="true" />
                {submit.isPending ? "Submitting…" : "Submit for review"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
export const chatWorkspacePlugin = {
  id: "chat",
  Component: ChatWorkspace,
} satisfies WorkspacePlugin;
