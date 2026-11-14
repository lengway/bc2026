import {
  CASES_REQUIRED, CertificateSlug, SkillCertificateFull, SkillCertificateLimited, SkillCertificateSlug,
  DisablePublicLinkRequest, type CertificateResponse, type ReviewResponse, type SkillCertificateResponse,
} from '@/contracts';
import { createCatalogService, type CatalogService } from '@/modules/catalog';
import { readSkillSeries } from '@/modules/skill-series';
import { z } from 'zod';
import type { Database,SqlExecutor } from '@/modules/database';
import { AppError,systemClock,type Clock } from '@/modules/shared';
import type { SubmittedSnapshot } from '@/modules/simulation';
import { canIssue,findBySlug,findOwnedSlug,issue } from './repo';
import { toPublicFull,toPublicLimited } from './projection';
import { currentCertificates, findCaseSkillCertificate, findSkillCertificate, issueSkillCertificate, skillCertificateMembers } from './skill-repo';

export interface CredentialsDeps {
  db:Database;loadSubmission:(caseId:string)=>Promise<SubmittedSnapshot|null>;
  getReview:(caseId:string,userId:string)=>Promise<ReviewResponse>;
  canFull:(ownerId:string)=>Promise<boolean>;now?:Clock;catalog?:CatalogService;
}
export function createCredentialsService({db,loadSubmission,getReview,canFull,now=systemClock,catalog=createCatalogService()}:CredentialsDeps) {
  async function issueSkillCertificatesWithExecutor(tx: SqlExecutor, userId: string) {
    // Serialize issuance with evaluation, confirmation and account deletion for this user.
    const { rows } = await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    if (!rows.length || !await canIssue(tx, userId)) return [];
    const at = now();
    const series = await readSkillSeries(tx, catalog, userId, at);
    const previous = new Map((await currentCertificates(tx, userId)).map((item) => [item.skill, item]));
    const issued = [];
    for (const entry of series) {
      const existing = previous.get(entry.skill);
      if (entry.level && entry.averageAccuracy !== null && (!existing || entry.level > existing.level)) {
        issued.push(await issueSkillCertificate(tx, {
          userId, skill: entry.skill, level: entry.level, counted: entry.counted, averageAccuracy: entry.averageAccuracy,
          at, previousId: existing?.id,
        }));
      }
    }
    return issued;
  }

  async function getOwnedLink(caseId: string, userId: string): Promise<{ slug?: string; disabled: boolean }> {
    if (!z.uuid().safeParse(caseId).success || !z.uuid().safeParse(userId).success) {
      throw new AppError('NOT_FOUND', 404, 'Case record not found.');
    }
    const existing = await findOwnedSlug(db, caseId, userId);
    if (existing) return existing.revokedAt ? { disabled: true } : { slug: CertificateSlug.parse(existing.slug), disabled: false };
    const owner = await db.query('SELECT type FROM cases WHERE id=$1 AND user_id=$2 AND status=$3', [caseId, userId, 'evaluated']);
    if (!owner.rows.length) throw new AppError('NOT_FOUND', 404, 'Case record not found.');
    if (owner.rows[0].type === 'prep') return { disabled: true };
    if (!await canIssue(db, userId)) return { disabled: false };
    const snapshot = await loadSubmission(caseId);
    if (!snapshot || snapshot.case.userId !== userId) throw new AppError('NOT_FOUND', 404, 'Case record not found.');
    const record = await db.transaction(tx => issue(tx, snapshot, now()));
    return record.revokedAt ? { disabled: true } : { slug: record.slug, disabled: false };
  }

  return {
    issueSkillCertificatesWithExecutor,
    async disablePublicLink(userId: string, kind: DisablePublicLinkRequest['kind'], slug: string) {
      const input = DisablePublicLinkRequest.parse({kind,slug});
      const table = input.kind === 'skill' ? 'skill_certificates' : 'certificates';
      const updated = await db.query(`UPDATE ${table} SET revoked_at=COALESCE(revoked_at,$3) WHERE user_id=$1 AND slug=$2 RETURNING id`, [userId,input.slug,now()]);
      if (!updated.rows.length) throw new AppError('NOT_FOUND',404,'Certificate not found.');
      return {ok:true as const};
    },
    async getSkillCertificateBySlug(slug: string): Promise<SkillCertificateResponse> {
      if (!SkillCertificateSlug.safeParse(slug).success) throw new AppError('NOT_FOUND', 404, 'Certificate not found.');
      const certificate = await findSkillCertificate(db, slug);
      if (!certificate) throw new AppError('NOT_FOUND', 404, 'Certificate not found.');
      const members = await skillCertificateMembers(db, certificate.id, certificate.skill);
      if (members.length !== CASES_REQUIRED) throw new AppError('NOT_FOUND', 404, 'Certificate not found.');
      const dependencies = members.flatMap(({ aiDependency }) => aiDependency === null ? [] : [aiDependency]);
      const limited = SkillCertificateLimited.parse({
        ...certificate, holderName: certificate.isGuest ? 'Demo Guest' : certificate.holderName || 'Skills participant',
        field: 'sales', issuedAt: certificate.issuedAt.toISOString(), verified: true, verificationScope: 'recorded_simulation',
        isDemo: certificate.isDemo || certificate.isGuest, cases: members,
        aiDependencyAverage: dependencies.length ? dependencies.reduce((sum, value) => sum + value, 0) / dependencies.length : null,
        trapResults: members.map(({ caseId, trapResult }) => ({ caseId, trapResult })),
      });
      if (!(certificate.isGuest && certificate.isSeededDemo) && !await canFull(certificate.userId)) return limited;
      const reviews = await Promise.all(members.map(async ({ caseId }) => {
        const review = await getReview(caseId, certificate.userId);
        if (review.evaluation.caseId !== caseId) throw new AppError('NOT_FOUND', 404, 'Certificate not found.');
        return review;
      }));
      const keyMoves = reviews.flatMap(({ evaluation, moves, transcript }) => {
        const publicEvents = new Set(transcript.map(({ id }) => id));
        const assessed = moves.filter((move) => move.assessmentStatus === 'assessed' && publicEvents.has(move.eventId));
        const byScore = assessed.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
        const skillMove = byScore.find(({ rubricRef }) => rubricRef === certificate.skill);
        const top = evaluation.topMoves.find(({ eventId }) => publicEvents.has(eventId));
        const move = skillMove ?? top ?? byScore[0];
        return move ? [{ caseId: evaluation.caseId, move }] : [];
      });
      if (keyMoves.length !== CASES_REQUIRED) return limited;
      return SkillCertificateFull.parse({
        ...limited,
        keyMoves,
        trustCurves: reviews.map(({ evaluation }) => ({ caseId: evaluation.caseId, points: evaluation.trustCurve })),
      });
    },
    issueCertificate:(snapshot:SubmittedSnapshot)=>db.transaction(tx=>issue(tx,snapshot,now())),
    issueCertificateWithExecutor:async(tx:SqlExecutor,snapshot:SubmittedSnapshot)=>snapshot.case.type !== 'prep' && await canIssue(tx,snapshot.case.userId)?issue(tx,snapshot,now()):null,
    getOwnedLink,
    async getOwnedSlug(caseId:string,userId:string):Promise<string|undefined> {
      return (await getOwnedLink(caseId,userId)).slug;
    },
    async getBySlug(slug:string):Promise<CertificateResponse> {
      if(!CertificateSlug.safeParse(slug).success) throw new AppError('NOT_FOUND',404,'Certificate not found.');
      const found=await findBySlug(db,slug);
      if(!found) throw new AppError('NOT_FOUND',404,'Certificate not found.');
      const snapshot=await loadSubmission(found.certificate.caseId);
      if(!snapshot||snapshot.case.type==='prep'||snapshot.case.userId!==found.certificate.userId) throw new AppError('NOT_FOUND',404,'Certificate not found.');
      const review=await getReview(found.certificate.caseId,found.certificate.userId);
      const holderName=snapshot.case.isGuest?'Demo Guest':found.holderName??'Skills participant';
      const skillCertificate=await findCaseSkillCertificate(db, found.certificate.caseId);
      const input={certificate:found.certificate,holderName,snapshot,review,skillCertificate};
      return await canFull(found.certificate.userId)?toPublicFull(input):toPublicLimited(input);
    },
  };
}
export type CredentialsService=ReturnType<typeof createCredentialsService>;
