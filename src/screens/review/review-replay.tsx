"use client";

import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Mail,
} from "lucide-react";
import { useEffect, useRef, type ReactNode, type Ref } from "react";
import type { CertificateTranscriptEvent, MoveReview } from "@/contracts";
import { ChatMessage, MoveLabelBadge } from "@/ui";
import { useReducedMotion } from "@/ui/lib/use-reduced-motion";
import { cn } from "@/ui/lib/utils";
import { Button } from "@/ui/primitives/button";

type Props = {
  transcript: ReadonlyArray<CertificateTranscriptEvent>;
  moves: ReadonlyArray<MoveReview>;
  selectedIndex: number;
  personaName: string;
  onSelect: (seq: number) => void;
  mobileDetail?: ReactNode;
  onAllMoves?: () => void;
  allMovesButtonRef?: Ref<HTMLButtonElement>;
};

export function ReviewReplay({
  transcript,
  moves,
  selectedIndex,
  personaName,
  onSelect,
  mobileDetail,
  onAllMoves,
  allMovesButtonRef,
}: Props) {
  const selected = moves[selectedIndex];
  const rows = useRef(new Map<string, HTMLLIElement>());
  const reducedMotion = useReducedMotion();
  const reviews = new Map(moves.map((move) => [move.eventId, move]));
  const dialogue = transcript
    .filter(
      (event) =>
        event.type === "twist" ||
        (event.type === "message" &&
          (event.actor === "user" || event.actor === "persona")),
    )
    .toSorted((a, b) => a.seq - b.seq);
  useEffect(() => {
    if (!selected) return;
    const frame = requestAnimationFrame(() =>
      rows.current.get(selected.eventId)?.scrollIntoView?.({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "nearest",
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [selected, reducedMotion]);
  const first = selectedIndex <= 0 || !selected;
  const last = selectedIndex >= moves.length - 1 || !selected;
  return (
    <section
      aria-label="Conversation replay"
      className="flex min-w-0 flex-col rounded-xl border bg-card"
    >
      <header className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <h2 className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
          Conversation
        </h2>
        <span className="text-xs text-muted-foreground">
          You and {personaName}
        </span>
      </header>
      {dialogue.length ? (
        <ol
          className="m-0 min-h-60 list-none space-y-5 p-3 sm:p-5 lg:h-[min(65dvh,42rem)] lg:overflow-y-auto"
          aria-label="Recorded conversation"
        >
          {dialogue.map((event) => {
            const move = reviews.get(event.id);
            const current = selected?.eventId === event.id;
            const future = selected ? event.seq > selected.seq : false;
            return (
              <li
                key={event.id}
                ref={(element) => {
                  if (element) rows.current.set(event.id, element);
                  else rows.current.delete(event.id);
                }}
                data-event-id={event.id}
                data-selected={current}
                data-future={future}
                className={cn(
                  "scroll-m-4 scroll-mb-36 lg:scroll-mb-4 rounded-lg border border-transparent p-2 transition-opacity motion-reduce:transition-none",
                  current && "border-ink-border bg-ink-soft",
                  future &&
                    "text-muted-foreground [&_[data-actor]_p]:text-muted-foreground [&_[data-actor]_span]:text-muted-foreground [&_[data-actor]_p.border]:border-border [&_[data-actor]_p.border]:bg-surface",
                )}
              >
                {event.type === "twist" ? (
                  <div className="flex gap-3 rounded-lg border bg-surface p-4 text-sm">
                    <Mail
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                      strokeWidth={1.5}
                    />
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        New information
                      </p>
                      <p className="whitespace-pre-wrap">{event.content}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {move && (
                      <button
                        type="button"
                        aria-label={`Select move ${moves.indexOf(move) + 1}`}
                        aria-current={current ? "step" : undefined}
                        onClick={() => onSelect(move.seq)}
                        className="mb-2 ml-auto flex min-h-11 items-center gap-2 rounded-md px-2 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Move {moves.indexOf(move) + 1}
                        <MoveLabelBadge
                          label={
                            move.assessmentStatus === "assessed"
                              ? move.label
                              : null
                          }
                          variant="glyph"
                        />
                      </button>
                    )}
                    <ChatMessage
                      actor={event.actor}
                      content={event.content}
                      authorName={
                        event.actor === "persona" ? personaName : undefined
                      }
                    />
                  </>
                )}
                {current && mobileDetail && (
                  <details key={event.id} open className="mt-4">
                    <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
                      This move
                    </summary>
                    {mobileDetail}
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="p-6 text-sm text-muted-foreground">
          No conversation messages were recorded for this case.
        </div>
      )}
      <nav
        aria-label="Replay controls"
        className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-b-xl border-t bg-card px-3 py-3 sm:px-5 lg:static"
      >
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            className="min-h-11 min-w-11"
            variant="ghost"
            aria-label="First move"
            disabled={first}
            onClick={() => onSelect(moves[0].seq)}
          >
            <ChevronFirst aria-hidden="true" strokeWidth={1.5} />
          </Button>
          <Button
            size="icon"
            className="min-h-11 min-w-11"
            variant="outline"
            aria-label="Previous move"
            disabled={first}
            onClick={() => onSelect(moves[selectedIndex - 1].seq)}
          >
            <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
          </Button>
        </div>
        <span
          role="status"
          aria-label="Move position"
          aria-live="polite"
          className="font-mono text-sm tabular-nums"
        >
          {selected ? selectedIndex + 1 : 0} / {moves.length}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            className="min-h-11 min-w-11"
            variant="outline"
            aria-label="Next move"
            disabled={last}
            onClick={() => onSelect(moves[selectedIndex + 1].seq)}
          >
            <ChevronRight aria-hidden="true" strokeWidth={1.5} />
          </Button>
          <Button
            size="icon"
            className="min-h-11 min-w-11"
            variant="ghost"
            aria-label="Last move"
            disabled={last}
            onClick={() => onSelect(moves[moves.length - 1].seq)}
          >
            <ChevronLast aria-hidden="true" strokeWidth={1.5} />
          </Button>
        </div>
        {onAllMoves && (
          <Button
            ref={allMovesButtonRef}
            variant="outline"
            className="min-h-11 w-full"
            onClick={onAllMoves}
          >
            All moves
          </Button>
        )}
      </nav>
    </section>
  );
}
