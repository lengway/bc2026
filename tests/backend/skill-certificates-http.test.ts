import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createApi, type Api } from '@/app/api/_lib/handlers';
import { CaseRecordResponse, SkillCertificateResponse, SkillPath } from '@/contracts';
import { readConfig } from '@/modules/config';
import { hashToken, newToken, SESSION_COOKIE } from '@/modules/identity';
import { MockProvider } from '@/modules/llm';
import { createCoreRuntime } from '@/modules/runtime';
import { createTestDatabase } from './db-helper';
import { reviewedCase } from './review-fixture';

const origin = 'https://skills.example';
const now = new Date('2026-11-15T12:00:00.000Z');
const nextMonth = '2026-12-15T12:00:00.000Z';
const expired = '2026-11-14T12:00:00.000Z';
const ownerEmail = 'certificate-owner@example.com';
const ownerId = randomUUID();
const visitorId = randomUUID();
const recordOnlyId = randomUUID();
const privateThought = 'private-inner-thought';
const caseIds: string[] = [];
let state: Awaited<ReturnType<typeof createTestDatabase>>;
let app: ReturnType<typeof createCoreRuntime>;
let api: Api;
let ownerCookie: string;
let visitorCookie: string;
let skillSlug: string;
let caseRecordSlug: string;
let legacyCaseSlug: string;

function request(path: string, cookie?: string, input?: unknown) {
  return new Request(`${origin}${path}`, {
    method: input === undefined ? 'GET' : 'POST',
    headers: { origin, ...(cookie ? { cookie } : {}), 'Content-Type': 'application/json' },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
}

const context = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

async function session(userId: string) {
  const token = newToken();
  await state.db.query('INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)', [
    userId, hashToken(token), nextMonth,
  ]);
  return `${SESSION_COOKIE}=${token}`;
}

async function setPlanExpiry(userId: string, date: string) {
  await state.db.query(`INSERT INTO subscriptions(user_id,status,current_period_end) VALUES($1,'pro',$2)
    ON CONFLICT(user_id) DO UPDATE SET current_period_end=excluded.current_period_end`, [userId, date]);
}

async function saveReview(userId: string, archetype: string, submittedAt: string) {
  const { snapshot, review, caseId } = await reviewedCase(state.db, { userId, submittedAt });
  const eventIds = new Map(snapshot.events.map(({ id }) => [id, randomUUID()]));
  const rekey = (move: (typeof review.moves)[number]) => ({
    ...move,
    eventId: eventIds.get(move.eventId)!,
    innerThought: privateThought,
    evidence: move.evidence.map((item) => ({ ...item, sourceId: eventIds.get(item.sourceId) ?? item.sourceId })),
  });
  const updatedSnapshot = {
    ...snapshot,
    events: snapshot.events.map((event) => ({ ...event, id: eventIds.get(event.id)! })),
  };
  const updatedReview = {
    ...review,
    evaluation: { ...review.evaluation, topMoves: review.evaluation.topMoves.map(rekey) },
    moves: review.moves.map(rekey),
  };

  return state.db.transaction(async (tx) => {
    await tx.query(`UPDATE cases SET archetype_id=$2,created_at=$3,submitted_snapshot=$4 WHERE id=$1`, [
      caseId, archetype, submittedAt, JSON.stringify(updatedSnapshot),
    ]);
    for (const event of updatedSnapshot.events) {
      await tx.query(`INSERT INTO events(id,case_id,seq,actor,type,content,meta,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [
        event.id, caseId, event.seq, event.actor, event.type, event.content, JSON.stringify(event.meta), event.createdAt,
      ]);
    }
    const { evaluation, moves } = updatedReview;
    await tx.query(`INSERT INTO evaluations(case_id,accuracy,label_counts,ai_dependency,trap_caught,outcome,top_move_ids,
      summary,skills,assistance,ai_use_skill,trap_result,score_audit,process_observations,trust_curve,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, [
      caseId, evaluation.accuracy, JSON.stringify(evaluation.labelCounts), evaluation.aiDependency, evaluation.trapCaught,
      evaluation.outcome, evaluation.topMoves.map((move) => move.eventId), evaluation.summary, JSON.stringify(evaluation.skills),
      JSON.stringify(evaluation.assistance), JSON.stringify(evaluation.aiUseSkill), evaluation.trapResult,
      JSON.stringify(evaluation.scoreAudit), JSON.stringify(evaluation.processObservations), JSON.stringify(evaluation.trustCurve), submittedAt,
    ]);
    for (const move of moves) {
      await tx.query(`INSERT INTO move_reviews(event_id,case_id,label,why,better_move,inner_thought,rubric_ref,trust_after,
        points,evidence,assessment_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
        move.eventId, caseId, move.label, move.why, move.betterMove, move.innerThought, move.rubricRef, move.trustAfter,
        move.points, JSON.stringify(move.evidence), move.assessmentStatus,
      ]);
    }
    const caseRecord = await app.credentials.issueCertificateWithExecutor(tx, updatedSnapshot);
    await app.credentials.issueSkillCertificatesWithExecutor(tx, userId);
    return { caseId, slug: caseRecord!.slug };
  });
}

function assertPublic(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const forbidden of [ownerEmail, privateThought, 'private-event-value', '"email"', '"hidden"', '"realMotive"', '"rubric"', '"rubricRef"', '"innerThought"', '"evidence"', '"processObservations"']) {
    expect(serialized).not.toContain(forbidden);
  }
}

beforeAll(async () => {
  state = await createTestDatabase();
  app = createCoreRuntime(readConfig({
    APP_URL: origin, DATABASE_URL: 'unused', LLM_MODEL: 'test-model', OPENAI_API_KEY: 'unused',
    SMTP_HOST: 'unused', SMTP_FROM: 'test@example.com',
  }), { db: state.db, now: () => now, provider: new MockProvider({}), mailer: { async sendMagicLink() {} } });
  api = createApi(app);
  await state.db.query(`INSERT INTO users(id,email,display_name,email_verified_at) VALUES
    ($1,$2,'Jordan Reyes',$5),($3,$4,'Visitor',$5)`, [ownerId, ownerEmail, visitorId, 'visitor@example.com', now]);
  await state.db.query("INSERT INTO profiles(user_id,field,subfield,level) VALUES($1,'sales','sdr_outbound','intermediate')", [visitorId]);
  ownerCookie = await session(ownerId);
  visitorCookie = await session(visitorId);
  await setPlanExpiry(visitorId, nextMonth);
  for (const [archetype, date] of [
    ['cold-discovery', '2026-11-10T12:00:00.000Z'],
    ['committee', '2026-11-11T12:00:00.000Z'],
    ['cold-discovery', '2026-11-12T12:00:00.000Z'],
  ]) {
    const { caseId, slug } = await saveReview(ownerId, archetype, date);
    caseIds.push(caseId);
    caseRecordSlug = slug;
  }
  const legacy = await saveReview(recordOnlyId, 'cold-discovery', '2026-10-01T12:00:00.000Z');
  legacyCaseSlug = legacy.slug;
  const path = await app.progress.getSkillPath(ownerId);
  skillSlug = path.series.find((series) => series.skill === 'discovery')?.certificate?.slug ?? '';
});

afterAll(async () => { await state?.cleanup(); });

it('returns the authenticated owner’s skill series with the three counted records', async () => {
  expect((await api.path(request('/api/me/path'))).status).toBe(401);
  const response = await api.path(request('/api/me/path', ownerCookie));
  expect(response.status).toBe(200);
  const path = SkillPath.parse(await response.json());
  const discovery = path.series.find((series) => series.skill === 'discovery');
  expect(discovery).toMatchObject({ required: 3, windowDays: 30, averageAccuracy: 75, eligible: true,
    certificate: { slug: expect.stringMatching(/^[A-Za-z0-9_-]{10}$/), level: 1 },
  });
  expect(discovery?.casesCounted.map(({ caseId }) => caseId).sort()).toEqual([...caseIds].sort());
  const visitor = SkillPath.parse(await (await api.path(request('/api/me/path', visitorCookie))).json());
  expect(visitor.series.every((series) => series.casesCounted.length === 0 && !series.certificate)).toBe(true);
});

it('keeps a Free holder’s shared certificate Limited even for a Pro visitor', async () => {
  const url = `/api/skill-certificates/${skillSlug}`;
  for (const cookie of [undefined, visitorCookie, ownerCookie]) {
    const response = await api.skillCertificate(request(url, cookie), context({ slug: skillSlug }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const payload = await response.json();
    expect(SkillCertificateResponse.parse(payload)).toMatchObject({
      slug: skillSlug, holderName: 'Jordan Reyes', skill: 'discovery', averageAccuracy: 75,
    });
    expect(payload).not.toHaveProperty('keyMoves');
    expect(payload).not.toHaveProperty('trustCurves');
    assertPublic(payload);
  }
});

it('serves sanitized Full evidence to anyone sharing a Pro holder’s slug', async () => {
  await setPlanExpiry(ownerId, nextMonth);
  const url = `/api/skill-certificates/${skillSlug}`;
  try {
    for (const cookie of [undefined, visitorCookie, ownerCookie]) {
      const response = await api.skillCertificate(request(url, cookie), context({ slug: skillSlug }));
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(SkillCertificateResponse.parse(payload)).toMatchObject({ slug: skillSlug });
      expect(payload.keyMoves).toHaveLength(3);
      expect(payload.trustCurves).toHaveLength(3);
      assertPublic(payload);
    }
  } finally {
    await setPlanExpiry(ownerId, expired);
  }
  const expiredResponse = await api.skillCertificate(request(url), context({ slug: skillSlug }));
  expect(expiredResponse.status).toBe(200);
  expect(await expiredResponse.json()).not.toHaveProperty('keyMoves');
});

it('preserves legacy Case Record responses and includes a backlink for counted records', async () => {
  const response = await api.certificate(request(`/api/certificates/${caseRecordSlug}`), context({ slug: caseRecordSlug }));
  expect(response.status).toBe(200);
  expect(CaseRecordResponse.parse(await response.json())).toMatchObject({
    slug: caseRecordSlug, accuracy: 75, skillCertificate: { skill: 'discovery', slug: skillSlug },
  });
  const legacy = await api.certificate(request(`/api/certificates/${legacyCaseSlug}`), context({ slug: legacyCaseSlug }));
  expect(legacy.status).toBe(200);
  const record = CaseRecordResponse.parse(await legacy.json());
  expect(record.slug).toBe(legacyCaseSlug);
  expect(record).not.toHaveProperty('skillCertificate');
});

it('returns both slug fields on the owner review', async () => {
  const id = caseIds.at(-1)!;
  const response = await api.review(request(`/api/cases/${id}/review`, ownerCookie), context({ id }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ caseRecordSlug, certificateSlug: caseRecordSlug });
});

it('checks and forwards a targeted Daily Case request to the queued generation job', async () => {
  const url = '/api/cases';
  expect((await api.generateCase(request(url, visitorCookie, { type: 'weekly', skill: 'discovery' }))).status).toBe(400);
  expect((await api.generateCase(request(url, visitorCookie, { type: 'daily', skill: 'unknown' }))).status).toBe(400);
  const response = await api.generateCase(request(url, visitorCookie, { type: 'daily', skill: 'discovery' }));
  expect(response.status).toBe(202);
  const { caseId } = await response.json();
  const jobs = await state.db.query("SELECT payload->>'skill' AS skill FROM jobs WHERE case_id=$1 AND kind='case.generate'", [caseId]);
  expect(jobs.rows).toEqual([{ skill: 'discovery' }]);
});

it('handles unknown slugs through the safe public error envelope', async () => {
  const slug = 'unknown000';
  const response = await api.skillCertificate(request(`/api/skill-certificates/${slug}`), context({ slug }));
  expect(response.status).toBe(404);
  expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
});
