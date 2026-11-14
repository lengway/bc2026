"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  useCase,
  useCaseEvents,
  useSendMove,
  useCopilot,
  useStartCase,
  useSubmitCase,
  type DisplayEvent,
} from "@/app/_hooks/case-hooks";
import type { MoveInput, CopilotInput } from "@/app/_lib/contracts";
import { ErrorPanel } from "@/app/_components/error-panel";
import { LoadingState } from "@/app/_components/providers";

export function CasePreview({ id }: { id: string }) {
  const query = useCase(id);
  const events = useCaseEvents(id);
  const start = useStartCase(id);
  const send = useSendMove(id);
  const copilot = useCopilot(id);
  const submit = useSubmitCase(id);
  const [draft, setDraft] = useState("");
  const [question, setQuestion] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const retryInput = useRef<MoveInput | null>(null);
  const retryQuestion = useRef<CopilotInput | null>(null);
  const router = useRouter();
  const busy = send.isPending || copilot.isPending || submit.isPending;
  const active = query.data?.status === "in_progress" && !send.data?.outcome;
  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy || !active) return;
    const input =
      retryInput.current?.text === text
        ? retryInput.current
        : {
            clientMsgId: crypto.randomUUID(),
            personaId:
              query.data && "personas" in query.data
                ? (query.data.personas[0]?.id ?? "dana")
                : "dana",
            draftId,
            text,
          };
    retryInput.current = input;
    send.mutate(input, {
      onSuccess: () => {
        setDraft("");
        retryInput.current = null;
        setDraftId(crypto.randomUUID());
      },
    });
  }
  function askCopilot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim() || busy || !active) return;
    const text = question.trim();
    const input =
      retryQuestion.current?.text === text
        ? retryQuestion.current
        : { clientMsgId: crypto.randomUUID(), text };
    retryQuestion.current = input;
    copilot.mutate(input, {
      onSuccess: () => {
        setQuestion("");
        retryQuestion.current = null;
      },
    });
  }
  const retryMessage = (event: DisplayEvent) => {
    if (!event.clientMsgId || busy || !active) return;
    send.mutate(
      {
        clientMsgId: event.clientMsgId,
        personaId: event.personaId ?? "dana",
        draftId: event.draftId,
        text: event.content,
      },
      {
        onSuccess: () => {
          if (draft.trim() === event.content) setDraft("");
          retryInput.current = null;
          setDraftId(crypto.randomUUID());
        },
      },
    );
  };
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const view = query.data;
  if (view.status === "generating")
    return <LoadingState label="Preparing your practice case…" />;
  if (!("brief" in view))
    return (
      <section className="stack">
        <h1>We couldn&apos;t prepare this case</h1>
        <Link href="/dashboard">Return to practice</Link>
      </section>
    );
  const transcript = (events.data ?? []).filter(
    (event) =>
      event.type !== "copilot_prompt" && event.type !== "copilot_reply",
  );
  const assistance = (events.data ?? []).filter(
    (event) =>
      event.type === "copilot_prompt" || event.type === "copilot_reply",
  );
  return (
    <div className="stack">
      <div className="stack tight">
        <p className="eyebrow">
          Sales practice · {Math.round(view.brief.timeLimitSec / 60)} minutes
        </p>
        <h1>{view.brief.title}</h1>
        <p className="muted">{view.brief.mission}</p>
      </div>
      {events.streamError && (
        <ErrorPanel error={events.streamError} retry={events.reconnect} />
      )}
      {view.status === "ready" && (
        <section className="panel stack">
          <h2>Your brief</h2>
          <p>
            <strong>Your role:</strong> {view.brief.yourRole}
          </p>
          <p>
            <strong>A useful outcome:</strong> {view.brief.successLooksLike}
          </p>
          <details>
            <summary>How scoring works</summary>
            <p>{view.scoringGuide.accuracyFormula}</p>
            <p>{view.scoringGuide.observationNotice}</p>
            <p>Allowed tools: {view.scoringGuide.allowedTools.join(", ")}</p>
          </details>
          <div>
            <button onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending ? "Starting…" : "Start case"}
            </button>
          </div>
          {start.isError && (
            <ErrorPanel error={start.error} retry={() => start.mutate()} />
          )}
        </section>
      )}
      {view.status !== "ready" && (
        <>
          {!active && (
            <div role="status" className="notice">
              This conversation has ended.{" "}
              <Link href={`/review/${id}`}>Open your review</Link>
            </div>
          )}
          <div className="workspace">
            <aside className="panel stack tight" aria-label="Case documents">
              <h2>Documents</h2>
              {view.docs.map((doc) => (
                <details key={doc.id}>
                  <summary>{doc.title}</summary>
                  <pre className="document">
                    {typeof doc.content === "string"
                      ? doc.content
                      : JSON.stringify(doc.content, null, 2)}
                  </pre>
                </details>
              ))}
            </aside>
            <section className="panel stack chat-panel">
              <div>
                <h2>Dana Whitfield</h2>
                <p className="muted">
                  Operations Director · Brightline Logistics
                </p>
              </div>
              <div
                role="log"
                aria-label="Conversation with Dana"
                aria-live="polite"
                aria-relevant="additions text"
                className="conversation"
              >
                {transcript.length === 0 && (
                  <p className="muted">
                    Dana is ready. Start the conversation when you are.
                  </p>
                )}
                {transcript.map((event) => (
                  <div
                    key={event.id}
                    className={`message ${event.actor === "user" ? "user" : ""}`}
                  >
                    <small>
                      {event.actor === "user"
                        ? "You"
                        : event.actor === "persona"
                          ? "Dana"
                          : "Case update"}
                      {event.delivery === "pending" ? " · Sending…" : ""}
                    </small>
                    <p>{event.content}</p>
                    {event.delivery === "failed" && (
                      <button
                        className="secondary"
                        disabled={busy || !active}
                        onClick={() => retryMessage(event)}
                      >
                        Retry message
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {send.isPending && (
                <p role="status" className="muted">
                  Dana is typing…
                </p>
              )}
              <form className="stack tight" onSubmit={sendMessage}>
                <div>
                  <label htmlFor="message">Message Dana</label>
                  <textarea
                    id="message"
                    maxLength={5000}
                    value={draft}
                    disabled={!active || busy}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Write your response…"
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                  />
                </div>
                <div className="actions">
                  <button disabled={!active || busy || !draft.trim()}>
                    Send message
                  </button>
                  <small className="muted">
                    Enter to send · Shift+Enter for a new line
                  </small>
                </div>
              </form>
              {send.isError && <ErrorPanel error={send.error} />}
            </section>
            <aside className="panel stack" aria-label="Copilot">
              <div>
                <h2>Copilot</h2>
                <p className="muted">
                  Copilot is allowed. We review how you check and use its
                  advice.
                </p>
              </div>
              <div
                role="log"
                aria-label="Copilot conversation"
                aria-live="polite"
                className="conversation"
              >
                {assistance.map((event) => (
                  <div className="message" key={event.id}>
                    <small>
                      {event.type === "copilot_prompt" ? "You" : "Copilot"}
                    </small>
                    <p>{event.content}</p>
                  </div>
                ))}
              </div>
              <form className="stack tight" onSubmit={askCopilot}>
                <div>
                  <label htmlFor="copilot-question">Ask Copilot</label>
                  <textarea
                    id="copilot-question"
                    maxLength={5000}
                    value={question}
                    disabled={!active || busy}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="What should I pay attention to?"
                  />
                </div>
                <button disabled={!active || busy || !question.trim()}>
                  {copilot.isPending ? "Thinking…" : "Ask Copilot"}
                </button>
              </form>
              {copilot.isError && <ErrorPanel error={copilot.error} />}
            </aside>
          </div>
          <div className="actions">
            <button
              className="secondary"
              disabled={!active || busy}
              onClick={() => setConfirm(true)}
            >
              Submit case
            </button>
            <Link href="/dashboard">Back to practice</Link>
          </div>
        </>
      )}
      <Dialog.Root open={confirm} onOpenChange={setConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title>Finish this conversation?</Dialog.Title>
            <Dialog.Description>
              You won&apos;t be able to send more messages after submitting.
              Your review will explain each move.
            </Dialog.Description>
            <div className="actions">
              <button
                disabled={submit.isPending}
                onClick={() =>
                  submit.mutate(undefined, {
                    onSuccess: () => router.push(`/review/${id}`),
                  })
                }
              >
                {submit.isPending ? "Submitting…" : "Submit for review"}
              </button>
              <Dialog.Close
                className="button secondary"
                disabled={submit.isPending}
              >
                Keep practicing
              </Dialog.Close>
            </div>
            {submit.isError && <ErrorPanel error={submit.error} />}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
