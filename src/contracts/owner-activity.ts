import { z } from "zod";
import { CaseRecordSlug, SkillCertificateSlug } from "./certificate";
import { EvaluationOutcome } from "./evaluation";
import { Id, NonEmpty, NonNegativeInt, Percent, Timestamp } from "./primitives";
import { AveragePercent, SkillCertificateLevel, SkillId } from "./skill-series";

export const CaseHistoryFilters = z.strictObject({
  skill: SkillId.optional(),
  outcome: EvaluationOutcome.optional(),
  period: z.enum(["7", "30", "90"]).optional(),
  sort: z
    .enum(["date-desc", "date-asc", "accuracy-desc", "accuracy-asc"])
    .default("date-desc"),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type CaseHistoryFilters = Partial<z.output<typeof CaseHistoryFilters>>;

export const HistoryCase = z.object({
  caseId: Id,
  title: NonEmpty,
  skill: SkillId.nullable(),
  accuracy: Percent.nullable(),
  outcome: EvaluationOutcome,
  date: z.iso.date(),
  labelCounts: z.object({ brilliant: NonNegativeInt, blunder: NonNegativeInt }),
});
export type HistoryCase = z.infer<typeof HistoryCase>;

export const CaseHistoryPage = z.object({
  items: z.array(HistoryCase),
  hasMore: z.boolean(),
});
export type CaseHistoryPage = z.infer<typeof CaseHistoryPage>;

export const OwnedCertificateFilters = z.strictObject({
  skill: SkillId.optional(),
});
export type OwnedCertificateFilters = z.infer<typeof OwnedCertificateFilters>;

const PublicLinkStatus = z.object({
  issuedAt: Timestamp,
  hasPublicLink: z.boolean(),
  revokedAt: Timestamp.nullable(),
});

export const OwnedSkillCertificate = PublicLinkStatus.extend({
  slug: SkillCertificateSlug,
  skill: SkillId,
  level: SkillCertificateLevel,
  averageAccuracy: AveragePercent,
  supersededBy: SkillCertificateSlug.nullable(),
});
export type OwnedSkillCertificate = z.infer<typeof OwnedSkillCertificate>;

export const OwnedCaseRecord = PublicLinkStatus.extend(
  HistoryCase.pick({
    caseId: true,
    title: true,
    skill: true,
    accuracy: true,
    outcome: true,
  }).extend({
    slug: CaseRecordSlug,
  }).shape,
);
export type OwnedCaseRecord = z.infer<typeof OwnedCaseRecord>;

export const OwnedCertificates = z.object({
  skills: z.array(OwnedSkillCertificate),
  caseRecords: z.array(OwnedCaseRecord),
});
export type OwnedCertificates = z.infer<typeof OwnedCertificates>;
