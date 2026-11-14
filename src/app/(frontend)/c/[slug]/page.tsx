import { ClientData } from "@/app/_components/providers";
import { CertificateSlug } from "@/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mocksEnabled } from "@/app/_lib/environment";
import { getPublicCertificate } from "@/app/_lib/public-certificate";
import {
  CertificateExperience,
  LocalCertificate,
} from "@/app/_components/certificate-experience";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const certificate = await getPublicCertificate(slug);
    return {
      title: certificate
        ? `${certificate.holderName} · Recorded practice`
        : "Practice certificate",
      description: certificate
        ? `${certificate.caseTitle}. Recorded simulation. ${certificate.accuracy === null ? "Not enough evidence for a score." : `Case accuracy ${certificate.accuracy}%.`} AI help is permitted; see assessment coverage and limitations.`
        : "A record of a timed work simulation.",
      robots: { index: false, follow: false },
      openGraph: { type: "website" },
    };
  } catch {
    return {
      title: "Practice certificate",
      robots: { index: false, follow: false },
    };
  }
}
export default async function CertificatePage({ params }: Props) {
  const { slug } = await params;
  const certificate = await getPublicCertificate(slug);
  if (certificate)
    return (
      <CertificateExperience
        certificate={certificate}
        sample={
          slug === "sample" ||
          slug === "sample-full" ||
          slug === "preview-certificate"
        }
      />
    );
  if (mocksEnabled && CertificateSlug.safeParse(slug).success)
    return (
      <ClientData>
        <LocalCertificate slug={slug} />
      </ClientData>
    );
  notFound();
}
