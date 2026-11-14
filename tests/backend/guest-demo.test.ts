import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { SkillCertificateFull } from '@/contracts';
import { readConfig } from '@/modules/config';
import { createCoreRuntime } from '@/modules/runtime';
import { createTestDatabase } from './db-helper';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
beforeAll(async () => { fixture = await createTestDatabase(); });
afterAll(async () => { await fixture?.cleanup(); });

it('creates isolated guest progress and shareable Full certificates without provider calls', async () => {
  const config = readConfig({ APP_URL: 'https://skills.example', DATABASE_URL: 'unused', LLM_MODEL: 'unused',
    OPENAI_API_KEY: 'unused', SMTP_HOST: 'unused', SMTP_FROM: 'test@example.com', GUEST_ACCESS_ENABLED: 'true' });
  const complete = vi.fn().mockRejectedValue(new Error('Guest seeding cannot call an LLM.'));
  const sendMagicLink = vi.fn().mockRejectedValue(new Error('Guest seeding cannot send email.'));
  const app = createCoreRuntime(config, { db: fixture.db, provider: { complete }, mailer: { sendMagicLink } });
  const key = randomUUID();
  const first = await app.identity.createGuestSession(key);
  const second = await app.identity.createGuestSession(key);
  const firstUser = first.session!.user.id;
  const secondUser = second.session!.user.id;
  const firstPath = await app.progress.getSkillPath(firstUser);
  const secondPath = await app.progress.getSkillPath(secondUser);
  const firstClosing = firstPath.series.find(({ skill }) => skill === 'closing')!;
  const secondClosing = secondPath.series.find(({ skill }) => skill === 'closing')!;
  const objections = firstPath.series.find(({ skill }) => skill === 'objection_handling')!;
  expect(firstPath.history).toHaveLength(4);
  expect(firstPath.today).toEqual({ daily: null, weekly: null });
  expect(objections.casesCounted.map(({ archetypeId }) => archetypeId).sort()).toEqual(['price-objection', 'procurement']);
  expect(objections.certificate).toBeUndefined();
  expect(firstPath.series.filter(({ certificate }) => certificate)).toHaveLength(1);
  expect(firstClosing.certificate!.slug).not.toBe(secondClosing.certificate!.slug);
  expect(firstClosing.casesCounted).toHaveLength(3);
  const certificate = SkillCertificateFull.parse(await app.credentials.getSkillCertificateBySlug(firstClosing.certificate!.slug));
  expect(certificate).toMatchObject({ isDemo: true, holderName: 'Demo Guest', skill: 'closing' });
  expect(certificate.cases).toEqual(firstClosing.casesCounted);
  expect(certificate.keyMoves).toHaveLength(3);
  expect(certificate.keyMoves.map(({ move }) => move.label)).toEqual(['brilliant', 'brilliant', 'brilliant']);
  expect(certificate.trustCurves.every(({ points }) => points.length === 5)).toBe(true);
  for (const item of firstPath.history) {
    expect(secondPath.history.map(({ caseId }) => caseId)).not.toContain(item.caseId);
    await expect(app.evaluation.getReview(item.caseId, secondUser)).rejects.toMatchObject({ status: 404 });
  }
  expect(await app.identity.createGuestSession(key, first.token)).toEqual(first);
  expect(await app.progress.getSkillPath(firstUser)).toEqual(firstPath);
  expect(complete).not.toHaveBeenCalled();
  expect(sendMagicLink).not.toHaveBeenCalled();
});
