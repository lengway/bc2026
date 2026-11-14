"use client";
import { useState } from "react";
import Link from "next/link";
import { Copy, Check, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Certificate } from "@/contracts";
import { api } from "@/app/_lib/api";
import { CertificateCard, isFullCertificate } from "@/ui/certificate-card";
import {
  AssistanceDetails,
  AiUseDetails,
  ScoreExplanation,
} from "@/ui/scoring-details";
import { ReviewScreen } from "@/screens/review/review-screen";
import { ChatMessage } from "@/ui/chat-message";
import { formatSkill } from "@/ui/lib/format";
import { Button } from "@/ui/primitives/button";
import { PublicShell } from "./product";
import { LoadingState } from "./providers";
import { ErrorPanel } from "./error-panel";
export function CertificateExperience({
  certificate,
  sample = false,
  local = false,
}: {
  certificate: Certificate;
  sample?: boolean;
  local?: boolean;
}) {
  const [showReview, setShowReview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const full = isFullCertificate(certificate);
  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-8 sm:py-14">
        {(sample || local) && (
          <p className="rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            {sample
              ? "Example case record · fictional results for illustration."
              : "Browser preview · this case record is available in the tab where you completed the case."}
          </p>
        )}
        <CertificateCard
          certificate={certificate}
          issuer="Gambit"
          titleAs="h1"
          onViewFullReview={
            full ? () => setShowReview((value) => !value) : undefined
          }
        />
        {certificate.skillCertificate && (
          <Button asChild variant="outline">
            <Link href={`/s/${certificate.skillCertificate.slug}`}>
              View {formatSkill(certificate.skillCertificate.skill)} skill
              certificate
            </Link>
          </Button>
        )}
        <section className="space-y-3 rounded-xl border bg-surface p-5 text-sm leading-relaxed">
          <h2 className="font-medium">What this record means</h2>
          <p className="text-muted-foreground">
            A recorded, timed work simulation with its observed assistance and
            assessment coverage. AI help is permitted. This record does not
            verify identity, unaided authorship, or performance in a real job.
          </p>
        </section>
        <div className="grid gap-6 md:grid-cols-2">
          <AssistanceDetails assistance={certificate.assistance} />
          <AiUseDetails skill={certificate.aiUseSkillSummary} />
        </div>
        <ScoreExplanation summary={certificate.scoringSummary} />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? (
              <Check aria-hidden="true" />
            ) : (
              <Copy aria-hidden="true" />
            )}
            {copied ? "Link copied" : "Copy case record link"}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              window.open(
                `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`,
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            Share on LinkedIn
          </Button>
          {full && (
            <Button
              variant="ghost"
              aria-expanded={showReview}
              onClick={() => setShowReview((value) => !value)}
            >
              {showReview ? "Hide full review" : "Read full review"}
            </Button>
          )}
        </div>
        {copyError && (
          <p role="status" className="text-sm text-muted-foreground">
            Copy the address from your browser to share this case record.
          </p>
        )}
        {!full && (
          <p className="text-xs text-muted-foreground">
            This case record includes the summary. Pro case records also include
            a move-by-move review and the published transcript.
          </p>
        )}
      </main>
      {full && showReview && (
        <section
          aria-label="Full public review"
          className="border-y bg-surface"
        >
          {certificate.personas[0] && (
            <ReviewScreen
              state="ready"
              caseTitle={certificate.caseTitle}
              persona={certificate.personas[0]}
              evaluation={certificate.evaluation}
              moves={certificate.moves}
              transcript={certificate.transcript}
            />
          )}
          <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-8">
            <h2 className="text-xl font-medium">
              Public conversation transcript
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Only the published conversation appears here. Editing history and
              private activity observations are excluded.
            </p>
            <ol className="space-y-5">
              {certificate.transcript.map((event) => (
                <li
                  id={`message-${event.id}`}
                  key={event.id}
                  className="[overflow-wrap:anywhere]"
                >
                  <ChatMessage actor={event.actor} content={event.content} />
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
      <section className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-6 px-4 py-12 sm:px-8">
        <div>
          <h2 className="font-serif text-3xl">Your next move starts here.</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Try a realistic case and get a review of your own.
          </p>
        </div>
        <Button asChild>
          <Link href="/login?next=/onboarding">
            Try a case like this
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </PublicShell>
  );
}
export function LocalCertificate({ slug }: { slug: string }) {
  const query = useQuery({
    queryKey: ["certificate", slug],
    queryFn: ({ signal }) => api.certificate(slug, signal),
    retry: false,
  });
  if (query.isPending)
    return (
      <PublicShell>
        <LoadingState label="Loading this preview case record…" />
      </PublicShell>
    );
  if (query.isError)
    return (
      <PublicShell>
        <main className="mx-auto max-w-2xl space-y-4 px-4 py-16">
          <h1 className="text-2xl font-medium">Case record unavailable</h1>
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
          <p className="text-sm text-muted-foreground">
            Preview case records are only available in the browser tab where the
            case was completed.
          </p>
          <Button asChild variant="outline">
            <Link href="/c/sample">View an example case record</Link>
          </Button>
        </main>
      </PublicShell>
    );
  return <CertificateExperience certificate={query.data} local />;
}
