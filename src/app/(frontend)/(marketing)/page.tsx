import { publicMetadata, publicOrigin } from "@/app/_lib/seo";
import { LandingScreen } from "@/screens/landing";
import { PublicEvaluation } from "@/contracts";
import { evaluation, moves, persona } from "@/app/(design)/design/fixtures";
import { sampleSkillCertificate } from "@/mocks/scenarios/skill-certificate";
export const metadata = publicMetadata("/");

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Gambit",
  url: new URL("/", publicOrigin).href,
  description: metadata.description,
  inLanguage: "en",
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <LandingScreen
        productName="Gambit"
        hrefs={{
          start: "/login?next=/onboarding",
          signIn: "/login?account=1",
          sampleCertificate: "/s/sample",
        }}
        preview={{
          caseTitle: "Renewal at risk: Brightline Logistics",
          reference: "SAMPLE",
          evaluation: PublicEvaluation.parse(evaluation),
          moves,
          persona,
        }}
        sampleCertificate={sampleSkillCertificate}
      />
    </>
  );
}
