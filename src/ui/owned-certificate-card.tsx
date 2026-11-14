"use client";

import Link from "next/link";
import { Copy, ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { OwnedSkillCertificate } from "@/contracts";
import { formatAverageAccuracy, formatDate, formatSkill } from "./lib/format";
import { Button } from "./primitives/button";

export function CopyCertificateLink({ href }: { href: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        new URL(href, window.location.origin).href,
      );
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  return (
    <Button className="min-h-11" variant="outline" onClick={() => void copy()}>
      <Copy aria-hidden="true" strokeWidth={1.5} />
      Copy link
    </Button>
  );
}

export function CertificateLinkStatus({
  certificate,
}: {
  certificate: Pick<OwnedSkillCertificate, "revokedAt" | "hasPublicLink">;
}) {
  if (certificate.hasPublicLink) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {certificate.revokedAt
        ? "Public link disabled"
        : "Confirm your email to share"}
    </p>
  );
}

export function OwnedSkillCertificateCard({
  certificate,
}: {
  certificate: OwnedSkillCertificate;
}) {
  const href = `/s/${certificate.slug}`;
  return (
    <article className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-2xl leading-tight">
            {formatSkill(certificate.skill)}
          </h3>
          <p className="mt-1 font-mono text-xs text-muted-foreground tabular-nums">
            Level {certificate.level}
          </p>
        </div>
        {certificate.supersededBy ? (
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            Superseded
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-ink-soft px-2 py-1 text-xs font-medium text-ink">
            <ShieldCheck
              aria-hidden="true"
              className="size-3.5"
              strokeWidth={1.5}
            />
            Verified
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="font-mono font-medium tabular-nums">
            {formatAverageAccuracy(certificate.averageAccuracy)}
          </span>
          <span className="ml-1.5 text-muted-foreground">average accuracy</span>
        </div>
        <time
          dateTime={certificate.issuedAt}
          className="font-mono text-xs text-muted-foreground tabular-nums"
        >
          {formatDate(certificate.issuedAt)}
        </time>
      </div>
      {certificate.hasPublicLink ? (
        <div className="mt-auto flex flex-wrap gap-2">
          <Button asChild className="min-h-11" variant="secondary">
            <Link
              href={href}
              aria-label={`Open ${formatSkill(certificate.skill)} level ${certificate.level} certificate`}
            >
              Open
              <ExternalLink aria-hidden="true" strokeWidth={1.5} />
            </Link>
          </Button>
          <CopyCertificateLink href={href} />
        </div>
      ) : (
        <CertificateLinkStatus certificate={certificate} />
      )}
    </article>
  );
}
