import Link from "next/link";
import type { SkillCertificateResponse, TrapResult } from "@/contracts";
import {
  FIELD_LABEL,
  formatDate,
  formatOutcome,
  formatSkill,
  formatAverageAccuracy,
} from "@/ui/lib/format";
import { VerifiedMark } from "@/ui/certificate-card";
import { MoveLabelBadge } from "@/ui/move-label-badge";
import { TrustCurveChart } from "@/ui/trust-curve-chart";

const TRAP_LABEL: Record<TrapResult, string> = {
  caught: "Copilot trap caught",
  missed: "Copilot trap missed",
  not_presented: "Copilot trap not presented",
  insufficient_evidence: "Copilot trap result unavailable",
};

export function SkillCertificateCard({
  certificate,
  titleAs: Title = "h1",
}: {
  certificate: SkillCertificateResponse;
  titleAs?: "h1" | "h2" | "h3";
}) {
  const ResultsTitle = Title === "h1" ? "h2" : Title === "h2" ? "h3" : "h4";
  const full = "keyMoves" in certificate;
  return (
    <article className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-card">
      <header className="space-y-4 border-b px-6 py-6 sm:px-8">
        <Title className="font-serif text-display-sm font-normal tracking-tight">
          Skill certificate
        </Title>
        <div className="flex flex-wrap items-center gap-2">
          <VerifiedMark>Verified</VerifiedMark>
          {certificate.isDemo && (
            <span className="inline-flex h-7 items-center rounded-md border bg-surface px-2.5 text-xs font-medium text-muted-foreground">
              Demo
            </span>
          )}
          {certificate.supersededBy && (
            <Link
              href={`/s/${certificate.supersededBy}`}
              className="text-sm underline underline-offset-4"
            >
              Superseded · View newer certificate
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-6 border-b px-6 py-8 sm:px-8">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Awarded to</p>
          <p className="font-serif text-display leading-none tracking-tight">
            {certificate.holderName}
          </p>
          <p>
            {formatSkill(certificate.skill)} · Level {certificate.level} ·{" "}
            {FIELD_LABEL[certificate.field]}
          </p>
          <p className="text-sm text-muted-foreground">
            Issued{" "}
            <time dateTime={certificate.issuedAt}>
              {formatDate(certificate.issuedAt)}
            </time>
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-mono text-xl">
            {formatAverageAccuracy(certificate.averageAccuracy)} average
            accuracy
          </p>
          {certificate.aiDependencyAverage !== null && (
            <p className="text-sm text-muted-foreground">
              {formatAverageAccuracy(certificate.aiDependencyAverage)} average
              Copilot text similarity
            </p>
          )}
        </div>
      </div>

      <section className="space-y-4 px-6 py-6 sm:px-8">
        <ResultsTitle className="text-sm font-medium">
          Qualifying case results
        </ResultsTitle>
        <ol className="divide-y">
          {certificate.cases.map((item) => {
            const move = full
              ? certificate.keyMoves.find(
                  (entry) => entry.caseId === item.caseId,
                )?.move
              : undefined;
            const curve = full
              ? certificate.trustCurves.find(
                  (entry) => entry.caseId === item.caseId,
                )?.points
              : undefined;
            const trap = certificate.trapResults.find(
              (entry) => entry.caseId === item.caseId,
            );
            return (
              <li key={item.caseId} className="space-y-3 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatOutcome(item.outcome)} ·{" "}
                      <time dateTime={item.completedAt}>
                        {formatDate(item.completedAt)}
                      </time>
                    </p>
                    {trap && (
                      <p className="text-xs text-muted-foreground">
                        {TRAP_LABEL[trap.trapResult]}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-sm">
                    {item.accuracy === null ? "Unscored" : `${item.accuracy}%`}
                  </span>
                </div>
                {move && (
                  <div className="space-y-2 rounded-md border bg-surface p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">Key move</p>
                      <MoveLabelBadge label={move.label} />
                    </div>
                    <blockquote className="border-l pl-3">
                      {move.userText}
                    </blockquote>
                    <p className="text-muted-foreground">{move.why}</p>
                  </div>
                )}
                {!!curve?.length && (
                  <TrustCurveChart
                    curve={curve}
                    moves={move ? [move] : []}
                    heightClassName="h-24"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </article>
  );
}
