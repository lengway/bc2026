import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
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
      ? `Level ${certificate.level} · ${formatAverageAccuracy(certificate.averageAccuracy)} average accuracy across ${certificate.cases.length} qualifying cases.`
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

  return (
    <PublicShell>
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-8 sm:py-14">
        {slug === "sample" && (
          <p className="rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Example skill certificate · fictional results for illustration.
          </p>
        )}
        <SkillCertificateCard certificate={certificate} />
        <p className="text-sm text-muted-foreground">
          Gambit verifies the results of the recorded simulations. AI help is
          permitted.
        </p>
        <Button asChild>
          <Link href="/login?next=/onboarding">
            Try a case like this
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </main>
    </PublicShell>
  );
}
