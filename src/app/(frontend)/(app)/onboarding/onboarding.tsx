"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Pencil } from "lucide-react";
import { api } from "@/app/_lib/api";
import { useCreateCase } from "@/app/_hooks/case-hooks";
import { Button } from "@/ui/primitives/button";
import { LEVEL_LABEL, formatSkill } from "@/ui/lib/format";
import { cn } from "@/ui/lib/utils";
import { inputClass, labelClass, Surface } from "@/app/_components/product";
import { ErrorPanel } from "@/app/_components/error-panel";
import { FOCUS_AREAS, type FocusArea, type Level } from "@/contracts";
import {
  EMPTY_ANSWERS,
  EXPERIENCE,
  FOCUS_CHOICES,
  MAX_FOCUS,
  ROLES,
  SEGMENTS,
  composeIntakeText,
  toggleFocus,
  type IntakeAnswers,
} from "./intake";

const FIELDS = [
  {
    value: "sales",
    label: "Sales",
    detail: "Discovery, objections, negotiation and closing",
    available: true,
  },
  {
    value: "project_management",
    label: "Project management",
    detail: "Coming soon",
    available: false,
  },
  {
    value: "software",
    label: "Software",
    detail: "Coming soon",
    available: false,
  },
] as const;

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-3 grid gap-1">
        <span className="text-sm font-medium">{title}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Choice({
  name,
  checked,
  onChange,
  label,
  detail,
  disabled,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  detail?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm transition-colors duration-150 ease-out",
        disabled
          ? "cursor-not-allowed bg-surface text-muted-foreground"
          : "cursor-pointer hover:border-border-strong",
        checked && "border-ink bg-ink-soft hover:border-ink",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="size-4 shrink-0 accent-ink"
      />
      <span className="grid gap-0.5">
        <span className="font-medium">{label}</span>
        {detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
      </span>
    </label>
  );
}

function FocusChips({
  selected,
  blocked,
  onToggle,
  label,
}: {
  selected: FocusArea[];
  blocked: FocusArea[];
  onToggle: (area: FocusArea) => void;
  label: string;
}) {
  const full = selected.length >= MAX_FOCUS;
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {FOCUS_CHOICES.map((area) => {
        const on = selected.includes(area);
        const disabled = !on && (full || blocked.includes(area));
        return (
          <button
            key={area}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(area)}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-md border px-3 text-sm outline-none transition-colors duration-150 ease-out",
              "focus-visible:ring-2 focus-visible:ring-ring",
              on
                ? "border-ink bg-ink text-primary-foreground"
                : "bg-card hover:border-border-strong",
              disabled && "cursor-not-allowed opacity-45 hover:border-border",
            )}
          >
            {on && (
              <Check aria-hidden="true" className="size-3.5" strokeWidth={2} />
            )}
            {FOCUS_AREAS[area].label}
          </button>
        );
      })}
    </div>
  );
}

export function Onboarding() {
  const [step, setStep] = useState<1 | 2>(1);
  const [answers, setAnswers] = useState<IntakeAnswers>(EMPTY_ANSWERS);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const router = useRouter();
  const intake = useMutation({
    mutationFn: api.intake,
    onSuccess: () => setStep(2),
  });
  const create = useCreateCase();
  const busy = intake.isPending || create.isPending;

  const set = <K extends keyof IntakeAnswers>(
    key: K,
    value: IntakeAnswers[K],
  ) => setAnswers((a) => ({ ...a, [key]: value }));

  const missing = [
    !answers.role && "your role",
    !answers.experience && "your experience",
    answers.practice.length === 0 && "at least one thing to practice",
  ].filter(Boolean) as string[];

  function submit() {
    setTriedSubmit(true);
    if (missing.length) return;
    intake.mutate({
      field: "sales",
      level: answers.level,
      text: composeIntakeText(answers),
    });
  }

  function prepare() {
    create.mutate(
      { type: "onboarding" },
      {
        onSuccess: (r) => router.push(`/case/${r.caseId}?type=onboarding`),
      },
    );
  }

  return (
    <main className="mx-auto grid w-full max-w-2xl gap-8 px-4 py-10 sm:py-16">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Make it relevant · Step {step} of 2
        </p>
        <div aria-hidden="true" className="grid grid-cols-2 gap-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`h-1 rounded-sm ${n <= step ? "bg-ink" : "bg-muted"}`}
            />
          ))}
        </div>
      </header>

      {step === 1 && (
        <form
          className="grid gap-10"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-3">
            <h1 className="text-3xl font-medium tracking-tight">
              Tell us about your work
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your answers decide which situations you practice. It takes about
              a minute, and your first case takes about eight. After each
              review, check your progress toward a three-case skill certificate.
            </p>
          </div>

          <Question title="Your field">
            <div className="grid gap-2 sm:grid-cols-3">
              {FIELDS.map((f) => (
                <Choice
                  key={f.value}
                  name="field"
                  checked={f.value === "sales"}
                  onChange={() => undefined}
                  label={f.label}
                  detail={f.available ? undefined : f.detail}
                  disabled={!f.available}
                />
              ))}
            </div>
          </Question>

          <Question title="Your role">
            <div className="grid gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <Choice
                  key={r.id}
                  name="role"
                  checked={answers.role === r.id}
                  onChange={() => set("role", r.id)}
                  label={r.label}
                  detail={r.detail}
                />
              ))}
            </div>
          </Question>

          <div className="grid gap-10 sm:grid-cols-2 sm:gap-6">
            <Question title="Experience in sales">
              <div className="grid grid-cols-2 gap-2">
                {EXPERIENCE.map((e) => (
                  <Choice
                    key={e.id}
                    name="experience"
                    checked={answers.experience === e.id}
                    onChange={() =>
                      setAnswers((a) => ({
                        ...a,
                        experience: e.id,
                        level: e.level,
                      }))
                    }
                    label={e.label}
                  />
                ))}
              </div>
            </Question>
            <Question
              title="Case difficulty"
              hint="Set from your experience. Change it if you like."
            >
              <div className="grid gap-2">
                {(
                  [
                    "beginner",
                    "intermediate",
                    "advanced",
                  ] as const satisfies readonly Level[]
                ).map((value) => (
                  <Choice
                    key={value}
                    name="level"
                    checked={answers.level === value}
                    onChange={() => set("level", value)}
                    label={LEVEL_LABEL[value]}
                  />
                ))}
              </div>
            </Question>
          </div>

          <Question title="Who you sell to" hint="Optional.">
            <div className="grid gap-2 sm:grid-cols-3">
              {SEGMENTS.map((s) => (
                <Choice
                  key={s.id}
                  name="segment"
                  checked={answers.segment === s.id}
                  onChange={() => set("segment", s.id)}
                  label={s.label}
                />
              ))}
            </div>
            <div>
              <label htmlFor="industry" className="sr-only">
                Industry
              </label>
              <input
                id="industry"
                value={answers.industry}
                onChange={(e) => set("industry", e.target.value)}
                maxLength={80}
                className={inputClass}
                placeholder="Industry, for example logistics software"
              />
            </div>
          </Question>

          <Question
            title="What do you want to practice?"
            hint={`Pick up to ${MAX_FOCUS}. Your cases will focus on these situations.`}
          >
            <FocusChips
              label="What you want to practice"
              selected={answers.practice}
              blocked={answers.strengths}
              onToggle={(area) =>
                set("practice", toggleFocus(answers.practice, area))
              }
            />
          </Question>

          <Question
            title="Where are you already strong?"
            hint={`Optional. Up to ${MAX_FOCUS}.`}
          >
            <FocusChips
              label="Where you are already strong"
              selected={answers.strengths}
              blocked={answers.practice}
              onToggle={(area) =>
                set("strengths", toggleFocus(answers.strengths, area))
              }
            />
          </Question>

          <div>
            <label htmlFor="intake" className={labelClass}>
              Anything else we should know
              <span className="ml-2 font-normal text-muted-foreground">
                Optional
              </span>
            </label>
            <textarea
              id="intake"
              value={answers.notes}
              onChange={(e) => set("notes", e.target.value)}
              maxLength={3000}
              rows={4}
              className={inputClass}
              placeholder="I book meetings fine, but I lose deals when price comes up and the buyer brings a competitor quote."
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Leave out confidential customer information.
            </p>
          </div>

          {triedSubmit && missing.length > 0 && (
            <p
              role="alert"
              className="rounded-lg border border-label-mistake/30 bg-label-mistake-soft px-4 py-3 text-sm text-label-mistake"
            >
              Please choose {missing.join(", ")}.
            </p>
          )}
          {intake.isError && <ErrorPanel error={intake.error} retry={submit} />}

          <Button size="lg" type="submit" disabled={busy}>
            {busy ? "Reading your answers…" : "Review my profile"}
            <ArrowRight aria-hidden="true" />
          </Button>
        </form>
      )}

      {step === 2 && intake.data && (
        <>
          <div className="space-y-3">
            <h1 className="text-3xl font-medium tracking-tight">
              Does this sound like you?
            </h1>
            <p className="text-sm text-muted-foreground">
              Your first case is chosen from this profile. You can change it
              before we prepare it.
            </p>
          </div>
          <Surface className="space-y-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">We understood</p>
              <p className="text-xl font-medium">
                Sales · {formatSkill(intake.data.subfield)} ·{" "}
                {intake.data.years === null
                  ? "Experience not specified"
                  : `${intake.data.years} ${intake.data.years === 1 ? "year" : "years"}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {LEVEL_LABEL[intake.data.level]} cases
              </p>
            </div>
            {answers.practice.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                  Your cases will focus on
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {answers.practice.map((area) => (
                    <li
                      key={area}
                      className="rounded-md bg-ink px-2.5 py-1 text-sm text-primary-foreground"
                    >
                      {FOCUS_AREAS[area].label}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {intake.data.pains.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-medium text-muted-foreground">
                  What feels difficult
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
              onClick={() => setStep(1)}
            >
              <Pencil aria-hidden="true" />
              Edit my answers
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
