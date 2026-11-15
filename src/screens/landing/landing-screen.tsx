import {
  ArrowRight,
  ChartNoAxesCombined,
  FileText,
  MessageSquare,
  Plus,
} from "lucide-react";
import Link from "next/link";
import type { SkillCertificateLimited } from "@/contracts";
import { SkillCertificateCard } from "@/app/_components/skill-certificate-card";
import { cn } from "@/ui/lib/utils";
import { Button } from "@/ui/primitives/button";
import { GambitMark } from "@/ui/brand";
import { ThemeToggle } from "@/ui/theme-toggle";
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
  sampleCertificate: SkillCertificateLimited;
};

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#certificate", label: "Sample certificate" },
  { href: "#employers", label: "For employers" },
  { href: "#pricing", label: "Pricing" },
];

const STEPS = [
  {
    Icon: FileText,
    title: "Read the account",
    body: "Get a buyer, a goal, and the emails and notes your team would have.",
  },
  {
    Icon: MessageSquare,
    title: "Work the deal",
    body: "Write to the buyer in your own words. Ask Copilot for help and check its advice against the case.",
  },
  {
    Icon: ChartNoAxesCombined,
    title: "Review the conversation",
    body: "Replay your moves and see where you gained trust, missed evidence, or could have closed more clearly.",
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
    body: "You see the skill, level, and the three results that qualified. Pro certificates also show one key move per case.",
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
      "A skill certificate shows the skill, level, and results from three qualifying cases. Pro certificates also show one key move from each case. Individual case records have their own links.",
  },
  {
    question: "Which fields are available?",
    answer:
      "Sales is available now. Project management and software are coming soon.",
  },
];

function SectionHeading({
  title,
  lead,
  className,
}: {
  title: string;
  lead?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-2xl flex-col gap-3", className)}>
      <h2 className="m-0 text-2xl font-medium tracking-tight sm:text-4xl">
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
            <GambitMark className="size-5" />
            <span className="text-lg leading-none tracking-tight">
              {productName}
            </span>
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
            <ThemeToggle />
            <Button asChild variant="ghost" size="lg">
              <Link href={hrefs.signIn}>Sign in</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={hrefs.start}>Start a case</Link>
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
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-x-14 gap-y-12 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
            <div className="flex flex-col gap-6">
              <h1 className="m-0 text-4xl font-medium tracking-tight text-balance sm:text-5xl">
                Practice real sales conversations.
              </h1>
              <p className="m-0 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Work through buyer objections and negotiations using account
                documents. Get a replay that shows where your approach worked
                and what to try next.
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Button asChild size="lg">
                  <Link href="/challenge">
                    Try the free challenge
                    <ArrowRight aria-hidden="true" data-icon="inline-end" />
                  </Link>
                </Button>
                <Link
                  href={hrefs.start}
                  className="flex min-h-11 items-center text-sm font-medium text-ink underline underline-offset-4 hover:text-ink-hover"
                >
                  Start your first case
                </Link>
              </div>
            </div>
            <ReviewPreview {...preview} />
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-8 border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8 sm:py-20">
            <SectionHeading title="How it works" />
            <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
              {STEPS.map(({ Icon, title, body }) => (
                <li
                  key={title}
                  className="flex flex-col gap-3 rounded-xl border bg-card p-5 sm:p-6"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-5 text-ink"
                    strokeWidth={1.5}
                  />
                  <h3 className="m-0 text-base font-medium">{title}</h3>
                  <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="certificate" className="scroll-mt-8 border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8 sm:py-20">
            <SectionHeading
              title="Earn a skill certificate"
              lead="A certificate shows the skill, level, and results from three qualifying simulations within 30 days. Each certificate has a link you can share."
            />
            <SkillCertificateCard
              certificate={sampleCertificate}
              titleAs="h3"
            />
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
          <div className="mx-auto grid w-full max-w-6xl gap-x-14 gap-y-10 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <SectionHeading title="What employers can see" />
            <ol className="m-0 flex list-none flex-col p-0">
              {EMPLOYER_POINTS.map((point) => (
                <li
                  key={point.title}
                  className="space-y-1.5 border-t py-5 first:border-t-0 first:pt-0"
                >
                  <h3 className="m-0 text-base font-medium">{point.title}</h3>
                  <p className="m-0 text-sm leading-relaxed text-muted-foreground">
                    {point.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="pricing" className="scroll-mt-8 border-b">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-8 sm:py-20">
            <SectionHeading
              title="Pricing"
              lead="Your first case is free. Free accounts get one practice case every 7 days. Pro includes unlimited practice cases."
            />
            <LandingPricing startHref={hrefs.start} />
          </div>
        </section>

        <section id="faq" className="scroll-mt-8 border-b">
          <div className="mx-auto grid w-full max-w-6xl gap-x-14 gap-y-8 px-4 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <SectionHeading title="Frequently asked questions" />
            <div className="flex flex-col">
              {FAQ.map((item) => (
                <details
                  key={item.question}
                  className="group border-t py-1 last:border-b"
                >
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-md text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    {item.question}
                    <Plus
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none group-open:rotate-45"
                    />
                  </summary>
                  <p className="m-0 max-w-prose pb-4 text-[15px] leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-8 text-sm text-muted-foreground sm:px-8">
          <p className="m-0 flex items-center gap-2.5 font-medium text-foreground">
            <GambitMark className="size-4" />
            <span className="text-base leading-none tracking-tight">
              {productName}
            </span>
          </p>
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center gap-x-6 gap-y-1"
          >
            {NAV.filter((item) => item.href !== "#pricing").map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/pricing"
              className="flex min-h-11 items-center hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/terms"
              className="flex min-h-11 items-center hover:text-foreground"
            >
              Terms
            </Link>
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
