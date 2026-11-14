import { z } from "zod";
import {
  CaseHistoryFilters,
  CaseHistoryPage,
  OwnedCertificates,
  HistoryCase,
  OwnedCaseRecord,
  OwnedSkillCertificate,
  skillsForFocus,
  type SkillId,
} from "@/contracts";
import type { CatalogService } from "@/modules/catalog";
import type { SqlExecutor } from "@/modules/database";

const ArchetypeFields = z.object({
  field: z.string(),
  archetype_id: z.string().nullable(),
});
const TimestampFields = z.object({
  issuedAt: z.date(),
  revokedAt: z.date().nullable(),
});
const HistoryRow = HistoryCase.omit({ skill: true }).extend(
  ArchetypeFields.shape,
);
const SkillRow = OwnedSkillCertificate.extend(TimestampFields.shape);
const CaseRecordRow = OwnedCaseRecord.omit({ skill: true }).extend({
  ...ArchetypeFields.shape,
  ...TimestampFields.shape,
});

const order = {
  "date-desc": '"completedAt" DESC, "caseId" DESC',
  "date-asc": '"completedAt" ASC, "caseId" ASC',
  "accuracy-desc":
    'accuracy DESC NULLS LAST, "completedAt" DESC, "caseId" DESC',
  "accuracy-asc": 'accuracy ASC NULLS LAST, "completedAt" DESC, "caseId" DESC',
} as const;

async function skillsByArchetype(catalog: CatalogService) {
  const pack = await catalog.getPack("sales");
  return new Map(
    pack.archetypes.map(({ id, focus }) => [id, skillsForFocus(focus)]),
  );
}

function matchingArchetypes(
  byArchetype: Map<string, SkillId[]>,
  skill?: SkillId,
) {
  return skill === undefined
    ? null
    : Array.from(byArchetype)
        .filter(([, skills]) => skills.includes(skill))
        .map(([id]) => id);
}

function displayedSkill(
  byArchetype: Map<string, SkillId[]>,
  row: { field: string; archetype_id: string | null },
  skill?: SkillId,
) {
  if (row.field !== "sales" || row.archetype_id === null) return null;
  return skill ?? byArchetype.get(row.archetype_id)?.[0] ?? null;
}

function validTimezone(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
    }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export async function readCaseHistory(
  db: SqlExecutor,
  catalog: CatalogService,
  userId: string,
  filters: z.output<typeof CaseHistoryFilters>,
  now: Date,
): Promise<CaseHistoryPage> {
  const { skill, outcome, period, sort, page, limit } = filters;
  const [byArchetype, owner] = await Promise.all([
    skillsByArchetype(catalog),
    db.query("SELECT timezone FROM users WHERE id=$1", [userId]),
  ]);
  const timezone = validTimezone(
    z.string().parse(owner.rows[0]?.timezone ?? "UTC"),
  );
  const { rows } = await db.query(
    `WITH owned AS (
      SELECT c.id AS "caseId", c.field, c.archetype_id,
        COALESCE(NULLIF(c.brief->>'title', ''), 'Untitled case') AS title,
        COALESCE(c.submitted_at, c.created_at) AS "completedAt",
        (COALESCE(c.submitted_at, c.created_at) AT TIME ZONE $4::text)::date AS "localDate",
        e.accuracy, e.outcome, e.label_counts AS "labelCounts"
      FROM cases c JOIN evaluations e ON e.case_id=c.id
      WHERE c.user_id=$1 AND c.status='evaluated'
        AND ($2::text[] IS NULL OR (c.field='sales' AND c.archetype_id=ANY($2)))
        AND ($3::text IS NULL OR e.outcome=$3)
    )
    SELECT *, "localDate"::text AS date FROM owned
    WHERE $5::int IS NULL OR "localDate" BETWEEN
      ($6::timestamptz AT TIME ZONE $4::text)::date - ($5::int - 1) AND ($6::timestamptz AT TIME ZONE $4::text)::date
    ORDER BY ${order[sort]} LIMIT $7 OFFSET $8`,
    [
      userId,
      matchingArchetypes(byArchetype, skill),
      outcome ?? null,
      timezone,
      period ?? null,
      now,
      limit + 1,
      (page - 1) * limit,
    ],
  );
  return CaseHistoryPage.parse({
    items: rows.slice(0, limit).map((result) => {
      const row = HistoryRow.parse(result);
      return { ...row, skill: displayedSkill(byArchetype, row, skill) };
    }),
    hasMore: rows.length > limit,
  });
}

export async function readOwnedCertificates(
  db: SqlExecutor,
  catalog: CatalogService,
  userId: string,
  skill?: SkillId,
): Promise<OwnedCertificates> {
  const byArchetype = await skillsByArchetype(catalog);
  const [certificates, records] = await Promise.all([
    db.query(
      `SELECT c.slug,c.skill,c.level,c.average_accuracy AS "averageAccuracy",
        c.issued_at AS "issuedAt",c.revoked_at AS "revokedAt",next.slug AS "supersededBy",
        (c.revoked_at IS NULL AND (u.email_verified_at IS NOT NULL OR u.is_guest)) AS "hasPublicLink"
      FROM skill_certificates c JOIN users u ON u.id=c.user_id
      LEFT JOIN skill_certificates next ON next.id=c.superseded_by AND next.user_id=c.user_id
      WHERE c.user_id=$1 AND ($2::text IS NULL OR c.skill=$2)
      ORDER BY c.issued_at DESC,c.level DESC,c.id DESC`,
      [userId, skill ?? null],
    ),
    db.query(
      `SELECT c.slug,c.case_id AS "caseId",k.field,k.archetype_id,
        COALESCE(NULLIF(k.brief->>'title', ''), 'Untitled case') AS title,
        c.issued_at AS "issuedAt",c.revoked_at AS "revokedAt",e.accuracy,e.outcome,
        (c.revoked_at IS NULL AND (u.email_verified_at IS NOT NULL OR u.is_guest)) AS "hasPublicLink"
      FROM certificates c JOIN users u ON u.id=c.user_id
      JOIN cases k ON k.id=c.case_id AND k.user_id=c.user_id
      JOIN evaluations e ON e.case_id=k.id
      WHERE c.user_id=$1 AND k.status='evaluated'
        AND ($2::text[] IS NULL OR (k.field='sales' AND k.archetype_id=ANY($2)))
      ORDER BY c.issued_at DESC,c.id DESC`,
      [userId, matchingArchetypes(byArchetype, skill)],
    ),
  ]);

  function dates(row: { issuedAt: Date; revokedAt: Date | null }) {
    return {
      issuedAt: row.issuedAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }

  return OwnedCertificates.parse({
    skills: certificates.rows.map((result) => {
      const row = SkillRow.parse(result);
      return { ...row, ...dates(row) };
    }),
    caseRecords: records.rows.map((result) => {
      const row = CaseRecordRow.parse(result);
      return {
        ...row,
        ...dates(row),
        skill: displayedSkill(byArchetype, row, skill),
      };
    }),
  });
}
