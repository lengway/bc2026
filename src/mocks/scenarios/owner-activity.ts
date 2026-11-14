import type { CaseHistoryPage, OwnedCertificates, SkillId } from "@/contracts";
import { sampleSkillCertificate } from "./skill-certificate";

const caseSkills = [
  "value_articulation",
  "objection_handling",
  "closing",
] as const satisfies readonly SkillId[];

export const activityHistory: CaseHistoryPage = {
  items: sampleSkillCertificate.cases
    .map((item, index) => ({
      caseId: item.caseId,
      title: item.title,
      skill: caseSkills[index]!,
      accuracy: item.accuracy,
      date: item.completedAt.slice(0, 10),
      outcome: item.outcome,
      labelCounts: { brilliant: index + 1, blunder: 2 - index },
    }))
    .reverse(),
  hasMore: false,
};
const { slug, skill, level, averageAccuracy, issuedAt } =
  sampleSkillCertificate;

export const activityCertificates: OwnedCertificates = {
  skills: [
    {
      slug,
      skill,
      level,
      averageAccuracy,
      issuedAt,
      supersededBy: null,
      hasPublicLink: true,
      revokedAt: null,
    },
    {
      slug: "Sample0002",
      skill,
      level: 1,
      averageAccuracy: 76,
      issuedAt: "2026-10-26T12:00:00.000Z",
      supersededBy: slug,
      hasPublicLink: false,
      revokedAt: "2026-11-14T12:00:00.000Z",
    },
  ],
  caseRecords: activityHistory.items.map((item, index) => ({
    ...item,
    slug: `Record000${index + 1}`,
    issuedAt: `${item.date}T12:00:00.000Z`,
    hasPublicLink: true,
    revokedAt: null,
  })),
};
