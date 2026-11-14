import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createProgressService } from '@/modules/progress';
import { createTestDatabase } from '../../../tests/backend/db-helper';
import { reviewedCase } from '../../../tests/backend/review-fixture';
import { createCredentialsService } from './service';

const now = () => new Date('2026-11-14T23:00:00Z');
type Sample = Awaited<ReturnType<typeof reviewedCase>>;
let state: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => { state = await createTestDatabase(); });
afterAll(async () => { await state?.cleanup(); });

function fixture() {
  const samples = new Map<string, Sample>();
  let pro = false;
  const service = createCredentialsService({
    db: state.db,
    now,
    canFull: async () => pro,
    loadSubmission: async (caseId) => samples.get(caseId)?.snapshot ?? null,
    getReview: async (caseId) => samples.get(caseId)!.review,
  });
  const progress = createProgressService({
    db: state.db,
    now,
    getCaseForUser: async () => null,
    loadSubmission: async () => null,
  });
  async function add(archetype: string, options: {
    owner?: string; accuracy?: number | null; ageDays?: number; outcome?: 'won' | 'left';
  } = {}) {
    const ageDays = options.ageDays ?? (10 - samples.size);
    const sample = await reviewedCase(state.db, {
      userId: options.owner,
      submittedAt: new Date(now().getTime() - ageDays * 86_400_000).toISOString(),
    });
    samples.set(sample.caseId, sample);
    const evalRow = sample.review.evaluation;
    await state.db.query('UPDATE cases SET archetype_id=$2 WHERE id=$1', [sample.caseId, archetype]);
    await state.db.query(`INSERT INTO evaluations(case_id,accuracy,label_counts,ai_dependency,trap_caught,outcome,summary,skills,
      assistance,ai_use_skill,trap_result,score_audit,process_observations,trust_curve)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [
      sample.caseId, options.accuracy === undefined ? 75 : options.accuracy, JSON.stringify(evalRow.labelCounts),
      evalRow.aiDependency, evalRow.trapCaught, options.outcome ?? 'won', evalRow.summary, JSON.stringify(evalRow.skills),
      JSON.stringify(evalRow.assistance), JSON.stringify(evalRow.aiUseSkill), evalRow.trapResult,
      JSON.stringify(evalRow.scoreAudit), JSON.stringify(evalRow.processObservations), JSON.stringify(evalRow.trustCurve),
    ]);
    return sample;
  }
  const issue = (owner: string) => state.db.transaction((tx) => service.issueSkillCertificatesWithExecutor(tx, owner));
  const discovery = async (owner: string) => (await progress.getSkillPath(owner)).series.find(({ skill }) => skill === 'discovery')!;
  return { add, discovery, issue, service, enablePro: () => { pro = true; } };
}

describe('skill certificate integration', () => {
  it('uses exactly the most recent three scored cases by submission time within thirty days', async () => {
    const demo = fixture();
    const first = await demo.add('cold-discovery');
    const owner = first.userId;
    const second = await demo.add('vendor', { owner, ageDays: 1 });
    await demo.add('committee', { owner, ageDays: 31, accuracy: 100 });
    await demo.add('cold-discovery', { owner, ageDays: 0, accuracy: null });
    expect(await demo.issue(owner)).toEqual([]);
    expect(await demo.discovery(owner)).toMatchObject({
      casesCounted: [{ caseId: second.caseId }, { caseId: first.caseId }],
      eligible: false, blockers: ['insufficient_cases'],
    });

    const third = await demo.add('cold-discovery', { owner, ageDays: 3 });
    const [run1, run2] = await Promise.all([demo.issue(owner), demo.issue(owner)]);
    const issued = [...run1, ...run2].filter(({ skill }) => skill === 'discovery');
    expect(issued).toHaveLength(1);
    const [certificate] = issued;
    const limited = await demo.service.getSkillCertificateBySlug(certificate.slug);
    expect(limited).toMatchObject({
      level: 1, supersededBy: null, averageAccuracy: 75,
      cases: [{ caseId: second.caseId }, { caseId: third.caseId }, { caseId: first.caseId }],
    });
    expect(limited).not.toHaveProperty('keyMoves');
    const legacy = await demo.service.issueCertificate(third.snapshot);
    expect((await demo.service.getBySlug(legacy.slug)).skillCertificate?.slug).toBe(certificate.slug);

    demo.enablePro();
    const full = await demo.service.getSkillCertificateBySlug(certificate.slug);
    expect(full).toHaveProperty('trustCurves', expect.arrayContaining([{ caseId: second.caseId, points: second.review.evaluation.trustCurve }]));
    expect(full).toHaveProperty('keyMoves', expect.arrayContaining([expect.objectContaining({ caseId: first.caseId })]));

    await demo.add('committee', { owner, ageDays: 0, accuracy: 57 });
    expect(await demo.discovery(owner)).toMatchObject({ averageAccuracy: 69, blockers: ['accuracy_below_threshold'],
      certificate: { slug: certificate.slug, level: certificate.level } });
    expect(await demo.issue(owner)).toEqual([]);
    await demo.add('vendor', { owner, ageDays: 0.1, accuracy: 100, outcome: 'left' });
    expect((await demo.discovery(owner)).blockers).toContain('left_case');
  });

  it('keeps previous slugs and replaces them only when a higher level is earned', async () => {
    const demo = fixture();
    const first = await demo.add('cold-discovery', { accuracy: 82 });
    const owner = first.userId;
    await demo.add('demo-no-show', { owner, accuracy: 82 });
    await demo.add('cold-discovery', { owner, accuracy: 82 });
    const base = (await demo.issue(owner)).find(({ skill }) => skill === 'discovery')!;
    expect(base.level).toBe(1);

    await demo.add('vendor', { owner, accuracy: 83 });
    const upgrade = (await demo.issue(owner)).find(({ skill }) => skill === 'discovery')!;
    expect(upgrade.level).toBe(2);
    expect(await demo.service.getSkillCertificateBySlug(base.slug)).toMatchObject({ supersededBy: upgrade.slug });

    await demo.add('committee', { owner, accuracy: 100 });
    const top = (await demo.issue(owner)).find(({ skill }) => skill === 'discovery')!;
    expect(top.level).toBe(3);
    expect(await demo.service.getSkillCertificateBySlug(upgrade.slug)).toMatchObject({ supersededBy: top.slug });
    expect(await demo.discovery(owner)).toMatchObject({ certificate: { slug: top.slug, level: top.level } });
    expect(await demo.issue(owner)).toEqual([]);
  });

  it('issues pending credentials at email verification and removes them on account deletion', async () => {
    const demo = fixture();
    const { createIdentityService } = await import('@/modules/identity');
    let token: string | null = null;
    const identity = createIdentityService({
      db: state.db, now, appUrl: 'https://example.com',
      onEmailVerified: demo.service.issueSkillCertificatesWithExecutor,
      mailer: {
        async sendMagicLink() {},
        async sendAccountMail(_email, _purpose, url) {
          token = url ? new URL(url).searchParams.get('token') : null;
        },
      },
    });
    const password = 'a password for the skill test';
    const email = `${randomUUID()}@example.com`;
    await identity.register({ email, password, displayName: 'Jordan Reyes' }, randomUUID());
    const member = await identity.login({ email, password }, randomUUID());
    const owner = member.session.user.id;
    await demo.add('cold-discovery', { owner });
    await demo.add('vendor', { owner });
    await demo.add('committee', { owner });
    expect(await demo.issue(owner)).toEqual([]);
    expect(await demo.discovery(owner)).toMatchObject({ eligible: false, blockers: ['email_unverified'] });

    const verified = await identity.verifyEmail(token!);
    const certificate = (await demo.discovery(owner)).certificate!;
    expect(await demo.service.getSkillCertificateBySlug(certificate.slug)).toMatchObject({ verified: true });
    await demo.add('committee', { owner, accuracy: 100 });
    await demo.add('vendor', { owner, accuracy: 100 });
    const upgrade = (await demo.issue(owner)).find(({ skill }) => skill === 'discovery')!;
    expect(upgrade.level).toBe(3);

    await identity.deleteAccount(verified.token, { confirm: 'DELETE', currentPassword: password });
    await expect(demo.service.getSkillCertificateBySlug(certificate.slug)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(demo.service.getSkillCertificateBySlug(upgrade.slug)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
