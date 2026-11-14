"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SkillId } from "@/contracts/skill-series";
import { useCase, useStartCase, useCreateCase } from "@/app/_hooks/case-hooks";
import { LoadingState } from "@/app/_components/providers";
import { ErrorPanel } from "@/app/_components/error-panel";
import { CaseBriefScreen } from "@/app/_components/case-brief";
import { PreparingCase } from "@/app/_components/preparing-case";
import { Button } from "@/ui/primitives/button";
import { chatWorkspacePlugin } from "@/workspaces/chat/workspace";
export function CasePreview({ id }: { id: string }) {
  const query = useCase(id, true);
  const start = useStartCase(id);
  const create = useCreateCase();
  const router = useRouter();
  const params = useSearchParams();
  const requestedType = params.get("type");
  const retryType =
    requestedType === "daily" || requestedType === "weekly"
      ? requestedType
      : "onboarding";
  const skill =
    retryType === "daily"
      ? SkillId.safeParse(params.get("skill")).data
      : undefined;
  useEffect(() => {
    if (
      query.data?.status === "evaluating" ||
      query.data?.status === "evaluated"
    )
      router.replace(`/review/${id}`);
  }, [query.data?.status, router, id]);
  if (query.isPending) return <LoadingState label="Opening your case…" />;
  if (query.isError)
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-10">
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to practice</Link>
        </Button>
      </main>
    );
  const view = query.data;
  if (view.status === "generating" || view.status === "failed")
    return (
      <>
        <PreparingCase
          failed={view.status === "failed"}
          retrying={create.isPending}
          onRetry={() => {
            if (create.isPending) return;
            create.mutate(
              { type: retryType, skill },
              {
                onSuccess: ({ caseId }) => {
                  const retryParams = new URLSearchParams({ type: retryType });
                  if (skill) retryParams.set("skill", skill);
                  router.replace(`/case/${caseId}?${retryParams}`);
                },
              },
            );
          }}
        />
        {create.isError && <ErrorPanel error={create.error} />}
      </>
    );
  if (
    !("brief" in view) ||
    view.status === "evaluating" ||
    view.status === "evaluated"
  )
    return <LoadingState label="Opening your review…" />;
  if (view.status === "ready")
    return (
      <CaseBriefScreen
        view={view}
        starting={start.isPending}
        error={start.error}
        onStart={() => start.mutate()}
      />
    );
  if (view.workspace !== chatWorkspacePlugin.id)
    return (
      <main className="mx-auto grid max-w-xl gap-4 px-4 py-16">
        <h1 className="text-2xl font-medium">This workspace is coming soon</h1>
        <p>Sales conversations are available now.</p>
        <Button asChild>
          <Link href="/dashboard">Back to practice</Link>
        </Button>
      </main>
    );
  const Workspace = chatWorkspacePlugin.Component;
  return <Workspace key={view.id} caseView={view} />;
}
