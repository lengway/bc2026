"use client";

import { ShieldCheck } from "lucide-react";
import { useReducedMotion } from "@/ui/lib/use-reduced-motion";
import type { CertificateFull, CertificateLimited } from "@/contracts";
import { AccuracyStat } from "@/ui/accuracy-stat";
import {
  FIELD_LABEL,
  LEVEL_LABEL,
  formatDate,
  formatOutcome,
  formatSkill,
} from "@/ui/lib/format";
import { cn } from "@/ui/lib/utils";
import { MoveLabelBadge } from "@/ui/move-label-badge";
import { BorderBeam } from "@/ui/primitives/border-beam";
import { Button } from "@/ui/primitives/button";
import { TrustCurveChart } from "@/ui/trust-curve-chart";

type CertificateCardProps = {
  certificate: CertificateLimited | CertificateFull;
  /** Issuer name shown on the document. */
  issuer?: string;
  /** Public address of this certificate, shown so a reader can check it. */
  verifyUrl?: string;
  /** Heading level of the document title. Use "h1" on the certificate page. */
  titleAs?: "h1" | "h2";
  onShare?: () => void;
  /** Full certificates only. */
  onViewFullReview?: () => void;
  className?: string;
};

export function isFullCertificate(
  certificate: CertificateLimited | CertificateFull,
): certificate is CertificateFull {
  return "evaluation" in certificate;
}

/** The "stamp": an engraved mark in the accent color. */
function Seal({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="Recorded simulation seal"
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth="1.5"
      className={cn("size-16 stroke-ink", className)}
    >
      <circle cx="32" cy="32" r="30" />
      <circle cx="32" cy="32" r="24.5" strokeDasharray="1.5 3.5" />
      <circle cx="32" cy="32" r="17" />
      <path d="M24.5 32.5l5.25 5.25L40 26.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VerifiedMark() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <span className="relative inline-flex h-7 w-fit items-center gap-1.5 rounded-md border border-ink-border bg-ink-soft px-2.5 text-xs font-medium text-ink">
      <ShieldCheck aria-hidden="true" className="size-3.5" strokeWidth={1.5} />
      Verified simulation record
      {prefersReducedMotion ? null : (
        <BorderBeam
          size={28}
          duration={8}
          borderWidth={1}
          colorFrom="var(--ink)"
          colorTo="var(--ink-border)"
        />
      )}
    </span>
  );
}

function Fact({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-6 py-4 sm:px-8">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("m-0 text-sm", mono && "font-mono tabular-nums")}>{children}</dd>
    </div>
  );
}

/**
 * The certificate as an official document. A limited certificate shows the
 * summary only; a full one adds the key moves and the trust curve.
 */
export function CertificateCard({
  certificate,
  issuer = "[PRODUCT]",
  verifyUrl,
  titleAs: Title = "h2",
  onShare,
  onViewFullReview,
  className,
}: CertificateCardProps) {
  const full = isFullCertificate(certificate) ? certificate : null;
  const personaName = full?.personas[0]?.name;

  return (
    <article
      data-tier={full ? "full" : "limited"}
      className={cn(
        "overflow-hidden rounded-xl border bg-card text-card-foreground shadow-card",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-6 border-b px-6 py-6 sm:px-8">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="m-0 font-mono text-xs tracking-wider text-muted-foreground uppercase">
            {issuer} · Record of work
          </p>
          <Title className="m-0 font-serif text-display-sm font-normal tracking-tight">
            Certificate of simulated work
          </Title>
          <div className="flex flex-wrap items-center gap-2">
            <VerifiedMark />
            {certificate.isDemo ? (
              <span className="inline-flex h-7 items-center rounded-md border bg-surface px-2.5 text-xs font-medium text-muted-foreground">Demo</span>
            ) : null}
          </div>
        </div>
        <Seal className="shrink-0" />
      </header>

      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 px-6 py-8 sm:px-8">
        <div className="flex min-w-0 flex-1 basis-80 flex-col gap-3">
          <p className="m-0 text-sm text-muted-foreground">Awarded to</p>
          <p className="m-0 font-serif text-display leading-none tracking-tight">
            {certificate.holderName}
          </p>
          <p className="m-0 text-base">
            <span className="font-medium">{formatSkill(certificate.skill)}</span>
            <span className="text-muted-foreground">
              {" · "}
              {LEVEL_LABEL[certificate.level]} · {FIELD_LABEL[certificate.field]}
            </span>
          </p>
          <p className="m-0 max-w-prose text-[15px] leading-relaxed">{certificate.headline}</p>
        </div>
        <AccuracyStat accuracy={certificate.accuracy} size="xl" />
      </div>

      <dl className="m-0 grid grid-cols-1 divide-y border-t sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
        <Fact label="Case">{certificate.caseTitle}</Fact>
        <Fact label="Outcome">{formatOutcome(certificate.outcome)}</Fact>
        <Fact label="Issued">{formatDate(certificate.issuedAt)}</Fact>
        <Fact label="Certificate ID" mono>
          {certificate.slug.toUpperCase()}
        </Fact>
      </dl>

      {full ? (
        <>
          <section aria-label="Key moves" className="border-t px-6 py-6 sm:px-8">
            <h3 className="m-0 mb-4 text-xs font-medium text-muted-foreground">Key moves</h3>
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {full.evaluation.topMoves.map((move) => (
                <li
                  key={move.eventId}
                  className="grid grid-cols-[6.75rem_minmax(0,1fr)] items-start gap-x-4 gap-y-1"
                >
                  <MoveLabelBadge label={move.label} className="justify-self-start" />
                  <p className="m-0 pt-0.5 text-[15px] leading-normal">{move.userText}</p>
                  <p className="col-start-2 m-0 text-sm leading-relaxed text-muted-foreground">
                    {move.why}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Trust curve" className="border-t px-6 py-6 sm:px-8">
            <TrustCurveChart
              curve={full.evaluation.trustCurve}
              moves={full.moves}
              personaName={personaName}
              heightClassName="h-40"
            />
          </section>
        </>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t bg-surface px-6 py-4 sm:px-8">
        <p className="m-0 min-w-0 text-xs text-muted-foreground">
          <span>Verification covers the recorded simulation, not identity or independent skill.</span>
          {verifyUrl ? <> {" "}Verify at <span className="font-mono text-foreground">{verifyUrl}</span></> : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {full && onViewFullReview ? (
            <Button variant="outline" onClick={onViewFullReview}>
              View full review
            </Button>
          ) : null}
          {onShare ? <Button onClick={onShare}>Share certificate</Button> : null}
        </div>
      </footer>
    </article>
  );
}
