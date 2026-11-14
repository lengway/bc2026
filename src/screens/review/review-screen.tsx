"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type {
  PublicEvaluation as Evaluation,
  MoveReview,
  PersonaPublic,
  CertificateTranscriptEvent,
} from "@/contracts";
import {
  AccuracyStat,
  LabelCounts,
  MoveDetail,
  MoveTimeline,
  OutcomeBadge,
  StepChecklist,
  TrustCurveChart,
  type ChecklistStep,
} from "@/ui";
import { Button } from "@/ui/primitives/button";
import { Skeleton } from "@/ui/primitives/skeleton";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/ui/primitives/sheet";
import { ReviewReplay } from "./review-replay";

type ReviewAnalyzingProps = {
  state: "analyzing";
  caseTitle: string;
  steps?: ReadonlyArray<ChecklistStep>;
};
type ReviewReadyProps = {
  state: "ready";
  caseTitle: string;
  persona: PersonaPublic;
  evaluation: Evaluation;
  moves: ReadonlyArray<MoveReview>;
  transcript?: ReadonlyArray<CertificateTranscriptEvent>;
  defaultSelectedSeq?: number;
  onShare?: () => void;
  sharePending?: boolean;
  onNextCase?: () => void;
};
export type ReviewScreenProps = ReviewAnalyzingProps | ReviewReadyProps;
const desktopQuery = "(min-width: 1024px)";
function subscribeDesktop(listener: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
const desktopSnapshot = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia(desktopQuery).matches;
const mobileSnapshot = () => false;

const DEFAULT_ANALYZING_STEPS: ReadonlyArray<ChecklistStep> = [
  { id: "read", label: "Reading the conversation", status: "done" },
  {
    id: "label",
    label: "Labeling each move",
    status: "active",
    detail: "Comparing your moves with the key moments of the case",
  },
  { id: "ai", label: "Reviewing observed assistance", status: "pending" },
  { id: "write", label: "Writing the review", status: "pending" },
];

function ReviewAnalyzing({
  caseTitle,
  steps = DEFAULT_ANALYZING_STEPS,
}: ReviewAnalyzingProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-10">
      <header className="flex flex-col gap-2">
        <p className="m-0 font-mono text-xs tracking-wider text-muted-foreground uppercase">
          Case review
        </p>
        <h1 className="m-0 text-2xl font-medium tracking-tight">{caseTitle}</h1>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section aria-live="polite" className="rounded-xl border bg-card p-6">
          <h2 className="m-0 text-base font-medium">Analyzing your moves…</h2>
          <p className="m-0 mt-1 mb-6 text-sm text-muted-foreground">
            This usually takes under a minute. You can stay on this page.
          </p>
          <StepChecklist steps={steps} />
        </section>

        <div aria-hidden="true" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end gap-8 rounded-xl border bg-card p-5">
            <Skeleton className="h-16 w-36" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <Skeleton className="h-44 w-full" />
          </div>
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-5">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}

function ReviewReady({
  caseTitle,
  persona,
  evaluation,
  moves,
  transcript = [],
  defaultSelectedSeq,
  onShare,
  sharePending = false,
  onNextCase,
}: ReviewReadyProps) {
  const [selectedSeq, setSelectedSeq] = useState(
    defaultSelectedSeq ?? evaluation.topMoves[0]?.seq ?? moves[0]?.seq ?? null,
  );
  const [allMovesOpen, setAllMovesOpen] = useState(false);
  const allMovesButton = useRef<HTMLButtonElement>(null);
  const desktop = useSyncExternalStore(
    subscribeDesktop,
    desktopSnapshot,
    mobileSnapshot,
  );
  const sheetOpen = !desktop && allMovesOpen;
  const selectedIndex = Math.max(
    0,
    moves.findIndex((move) => move.seq === selectedSeq),
  );
  const selectedMove = moves[selectedIndex];
  const trustBefore =
    selectedIndex > 0 ? moves[selectedIndex - 1].trustAfter : null;
  const hasScore =
    moves.some((move) => move.assessmentStatus === "assessed") &&
    evaluation.accuracy !== null;
  const trap =
    evaluation.trapResult === "caught" || evaluation.trapResult === "missed"
      ? evaluation.trapResult
      : null;
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        sheetOpen
      )
        return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"]',
        )
      )
        return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!moves.length) return;
      event.preventDefault();
      const index = Math.max(
        0,
        Math.min(
          moves.length - 1,
          selectedIndex + (event.key === "ArrowRight" ? 1 : -1),
        ),
      );
      setSelectedSeq(moves[index].seq);
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [sheetOpen, moves, selectedIndex]);
  function select(seq: number) {
    setSelectedSeq(seq);
    setAllMovesOpen(false);
  }
  const detail = selectedMove ? (
    <MoveDetail
      move={selectedMove}
      moveNumber={selectedIndex + 1}
      totalMoves={moves.length}
      personaName={persona.name}
      trustBefore={trustBefore}
      showUserText={false}
      showEvidence={false}
    />
  ) : null;
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0 space-y-2">
          <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
            Case review
          </p>
          <h1 className="text-2xl font-medium tracking-tight">{caseTitle}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasScore && onNextCase && (
            <Button variant="outline" onClick={onNextCase}>
              Next case
            </Button>
          )}
          {onShare && (
            <Button disabled={sharePending} onClick={onShare}>
              {sharePending ? "Preparing certificate" : "Share certificate"}
            </Button>
          )}
        </div>
      </header>
      {hasScore ? (
        <section
          aria-label="Result"
          className="space-y-4 rounded-xl border bg-card p-5 sm:p-6"
        >
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <AccuracyStat accuracy={evaluation.accuracy} size="lg" />
            <div className="space-y-3">
              <OutcomeBadge outcome={evaluation.outcome} />
              <LabelCounts counts={evaluation.labelCounts} />
            </div>
          </div>
          <p className="max-w-prose text-sm leading-relaxed">
            {evaluation.summary}
          </p>
          {(evaluation.aiDependency !== null || trap) && (
            <p className="text-xs text-muted-foreground">
              {evaluation.aiDependency !== null &&
                `AI dependency ${evaluation.aiDependency}%`}
              {evaluation.aiDependency !== null && trap && " · "}
              {trap && `Copilot trap ${trap}`}
            </p>
          )}
        </section>
      ) : (
        <section
          aria-label="Result"
          className="space-y-4 rounded-xl border bg-surface p-5 sm:p-6"
        >
          <p className="text-base font-medium">
            We couldn’t score this case. Your conversation is saved below.
          </p>
          {onNextCase && <Button onClick={onNextCase}>Try a new case</Button>}
        </section>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(20rem,1fr)]">
        <ReviewReplay
          transcript={transcript}
          moves={moves}
          selectedIndex={selectedIndex}
          personaName={persona.name}
          onSelect={select}
          mobileDetail={desktop ? undefined : detail}
          allMovesButtonRef={allMovesButton}
          onAllMoves={
            desktop || !moves.length ? undefined : () => setAllMovesOpen(true)
          }
        />
        {desktop && (
          <aside className="min-w-0 space-y-5">
            <section aria-label="Selected move" className="space-y-3">
              <h2 className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
                Current move
              </h2>
              {detail ?? (
                <p className="text-sm text-muted-foreground">
                  No moves to review.
                </p>
              )}
            </section>
            <section aria-label="All moves" className="space-y-3">
              <h2 className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
                All moves
              </h2>
              <div className="max-h-80 overflow-y-auto">
                <MoveTimeline
                  moves={moves}
                  selectedSeq={selectedMove?.seq}
                  onSelectMove={select}
                />
              </div>
            </section>
          </aside>
        )}
      </div>
      <section
        aria-label="Trust curve"
        className="space-y-4 rounded-xl border bg-card p-5 sm:p-6"
      >
        <h2 className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
          Trust through the conversation
        </h2>
        <TrustCurveChart
          curve={evaluation.trustCurve}
          moves={moves}
          selectedSeq={selectedMove?.seq}
          onSelectMove={select}
          personaName={persona.name}
        />
      </section>
      <details className="rounded-xl border bg-card px-5 py-4 text-sm">
        <summary className="min-h-7 cursor-pointer font-medium">
          How this was scored
        </summary>
        <div className="mt-3 max-w-prose space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Each assessed message gets a label, from Brilliant to Blunder.
            Accuracy is the average of those labels’ points.
          </p>
          <p>Messages without enough evidence to judge are not counted.</p>
          <p>AI dependency describes how closely your text followed Copilot.</p>
        </div>
      </details>
      <Sheet open={sheetOpen} onOpenChange={setAllMovesOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[80dvh] overflow-y-auto p-5"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            setAllMovesOpen(false);
            allMovesButton.current?.focus({ preventScroll: true });
          }}
        >
          <SheetTitle>All moves</SheetTitle>
          <SheetDescription>
            Choose a move to jump to that point in the conversation.
          </SheetDescription>
          <MoveTimeline
            moves={moves}
            selectedSeq={selectedMove?.seq}
            onSelectMove={select}
          />
        </SheetContent>
      </Sheet>
    </main>
  );
}
export function ReviewScreen(props: ReviewScreenProps) {
  return props.state === "analyzing" ? (
    <ReviewAnalyzing {...props} />
  ) : (
    <ReviewReady key={props.evaluation.caseId} {...props} />
  );
}
