import type { PublicEvaluation, MoveReview, PersonaPublic } from "@/contracts";
import { trapLabels } from "@/ui/scoring-details";
import {
  AccuracyStat,
  LabelCounts,
  MoveLabelBadge,
  TrustCurveChart,
  formatOutcome,
} from "@/ui";
import { cn } from "@/ui/lib/utils";

export type ReviewPreviewData = {
  caseTitle: string;
  /** Short public reference, e.g. "7F3K-2291". */
  reference: string;
  persona: PersonaPublic;
  evaluation: PublicEvaluation;
  moves: ReadonlyArray<MoveReview>;
};

type ReviewPreviewProps = ReviewPreviewData & { className?: string };

/** A compact, read-only review for the landing hero. Real components on fixture data. */
export function ReviewPreview({
  caseTitle,
  reference,
  persona,
  evaluation,
  moves,
  className,
}: ReviewPreviewProps) {
  return (
    <figure
      aria-label="Example of a case review"
      className={cn("m-0 rounded-xl border bg-card shadow-raised", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-3.5 text-[13px]">
        <p className="m-0 min-w-0 truncate">
          <span className="font-semibold">Review</span>
          <span className="text-muted-foreground"> · {caseTitle}</span>
        </p>
        <span className="font-mono text-xs text-muted-foreground">
          {reference}
        </span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 pt-5 pb-4">
        <AccuracyStat
          accuracy={evaluation.accuracy}
          animate
          size="lg"
          label={`Accuracy · ${evaluation.scoreAudit.completionStatus.replaceAll("_", " ")}`}
        />
        <dl className="m-0 grid grid-cols-[auto_auto] gap-x-5 gap-y-1.5 text-[13px]">
          <dt className="text-muted-foreground">Outcome</dt>
          <dd className="m-0 text-right font-medium">
            {formatOutcome(evaluation.outcome)}
          </dd>
          <dt className="text-muted-foreground">Copilot text similarity</dt>
          <dd className="m-0 text-right font-mono tabular-nums">
            {evaluation.assistance.copilotTextSimilarityPercent === null
              ? "Not enough evidence"
              : `${evaluation.assistance.copilotTextSimilarityPercent}%`}
          </dd>
          <dt className="text-muted-foreground">Copilot trap</dt>
          <dd className="m-0 text-right font-medium">
            {trapLabels[evaluation.trapResult]}
          </dd>
        </dl>
      </div>

      <LabelCounts counts={evaluation.labelCounts} className="px-5 pb-4" />

      <div className="border-t px-5 pt-4 pb-3">
        <TrustCurveChart
          curve={evaluation.trustCurve}
          moves={moves}
          personaName={persona.name}
          heightClassName="h-32"
        />
      </div>

      <ol
        aria-label="Key moves"
        className="m-0 list-none divide-y border-t p-0 text-[13px]"
      >
        {evaluation.topMoves.map((move) => {
          const moveNumber = moves.findIndex((m) => m.seq === move.seq) + 1;
          return (
            <li
              key={move.eventId}
              className="grid grid-cols-[1.25rem_2.25rem_minmax(0,1fr)] items-center gap-2.5 px-5 py-2.5"
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {moveNumber > 0 ? moveNumber : ""}
              </span>
              <MoveLabelBadge
                label={move.label}
                variant="glyph"
                size="sm"
                className="justify-self-start"
              />
              <span className="truncate">{move.userText}</span>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
