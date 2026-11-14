"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
import { useState } from "react";
import type {
  PublicEvaluation as Evaluation,
  MoveReview,
  PersonaPublic,
  ScoreEvidence,
  CaseDoc,
  ProcessObservations,
} from "@/contracts";
import {
  AccuracyStat,
  LabelCounts,
  Meter,
  MoveDetail,
  MoveTimeline,
  OutcomeBadge,
  PersonaCard,
  StepChecklist,
  TrustCurveChart,
  formatSkill,
  type ChecklistStep,
} from "@/ui";
import { cn } from "@/ui/lib/utils";
import { Button } from "@/ui/primitives/button";
import { Skeleton } from "@/ui/primitives/skeleton";
import {
  AssistanceDetails,
  AiUseDetails,
  ScoreExplanation,
  ActivityObservations,
} from "@/ui/scoring-details";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/ui/primitives/dialog";
import { DocViewer } from "@/ui/doc-viewer";

type ReviewAnalyzingProps = {
  state: "analyzing";
  caseTitle: string;
  /** Progress of the evaluation. Defaults to a generic four-step list. */
  steps?: ReadonlyArray<ChecklistStep>;
};

type ReviewReadyProps = {
  state: "ready";
  caseTitle: string;
  persona: PersonaPublic;
  evaluation: Evaluation;
  observations?: ProcessObservations;
  events?: ReadonlyArray<{ id: string; content: string }>;
  docs?: ReadonlyArray<CaseDoc>;
  moves: ReadonlyArray<MoveReview>;
  /** Which move is open first. Defaults to the first key move. */
  defaultSelectedSeq?: number;
  onShare?: () => void;
  /** Disables Share while the certificate is being issued. */
  sharePending?: boolean;
  onNextCase?: () => void;
};

export type ReviewScreenProps = ReviewAnalyzingProps | ReviewReadyProps;

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

function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)}>
      {title ? (
        <h2 className="m-0 mb-4 text-xs font-medium text-muted-foreground">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

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
  observations,
  events = [],
  docs = [],
  moves,
  defaultSelectedSeq,
  onShare,
  sharePending = false,
  onNextCase,
}: ReviewReadyProps) {
  const initialSeq =
    defaultSelectedSeq ?? evaluation.topMoves[0]?.seq ?? moves[0]?.seq ?? null;
  const [selectedSeq, setSelectedSeq] = useState<number | null>(initialSeq);

  const foundIndex = moves.findIndex((move) => move.seq === selectedSeq);
  const selectedIndex = foundIndex === -1 ? 0 : foundIndex;
  const selectedMove = moves[selectedIndex];
  const trustBefore =
    selectedIndex > 0 ? moves[selectedIndex - 1].trustAfter : null;
  const [evidence, setEvidence] = useState<ScoreEvidence | null>(null);
  const available = (item: ScoreEvidence) =>
    item.source === "case_doc"
      ? docs.some((doc) => doc.id === item.sourceId)
      : events.some((event) => event.id === item.sourceId);
  const selectedDoc =
    evidence?.source === "case_doc"
      ? docs.find((doc) => doc.id === evidence.sourceId)
      : undefined;
  const selectedEvent =
    evidence && evidence.source !== "case_doc"
      ? events.find((event) => event.id === evidence.sourceId)
      : undefined;

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {onNextCase ? (
        <Button variant="outline" size="lg" onClick={onNextCase}>
          Next case
        </Button>
      ) : null}
      {onShare ? (
        <Button size="lg" disabled={sharePending} onClick={onShare}>
          {sharePending ? "Preparing certificate" : "Share certificate"}
        </Button>
      ) : null}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="m-0 font-mono text-xs tracking-wider text-muted-foreground uppercase">
              Case review
            </p>
            <h1 className="m-0 text-2xl font-medium tracking-tight">
              {caseTitle}
            </h1>
            <PersonaCard persona={persona} variant="compact" className="mt-1" />
          </div>
          {actions}
        </header>

        <section
          aria-label="Result"
          className="grid gap-x-10 gap-y-6 rounded-xl border bg-card p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,18rem)]"
        >
          <div className="flex flex-col items-start gap-4">
            <AccuracyStat accuracy={evaluation.accuracy} animate size="xl" />
            <OutcomeBadge outcome={evaluation.outcome} />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <LabelCounts counts={evaluation.labelCounts} variant="full" />
            <p className="m-0 max-w-prose text-[15px] leading-relaxed">
              {evaluation.summary}
            </p>
          </div>

          <div className="space-y-3 lg:border-l lg:pl-8">
            <h2 className="text-sm font-medium">Case performance</h2>
            <p className="text-sm capitalize">
              {evaluation.scoreAudit.completionStatus.replaceAll("_", " ")}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {evaluation.scoreAudit.scoredMoveCount} of{" "}
              {evaluation.scoreAudit.totalUserMoveCount} moves assessed. A short
              or partial conversation does not establish complete skill
              coverage.
            </p>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <AssistanceDetails assistance={evaluation.assistance} />
          <AiUseDetails
            skill={evaluation.aiUseSkill}
            trap={evaluation.trapResult}
            onEvidence={setEvidence}
            available={available}
          />
        </div>
        <Panel>
          <TrustCurveChart
            curve={evaluation.trustCurve}
            moves={moves.filter((move) => move.assessmentStatus === "assessed")}
            selectedSeq={selectedSeq}
            onSelectMove={setSelectedSeq}
            personaName={persona.name}
            heightClassName="h-56"
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Trust is the counterpart’s simulated reaction, not independent
            evidence of your score.
          </p>
        </Panel>

        {selectedMove ? (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <section aria-label="All moves" className="flex flex-col gap-3">
              <h2 className="m-0 text-xs font-medium text-muted-foreground">
                Moves · {moves.length}
              </h2>
              <MoveTimeline
                moves={moves}
                selectedSeq={selectedMove.seq}
                onSelectMove={setSelectedSeq}
              />
            </section>

            <section aria-label="Selected move" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className="m-0 text-xs font-medium text-muted-foreground">
                  Selected move
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Previous move"
                    disabled={selectedIndex === 0}
                    onClick={() => setSelectedSeq(moves[selectedIndex - 1].seq)}
                  >
                    <ChevronLeft aria-hidden="true" strokeWidth={1.5} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Next move"
                    disabled={selectedIndex === moves.length - 1}
                    onClick={() => setSelectedSeq(moves[selectedIndex + 1].seq)}
                  >
                    <ChevronRight aria-hidden="true" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
              <motion.div
                key={selectedMove.seq}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <MoveDetail
                  move={selectedMove}
                  onEvidence={setEvidence}
                  available={available}
                  moveNumber={selectedIndex + 1}
                  totalMoves={moves.length}
                  personaName={persona.name}
                  trustBefore={trustBefore}
                />
              </motion.div>
            </section>
          </div>
        ) : (
          <Panel>
            <p className="m-0 text-sm text-muted-foreground">
              No moves were made in this case, so there is nothing to review.
            </p>
          </Panel>
        )}

        <ScoreExplanation summary={evaluation.scoreAudit} />
        {observations && <ActivityObservations observations={observations} />}
        <Dialog
          open={Boolean(evidence)}
          onOpenChange={(open) => {
            if (!open) setEvidence(null);
          }}
        >
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
            <DialogTitle>
              {selectedDoc?.title ?? "Recorded message"}
            </DialogTitle>
            <DialogDescription>{evidence?.explanation}</DialogDescription>
            {selectedDoc ? (
              <DocViewer doc={selectedDoc} />
            ) : (
              <p className="whitespace-pre-wrap rounded-lg border bg-surface p-4 text-sm leading-relaxed">
                {selectedEvent?.content ?? evidence?.quote}
              </p>
            )}
          </DialogContent>
        </Dialog>
        {evaluation.skills.length > 0 ? (
          <Panel title="Skills in this case">
            <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {evaluation.skills.map((entry) => (
                <Meter
                  key={entry.skill}
                  label={formatSkill(entry.skill)}
                  value={entry.score}
                />
              ))}
            </div>
          </Panel>
        ) : null}

        {onShare || onNextCase ? (
          <footer className="flex flex-wrap items-center justify-between gap-4 border-t pt-6">
            <p className="m-0 max-w-prose text-sm text-muted-foreground">
              Your certificate is a link. Anyone you send it to sees the result
              of this case.
            </p>
            {actions}
          </footer>
        ) : null}
      </main>
    </MotionConfig>
  );
}

/**
 * The review of one case: accuracy, trust curve, every move with its label.
 * Presentational — the container loads the data and handles share / next.
 */
export function ReviewScreen(props: ReviewScreenProps) {
  return props.state === "analyzing" ? (
    <ReviewAnalyzing {...props} />
  ) : (
    <ReviewReady {...props} />
  );
}
