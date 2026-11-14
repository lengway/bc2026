import type { Metadata } from "next";
import { LandingScreen } from "@/screens/landing";
import { evaluation, moves, persona } from "../fixtures";

import { sampleSkillCertificate } from "@/mocks/scenarios/skill-certificate";

export const metadata: Metadata = { title: "Design · Landing", robots: { index: false } };

export default function DesignLandingPage() {
  return (
    <LandingScreen
      hrefs={{ start: "/design", signIn: "/design", sampleCertificate: "/design" }}
      preview={{
        caseTitle: "Brightline Logistics renewal",
        reference: "7F3K-2291",
        persona,
        evaluation,
        moves,
      }}
      sampleCertificate={sampleSkillCertificate}
    />
  );
}
