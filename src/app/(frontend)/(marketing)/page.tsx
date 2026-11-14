import { LandingScreen } from "@/screens/landing";
import { CertificateLimited, PublicEvaluation } from "@/contracts";
import {
  certificateLimited,
  evaluation,
  moves,
  persona,
} from "@/app/design/fixtures";
export default function HomePage() {
  return (
    <LandingScreen
      productName="Gambit"
      hrefs={{
        start: "/login?next=/onboarding",
        signIn: "/login",
        sampleCertificate: "/c/sample",
      }}
      preview={{
        caseTitle: "Renewal at risk: Brightline Logistics",
        reference: "SAMPLE",
        evaluation: PublicEvaluation.parse(evaluation),
        moves,
        persona,
      }}
      sampleCertificate={CertificateLimited.parse(certificateLimited)}
    />
  );
}
