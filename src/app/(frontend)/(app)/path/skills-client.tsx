"use client";

import { useState } from "react";
import type { SkillId } from "@/contracts";
import { ErrorPanel } from "@/app/_components/error-panel";
import { useSkillPath } from "@/app/_hooks/case-hooks";
import {
  useCaseHistory,
  useOwnedCertificates,
} from "@/app/_hooks/owner-activity-hooks";
import { usePreparePracticeCase } from "@/app/_hooks/use-prepare-practice-case";
import { SkillDetailScreen } from "@/screens/path/skill-detail-screen";
import {
  seriesForSkill,
  skillLevel,
  SkillPathScreen,
} from "@/screens/path/skill-path-screen";
import { SkillSkeleton } from "@/screens/path/skill-skeleton";
import { EmptyState } from "@/ui/app-summary";
import { OwnedSkillCertificateCard } from "@/ui/owned-certificate-card";
import { CaseResultsSkeleton, CaseResultsTable } from "@/ui/recent-cases";
import { Button } from "@/ui/primitives/button";
import { Skeleton } from "@/ui/primitives/skeleton";
import Link from "next/link";

export function SkillsClient({ skill }: { skill?: SkillId }) {
  const path = useSkillPath();
  const create = usePreparePracticeCase();

  if (path.isPending) return <SkillSkeleton detail={Boolean(skill)} />;
  if (path.isError) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
        <ErrorPanel error={path.error} retry={() => void path.refetch()} />
      </main>
    );
  }

  const practice = (target: SkillId) =>
    create.prepare({ type: "daily", skill: target });
  const error = create.error;
  const request = create.variables;
  const practiceError = error && request && (
    <ErrorPanel error={error} retry={() => create.prepare(request)} />
  );

  if (skill) {
    return (
      <SkillDetailScreen
        series={seriesForSkill(path.data, skill)}
        level={skillLevel(path.data, skill)}
        pending={create.isPending}
        onPractice={practice}
        practiceError={practiceError}
        history={<SkillHistory skill={skill} />}
        certificates={<SkillCertificates skill={skill} />}
      />
    );
  }

  return (
    <SkillPathScreen
      path={path.data}
      pendingSkill={create.isPending ? request?.skill : undefined}
      onPractice={practice}
      practiceError={practiceError}
    />
  );
}

function SkillHistory({ skill }: { skill: SkillId }) {
  const [page, setPage] = useState(1);
  const query = useCaseHistory({ skill, page });
  if (query.isPending) return <CaseResultsSkeleton />;
  if (query.isError) {
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  }

  return (
    <>
      {query.data.items.length ? (
        <CaseResultsTable cases={query.data.items} />
      ) : (
        <EmptyState
          message="No completed cases for this skill."
          action={
            <Button asChild variant="outline" className="min-h-11">
              <Link href="#practice-skill">Go to practice</Link>
            </Button>
          }
        />
      )}
      {(page > 1 || query.data.hasMore) && (
        <nav
          aria-label="Case history pages"
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <Button
            type="button"
            className="min-h-11"
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            Page {page}
          </span>
          <Button
            type="button"
            className="min-h-11"
            variant="outline"
            disabled={!query.data.hasMore}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </>
  );
}

function SkillCertificates({ skill }: { skill: SkillId }) {
  const query = useOwnedCertificates({ skill });
  if (query.isPending) return <CertificateSkeleton />;
  if (query.isError) {
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  }

  return query.data.skills.length ? (
    <div className="grid gap-3 sm:grid-cols-2">
      {query.data.skills.map((certificate) => (
        <OwnedSkillCertificateCard
          key={certificate.slug}
          certificate={certificate}
        />
      ))}
    </div>
  ) : (
    <EmptyState
      message="No certificates for this skill yet."
      action={
        <Button asChild variant="outline" className="min-h-11">
          <Link href="#series">See series progress</Link>
        </Button>
      }
    />
  );
}

function CertificateSkeleton() {
  return (
    <div role="status" aria-busy="true" className="grid gap-3 sm:grid-cols-2">
      <span className="sr-only">Loading certificates…</span>
      {[0, 1].map((index) => (
        <div
          key={index}
          aria-hidden="true"
          className="grid gap-3 rounded-xl border bg-card p-4"
        >
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-11 w-24" />
        </div>
      ))}
    </div>
  );
}
