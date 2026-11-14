import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { SkillCertificateCard } from "@/app/_components/skill-certificate-card";
import { PublicShell } from "@/app/_components/product";
import { getPublicSkillCertificate } from "@/app/_lib/public-skill-certificate";
import { formatAverageAccuracy, formatSkill } from "@/ui/lib/format";
import { Button } from "@/ui/primitives/button";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const certificate = await getPublicSkillCertificate(slug).catch(() => null);
  return {
    title: certificate
      ? `${certificate.holderName} · ${formatSkill(certificate.skill)} skill certificate`
      : "Skill certificate",
    description: certificate
      ? `Level ${certificate.level} · ${formatAverageAccuracy(certificate.averageAccuracy)} average accuracy across ${certificate.cases.length} recorded cases.`
      : "A certificate for three qualifying recorded simulations.",
    robots: { index: false, follow: false },
    openGraph: { type: "website" },
  };
}

export default async function SkillCertificatePage({ params }: Props) {
  const { slug } = await params;
  await connection();
  const certificate = await getPublicSkillCertificate(slug);
  if (!certificate) notFound();

  const example = slug === "sample";

  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-8 sm:py-14">
        {example && (
          <p className="rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Example skill certificate · fictional results for illustration.
          </p>
        )}
        <SkillCertificateCard certificate={certificate} />
        <section
          aria-labelledby="verify-title"
          className="flex flex-wrap items-center justify-between gap-5 rounded-xl border bg-card p-5 sm:p-6"
        >
          <div className="flex max-w-prose gap-3">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 text-ink"
            />
            <div className="space-y-1">
              <h2 id="verify-title" className="font-medium">
                Verification scope
              </h2>
              <p className="text-sm text-muted-foreground">
                {example
                  ? "This example shows how Gambit reports skill evidence and scores from a recorded simulation."
                  : "Gambit verifies the recorded simulation results attached to this link. Participants can use AI help during the cases."}
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/login?next=/onboarding">
              {example ? "Start a free practice case" : "Try a case like this"}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>
    </PublicShell>
  );
}
