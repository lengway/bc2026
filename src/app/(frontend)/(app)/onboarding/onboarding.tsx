"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Pencil } from "lucide-react";
import { api } from "@/app/_lib/api";
import { useCreateCase } from "@/app/_hooks/case-hooks";
import { Button } from "@/ui/primitives/button";
import { LEVEL_LABEL, formatSkill } from "@/ui/lib/format";
import { inputClass, labelClass, Surface } from "@/app/_components/product";
import { ErrorPanel } from "@/app/_components/error-panel";
import type { Level } from "@/contracts";
export function Onboarding() {
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState<Level>("intermediate");
  const [text, setText] = useState("");
  const router = useRouter();
  const intake = useMutation({
    mutationFn: api.intake,
    onSuccess: () => setStep(3),
  });
  const create = useCreateCase();
  const busy = intake.isPending || create.isPending;
  function parse() {
    intake.mutate({ field: "sales", level, text: text.trim() });
  }
  function prepare() {
    create.mutate("onboarding", {
      onSuccess: (r) => router.push(`/case/${r.caseId}?type=onboarding`),
    });
  }
  return (
    <main className="mx-auto grid w-full max-w-xl gap-8 px-4 py-10 sm:py-16">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Make it relevant · Step {step} of 3
        </p>
        <div
          aria-label={`Step ${step} of 3`}
          className="grid grid-cols-3 gap-2"
        >
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 rounded-sm ${n <= step ? "bg-ink" : "bg-muted"}`}
            />
          ))}
        </div>
      </header>
      {step === 1 && (
        <>
          <div className="space-y-3">
            <h1 className="text-3xl font-medium tracking-tight">
              What kind of work do you do?
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Start with your field and experience. Your first case takes about
              eight minutes.
            </p>
          </div>
          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium">Your field</legend>
            {[
              {
                value: "sales",
                label: "Sales",
                detail: "Discovery, objections, negotiation and closing",
              },
              {
                value: "project_management",
                label: "Project management",
                detail: "Coming soon",
              },
              { value: "software", label: "Software", detail: "Coming soon" },
            ].map((field) => (
              <label
                key={field.value}
                className={`flex items-center gap-3 rounded-xl border p-4 ${field.value === "sales" ? "border-ink bg-ink-soft" : "bg-surface text-muted-foreground"}`}
              >
                <input
                  type="radio"
                  name="field"
                  value={field.value}
                  defaultChecked={field.value === "sales"}
                  disabled={field.value !== "sales"}
                  className="size-4 accent-ink"
                />
                <span className="grid gap-1">
                  <span className="text-sm font-medium">{field.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {field.detail}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">Your level</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["beginner", "intermediate", "advanced"] as const).map(
                (value) => (
                  <label
                    key={value}
                    className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${level === value ? "border-ink bg-ink-soft" : "bg-card"}`}
                  >
                    <input
                      type="radio"
                      name="level"
                      value={value}
                      checked={value === level}
                      onChange={() => setLevel(value)}
                      className="accent-ink"
                    />
                    {LEVEL_LABEL[value]}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <Button size="lg" onClick={() => setStep(2)}>
            Continue
            <ArrowRight aria-hidden="true" />
          </Button>
        </>
      )}
      {step === 2 && (
        <form
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            parse();
          }}
        >
          <div className="space-y-3">
            <h1 className="text-3xl font-medium tracking-tight">
              Tell us about your work
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Optional. A few specifics help us make the case useful to you.
            </p>
          </div>
          <div>
            <label htmlFor="intake" className={labelClass}>
              Your role, experience and what feels difficult
            </label>
            <textarea
              id="intake"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={5000}
              rows={6}
              className={inputClass}
              placeholder="I'm an SDR at a logistics software company, 3 years in. I book meetings fine but lose deals when price comes up."
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Leave out confidential customer information.
            </p>
          </div>
          {intake.isError && <ErrorPanel error={intake.error} retry={parse} />}
          <div className="flex justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setStep(1)}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
            <Button disabled={busy} type="submit">
              {busy ? "Reading your answer…" : "Review my profile"}
              <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </form>
      )}
      {step === 3 && intake.data && (
        <>
          <div className="space-y-3">
            <h1 className="text-3xl font-medium tracking-tight">
              Does this sound like you?
            </h1>
            <p className="text-sm text-muted-foreground">
              We understood the following. You can revise your answer before
              preparing the case.
            </p>
          </div>
          <Surface className="space-y-5">
            <p className="text-xs text-muted-foreground">We understood</p>
            <p className="text-xl font-medium">
              Sales · {formatSkill(intake.data.subfield)} ·{" "}
              {intake.data.years === null
                ? "Experience not specified"
                : `${intake.data.years} ${intake.data.years === 1 ? "year" : "years"}`}
            </p>
            <p className="text-sm text-muted-foreground">
              {LEVEL_LABEL[intake.data.level]}
            </p>
            {intake.data.pains.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                  What you want to work on
                </h2>
                <ul className="space-y-2 text-sm">
                  {intake.data.pains.map((pain) => (
                    <li key={pain} className="flex gap-2">
                      <Check
                        aria-hidden="true"
                        className="size-4 shrink-0 text-ink"
                      />
                      {pain}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setStep(2)}
            >
              <Pencil aria-hidden="true" />
              Edit my answer
            </Button>
          </Surface>
          {create.isError && (
            <ErrorPanel error={create.error} retry={prepare} />
          )}
          <Button size="lg" disabled={busy} onClick={prepare}>
            {busy ? "Preparing your case…" : "Looks right, prepare my case"}
            <ArrowRight aria-hidden="true" />
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            You will see the full brief before the timer starts.
          </p>
        </>
      )}
    </main>
  );
}
