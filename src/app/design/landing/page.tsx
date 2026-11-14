import type { Metadata } from "next";
import { LandingScreen } from "@/screens/landing";
import { certificateLimited, evaluation, moves, persona } from "../fixtures";

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
      sampleCertificate={certificateLimited}
    />
  );
}
