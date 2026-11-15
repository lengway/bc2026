"use client";
import { useState } from "react";
import { ArrowRight, Clock, FileText } from "lucide-react";
import type { CaseView, PublicScoringGuide } from "@/contracts";
import { PersonaCard } from "@/ui";
import { Button } from "@/ui/primitives/button";
import { Surface, PageHeading } from "./product";
import { ErrorPanel } from "./error-panel";
export function ScoringGuide({ guide }: { guide: PublicScoringGuide }) {
  return (
    <details className="rounded-xl border bg-card p-5">
      <summary className="cursor-pointer text-sm font-medium">
        How scoring works
      </summary>
      <div className="mt-5 space-y-6 text-sm">
        <ul className="space-y-3">
          {guide.criteria.map((c) => (
            <li key={c.id}>
              <h3 className="font-medium">{c.title}</h3>
              <p className="mt-1 text-muted-foreground">{c.description}</p>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {Object.entries(guide.labelPoints).map(([label, points]) => (
            <span key={label} className="text-xs">
              <span className="capitalize">{label}</span>
              <span className="ml-2 font-mono text-muted-foreground">
                {points} points
              </span>
            </span>
          ))}
        </div>
        <dl className="grid gap-3">
          <div>
            <dt className="font-medium">Case performance</dt>
            <dd className="mt-1 font-mono text-xs text-muted-foreground">
              {guide.accuracyFormula}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Checking and applying AI advice</dt>
            <dd className="mt-1 font-mono text-xs text-muted-foreground">
              {guide.aiUseFormula}
            </dd>
          </div>
        </dl>
        <p className="text-muted-foreground">
          {guide.requiredCheckCount} required criteria. A partial result is
          shown when there is not enough evidence to assess all applicable
          criteria.
        </p>
        <p>
          <strong>Allowed tools:</strong> {guide.allowedTools.join(", ")}. Using
          help is not a penalty in itself.
        </p>
        <p className="text-xs text-muted-foreground">
          Method version: {guide.version}
        </p>
      </div>
    </details>
  );
}
export function CaseBriefScreen({
  view,
  starting,
  onStart,
  error,
}: {
  view: CaseView;
  starting: boolean;
  onStart: () => void;
  error?: Error | null;
}) {
  const [noticeRead, setNoticeRead] = useState(false);
  const caseLabel = view.type === "pressure" ? "Pressure" : view.type;
  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:px-8">
      <PageHeading
        eyebrow={`Case brief · ${caseLabel} · Sales`}
        title={view.brief.title}
      >
        {view.brief.mission}
      </PageHeading>
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-5">
          <Surface className="space-y-6">
            <div>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Your role
              </h2>
              <p className="text-sm leading-relaxed">{view.brief.yourRole}</p>
            </div>
            <div>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Success looks like
              </h2>
              <p className="text-sm leading-relaxed">
                {view.brief.successLooksLike}
              </p>
            </div>
            <p className="flex items-center gap-2 text-sm">
              <Clock aria-hidden="true" className="size-4 text-ink" />
              <span className="font-mono">
                {Math.ceil(view.brief.timeLimitSec / 60)} minutes
              </span>
              <span className="text-muted-foreground">
                The timer starts when you begin.
              </span>
            </p>
          </Surface>
          <ScoringGuide guide={view.scoringGuide} />
        </div>
        <aside className="grid gap-5">
          {view.personas.map((p) => (
            <PersonaCard key={p.id} persona={p} />
          ))}
          <Surface>
            <h2 className="mb-4 text-sm font-medium">Your documents</h2>
            <ul className="space-y-3">
              {view.docs.map((d) => (
                <li key={d.id} className="flex items-start gap-2 text-sm">
                  <FileText
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  {d.title}
                </li>
              ))}
            </ul>
          </Surface>
        </aside>
      </div>
      <Surface className="space-y-4">
        <h2 className="text-sm font-medium">Before you start</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {view.scoringGuide.observationNotice}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Editing activity and interaction summaries explain what was observed,
          not who wrote a message. External tools and other apps are not
          observed.
        </p>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-ink"
            checked={noticeRead}
            onChange={(e) => setNoticeRead(e.target.checked)}
          />
          I understand what is recorded in this workspace.
        </label>
      </Surface>
      {error && (
        <ErrorPanel error={error} retry={noticeRead ? onStart : undefined} />
      )}
      <div className="flex flex-wrap items-center gap-4">
        <Button size="lg" disabled={starting || !noticeRead} onClick={onStart}>
          {starting ? "Starting…" : "Start case"}
          <ArrowRight aria-hidden="true" />
        </Button>
        <p className="text-xs text-muted-foreground">
          Copilot is allowed. Check its advice against your documents.
        </p>
      </div>
    </main>
  );
}
