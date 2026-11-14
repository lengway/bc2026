import type {
  AssistanceProfile,
  AiUseSkill,
  AiUseSkillSummary,
  ScoringSummary,
  ScoreAudit,
  ScoreEvidence,
  ProcessObservations,
  TrapResult,
} from "@/contracts";
import { Button } from "@/ui/primitives/button";

export const trapLabels: Record<TrapResult, string> = {
  caught: "Caught",
  missed: "Missed",
  not_presented: "Not presented",
  insufficient_evidence: "Not enough evidence",
};
export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | null;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs leading-relaxed text-muted-foreground">{label}</dt>
      <dd className="font-mono text-xl tracking-tight">
        {value === null ? (
          <span className="font-sans text-sm">Not enough evidence</span>
        ) : (
          `${value}%`
        )}
        {hint && (
          <p className="mt-1 font-sans text-xs leading-relaxed tracking-normal text-muted-foreground">
            {hint}
          </p>
        )}
      </dd>
    </div>
  );
}
export function EvidenceList({
  evidence,
  onOpen,
  available,
}: {
  evidence: ReadonlyArray<ScoreEvidence>;
  onOpen?: (item: ScoreEvidence) => void;
  available?: (item: ScoreEvidence) => boolean;
}) {
  if (!evidence.length)
    return (
      <p className="text-xs text-muted-foreground">
        No supporting evidence was supplied.
      </p>
    );
  return (
    <ul className="space-y-3">
      {evidence.map((item, index) => (
        <li
          key={`${item.sourceId}-${index}`}
          className="rounded-lg border bg-surface p-3"
        >
          <blockquote className="whitespace-pre-wrap text-sm leading-relaxed">
            “{item.quote}”
          </blockquote>
          <p className="mt-2 text-xs text-muted-foreground">
            {item.explanation}
          </p>
          {onOpen &&
          item.source !== "editor_aggregate" &&
          (!available || available(item)) ? (
            <Button
              size="sm"
              variant="link"
              className="mt-1 h-auto px-0"
              onClick={() => onOpen(item)}
            >
              View {item.source === "case_doc" ? "document" : "message"}
            </Button>
          ) : (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              {item.source === "editor_aggregate"
                ? "Editing summary · no raw drafts"
                : item.source === "case_doc"
                  ? "Document quotation"
                  : "Recorded message"}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
export function AssistanceDetails({
  assistance,
}: {
  assistance: AssistanceProfile;
}) {
  return (
    <section
      aria-label="Observed assistance"
      className="space-y-5 rounded-xl border bg-card p-5 sm:p-6"
    >
      <div>
        <h2 className="text-base font-medium">Observed assistance</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          What was observed in this workspace. Help itself is not a penalty.
        </p>
      </div>
      <dl className="grid gap-5 sm:grid-cols-2">
        <Metric
          label="Text retained from observed Copilot insertions"
          value={assistance.copilotRetainedPercent}
        />
        <Metric
          label="Similarity to earlier Copilot replies"
          value={assistance.copilotTextSimilarityPercent}
          hint="Similarity is not proof of a transfer or authorship."
        />
        <div>
          <dt className="text-xs text-muted-foreground">Copilot requests</dt>
          <dd className="mt-1 font-mono text-xl">
            {assistance.copilotRequests}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Pastes with an unknown source
          </dt>
          <dd className="mt-1 font-mono text-xl">
            {assistance.unknownPasteCount}
            <span className="ml-2 text-xs text-muted-foreground">
              {assistance.unknownPasteChars} characters
            </span>
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Observation coverage:{" "}
        <span className="capitalize">{assistance.observationStatus}</span>.{" "}
        {assistance.observedInputModes.length > 0
          ? `Observed input modes: ${assistance.observedInputModes.join(", ")}.`
          : "Input mode was not observed."}
      </p>
      {assistance.limitations.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          {assistance.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function AiUseDetails({
  skill,
  trap,
  onEvidence,
  available,
}: {
  skill: AiUseSkill | AiUseSkillSummary;
  trap?: TrapResult;
  onEvidence?: (item: ScoreEvidence) => void;
  available?: (item: ScoreEvidence) => boolean;
}) {
  return (
    <section
      aria-label="Checking and applying AI advice"
      className="space-y-5 rounded-xl border bg-card p-5 sm:p-6"
    >
      <h2 className="text-base font-medium">Checking and applying AI advice</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Metric label="Evidence-based check score" value={skill.score} />
        <div>
          <dt className="text-xs text-muted-foreground">Coverage</dt>
          <dd className="mt-1 font-mono text-xl">
            {skill.assessedChecks} / {skill.applicableChecks}
            <span className="ml-2 font-sans text-xs text-muted-foreground">
              checks assessed
            </span>
          </dd>
        </div>
      </dl>
      {trap && (
        <p className="text-sm">
          Copilot trap:{" "}
          <strong className="font-medium">{trapLabels[trap]}</strong>
        </p>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Not observed and not applicable checks are not failures.{" "}
        {skill.earnedPoints} points earned out of {skill.assessedMaxPoints}{" "}
        assessed points; {skill.applicableMaxPoints} applicable points in total.
      </p>
      {"checks" in skill &&
        skill.checks.map((check) => (
          <details key={check.id} className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm">
              <span className="font-medium">
                {check.criterionId.replaceAll("_", " ")}
              </span>
              <span className="ml-2 text-xs capitalize text-muted-foreground">
                {check.status.replaceAll("_", " ")}
              </span>
            </summary>
            <p className="my-3 text-sm text-muted-foreground">{check.reason}</p>
            <EvidenceList
              evidence={check.evidence}
              onOpen={onEvidence}
              available={available}
            />
          </details>
        ))}
    </section>
  );
}
export function ScoreExplanation({
  summary,
}: {
  summary: ScoringSummary | ScoreAudit;
}) {
  return (
    <details className="rounded-xl border bg-card p-5 sm:p-6">
      <summary className="cursor-pointer text-base font-medium">
        Why this score?
      </summary>
      <div className="mt-5 space-y-5">
        <p className="text-sm">
          Assessment coverage:{" "}
          <strong className="font-medium capitalize">
            {summary.completionStatus.replaceAll("_", " ")}
          </strong>
        </p>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Assessed moves</dt>
            <dd className="mt-1 font-mono">
              {summary.scoredMoveCount} / {summary.totalUserMoveCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Saved points</dt>
            <dd className="mt-1 font-mono">
              {summary.pointsSum} / {summary.maxPoints}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Case level</dt>
            <dd className="mt-1 capitalize">{summary.caseLevel}</dd>
          </div>
        </dl>
        <div className="rounded-lg bg-surface p-4">
          <p className="mb-2 text-xs text-muted-foreground">
            Saved calculation
          </p>
          <p className="break-words font-mono text-sm">{summary.formula}</p>
        </div>
        {"labelPoints" in summary && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Points for each move label</caption>
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="pb-3 font-normal">
                    Label
                  </th>
                  <th scope="col" className="pb-3 text-right font-normal">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.labelPoints).map(([label, points]) => (
                  <tr key={label} className="border-t">
                    <td className="py-2 capitalize">{label}</td>
                    <td className="py-2 text-right font-mono">{points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {"criterionCoverage" in summary &&
          summary.criterionCoverage.length > 0 && (
            <ul className="space-y-2 text-sm">
              {summary.criterionCoverage.map((c) => (
                <li
                  className="flex flex-wrap justify-between gap-3 border-b pb-2"
                  key={c.criterionId}
                >
                  <span>{c.criterionId.replaceAll("_", " ")}</span>
                  <span className="text-xs capitalize text-muted-foreground">
                    {c.status.replaceAll("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          {summary.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="break-words font-mono text-[10px] leading-relaxed text-muted-foreground">
          Rubric {summary.rubricVersion} · Model {summary.scorerModel} · Prompt{" "}
          {summary.scorerPromptVersion}
        </p>
      </div>
    </details>
  );
}
export function ActivityObservations({
  observations,
}: {
  observations: ProcessObservations;
}) {
  return (
    <details className="rounded-xl border bg-card p-5 sm:p-6">
      <summary className="cursor-pointer text-base font-medium">
        Activity observations
      </summary>
      <div className="mt-5 space-y-4">
        <p className="text-sm capitalize">
          {observations.automationStatus.replaceAll("_", " ")}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          These observations do not establish authorship or identity and do not
          reduce the case score. Touch, keyboard-only and assistive input are
          normal modes.
        </p>
        {observations.signals.map((signal, index) => (
          <div
            key={`${signal.code}-${index}`}
            className="rounded-lg border p-4 text-sm"
          >
            <h3 className="font-medium">{signal.explanation}</h3>
            <p className="my-2 break-words font-mono text-xs">
              Observed value: {JSON.stringify(signal.observedValue)}
            </p>
            <p className="text-xs text-muted-foreground">
              Limitation: {signal.limitation}
            </p>
          </div>
        ))}
        {observations.textFeatures.length > 0 && (
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm">
              Descriptive text characteristics
            </summary>
            <p className="my-3 text-xs text-muted-foreground">
              Punctuation, spelling and edits do not reveal where a thought
              originated. Editor deletions are not spelling errors.
            </p>
            <ul className="space-y-2 text-xs">
              {observations.textFeatures.map((item, index) => (
                <li key={item.messageId}>
                  Message {index + 1}: {item.charCount} characters,{" "}
                  {item.listMarkerCount} list markers. Recorded edits:{" "}
                  {item.editCount ?? "not observed"}.{" "}
                  {item.languageIssues
                    ? `${item.languageIssues.count} language observations (${item.languageIssues.method}, ${item.languageIssues.version}).`
                    : "Language issues were not assessed."}
                </li>
              ))}
            </ul>
          </details>
        )}
        <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
          {observations.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="font-mono text-[10px] text-muted-foreground">
          Observation status: {observations.observationStatus} · Method{" "}
          {observations.rulesVersion}
        </p>
      </div>
    </details>
  );
}
