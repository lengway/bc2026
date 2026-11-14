import { LandingScreen } from "@/screens/landing";
import { PublicEvaluation } from "@/contracts";
import { evaluation, moves, persona } from "@/app/(design)/design/fixtures";
import { sampleSkillCertificate } from "@/mocks/scenarios/skill-certificate";
export default function HomePage() {
  return (
    <LandingScreen
      productName="Gambit"
      hrefs={{
        start: "/login?next=/onboarding",
        signIn: "/login",
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
  );
}
