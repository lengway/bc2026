import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  AveragePercent, CaseRef, SkillCertificateLevel, SkillCertificateSlug, SkillId, TrapResult,
} from '@/contracts';
import type { SqlExecutor } from '@/modules/database';
import type { SeriesCase } from '@/modules/skill-series';

const CertificateRow = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  skill: SkillId,
  level: SkillCertificateLevel,
  slug: SkillCertificateSlug,
  issuedAt: z.coerce.date(),
  averageAccuracy: AveragePercent,
  isDemo: z.boolean(),
  isSeededDemo: z.boolean(),
  isGuest: z.boolean(),
  holderName: z.string().nullable(),
  supersededBy: SkillCertificateSlug.nullable(),
  superseded: z.boolean(),
});

const MemberRow = CaseRef.extend({
  completedAt: z.coerce.date(),
  aiDependency: AveragePercent.nullable(),
  trapResult: TrapResult,
});

export async function currentCertificates(db: SqlExecutor, userId: string) {
  const { rows } = await db.query(`SELECT id,skill,level,slug,revoked_at AS "revokedAt" FROM skill_certificates
    WHERE user_id=$1 AND superseded_by IS NULL`, [userId]);
  return z.array(CertificateRow.pick({ id: true, skill: true, level: true, slug: true }).extend({
    revokedAt: z.coerce.date().nullable().transform((value) => value?.toISOString() ?? null),
  })).parse(rows);
}

export async function issueSkillCertificate(
  tx: SqlExecutor,
  input: { userId: string; skill: SkillId; level: SkillCertificateLevel; counted: SeriesCase[]; averageAccuracy: number; at: Date; previousId?: string },
) {
  const { userId, skill, level, counted, averageAccuracy, at, previousId } = input;
  const id = randomUUID();
  if (previousId) await tx.query('UPDATE skill_certificates SET superseded_by=$2 WHERE id=$1', [previousId, id]);

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = randomBytes(8).toString('base64url').slice(0, 10);
    const saved = await tx.query(`INSERT INTO skill_certificates(id,user_id,skill,level,slug,issued_at,average_accuracy,is_demo,is_seeded_demo)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(slug) DO NOTHING RETURNING slug`,
    [id, userId, skill, level, slug, at, averageAccuracy, counted.some((row) => row.isDemo), counted.every((row) => row.isSeededDemo)]);
    if (!saved.rowCount) continue;
    await tx.query(`INSERT INTO skill_certificate_cases(certificate_id,case_id,user_id,position)
      SELECT $1,case_id,$2,position FROM unnest($3::uuid[]) WITH ORDINALITY AS members(case_id,position)`,
    [id, userId, counted.map(({ caseId }) => caseId)]);
    return { skill, level, slug };
  }
  throw new Error('Unable to allocate skill certificate identifier');
}

export async function findSkillCertificate(db: SqlExecutor, slug: string) {
  const { rows } = await db.query(`SELECT c.id,c.user_id AS "userId",c.skill,c.level,c.slug,c.issued_at AS "issuedAt",
    c.average_accuracy AS "averageAccuracy",c.is_demo AS "isDemo",c.is_seeded_demo AS "isSeededDemo",
    u.is_guest AS "isGuest",u.display_name AS "holderName",next.slug AS "supersededBy",(c.superseded_by IS NOT NULL) AS superseded
    FROM skill_certificates c JOIN users u ON u.id=c.user_id
    LEFT JOIN skill_certificates next ON next.id=c.superseded_by AND next.revoked_at IS NULL
    WHERE c.slug=$1 AND c.revoked_at IS NULL AND (u.email_verified_at IS NOT NULL OR u.is_guest)`, [slug]);
  return rows[0] ? CertificateRow.parse(rows[0]) : null;
}

export async function skillCertificateMembers(db: SqlExecutor, id: string) {
  const { rows } = await db.query(`SELECT c.id AS "caseId",c.brief->>'title' AS title,c.archetype_id AS "archetypeId",
    e.accuracy,e.outcome,c.submitted_at AS "completedAt",e.ai_dependency AS "aiDependency",e.trap_result AS "trapResult"
    FROM skill_certificate_cases m JOIN cases c ON c.id=m.case_id JOIN evaluations e ON e.case_id=c.id
    WHERE m.certificate_id=$1 ORDER BY m.position`, [id]);
  return rows.map((row) => {
    const member = MemberRow.parse(row);
    return { ...member, completedAt: member.completedAt.toISOString() };
  });
}

export async function findCaseSkillCertificate(db: SqlExecutor, caseId: string) {
  const { rows } = await db.query(`SELECT c.slug,c.skill FROM skill_certificate_cases m
    JOIN skill_certificates c ON c.id=m.certificate_id WHERE m.case_id=$1 AND c.revoked_at IS NULL
    ORDER BY c.superseded_by IS NULL DESC,c.issued_at DESC,c.level DESC,c.skill LIMIT 1`, [caseId]);
  return rows[0] ? CertificateRow.pick({ slug: true, skill: true }).parse(rows[0]) : undefined;
}
