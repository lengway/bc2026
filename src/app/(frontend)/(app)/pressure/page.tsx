"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, MailWarning } from "lucide-react";
import { api } from "@/app/_lib/api";
import { Button } from "@/ui/primitives/button";
import { ErrorPanel } from "@/app/_components/error-panel";
import { Surface } from "@/app/_components/product";

export default function PressurePage() {
  const router = useRouter();
  const launch = useMutation({
    mutationFn: api.createPressureCase,
    onSuccess: ({ caseId }) => router.push(`/case/${caseId}?type=onboarding`),
  });

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-8 px-4 py-10 sm:py-16">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Curated practice · Sales
        </p>
        <h1 className="text-3xl font-medium tracking-tight">Pressure case</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A customer is considering a scheduling pilot. After a couple of
          exchanges, an important finance email changes the approved budget.
          Recheck the evidence, adapt your recommendation, and agree the next
          step.
        </p>
      </header>
      <Surface className="grid gap-4 p-5">
        <div className="flex items-start gap-3">
          <MailWarning
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-amber-700"
          />
          <div className="space-y-1">
            <h2 className="font-medium">Watch for the incoming CFO email</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The email arrives midway through the conversation and changes
              which proposal is supportable. The case documents show when each
              item becomes available.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          About 8 minutes · Requires a completed Sales profile
        </p>
      </Surface>
      {launch.isError && <ErrorPanel error={launch.error} />}
      <Button
        className="w-fit"
        disabled={launch.isPending}
        onClick={() => launch.mutate()}
      >
        {launch.isPending ? "Preparing case…" : "Start Pressure case"}
        {!launch.isPending && (
          <ArrowRight aria-hidden="true" className="size-4" />
        )}
      </Button>
    </main>
  );
}
