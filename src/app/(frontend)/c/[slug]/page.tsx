import type { Metadata } from "next";
import Link from "next/link";
import { mocksEnabled } from "@/app/_lib/environment";
import { CertificateLimited } from "@/app/_lib/contracts";
export const metadata: Metadata = {
  title: "Practice certificate",
  robots: { index: false, follow: false },
};
export default async function CertificatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // F1 public RSC shell: real certificate SSR/OG projection belongs to F4/F5.
  const sample =
    mocksEnabled && slug === "preview-certificate"
      ? CertificateLimited.parse(
          (await import("@/mocks/scenarios/sales")).previewCertificate,
        )
      : null;
  return (
    <section className="stack">
      <p className="eyebrow">{sample ? "Sample result" : "Work practice"}</p>
      <h1>Practice certificate</h1>
      {sample ? (
        <article className="panel stack">
          <h2>{sample.holderName}</h2>
          <p>
            {sample.skill} · {sample.caseTitle}
          </p>
          <p className="metric">
            {sample.accuracy === null
              ? "Not enough evidence"
              : `${sample.accuracy}%`}
          </p>
          <p>Recorded simulation</p>
          <p>{sample.headline}</p>
          <p className="muted">
            This is a preview certificate with fictional results.
          </p>
        </article>
      ) : (
        <p>
          This certificate is not available yet. Check the link or try again
          later.
        </p>
      )}
      <div>
        <Link className="button" href="/login?next=/onboarding">
          Try a case like this
        </Link>
      </div>
    </section>
  );
}
