"use client";
import { useRouter } from "next/navigation";
import { useCreateCase, useSkillPath } from "@/app/_hooks/case-hooks";
import { ErrorPanel } from "@/app/_components/error-panel";
import { LoadingState } from "@/app/_components/providers";
export function Dashboard() {
  const path = useSkillPath();
  const create = useCreateCase();
  const router = useRouter();
  if (path.isPending) return <LoadingState />;
  if (path.isError)
    return <ErrorPanel error={path.error} retry={() => void path.refetch()} />;
  return (
    <div className="stack">
      <div className="stack tight">
        <p className="eyebrow">Make practice a habit</p>
        <h1>Your practice</h1>
        <p className="muted">
          One focused conversation. Something useful to take into your next
          workday.
        </p>
      </div>
      <div className="grid">
        <section className="panel stack">
          <p className="eyebrow">Your next case · Sales</p>
          <h2>A renewal at risk</h2>
          <p className="muted">
            A customer is questioning the value of their renewal. Find out
            what&apos;s really getting in their way.
          </p>
          <div className="actions">
            <button
              disabled={create.isPending}
              onClick={() =>
                create.mutate("onboarding", {
                  onSuccess: (result) => router.push(`/case/${result.caseId}`),
                })
              }
            >
              {create.isPending && create.variables === "onboarding"
                ? "Preparing…"
                : "Open practice case"}
            </button>
            <span className="muted">8 minutes</span>
          </div>
        </section>
        <section className="panel stack">
          <p className="eyebrow">Weekly practice · Pro</p>
          <h2>Make room for a bigger challenge</h2>
          <p className="muted">
            Work through a longer scenario with more context and changing
            priorities.
          </p>
          <div>
            <button
              className="secondary"
              disabled={create.isPending}
              onClick={() =>
                create.mutate("weekly", {
                  onSuccess: (result) => router.push(`/case/${result.caseId}`),
                })
              }
            >
              Open weekly case
            </button>
          </div>
        </section>
      </div>
      {create.isError && <ErrorPanel error={create.error} />}
      <section className="panel stack tight">
        <h2>Recent practice</h2>
        {path.data.history.length === 0 ? (
          <p className="muted">
            Your completed cases will appear here. Start with one conversation.
          </p>
        ) : (
          path.data.history.map((item) => (
            <p key={item.caseId}>
              {item.title} ·{" "}
              {item.accuracy === null
                ? "Not enough evidence"
                : `${item.accuracy}%`}
            </p>
          ))
        )}
      </section>
    </div>
  );
}
