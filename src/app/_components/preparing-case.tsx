"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { StepChecklist } from "@/ui";
import { Button } from "@/ui/primitives/button";
const stages = [
  "Building the scenario",
  "Writing the client's background",
  "Preparing documents",
  "Setting up your workspace",
];
export function PreparingCase({
  failed,
  onTimeout,
  onRetry,
}: {
  failed?: boolean;
  onTimeout: () => void;
  onRetry: () => void;
}) {
  const [started] = useState(Date.now);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [started]);
  useEffect(() => {
    if (seconds >= 60) onTimeout();
  }, [seconds, onTimeout]);
  return (
    <main className="mx-auto grid w-full max-w-lg gap-5 px-4 py-16">
      <div className="rounded-xl border bg-card p-6 sm:p-8">
        <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Your next case
        </p>
        <h1 className="text-2xl font-medium tracking-tight">
          {failed ? "We couldn't prepare this case" : "Preparing your case"}
        </h1>
        <p className="mb-7 mt-3 text-sm leading-relaxed text-muted-foreground">
          {failed
            ? "Your practice hasn't started. Try checking again, or return to your dashboard."
            : "We're setting up the scenario and materials. The timer has not started."}
        </p>
        {!failed && (
          <StepChecklist
            steps={stages.map((label, i) => ({
              id: String(i),
              label,
              status:
                i < Math.min(3, Math.floor(seconds / 7))
                  ? "done"
                  : i === Math.min(3, Math.floor(seconds / 7))
                    ? "active"
                    : "pending",
            }))}
          />
        )}
        <p role="status" className="mt-5 text-xs text-muted-foreground">
          {failed
            ? "No practice time has been used."
            : "Preparation stages are an estimate. This can take up to a minute."}
        </p>
        {failed && (
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={onRetry}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to practice</Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
