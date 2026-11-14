"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, RotateCcw } from "lucide-react";
import type { MoveLabel } from "@/contracts";
import { MoveLabelBadge, StepChecklist, formatClock } from "@/ui";
import { cn } from "@/ui/lib/utils";
import { Button } from "@/ui/primitives/button";

/** Case generation usually takes 60–120 s (two model calls). Stages are paced to that. */
const STAGES = [
  { label: "Choosing a situation for your profile", at: 0 },
  { label: "Writing your counterpart's background", at: 20 },
  { label: "Preparing the documents", at: 50 },
  { label: "Setting the review criteria", at: 85 },
];
const SLOW_AFTER_SEC = 150;

type WarmUpOption = { text: string; label: MoveLabel; why: string };
type WarmUp = {
  from: string;
  message: string;
  options: [WarmUpOption, WarmUpOption];
};

const WARM_UPS: WarmUp[] = [
  {
    from: "Priya Nair, VP Operations",
    message: "Honestly, your price is 20% above the other quote we have.",
    options: [
      {
        text: "I can match that if we sign this week.",
        label: "mistake",
        why: "You discounted before learning what the other quote includes. It tells her the price was never firm.",
      },
      {
        text: "Fair. What does their quote include, and what made you look in the first place?",
        label: "best",
        why: "You stay calm and find out what she is really comparing before touching the price.",
      },
    ],
  },
  {
    from: "Copilot",
    message:
      "Their contract renews on the 30th, so you could offer the early-renewal rate.",
    options: [
      {
        text: "Since you renew on the 30th, I can apply our early-renewal rate.",
        label: "blunder",
        why: "You repeated Copilot without checking. The CRM says the renewal is on the 13th, and the client knows her own contract.",
      },
      {
        text: "Let me check the renewal date in the CRM before I mention any rate.",
        label: "brilliant",
        why: "You caught a wrong suggestion. Checking AI output against the documents is part of your score.",
      },
    ],
  },
  {
    from: "Marcus Hale, IT Director",
    message: "We're happy with what we have. Why would we switch?",
    options: [
      {
        text: "What would have to be true for you to look at something new next year?",
        label: "best",
        why: "An open question that keeps the door open without arguing with him.",
      },
      {
        text: "Because our platform is faster and cheaper than theirs.",
        label: "inaccuracy",
        why: "Not wrong, but you pitch before you know what he values. He has no reason to agree yet.",
      },
    ],
  },
];

function WarmUpCard() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const done = index >= WARM_UPS.length;
  const item = WARM_UPS[Math.min(index, WARM_UPS.length - 1)];
  const rank: Record<MoveLabel, number> = {
    brilliant: 5,
    best: 4,
    good: 3,
    inaccuracy: 2,
    mistake: 1,
    blunder: 0,
  };
  const strongest =
    rank[item.options[0].label] >= rank[item.options[1].label] ? 0 : 1;

  function choose(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === strongest) setScore((s) => s + 1);
  }

  return (
    <section
      aria-labelledby="warmup-title"
      className="rounded-xl border bg-card p-6 sm:p-8"
    >
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 id="warmup-title" className="text-base font-medium">
          While you wait: which reply is stronger?
        </h2>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {done
            ? `${score}/${WARM_UPS.length}`
            : `${index + 1}/${WARM_UPS.length}`}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="grid gap-4"
          >
            <p className="text-sm leading-relaxed">
              You picked the stronger reply {score} of {WARM_UPS.length} times.
              In your case every message you send gets a label like these, with
              the reason and a better move.
            </p>
            <Button
              variant="outline"
              className="justify-self-start"
              onClick={() => {
                setIndex(0);
                setPicked(null);
                setScore(0);
              }}
            >
              <RotateCcw aria-hidden="true" />
              Try again
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="grid gap-4"
          >
            <div className="rounded-lg border bg-surface px-4 py-3">
              <p className="text-xs text-muted-foreground">{item.from}</p>
              <p className="mt-1 text-[15px] leading-normal">{item.message}</p>
            </div>
            <div className="grid gap-2">
              {item.options.map((option, i) => {
                const revealed = picked !== null;
                const chosen = picked === i;
                return (
                  <button
                    key={option.text}
                    type="button"
                    disabled={revealed}
                    aria-pressed={chosen}
                    onClick={() => choose(i)}
                    className={cn(
                      "grid gap-2 rounded-lg border px-4 py-3 text-left text-sm outline-none transition-colors duration-150 ease-out",
                      "focus-visible:ring-2 focus-visible:ring-ring",
                      !revealed && "hover:border-ink hover:bg-ink-soft",
                      chosen && "border-ink",
                      revealed && !chosen && "opacity-80",
                    )}
                  >
                    <span className="leading-normal">{option.text}</span>
                    {revealed && (
                      <motion.span
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="grid gap-1.5 overflow-hidden"
                      >
                        <MoveLabelBadge
                          label={option.label}
                          size="sm"
                          className="justify-self-start"
                        />
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {option.why}
                        </span>
                      </motion.span>
                    )}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <Button
                className="justify-self-end"
                onClick={() => {
                  setIndex((n) => n + 1);
                  setPicked(null);
                }}
              >
                {index + 1 < WARM_UPS.length ? "Next" : "See result"}
                <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function PreparingCase({
  failed,
  onRetry,
  retrying = false,
}: {
  /** Only when the server reports the generation failed. Slowness is never a failure. */
  failed?: boolean;
  onRetry: () => void;
  retrying?: boolean;
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

  const activeIndex = STAGES.reduce(
    (current, stage, i) => (seconds >= stage.at ? i : current),
    0,
  );
  const slow = seconds >= SLOW_AFTER_SEC;

  if (failed)
    return (
      <main className="mx-auto grid w-full max-w-lg gap-5 px-4 py-16">
        <div className="rounded-xl border bg-card p-6 sm:p-8">
          <p className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Your next case
          </p>
          <h1 className="text-2xl font-medium tracking-tight">
            We could not prepare this case
          </h1>
          <p className="mb-6 mt-3 text-sm leading-relaxed text-muted-foreground">
            Something went wrong on our side. No practice time has been used.
            Try again, and we will write a new case for you.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onRetry} disabled={retrying}>
              {retrying ? "Starting again…" : "Prepare a new case"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Back to practice</Link>
            </Button>
          </div>
        </div>
      </main>
    );

  return (
    <main className="mx-auto grid w-full max-w-4xl items-start gap-6 px-4 py-10 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="rounded-xl border bg-card p-6 sm:p-8">
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Your next case
          </p>
          <span
            className="font-mono text-xs text-muted-foreground tabular-nums"
            aria-hidden="true"
          >
            {formatClock(seconds)}
          </span>
        </div>
        <h1 className="text-2xl font-medium tracking-tight">
          Preparing your case
        </h1>
        <p className="mb-7 mt-3 text-sm leading-relaxed text-muted-foreground">
          We are writing a case for your profile. This usually takes one to two
          minutes. The timer has not started.
        </p>
        <StepChecklist
          steps={STAGES.map((stage, i) => ({
            id: String(i),
            label: stage.label,
            status:
              i < activeIndex
                ? "done"
                : i === activeIndex
                  ? "active"
                  : "pending",
          }))}
        />
        <div
          className="mt-6 h-1 overflow-hidden rounded-sm bg-muted"
          aria-hidden="true"
        >
          <motion.div
            className="h-full rounded-sm bg-ink"
            initial={{ width: "4%" }}
            animate={{ width: `${Math.min(92, 4 + (seconds / 110) * 88)}%` }}
            transition={{ duration: 1, ease: "linear" }}
          />
        </div>
        <p
          role="status"
          className="mt-4 text-xs leading-relaxed text-muted-foreground"
        >
          {slow
            ? "This is taking longer than usual. We are still working on it, and the page will open the brief as soon as it is ready."
            : "The page opens the brief as soon as the case is ready. You can stay here."}
        </p>
      </div>
      <WarmUpCard />
    </main>
  );
}
