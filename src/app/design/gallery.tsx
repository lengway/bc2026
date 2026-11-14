"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AccuracyStat,
  CaseTimer,
  CertificateCard,
  ChatMessage,
  DocViewer,
  MOVE_LABEL_ORDER,
  MoveDetail,
  MoveLabelBadge,
  MoveTimeline,
  PersonaCard,
  PracticeRecord,
  PricingTable,
  SkillProgress,
  StepChecklist,
  TrustCurveChart,
  TwistNotice,
  TypingIndicator,
  formatOutcome,
  type BillingPeriod,
} from "@/ui";
import { cn } from "@/ui/lib/utils";
import { Button } from "@/ui/primitives/button";
import {
  certificateFull,
  certificateLimited,
  docs,
  evaluation,
  moves,
  persona,
  practiceDays,
  preparingSteps,
  skillPath,
} from "./fixtures";

const SWATCHES = [
  { name: "Background", className: "bg-background" },
  { name: "Surface", className: "bg-surface" },
  { name: "Muted", className: "bg-muted" },
  { name: "Border", className: "bg-border" },
  { name: "Muted text", className: "bg-muted-foreground" },
  { name: "Foreground", className: "bg-foreground" },
  { name: "Ink", className: "bg-ink" },
  { name: "Ink soft", className: "bg-ink-soft" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 border-t pt-8">
      <h2 className="m-0 font-mono text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DesignGallery() {
  const [dark, setDark] = useState(false);
  const [selectedSeq, setSelectedSeq] = useState<number>(moves[5].seq);
  const [billing, setBilling] = useState<BillingPeriod>("monthly");

  const selectedIndex = Math.max(
    0,
    moves.findIndex((move) => move.seq === selectedSeq),
  );
  const selectedMove = moves[selectedIndex];
  const trustBefore = selectedIndex > 0 ? moves[selectedIndex - 1].trustAfter : null;

  return (
    <div className={cn(dark && "dark", "min-h-full bg-background text-foreground")}>
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="m-0 font-mono text-xs tracking-wider text-muted-foreground uppercase">
              Design system · Ledger
            </p>
            <h1 className="m-0 font-serif text-display font-normal tracking-tight">
              Component gallery
            </h1>
          </div>
          <Button variant="outline" aria-pressed={dark} onClick={() => setDark((v) => !v)}>
            {dark ? "Light theme" : "Dark theme"}
          </Button>
        </header>

        <nav aria-label="Screens" className="flex flex-wrap items-center gap-2 text-sm">
          <span className="mr-2 font-mono text-xs text-muted-foreground uppercase">Screens</span>
          <Button asChild variant="outline">
            <Link href="/design/landing">Landing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/design/review">Review</Link>
          </Button>
        </nav>

        <Section title="Color">
          <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-4 lg:grid-cols-8">
            {SWATCHES.map((swatch) => (
              <li key={swatch.name} className="flex flex-col gap-2">
                <span className={cn("block h-14 rounded-lg border", swatch.className)} />
                <span className="text-[13px] font-medium">{swatch.name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Type">
          <div className="flex flex-col gap-4">
            <p className="m-0 font-serif text-display-lg tracking-tight">
              Prove what you can do.
            </p>
            <p className="m-0 font-serif text-display tracking-tight">
              Certificate of demonstrated skill
            </p>
            <p className="m-0 text-2xl font-medium tracking-tight">Review every move</p>
            <p className="m-0 max-w-prose text-base text-muted-foreground">
              Work a realistic case against a live counterpart, with a copilot at your side.
            </p>
            <p className="m-0 font-mono text-sm tabular-nums">CERT-7F3K-2291 · 05:41 · 74%</p>
          </div>
        </Section>

        <Section title="Controls">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Share certificate</Button>
            <Button variant="outline">Next case</Button>
            <Button variant="secondary">Save draft</Button>
            <Button variant="ghost">Cancel</Button>
            <Button disabled>Submitting</Button>
          </div>
        </Section>

        <Section title="Move labels">
          <div className="flex flex-wrap gap-2">
            {MOVE_LABEL_ORDER.map((label) => (
              <MoveLabelBadge key={label} label={label} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {MOVE_LABEL_ORDER.map((label) => (
              <MoveLabelBadge key={label} label={label} variant="glyph" size="sm" />
            ))}
          </div>
        </Section>

        <Section title="Review">
          <div className="flex flex-wrap items-end gap-x-12 gap-y-6">
            <AccuracyStat accuracy={evaluation.accuracy} animate size="xl" />
            <dl className="m-0 grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Outcome</dt>
              <dd className="m-0 font-medium">{formatOutcome(evaluation.outcome)}</dd>
              <dt className="text-muted-foreground">AI dependency</dt>
              <dd className="m-0 font-mono tabular-nums">{evaluation.aiDependency === null ? "Unavailable" : `${evaluation.aiDependency}%`}</dd>
              <dt className="text-muted-foreground">Copilot trap</dt>
              <dd className="m-0 font-medium">{{ caught: "Caught", missed: "Missed", not_presented: "Not presented", insufficient_evidence: "Insufficient evidence" }[evaluation.trapResult]}</dd>
            </dl>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <TrustCurveChart
              curve={evaluation.trustCurve}
              moves={moves}
              selectedSeq={selectedSeq}
              onSelectMove={setSelectedSeq}
              personaName={persona.name}
            />
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <MoveTimeline moves={moves} selectedSeq={selectedSeq} onSelectMove={setSelectedSeq} />
            <MoveDetail
              move={selectedMove}
              moveNumber={selectedIndex + 1}
              totalMoves={moves.length}
              personaName={persona.name}
              trustBefore={trustBefore}
              timeLabel="05:41"
            />
          </div>
        </Section>

        <Section title="Workspace">
          <div className="flex flex-wrap items-center gap-3">
            <CaseTimer remainingSec={259} />
            <CaseTimer remainingSec={45} />
            <CaseTimer remainingSec={0} />
          </div>
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <PersonaCard persona={persona} />
              <PersonaCard persona={persona} variant="compact" />
            </div>
            <div className="flex flex-col gap-4 rounded-xl border bg-surface p-5">
              <ChatMessage actor="system" content="Case started · 08:00 on the clock" />
              <ChatMessage actor="user" content={moves[0].userText} timeLabel="10:31" />
              <ChatMessage
                actor="persona"
                authorName={persona.name}
                content="Busy. March was rough. What do you need from me today?"
                timeLabel="10:31"
              />
              <TwistNotice
                kind="email"
                from="Marcus Reyes, CFO"
                content="Dana, I need the vendor decision by Thursday. If the routing issue is not fixed in writing, we move."
                timeLabel="10:34"
                onOpen={() => undefined}
              />
              <ChatMessage
                actor="copilot"
                content="Her contract qualifies for the 15% volume tier. You could lead with that."
                timeLabel="10:35"
              />
              <ChatMessage actor="user" content={moves[1].userText} pending />
              <TypingIndicator name={persona.name} />
            </div>
          </div>
        </Section>

        <Section title="Documents">
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {docs.map((doc, index) => (
              <DocViewer key={doc.id} doc={doc} isNew={index === 2} />
            ))}
          </div>
        </Section>

        <Section title="Certificate · limited">
          <CertificateCard
            certificate={certificateLimited}
            verifyUrl="product.example/c/7f3k-2291"
            onShare={() => undefined}
          />
        </Section>

        <Section title="Certificate · full">
          <CertificateCard
            certificate={certificateFull}
            verifyUrl="product.example/c/7f3k-2291"
            onShare={() => undefined}
            onViewFullReview={() => undefined}
          />
        </Section>

        <Section title="Skill path">
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5 rounded-xl border bg-card p-5">
              {skillPath.skills.map((skill) => (
                <SkillProgress key={skill.skill} skill={skill} />
              ))}
            </div>
            <div className="rounded-xl border bg-card p-5">
              <PracticeRecord streak={skillPath.streak} days={practiceDays} />
            </div>
          </div>
        </Section>

        <Section title="Preparing your case">
          <div className="max-w-md rounded-xl border bg-card p-6">
            <StepChecklist steps={preparingSteps} />
          </div>
        </Section>

        <Section title="Pricing">
          <PricingTable
            billing={billing}
            onBillingChange={setBilling}
            onSelectPlan={() => undefined}
            currentPlan="free"
          />
        </Section>
      </main>
    </div>
  );
}
