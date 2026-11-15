"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ErrorPanel } from "@/app/_components/error-panel";
import {
  inputClass,
  labelClass,
  PageHeading,
  Surface,
} from "@/app/_components/product";
import {
  practiceCaseHref,
  usePreparePracticeCase,
  useRecoverablePrep,
} from "@/app/_hooks/use-prepare-practice-case";
import { ApiError } from "@/app/_lib/api-client";
import { SALES_CALL_PREP_DETAIL_LIMIT, SalesCallPrep } from "@/contracts";
import { Button } from "@/ui/primitives/button";

const fields = [
  {
    name: "offering",
    label: "What do you sell?",
    placeholder: "Fleet maintenance software",
  },
  {
    name: "buyer",
    label: "Who is the buyer?",
    placeholder: "An operations director at a regional delivery fleet",
  },
  {
    name: "objection",
    label: "What objection do you expect?",
    placeholder:
      "Taking vans off the road during rollout would disrupt deliveries",
  },
] as const;

export function PrepareSalesCall() {
  const { prepare, isPending, error, reset } = usePreparePracticeCase();
  const { data: recoverablePrep } = useRecoverablePrep();
  const [showValidation, setShowValidation] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    const form = new FormData(event.currentTarget);
    const result = SalesCallPrep.safeParse(
      Object.fromEntries(fields.map(({ name }) => [name, form.get(name)])),
    );
    setShowValidation(!result.success);
    if (result.success) prepare({ type: "prep", prep: result.data });
  }

  const paywall = error instanceof ApiError && error.code === "PAYWALL";

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-8 sm:py-12">
      <PageHeading title="Prepare for a sales call">
        Rehearse a 10-minute conversation with a fictional buyer who has the
        objection you expect to hear.
      </PageHeading>
      {recoverablePrep && (
        <Surface>
          <div className="space-y-3">
            <div>
              <h2 className="font-medium">
                Your recent practice is still here
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Continue the case you already started, or prepare another one.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href={practiceCaseHref(recoverablePrep)}>
                Resume or review this case
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </Surface>
      )}
      <Surface>
        <form onSubmit={submit} onChange={reset} className="space-y-5">
          <p
            id="prep-privacy"
            className="text-sm leading-relaxed text-muted-foreground"
          >
            Use general descriptions. Leave out names, contact information, deal
            terms, and other confidential details. Your scenario and review are
            private.
          </p>
          {fields.map(({ name, label, placeholder }) => (
            <div key={name}>
              <label htmlFor={name} className={labelClass}>
                {label}
              </label>
              <textarea
                id={name}
                name={name}
                className={inputClass}
                placeholder={placeholder}
                aria-describedby="prep-privacy"
                autoComplete="off"
                required
                rows={2}
                maxLength={SALES_CALL_PREP_DETAIL_LIMIT}
                disabled={isPending}
              />
            </div>
          ))}
          {showValidation && (
            <p role="alert" className="text-sm text-destructive">
              Enter a short description in all three fields.
            </p>
          )}
          {paywall ? (
            <div role="alert" className="space-y-2 text-sm">
              <p>You’ve used your free case for this seven-day period.</p>
              <Link href="/pricing" className="underline underline-offset-4">
                View Pro plans
              </Link>
            </div>
          ) : (
            error && <ErrorPanel error={error} />
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Prep uses the same free allowance as a daily case. It does not count
            toward a skill certificate.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Preparing…" : "Prepare practice case"}
              <ArrowRight aria-hidden="true" />
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard">Back to practice</Link>
            </Button>
          </div>
        </form>
      </Surface>
    </main>
  );
}
