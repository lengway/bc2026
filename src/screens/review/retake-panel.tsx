"use client";

import { useId, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Send } from "lucide-react";
import { RetakeStatus, type RetakeResult } from "@/contracts/retake";
import { apiClient } from "@/app/_lib/api-client";
import { UpgradeCheckout } from "@/app/_components/upgrade-checkout";
import { ErrorPanel } from "@/app/_components/error-panel";
import { Button } from "@/ui/primitives/button";

function RetakeComparison({ result }: { result: RetakeResult }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { title: "Original move", exchange: result.before, simulated: false },
          { title: "Practice retake", exchange: result.after, simulated: true },
        ].map(({ title, exchange, simulated }) => (
          <section
            key={title}
            aria-label={title}
            className="min-w-0 space-y-3 rounded-lg border bg-background p-3 text-sm"
          >
            <h3 className="font-medium">{title}</h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs text-muted-foreground">Your answer</dt>
                <dd className="wrap-break-word whitespace-pre-wrap">
                  {exchange.answer}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  {result.personaName} ·{" "}
                  {simulated ? "simulated reaction" : "recorded reaction"}
                </dt>
                <dd className="wrap-break-word whitespace-pre-wrap">
                  {exchange.reaction}
                </dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
      {result.feedback && (
        <div className="space-y-1 text-sm">
          <p className="font-medium">
            {result.criterionTitle} · Practice feedback
          </p>
          <p>{result.feedback}</p>
        </div>
      )}
    </div>
  );
}

export function RetakePanel({
  caseId,
  eventId,
}: {
  caseId: string;
  eventId: string;
}) {
  const client = useQueryClient();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [answer, setAnswer] = useState("");
  const path = `/api/cases/${encodeURIComponent(caseId)}/review/retake/${encodeURIComponent(eventId)}`;
  const queryKey = ["move-retake", caseId, eventId] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => apiClient(path, RetakeStatus, { signal }),
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2500 : false,
    retry: false,
  });
  const submit = useMutation({
    mutationFn: (text: string) =>
      apiClient(path, RetakeStatus, {
        method: "POST",
        body: { text },
        timeoutMs: 85_000,
      }),
    onSuccess: (result) => {
      client.setQueryData(queryKey, result);
      void client.invalidateQueries({
        queryKey: ["move-retake"],
        refetchType: "none",
      });
    },
    onError: () => void query.refetch(),
  });
  const data = query.data;
  if (query.isError && !data)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  if (!data)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Checking retake availability…
      </p>
    );
  return (
    <section
      aria-label="Retake this move"
      className="space-y-3 rounded-xl border bg-surface p-4"
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <RotateCcw aria-hidden="true" className="size-4 text-ink" />
        Try a different answer
      </h3>
      {data.status === "upgrade" ? (
        <>
          <p className="text-sm">
            Rewrite this move with Pro and compare the simulated response.
          </p>
          <UpgradeCheckout />
        </>
      ) : data.status === "unavailable" ? (
        <p className="text-sm text-muted-foreground">
          The recorded conversation is missing context for a retake of this
          move.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {data.remaining} of 3 retakes available
            {data.status === "exhausted" &&
              data.nextAvailableAt &&
              ` · Next on ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(data.nextAvailableAt))}`}
          </p>
          {submit.isError && data.status !== "completed" && (
            <ErrorPanel error={submit.error} />
          )}
          {(data.status === "pending" || submit.isPending) && (
            <p role="status" className="text-sm">
              Simulating the reaction…
            </p>
          )}
          {data.result && <RetakeComparison result={data.result} />}
          {data.status === "available" &&
            (editing ? (
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!submit.isPending && answer.trim())
                    submit.mutate(answer.trim());
                }}
              >
                <label className="block text-sm font-medium" htmlFor={id}>
                  Your new answer
                </label>
                <textarea
                  id={id}
                  autoFocus
                  className="min-h-28 w-full rounded-md border bg-background p-3 text-sm focus-visible:ring-2 focus-visible:ring-ring"
                  rows={3}
                  maxLength={8000}
                  value={answer}
                  disabled={submit.isPending}
                  onChange={(event) => setAnswer(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={submit.isPending || !answer.trim()}
                  >
                    <Send aria-hidden="true" />
                    Send practice answer
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    disabled={submit.isPending}
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                <RotateCcw aria-hidden="true" />
                Retake this move
              </Button>
            ))}
          {(editing || data.status === "completed") && (
            <p className="text-xs text-muted-foreground">
              This practice attempt is separate from your original case score.
            </p>
          )}
        </>
      )}
    </section>
  );
}
