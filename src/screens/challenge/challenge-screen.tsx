"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clipboard, RotateCcw, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GambitMark } from "@/ui/brand";
import { Button } from "@/ui/primitives/button";
import { challengeScenarios } from "./challenge-data";

export function ChallengeScreen() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const exerciseHeading = useRef<HTMLHeadingElement>(null);
  const scoreHeading = useRef<HTMLHeadingElement>(null);
  const scenario = challengeScenarios[Math.min(step, challengeScenarios.length - 1)];
  const complete = step >= challengeScenarios.length;
  const score = answers.filter((answer, index) => challengeScenarios[index]?.choices[answer]?.correct).length;
  const scoreText = `Gambit Challenge: ${score}/${challengeScenarios.length} correct · ${challengeScenarios.length} exercises completed`;
  const challengeUrl = typeof window === "undefined" ? "https://gambit.lengway.me/challenge" : `${window.location.origin}/challenge`;
  const shareText = `${scoreText}\nPlay the challenge: ${challengeUrl}`;

  useEffect(() => {
    if (step > 0 && !complete) exerciseHeading.current?.focus();
    if (complete) scoreHeading.current?.focus();
  }, [complete, step]);

  async function copyScore() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(shareText);
      setNotice("Score copied. Share it wherever you like.");
    } catch {
      setNotice("Copy isn't available here. Select and copy the score and challenge link above.");
    }
  }

  async function shareScore() {
    if (!navigator.share) {
      setNotice("Native sharing isn't available here. Use Copy score instead; it includes the challenge link.");
      return;
    }
    try {
      await navigator.share({ title: "My Gambit Challenge score", text: shareText, url: challengeUrl });
      setNotice("Score shared.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setNotice("Sharing didn't work. Use Copy score instead.");
    }
  }

  function chooseAnswer(answer: number) {
    setAnswers((current) => current.length > step ? current : [...current, answer]);
    setNotice("");
  }

  function advance() {
    if (answers.length <= step) return;
    setStep((current) => current + 1);
  }

  function replay() {
    setStep(0);
    setAnswers([]);
    setNotice("");
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link href="/" className="flex min-h-11 items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <GambitMark className="size-5" />
            <span className="font-serif text-2xl leading-none tracking-tight">Gambit</span>
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="m-0 font-mono text-xs tracking-wider text-muted-foreground uppercase">A 3-minute practice</p>
            <h1 className="m-0 mt-2 font-serif text-display-sm font-normal tracking-tight sm:text-display">Spot the mismatch</h1>
            <p className="m-0 mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Copilot sounds confident. Check the documents before you commit to a reply.</p>
          </div>
          <div className="min-w-40" aria-label={`Exercise ${Math.min(step + 1, challengeScenarios.length)} of ${challengeScenarios.length}`}>
            <div className="mb-2 flex justify-between font-mono text-xs text-muted-foreground">
              <span>Progress</span><span>{answers.length} / {challengeScenarios.length}</span>
            </div>
            <div className="flex gap-1.5" aria-hidden="true">
              {challengeScenarios.map((item, index) => (
                <span key={item.title} className={`h-1.5 flex-1 rounded-sm ${index < answers.length ? "bg-ink" : "bg-border"}`} />
              ))}
            </div>
          </div>
        </div>

        {complete ? (
          <section className="mx-auto max-w-2xl rounded-lg border bg-card p-6 shadow-card sm:p-10" aria-labelledby="score-heading">
            <div className="mb-5 inline-flex size-11 items-center justify-center rounded-md bg-ink-soft text-ink"><Check aria-hidden="true" className="size-5" /></div>
            <p className="m-0 font-mono text-xs tracking-wider text-muted-foreground uppercase">Three exercises completed</p>
            <h2 id="score-heading" ref={scoreHeading} tabIndex={-1} className="m-0 mt-2 font-serif text-display-sm font-normal tracking-tight focus:outline-none">Your challenge score</h2>
            <p className="m-0 mt-5 font-serif text-5xl tracking-tight" aria-label={`${score} of ${challengeScenarios.length} correct`}>{score}<span className="text-muted-foreground"> / {challengeScenarios.length}</span></p>
            <p className="m-0 mt-3 text-sm text-muted-foreground">Calculated from your choices across all three scenarios. Your responses stayed in this browser.</p>
            <div className="mt-6 rounded-md border bg-surface p-4 font-mono text-sm" aria-label="Shareable score">{scoreText}<br /><a className="underline" href={challengeUrl}>{challengeUrl}</a></div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button onClick={copyScore} className="min-h-11 gap-2"><Clipboard aria-hidden="true" className="size-4" />Copy score</Button>
              <Button variant="outline" onClick={shareScore} className="min-h-11 gap-2"><Share2 aria-hidden="true" className="size-4" />Share</Button>
              <Button variant="ghost" onClick={replay} className="min-h-11 gap-2"><RotateCcw aria-hidden="true" className="size-4" />Play again</Button>
              <Button variant="outline" asChild className="min-h-11"><Link href="/">Continue to full practice</Link></Button>
            </div>
            <p role="status" aria-live="polite" className="m-0 mt-3 min-h-5 text-sm text-muted-foreground">{notice}</p>
          </section>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start" aria-labelledby="exercise-heading">
            <div className="contents lg:flex lg:flex-col lg:gap-5">
              <div className="order-1 lg:order-none lg:col-start-1">
                <p className="m-0 font-mono text-xs tracking-wider text-muted-foreground uppercase">Exercise {step + 1}</p>
                <h2 id="exercise-heading" ref={exerciseHeading} tabIndex={-1} className="m-0 mt-2 font-serif text-display-sm font-normal tracking-tight focus:outline-none">{scenario.title}</h2>
                <p className="m-0 mt-3 text-sm leading-relaxed">{scenario.context}</p>
              </div>
              <aside className="order-2 rounded-lg border border-ink-border bg-ink-soft p-5 lg:order-none" aria-label="Copilot suggestion">
                <p className="m-0 font-mono text-[11px] tracking-wider text-ink uppercase">Copilot suggests</p>
                <blockquote className="m-0 mt-3 text-sm leading-relaxed">“{scenario.copilotClaim}”</blockquote>
              </aside>
              <div className="order-4 rounded-lg border bg-card p-5 shadow-card lg:order-none">
                <p className="m-0 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Your reply</p>
                <h3 className="m-0 mt-2 text-base font-semibold">{scenario.prompt}</h3>
                <div className="mt-4 flex flex-col gap-2" role="group" aria-label="Choose your reply">
                  {scenario.choices.map((choice, index) => (
                    <button key={choice.label} type="button" onClick={() => chooseAnswer(index)} disabled={answers.length > step} aria-pressed={answers[step] === index} className={`group flex min-h-12 items-start gap-3 rounded-md border bg-background px-3 py-3 text-left text-sm leading-relaxed transition-colors hover:border-ink-border hover:bg-ink-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-100 ${answers.length > step && answers[step] === index ? choice.correct ? "border-label-best bg-label-best-soft" : "border-label-risk bg-label-risk-soft" : ""}`}>
                      <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm border font-mono text-[11px] text-muted-foreground group-hover:border-ink group-hover:text-ink">{String.fromCharCode(65 + index)}</span>{choice.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="contents lg:flex lg:flex-col lg:gap-5">
              <article className="order-3 overflow-hidden rounded-lg border bg-card shadow-card lg:order-none lg:col-start-2 lg:row-start-1">
                <header className="border-b bg-surface px-5 py-4">
                  <p className="m-0 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">Document to inspect</p>
                  <h3 className="m-0 mt-1 text-base font-semibold">{scenario.documentTitle}</h3>
                  <p className="m-0 mt-1 text-xs text-muted-foreground">{scenario.documentMeta}</p>
                </header>
                <dl className="m-0 divide-y px-5">
                  {scenario.documentLines.map((line) => (
                    <div key={line.label} className={`grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-4 ${line.highlight && answers.length > step ? "-mx-2 bg-ink-soft px-2" : ""}`}>
                      <dt className="font-mono text-xs text-muted-foreground">{line.label}</dt>
                      <dd className="m-0 text-sm leading-relaxed">{line.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>

              {answers.length > step && (
                <div className="order-5 flex flex-col gap-4 lg:order-none" aria-live="polite">
                  <div role="region" aria-label="What the record says" className="rounded-lg border border-label-best bg-label-best-soft p-5">
                    <p className="m-0 font-mono text-[11px] tracking-wider text-label-best uppercase">What the record says</p>
                    <p className="m-0 mt-2 text-sm font-semibold">Your choice: {scenario.choices[answers[step]]?.label} — {scenario.choices[answers[step]]?.correct ? "Correct" : "Incorrect"}</p>
                    <p className="m-0 mt-2 font-medium leading-relaxed">{scenario.evidence}</p>
                    <p className="m-0 mt-3 text-sm leading-relaxed">{scenario.explanation}</p>
                  </div>
                  <div className="rounded-lg border bg-surface p-5">
                    <p className="m-0 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">What could happen</p>
                    <p className="m-0 mt-2 text-sm leading-relaxed">{scenario.consequence}</p>
                  </div>
                  <Button onClick={advance} className="min-h-11 gap-2 self-start">
                    {step === challengeScenarios.length - 1 ? "See results" : "Next exercise"} <ArrowRight aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
