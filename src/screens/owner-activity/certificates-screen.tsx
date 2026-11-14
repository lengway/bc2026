import type { ReactNode } from "react";
import Link from "next/link";
import type { OwnedCaseRecord, OwnedCertificates } from "@/contracts";
import { EmptyState, SectionHeader } from "@/ui/app-summary";
import { formatDate } from "@/ui/lib/format";
import {
  CertificateLinkStatus,
  CopyCertificateLink,
  OwnedSkillCertificateCard,
} from "@/ui/owned-certificate-card";
import { OutcomeBadge } from "@/ui/outcome-badge";
import { Button } from "@/ui/primitives/button";
import { Skeleton } from "@/ui/primitives/skeleton";

const cardGrid = "grid gap-3 sm:grid-cols-2 2xl:grid-cols-3";

function CaseRecords({ records }: { records: readonly OwnedCaseRecord[] }) {
  return (
    <ul className="min-w-0 divide-y rounded-xl border bg-card">
      {records.map((record) => (
        <li
          key={record.slug}
          className="flex flex-wrap items-center justify-between gap-3 p-3"
        >
          <div className="grid min-w-0 gap-1">
            <Link
              href={`/review/${record.caseId}`}
              className="w-fit rounded-sm text-sm font-medium break-words outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {record.title}
            </Link>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
              <time
                dateTime={record.issuedAt}
                className="font-mono text-xs tabular-nums"
              >
                {formatDate(record.issuedAt)}
              </time>
              <span className="font-mono text-sm tabular-nums">
                {record.accuracy === null ? (
                  <span aria-label="Unscored">—</span>
                ) : (
                  `${record.accuracy}%`
                )}
              </span>
              <OutcomeBadge outcome={record.outcome} />
            </div>
          </div>
          {record.hasPublicLink ? (
            <div className="flex flex-wrap gap-2">
              <Button asChild className="min-h-11" variant="secondary">
                <Link
                  href={`/c/${record.slug}`}
                  aria-label={`Open case record for ${record.title}`}
                >
                  Open
                </Link>
              </Button>
              <CopyCertificateLink href={`/c/${record.slug}`} />
            </div>
          ) : (
            <CertificateLinkStatus certificate={record} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function CertificatesScreen({
  result,
  loading,
  error,
  practice,
  start,
}: {
  result?: OwnedCertificates;
  loading?: boolean;
  error?: ReactNode;
  practice?: ReactNode;
  start?: ReactNode;
}) {
  return (
    <section className="mx-auto grid w-full min-w-0 max-w-6xl gap-6 p-4 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Certificates</h1>
      {error}
      <section className="grid gap-3">
        <SectionHeader title="Skill certificates" />
        {loading && (
          <div
            role="status"
            aria-label="Loading skill certificates"
            className={cardGrid}
          >
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-44 w-full" />
          </div>
        )}
        {result &&
          (result.skills.length ? (
            <div className={cardGrid}>
              {result.skills.map((certificate) => (
                <OwnedSkillCertificateCard
                  key={certificate.slug}
                  certificate={certificate}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              message="Complete a qualifying series to earn a skill certificate."
              action={practice}
            />
          ))}
      </section>
      <section className="grid gap-3">
        <SectionHeader title="Case records" />
        {loading && (
          <div
            role="status"
            aria-label="Loading case records"
            className="grid gap-1"
          >
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}
        {result &&
          (result.caseRecords.length ? (
            <CaseRecords records={result.caseRecords} />
          ) : (
            <EmptyState
              message="Your case records will appear here."
              action={start}
            />
          ))}
      </section>
    </section>
  );
}
