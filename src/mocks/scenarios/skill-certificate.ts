import { SkillCertificateLimited } from "@/contracts";

const cases = [
  {
    caseId: "2713f291-9091-45fe-8a68-67bf8338140e",
    title: "Renewal at risk: Brightline Logistics",
    archetypeId: "account-renewal",
    accuracy: 84,
    outcome: "won",
    completedAt: "2026-11-06T12:00:00.000Z",
  },
  {
    caseId: "972d5e7b-3c84-4801-a5da-5a011e45e462",
    title: "A pricing objection at Northstar",
    archetypeId: "price-objection",
    accuracy: 86,
    outcome: "won",
    completedAt: "2026-11-09T12:00:00.000Z",
  },
  {
    caseId: "f5329d6f-c163-43bd-b64b-b4a52d355c3f",
    title: "A procurement review at Beacon",
    archetypeId: "procurement",
    accuracy: 88,
    outcome: "won",
    completedAt: "2026-11-12T12:00:00.000Z",
  },
];

export const sampleSkillCertificate = SkillCertificateLimited.parse({
  slug: "Sample0001",
  holderName: "Dana Whitfield",
  skill: "objection_handling",
  field: "sales",
  level: 2,
  cases: cases.map((item, index) => ({
    ...item,
    skillAssessment: { score: [80, 90, 95][index], status: "met" },
  })),
  averageAccuracy: 86,
  aiDependencyAverage: 12,
  trapResults: cases.map(({ caseId }) => ({ caseId, trapResult: "caught" })),
  supersededBy: null,
  issuedAt: "2026-11-12T12:00:00.000Z",
  isDemo: true,
  verified: true,
  verificationScope: "recorded_simulation",
});
