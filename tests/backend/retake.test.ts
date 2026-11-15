import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApi } from "@/app/api/_lib/handlers";
import { readConfig } from "@/modules/config";
import { hashToken, newToken, SESSION_COOKIE } from "@/modules/identity";
import type { LlmRequest } from "@/modules/llm";
import { createCoreRuntime } from "@/modules/runtime";
import { createTestDatabase } from "./db-helper";
import { reviewedCase } from "./review-fixture";

const origin = "https://gambit.example";
const now = new Date("2026-11-14T12:05:00.000Z");
const reply = {
  reply: "Our director approves renewals.",
  typingMs: 900,
  trustDelta: 3,
  patienceDelta: 0,
  revealed: [],
  outcome: null,
  innerThought: "PRIVATE_PRACTICE_THOUGHT",
};

describe("review move retakes on PostgreSQL", () => {
  let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
  beforeAll(async () => {
    fixture = await createTestDatabase();
  });
  afterAll(async () => {
    await fixture?.cleanup();
  });

  async function setup(provider?: (request: LlmRequest) => Promise<unknown>) {
    const requests: LlmRequest[] = [];
    let time = now.getTime();
    const app = createCoreRuntime(
      readConfig({
        APP_URL: origin,
        DATABASE_URL: "unused",
        LLM_MODEL: "test-model",
        OPENAI_API_KEY: "unused",
        SMTP_HOST: "unused",
        SMTP_FROM: "test@example.com",
      }),
      {
        db: fixture.db,
        now: () => new Date(time),
        mailer: { async sendMagicLink() {} },
        provider: {
          async complete(request) {
            requests.push(request);
            const data = await (provider?.(request) ??
              (request.promptId === "persona.reply"
                ? reply
                : { feedback: "The question uncovers the decision maker." }));
            return { text: JSON.stringify(data), model: "test-model" };
          },
        },
      },
    );
    return {
      api: createApi(app),
      app,
      requests,
      advance: (ms: number) => {
        time += ms;
      },
    };
  }

  async function prepare(userId?: string) {
    const source = await reviewedCase(fixture.db, { userId });
    const { caseId, snapshot, review } = source;
    const move = review.moves.find(
      (entry) =>
        entry.assessmentStatus === "assessed" &&
        snapshot.case.scoringGuide.criteria.some(
          (criterion) => criterion.id === entry.rubricRef,
        ),
    );
    if (!move) throw new Error("Expected an assessed fixture move");
    const eventId = randomUUID(),
      replyId = randomUUID();
    const personaId = randomUUID();
    const persona = snapshot.case.personas[0];
    const publicPersona = { ...persona.public, id: personaId };
    const at = now.toISOString();
    const event = {
      id: eventId,
      caseId,
      actor: "user",
      type: "message",
      seq: 1,
      content: move.userText,
      personaId,
      createdAt: at,
      clientMsgId: null,
      draftId: null,
      isPublic: true,
      meta: { availableDocumentIds: [snapshot.case.docs[0].id] },
    };
    const originalReply = {
      ...event,
      id: replyId,
      actor: "persona",
      seq: 2,
      content: "Ask me about our timeline.",
      meta: { replyToEventId: eventId },
    };
    await fixture.db.query(
      "UPDATE cases SET submitted_snapshot=$2 WHERE id=$1",
      [
        caseId,
        JSON.stringify({
          ...snapshot,
          case: {
            ...snapshot.case,
            personas: [{ ...persona, public: publicPersona }],
          },
          events: [event, originalReply],
        }),
      ],
    );
    await fixture.db.query(
      "INSERT INTO personas(id,case_id,public,hidden) VALUES($1,$2,$3,$4)",
      [
        personaId,
        caseId,
        JSON.stringify(publicPersona),
        JSON.stringify(persona.hidden),
      ],
    );
    await fixture.db.query(
      "INSERT INTO events(id,case_id,seq,actor,persona_id,type,content) VALUES($1,$2,1,'user',$3,'message',$4)",
      [eventId, caseId, personaId, move.userText],
    );
    await fixture.db.query(
      `INSERT INTO move_reviews(event_id,case_id,label,why,rubric_ref,trust_after,points,evidence,assessment_status)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,'assessed')`,
      [
        eventId,
        caseId,
        move.label,
        move.why,
        move.rubricRef,
        move.trustAfter,
        move.points,
        JSON.stringify(move.evidence),
      ],
    );
    const evaluation = review.evaluation;
    await fixture.db.query(
      `INSERT INTO evaluations(case_id,accuracy,label_counts,ai_dependency,trap_caught,outcome,summary,skills,assistance,ai_use_skill,trap_result,score_audit,process_observations)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        caseId,
        evaluation.accuracy,
        JSON.stringify(evaluation.labelCounts),
        evaluation.aiDependency,
        evaluation.trapCaught,
        evaluation.outcome,
        evaluation.summary,
        JSON.stringify(evaluation.skills),
        JSON.stringify(evaluation.assistance),
        JSON.stringify(evaluation.aiUseSkill),
        evaluation.trapResult,
        JSON.stringify(evaluation.scoreAudit),
        JSON.stringify(evaluation.processObservations),
      ],
    );
    await fixture.db.query(
      "INSERT INTO llm_calls(case_id,prompt_id,model,prompt_version,input,ok,latency_ms) VALUES($1,'persona.reply','test','1',$2,true,0)",
      [
        caseId,
        JSON.stringify({
          state: {
            turn: 0,
            trust: 40,
            patience: 4,
            mood: "neutral",
            revealed: [],
            outcome: null,
          },
          history: [{ id: eventId }],
        }),
      ],
    );
    return {
      ...source,
      eventId,
      context: { params: Promise.resolve({ id: caseId, eventId }) },
    };
  }

  async function cookie(userId: string) {
    const token = newToken();
    await fixture.db.query(
      "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,$2,$3)",
      [userId, hashToken(token), new Date("2026-12-14T12:00:00.000Z")],
    );
    return `${SESSION_COOKIE}=${token}`;
  }

  async function grantPro(userId: string) {
    await fixture.db.query(
      "INSERT INTO subscriptions(user_id,status,current_period_end) VALUES($1,'pro',$2)",
      [userId, new Date("2026-12-14T12:00:00.000Z")],
    );
  }

  function request(session: string, text?: string, requestOrigin = origin) {
    return new Request(`${origin}/api/retake`, {
      headers: {
        cookie: session,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      ...(text === undefined
        ? {}
        : { method: "POST", body: JSON.stringify({ text }) }),
    });
  }

  it("authorizes the scored case owner and preserves the original review when saving a retake", async () => {
    const { api, requests } = await setup();
    const source = await prepare(),
      other = await prepare();
    const ownedCookie = await cookie(source.userId),
      otherCookie = await cookie(other.userId);
    expect(
      (await api.retakeStatus(request(otherCookie), source.context)).status,
    ).toBe(404);
    expect(
      (
        await api.retakeSubmit(
          request(ownedCookie, "New answer", "https://elsewhere.example"),
          source.context,
        )
      ).status,
    ).toBe(403);
    expect(
      await (
        await api.retakeStatus(request(ownedCookie), source.context)
      ).json(),
    ).toMatchObject({ status: "upgrade" });
    expect(
      (
        await api.retakeSubmit(
          request(ownedCookie, "New answer"),
          source.context,
        )
      ).status,
    ).toBe(403);
    expect(requests).toHaveLength(0);
    await grantPro(source.userId);
    const answer = "Who owns the final approval?";
    const result = await api.retakeSubmit(
      request(ownedCookie, answer),
      source.context,
    );
    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body).toMatchObject({
      status: "completed",
      remaining: 2,
      result: {
        before: { reaction: "Ask me about our timeline." },
        after: { answer, reaction: reply.reply },
        feedback: "The question uncovers the decision maker.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("PRIVATE_PRACTICE_THOUGHT");
    expect(
      await (
        await api.retakeSubmit(request(ownedCookie, answer), source.context)
      ).json(),
    ).toEqual(body);
    expect(
      (
        await api.retakeSubmit(
          request(ownedCookie, "Another answer"),
          source.context,
        )
      ).status,
    ).toBe(409);
    expect(
      requests.filter((req) => req.promptId === "persona.reply"),
    ).toHaveLength(1);
    const stored = await fixture.db.query(
      "SELECT accuracy,(SELECT count(*)::int FROM events WHERE case_id=$1) AS events FROM evaluations WHERE case_id=$1",
      [source.caseId],
    );
    expect(stored.rows[0]).toEqual({
      accuracy: source.review.evaluation.accuracy,
      events: 1,
    });
  });

  it("keeps only three reservations across concurrent cases and releases a slot after a rolling week", async () => {
    const { app, advance } = await setup();
    const first = await prepare();
    await grantPro(first.userId);
    const others = await Promise.all(
      Array.from({ length: 3 }, () => prepare(first.userId)),
    );
    const options = [first, ...others];
    const attempts = await Promise.allSettled(
      options.map(({ userId, caseId, eventId }) =>
        app.retake.submit(
          userId,
          caseId,
          eventId,
          "Can you outline the approval process?",
        ),
      ),
    );
    expect(
      attempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(3);
    const blockedIndex = attempts.findIndex(
      (attempt) => attempt.status === "rejected",
    );
    expect(attempts[blockedIndex]).toMatchObject({
      status: "rejected",
      reason: { status: 429 },
    });
    const blocked = options[blockedIndex];
    expect(
      await app.retake.status(first.userId, blocked.caseId, blocked.eventId),
    ).toMatchObject({ status: "exhausted", remaining: 0 });
    advance(7 * 86_400_000);
    expect(
      await app.retake.status(first.userId, blocked.caseId, blocked.eventId),
    ).toMatchObject({ status: "available", remaining: 3 });
    const used = options.find((_, index) => index !== blockedIndex)!;
    expect(
      await app.retake.status(first.userId, used.caseId, used.eventId),
    ).toMatchObject({ status: "completed" });
  });

  it("returns a failed reaction quota slot to the owner", async () => {
    let fail = true;
    const { app } = await setup(async (request) => {
      if (request.promptId === "practice.feedback")
        return { feedback: "Practice comparison." };
      if (fail) throw new Error("Provider unavailable");
      return reply;
    });
    const { userId, caseId, eventId } = await prepare();
    await grantPro(userId);
    await expect(
      app.retake.submit(userId, caseId, eventId, "What does approval require?"),
    ).rejects.toMatchObject({ status: 502 });
    expect(await app.retake.status(userId, caseId, eventId)).toMatchObject({
      status: "available",
      remaining: 3,
    });
    fail = false;
    expect(
      await app.retake.submit(
        userId,
        caseId,
        eventId,
        "What does approval require?",
      ),
    ).toMatchObject({ status: "completed", remaining: 2 });
  });
});
