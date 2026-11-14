"use client";
import Link from "next/link";
import { useCase, useReview } from "@/app/_hooks/case-hooks";
import { ErrorPanel } from "@/app/_components/error-panel";
import { LoadingState } from "@/app/_components/providers";
export function ReviewPreview({ id }: { id: string }) {
  const currentCase = useCase(id);
  const query = useReview(id, currentCase.data?.status === "evaluated");
  if (currentCase.isError)
    return (
      <ErrorPanel
        error={currentCase.error}
        retry={() => void currentCase.refetch()}
      />
    );
  if (query.isPending) return <LoadingState label="Analyzing your moves…" />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <section className="stack">
      <p className="eyebrow">Your practice review</p>
      <h1>A clearer next move</h1>
      <div className="panel stack">
        <h2>Accuracy</h2>
        <p className="metric">
          {query.data.evaluation.accuracy === null
            ? "Not enough evidence"
            : `${query.data.evaluation.accuracy}%`}
        </p>
        <p className="muted">
          {query.data.evaluation.scoreAudit.completionStatus.replaceAll(
            "_",
            " ",
          )}
        </p>
        <p>{query.data.evaluation.summary}</p>
      </div>
      <div className="actions">
        {query.data.certificateSlug && (
          <Link
            href={`/c/${encodeURIComponent(query.data.certificateSlug)}`}
            className="button"
          >
            Open certificate
          </Link>
        )}
        <Link href="/dashboard">Back to practice</Link>
      </div>
    </section>
  );
}
