"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCase, useReview, useCreateCase } from "@/app/_hooks/case-hooks";
import { ErrorPanel } from "@/app/_components/error-panel";
import { LoadingState } from "@/app/_components/providers";
import { Button } from "@/ui/primitives/button";
import { ReviewScreen } from "@/screens/review/review-screen";
export function ReviewPreview({ id }: { id: string }) {
  const [slow, setSlow] = useState(false);
  const current = useCase(id, !slow);
  const router = useRouter();
  const create = useCreateCase();
  const ready = current.data?.status === "evaluated";
  const query = useReview(id, ready);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setSlow(true), 60_000);
    return () => clearTimeout(timer);
  }, [ready]);
  if (current.isError)
    return (
      <ErrorPanel error={current.error} retry={() => void current.refetch()} />
    );
  if (current.isPending || !current.data)
    return <LoadingState label="Loading the review…" />;
  const view = current.data;
  if (
    !("brief" in view) ||
    view.status === "ready" ||
    view.status === "in_progress"
  )
    return (
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-16">
        <h1 className="text-2xl font-medium">This case is still open</h1>
        <p className="text-muted-foreground">
          Submit your practice to receive a review.
        </p>
        <Button asChild>
          <Link href={`/case/${id}`}>Return to case</Link>
        </Button>
      </main>
    );
  if (view.status === "evaluating")
    return (
      <>
        <ReviewScreen state="analyzing" caseTitle={view.brief.title} />
        {slow && (
          <div className="mx-auto max-w-6xl space-y-3 px-4 pb-8">
            <p role="status" className="text-sm text-muted-foreground">
              This is taking longer than expected. Your submitted case is saved.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSlow(false);
                void current.refetch();
              }}
            >
              Check again
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard">Back to practice</Link>
            </Button>
          </div>
        )}
      </>
    );
  if (query.isPending) return <LoadingState label="Loading your results…" />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const { evaluation, moves, certificateSlug, transcript } = query.data;
  const persona = view.personas[0];
  if (!persona)
    return (
      <ErrorPanel
        error={new Error("This review is missing its conversation details.")}
      />
    );
  return (
    <>
      <ReviewScreen
        state="ready"
        caseTitle={view.brief.title}
        persona={persona}
        evaluation={evaluation}
        moves={moves}
        transcript={transcript}
        onShare={
          certificateSlug
            ? () => router.push(`/c/${encodeURIComponent(certificateSlug)}`)
            : undefined
        }
        sharePending={!certificateSlug}
        onNextCase={() => {
          if (!create.isPending)
            create.mutate("daily", {
              onSuccess: (r) => router.push(`/case/${r.caseId}`),
            });
        }}
      />
      <div className="mx-auto max-w-6xl space-y-4 px-4 pb-10 sm:px-8">
        {!certificateSlug && (
          <p className="text-sm text-muted-foreground">
            The certificate link has not been issued yet.
          </p>
        )}
        {create.isPending && (
          <p role="status" className="text-sm">
            Preparing your next case…
          </p>
        )}
        {create.isError && <ErrorPanel error={create.error} />}
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to practice</Link>
        </Button>
      </div>
    </>
  );
}
