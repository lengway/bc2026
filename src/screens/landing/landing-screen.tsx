import { ArrowRight, Check, Minus } from "lucide-react";
import Link from "next/link";
import type { CertificateLimited } from "@/contracts";
import { CertificateCard, Reveal } from "@/ui";
import { cn } from "@/ui/lib/utils";
import { Button } from "@/ui/primitives/button";
import { LandingPricing } from "./landing-pricing";
import { ReviewPreview, type ReviewPreviewData } from "./review-preview";

export type LandingScreenProps = {
  productName?: string;
  hrefs: {
    /** Sign-up that leads into the first case. */
    start: string;
    signIn: string;
    /** A public example certificate. */
    sampleCertificate: string;
  };
  /** Review shown in the hero. */
  preview: ReviewPreviewData;
  /** Certificate shown in the "sample certificate" section. */
  sampleCertificate: CertificateLimited;
};

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#certificate", label: "Sample certificate" },
  { href: "#employers", label: "For employers" },
  { href: "#pricing", label: "Pricing" },
];

const STEPS = [
  {
    title: "Get a realistic work case",
    body: "Tell us what you do. We write a case for your role and level: a counterpart with their own motives, and the documents you would have on a normal workday. No two cases are the same.",
  },
  {
    title: "Work it with an AI copilot",
    body: "Talk to the counterpart in your own words. There are no answer options. A copilot is there to help, and how you use it is part of the evaluation.",
  },
  {
    title: "Get a move-by-move review and a shareable record",
    body: "Every message you sent gets a label, from brilliant to blunder, with the reason and a better move. The result is a link an employer can open.",
  },
];

const COMPARISON = [
  {
    topic: "What it shows",
    course: "That you finished a course",
    proof: "How you handled a recorded simulation",
  },
  {
    topic: "The task",
    course: "The same quiz for everyone",
    proof: "A unique case written for your role",
  },
  {
    topic: "Your answers",
    course: "Multiple choice",
    proof: "Free text, in your own words",
  },
  {
    topic: "AI use",
    course: "Invisible. A chatbot can complete it",
    proof: "Observed in the workspace, with clear limits",
  },
  {
    topic: "What an employer sees",
    course: "A title and a date",
    proof: "Accuracy, key moves and the full conversation",
  },
];

const EMPLOYER_POINTS = [
  {
    title: "The work is recorded",
    body: "Review a timed simulation and the assistance observed inside its workspace. This is not identity verification or proof of unaided authorship.",
  },
  {
    title: "The case was unique",
    body: "It was generated for this candidate. There is no answer key to find and no previous cohort to copy from.",
  },
  {
    title: "The process is visible",
    body: "You see the accuracy, three key moves and how trust changed during the conversation. The full review is one click away.",
  },
];

const FAQ = [
  {
    question: "How long does a case take?",
    answer:
      "Your first case takes 8 minutes. A daily case takes about 10. A weekly case is longer, 30 to 40 minutes, with changes of direction along the way.",
  },
  {
    question: "Is every case really unique?",
    answer:
      "Cases are generated for your field, role and level, with a counterpart and supporting documents.",
  },
  {
    question: "Can I use AI during a case?",
    answer:
      "Yes. Copilot is allowed. We review how you check and apply its advice, separately from case performance. Unobserved external help cannot be ruled out.",
  },
  {
    question: "What does an employer see?",
    answer:
      "With a free certificate: your skill and level, accuracy, the outcome and a short characterization. With Pro: the key moves, the trust curve and the full review of the conversation.",
  },
  {
    question: "Which fields are available?",
    answer:
      "Sales is available now. Project management and software are coming soon.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", className)}>
      <p className="m-0 font-mono text-xs tracking-wider text-muted-foreground uppercase">
        {eyebrow}
      </p>
      <h2 className="m-0 font-serif text-display-sm font-normal tracking-tight sm:text-display">
        {title}
      </h2>
      {lead ? (
        <p className="m-0 text-base leading-relaxed text-muted-foreground">
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/** Marketing landing page. Server-renderable: only links, no callbacks. */
export function LandingScreen({
  productName = "Gambit",
  hrefs,
  preview,
  sampleCertificate,
}: LandingScreenProps) {
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-raised"
      >
        Skip to content
      </a>

      <header className="border-b">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-2 px-4 sm:px-8">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 text-[15px] font-semibold tracking-tight"
          >
            <span aria-hidden="true" className="size-4.5 rounded-sm bg-ink" />
            {productName}
          </Link>
          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 text-sm md:flex"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="lg">
              <Link href={hrefs.signIn}>Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={hrefs.start}>Start free</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main" className="flex flex-col">
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage:
                "radial-gradient(ellipse at 72% 42%, black 10%, transparent 70%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-x-14 gap-y-12 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
            <div className="flex flex-col gap-7">
              <p className="m-0 font-mono text-xs tracking-wider text-muted-foreground uppercase">
                Sales · Live case · 8 minutes
              </p>
              <h1 className="m-0 font-serif text-display font-normal tracking-tight text-balance sm:text-display-lg">
                Practice the moments that matter at work.
              </h1>
              <p className="m-0 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Work a realistic sales case against a live AI counterpart, with
                a copilot at your side. Every move is reviewed like a chess
                game, and the result is a certificate an reader can explore,
                with evidence and clear limitations.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button asChild size="lg" className="h-12 px-5 text-[15px]">
                  <Link href={hrefs.start}>
                    Take your first case — free, 8 minutes
                    <ArrowRight
                      aria-hidden="true"
                      strokeWidth={1.5}
                      data-icon="inline-end"
                    />
                  </Link>
                </Button>
                <Link
                  href={hrefs.sampleCertificate}
                  className="flex min-h-11 items-center text-[15px] font-medium text-ink underline underline-offset-4 hover:text-ink-hover"
                >
                  View a sample certificate
                </Link>
              </div>
              <p className="m-0 text-sm text-muted-foreground">
                Open responses, source documents, and an optional Copilot.
              </p>
            </div>
            <ReviewPreview {...preview} />
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-8 border-b">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8 sm:py-20">
            <Reveal>
              <SectionHeading
                eyebrow="How it works"
                title="One case. Ten minutes. A record of how you work."
              />
            </Reveal>
            <ol className="m-0 grid list-none gap-x-10 gap-y-8 p-0 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <Reveal
                    delay={index * 0.06}
                    className="flex flex-col gap-3 border-t pt-5"
                  >
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="m-0 text-xl font-medium tracking-tight">
                      {step.title}
                    </h3>
                    <p className="m-0 text-[15px] leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8 sm:py-20">
            <Reveal>
              <SectionHeading
                eyebrow="Not a quiz"
                title="A course certificate says you attended. This shows the work."
              />
            </Reveal>
            <Reveal className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full min-w-[40rem] border-collapse text-[15px]">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="w-1/4 px-5 py-3.5 font-medium">
                      <span className="sr-only">Topic</span>
                    </th>
                    <th
                      scope="col"
                      className="w-[37.5%] px-5 py-3.5 font-medium"
                    >
                      Course certificate
                    </th>
                    <th
                      scope="col"
                      className="w-[37.5%] bg-ink-soft px-5 py-3.5 font-medium text-ink"
                    >
                      {productName} proof
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.topic} className="border-b last:border-b-0">
                      <th
                        scope="row"
                        className="px-5 py-4 text-left text-sm font-medium"
                      >
                        {row.topic}
                      </th>
                      <td className="px-5 py-4 text-muted-foreground">
                        <span className="flex items-start gap-2.5">
                          <Minus
                            aria-hidden="true"
                            className="mt-1 size-4 shrink-0"
                            strokeWidth={1.5}
                          />
                          {row.course}
                        </span>
                      </td>
                      <td className="bg-ink-soft px-5 py-4">
                        <span className="flex items-start gap-2.5">
                          <Check
                            aria-hidden="true"
                            className="mt-1 size-4 shrink-0 text-ink"
                            strokeWidth={1.5}
                          />
                          {row.proof}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>
        </section>

        <section id="certificate" className="scroll-mt-8 border-b">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8 sm:py-20">
            <Reveal>
              <SectionHeading
                eyebrow="Sample certificate"
                title="A link, not a PDF."
                lead="Each certificate has its own address. It states the skill, the level, the result and a short characterization. It also states what went wrong, which is why it can be trusted."
              />
            </Reveal>
            <Reveal>
              <CertificateCard
                certificate={sampleCertificate}
                issuer={productName}
              />
            </Reveal>
            <Link
              href={hrefs.sampleCertificate}
              className="flex min-h-11 items-center gap-2 self-start text-[15px] font-medium text-ink underline underline-offset-4 hover:text-ink-hover"
            >
              Open the sample certificate
              <ArrowRight
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.5}
              />
            </Link>
          </div>
        </section>

        <section id="employers" className="scroll-mt-8 border-b bg-surface">
          <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-10 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Reveal>
              <SectionHeading
                eyebrow="For employers"
                title="Read it in 30 seconds."
                lead="You do not have to watch a recording or trust a badge. Open the link a candidate sent you and see how they actually handled the situation."
              />
            </Reveal>
            <ol className="m-0 flex list-none flex-col p-0">
              {EMPLOYER_POINTS.map((point, index) => (
                <li
                  key={point.title}
                  className="border-t py-5 first:border-t-0 first:pt-0"
                >
                  <Reveal
                    delay={index * 0.06}
                    className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 gap-y-1.5"
                  >
                    <span className="pt-1 font-mono text-xs text-muted-foreground tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="m-0 text-xl font-medium tracking-tight">
                      {point.title}
                    </h3>
                    <p className="col-start-2 m-0 text-[15px] leading-relaxed text-muted-foreground">
                      {point.body}
                    </p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-8 border-b">
          <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8 sm:py-20">
            <Reveal>
              <SectionHeading
                eyebrow="Pricing"
                title="Start free. Pay when the proof matters."
                lead="The first case and its certificate are free. Pro adds unlimited daily cases and the full verifiable review on every certificate."
              />
            </Reveal>
            <Reveal>
              <LandingPricing startHref={hrefs.start} />
            </Reveal>
          </div>
        </section>

        <section id="faq" className="scroll-mt-8 border-b">
          <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-8 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <SectionHeading eyebrow="Questions" title="Before you start." />
            <div className="flex flex-col">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group border-t py-1 last:border-b"
                >
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <span
                      aria-hidden="true"
                      className="font-mono text-lg leading-none text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="m-0 max-w-prose pb-4 text-[15px] leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-16 sm:px-8 sm:py-20">
            <h2 className="m-0 max-w-2xl font-serif text-display-sm font-normal tracking-tight text-balance sm:text-display">
              Eight minutes from now you can have something to show.
            </h2>
            <Button asChild size="lg" className="h-12 px-5 text-[15px]">
              <Link href={hrefs.start}>
                Take your first case — free, 8 minutes
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.5}
                  data-icon="inline-end"
                />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-8 text-sm text-muted-foreground sm:px-8">
          <p className="m-0 flex items-center gap-2.5 font-medium text-foreground">
            <span aria-hidden="true" className="size-4 rounded-sm bg-ink" />
            {productName}
          </p>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-6 gap-y-1"
          >
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <a
              href="#faq"
              className="flex min-h-11 items-center hover:text-foreground"
            >
              Questions
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
