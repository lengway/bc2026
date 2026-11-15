import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { PageHeading, Surface } from "@/app/_components/product";
import { Button } from "@/ui/primitives/button";

const questions = [
  {
    title: "How are my moves evaluated?",
    answer:
      "Your review assesses key decisions against the case rubric. Each assessed move has a label and evidence from the conversation. Accuracy summarizes how well your moves matched the available choices in the simulation.",
  },
  {
    title: "How do I earn a skill certificate?",
    answer:
      "A series uses your three most recent scored cases for the skill within 30 days, across at least two different scenarios. Each case must show rubric evidence for the skill and score at least 70% in it. The series must average at least 70% case Accuracy, with no client walkouts. Confirm your email to receive a certificate.",
  },
  {
    title: "How does Copilot work?",
    answer:
      "Ask Copilot for ideas during a case. One suggestion may contain a deliberately misleading detail. Check it against the case documents and conversation before acting. Your review considers how you used that advice.",
  },
  {
    title: "Who can see my results?",
    answer:
      "Only you can open your case history and private reviews. Anyone with a public link can view the published certificate or case record. Some public records include selected moves or conversation details. You can disable a link in Privacy & data.",
  },
];

export default function HelpPage() {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <PageHeading title="Help">
        Answers about cases, reviews and certificates.
      </PageHeading>
      <Surface className="divide-y py-1 sm:py-1">
        {questions.map(({ title, answer }) => (
          <details className="group py-1" key={title}>
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              {title}
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
                strokeWidth={1.5}
              />
            </summary>
            <p className="max-w-prose pb-4 text-sm leading-relaxed text-muted-foreground">
              {answer}
            </p>
          </details>
        ))}
      </Surface>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild className="min-h-11">
          <Link href="/settings/privacy">Privacy settings</Link>
        </Button>
        <Button variant="ghost" asChild className="min-h-11">
          <a href="https://github.com/lengway/bc2026/issues/new">
            Contact the project team
          </a>
        </Button>
      </div>
    </main>
  );
}
