import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createApi } from "@/app/api/_lib/handlers";
import { CaseHistoryPage, OwnedCertificates } from "@/contracts";
import { readConfig } from "@/modules/config";
import { hashToken, newToken, SESSION_COOKIE } from "@/modules/identity";
import { MockProvider } from "@/modules/llm";
import { createCoreRuntime } from "@/modules/runtime";
import { createTestDatabase } from "./db-helper";

const now = new Date("2026-11-15T12:00:00.000Z");
const owner = randomUUID();
const visitor = randomUUID();
let db: Awaited<ReturnType<typeof createTestDatabase>>;
let api: ReturnType<typeof createApi>;
let cookie: string;

function request(path: string, as?: string) {
  return new Request(`https://skills.example${path}`, {
    headers: as ? { cookie: as } : {},
  });
}

async function insertCase(
  userId: string,
  input: {
    title: string;
    archetype: string;
    date: string;
    accuracy: number | null;
    outcome?: string;
  },
) {
  const caseId = randomUUID();
  await db.db.query(
    `INSERT INTO cases(id,user_id,field,subfield,type,workspace,status,brief,archetype_id,submitted_at)
      VALUES($1,$2,'sales','account_executive','daily','chat','evaluated',$3,$4,$5)`,
    [caseId, userId, { title: input.title }, input.archetype, input.date],
  );
  await db.db.query(
    `INSERT INTO evaluations(case_id,accuracy,label_counts,trap_caught,outcome,summary,
      skills,assistance,ai_use_skill,trap_result,score_audit,process_observations)
      VALUES($1,$2,'{"brilliant":2,"blunder":1}',false,$3,'Internal summary',
        '[]','{}','{}','not_presented','{}','{}')`,
    [caseId, input.accuracy, input.outcome ?? "won"],
  );
  return caseId;
}

beforeAll(async () => {
  db = await createTestDatabase();
  const config = readConfig({
    NODE_ENV: "test",
    APP_URL: "https://skills.example",
    DATABASE_URL: "postgres://used:v@test/example",
    OPENAI_API_KEY: "test-key",
    LLM_MODEL: "test-model",
    SMTP_HOST: "unused",
    SMTP_FROM: "test@example.com",
  });
  const runtime = createCoreRuntime(config, {
    db: db.db,
    provider: new MockProvider({}),
    now: () => now,
  });
  api = createApi(runtime);
  const token = newToken();
  cookie = `${SESSION_COOKIE}=${token}`;

  await db.db.query(
    `INSERT INTO users(id,email,timezone,email_verified_at)
      VALUES ($1,'owner@example.com','America/Los_Angeles',$3),($2,'visitor@example.com','UTC',$3)`,
    [owner, visitor, now],
  );
  await db.db.query(
    "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)",
    [owner, hashToken(token), "2026-12-15T12:00:00.000Z"],
  );

  const caseId = await insertCase(owner, {
    title: "Price discussion",
    archetype: "price-objection",
    date: "2026-11-15T05:00:00.000Z",
    accuracy: 75,
  });
  await insertCase(owner, {
    title: "Earlier price discussion",
    archetype: "price-objection",
    date: "2026-11-11T10:00:00.000Z",
    accuracy: 85,
  });
  await insertCase(owner, {
    title: "Older price discussion",
    archetype: "price-objection",
    date: "2026-11-01T12:00:00.000Z",
    accuracy: 95,
  });
  await insertCase(owner, {
    title: "Discovery call",
    archetype: "cold-discovery",
    date: "2026-11-14T05:00:00.000Z",
    accuracy: 99,
  });
  await insertCase(owner, {
    title: "Walkout",
    archetype: "price-objection",
    date: "2026-11-14T12:00:00.000Z",
    accuracy: null,
    outcome: "left",
  });
  await insertCase(visitor, {
    title: "Other user's case",
    archetype: "price-objection",
    date: "2026-11-14T12:00:00.000Z",
    accuracy: 100,
  });

  const newerId = randomUUID();
  await db.db.query(
    `INSERT INTO skill_certificates(id,user_id,skill,level,slug,average_accuracy,issued_at)
      VALUES($1,$2,'objection_handling',2,'certnew001',85,$4),
        ($3,$5,'objection_handling',2,'certelse01',95,$4)`,
    [newerId, owner, randomUUID(), now, visitor],
  );
  await db.db.query(
    `INSERT INTO skill_certificates(user_id,skill,level,slug,average_accuracy,issued_at,superseded_by,revoked_at)
      VALUES($1,'objection_handling',1,'certold001',76,'2026-10-15',$2,$3)`,
    [owner, newerId, now],
  );
  await db.db.query(
    "INSERT INTO certificates(case_id,user_id,slug,skill,issued_at) VALUES($1,$2,'record0001','Sales',$3)",
    [caseId, owner, now],
  );
});

afterAll(async () => db?.cleanup());

it("requires authentication for owner resources", async () => {
  expect((await api.history(request("/api/me/history"))).status).toBe(401);
  expect(
    (await api.ownedCertificates(request("/api/me/certificates"))).status,
  ).toBe(401);
});

it("pages and sorts scoped cases by matching archetypes, outcome, and local calendar period", async () => {
  const path =
    "/api/me/history?skill=critical_ai_use&outcome=won&period=7&sort=accuracy-desc&limit=1";
  const first = await api.history(request(path, cookie));
  expect(first.status).toBe(200);
  expect(first.headers.get("Cache-Control")).toBe("no-store");
  expect(CaseHistoryPage.parse(await first.json())).toMatchObject({
    items: [{ title: "Earlier price discussion", accuracy: 85 }],
    hasMore: true,
  });
  const second = await api.history(request(`${path}&page=2`, cookie));
  expect(CaseHistoryPage.parse(await second.json())).toMatchObject({
    items: [
      {
        title: "Price discussion",
        accuracy: 75,
        skill: "critical_ai_use",
        date: "2026-11-14",
        labelCounts: { brilliant: 2, blunder: 1 },
      },
    ],
    hasMore: false,
  });
});

it("returns the owner's superseded records and disables publication of revoked links", async () => {
  const response = await api.ownedCertificates(
    request("/api/me/certificates?skill=objection_handling", cookie),
  );
  expect(response.status).toBe(200);
  expect(OwnedCertificates.parse(await response.json())).toMatchObject({
    skills: [
      { slug: "certnew001", supersededBy: null, hasPublicLink: true },
      {
        slug: "certold001",
        supersededBy: "certnew001",
        hasPublicLink: false,
        revokedAt: now.toISOString(),
      },
    ],
    caseRecords: [
      { slug: "record0001", title: "Price discussion", hasPublicLink: true },
    ],
  });
});
