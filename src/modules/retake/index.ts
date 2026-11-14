import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { RetakeResult, RetakeStatus } from "@/contracts/retake";
import type { BillingService } from "@/modules/billing";
import type { Database } from "@/modules/database";
import { consumeRateLimit } from "@/modules/identity";
import { PersonaReply, type LlmService } from "@/modules/llm";
import { AppError, systemClock, type Clock } from "@/modules/shared";
import * as repo from "./repo";

const LEASE_MS = 120_000;
const Feedback = z.object({ feedback: z.string().trim().min(1).max(600) });
const Reaction = PersonaReply.extend({
  reply: z.string().trim().min(1).max(32_000),
});
const unavailable = () =>
  new AppError(
    "VALIDATION",
    409,
    "This move does not have enough recorded context for a retake.",
  );
const pending = () =>
  new AppError(
    "VALIDATION",
    409,
    "A retake is in progress. Check its status in a moment.",
  );
const upgrade = () =>
  new AppError("PAYWALL", 403, "Move retakes are available with Pro.");

export function createRetakeService({
  db,
  llm,
  billing,
  now = systemClock,
}: {
  db: Database;
  llm: LlmService;
  billing: Pick<BillingService, "can">;
  now?: Clock;
}) {
  async function status(
    userId: string,
    caseId: string,
    eventId: string,
  ): Promise<RetakeStatus> {
    const source = await repo.readSource(db, userId, caseId, eventId);
    const empty = { remaining: 0, nextAvailableAt: null, result: null };
    if (!source) return { ...empty, status: "unavailable" };
    if (!(await billing.can(userId, "practice_retake"))) {
      return {
        ...empty,
        status: (await repo.readContext(db, caseId, eventId, source))
          ? "upgrade"
          : "unavailable",
      };
    }
    const at = now();
    const [attempt, quota] = await Promise.all([
      repo.readAttempt(db, eventId),
      repo.readQuota(db, userId, at),
    ]);
    if (attempt?.result)
      return { ...quota, status: "completed", result: attempt.result };
    if (attempt?.lease_expires_at && attempt.lease_expires_at > at)
      return { ...quota, status: "pending", result: null };
    if (!(await repo.readContext(db, caseId, eventId, source)))
      return { ...empty, status: "unavailable" };
    return {
      ...quota,
      status: quota.remaining > 0 ? "available" : "exhausted",
      result: null,
    };
  }

  async function submit(
    userId: string,
    caseId: string,
    eventId: string,
    text: string,
  ): Promise<RetakeStatus> {
    const answer = text.trim();
    const token = randomUUID();
    const started = await db.transaction(async (tx) => {
      // All attempts by one owner serialize across cases for the rolling quota.
      await repo.lockQuota(tx, userId);
      const at = now();
      const source = await repo.readSource(tx, userId, caseId, eventId);
      if (!source) throw unavailable();
      if (!(await billing.can(userId, "practice_retake", tx))) throw upgrade();
      const attempt = await repo.readAttempt(tx, eventId);
      if (attempt?.result) {
        if (attempt.answer !== answer)
          throw new AppError(
            "VALIDATION",
            409,
            "This move has already been retaken.",
          );
        return {
          result: attempt.result,
          quota: await repo.readQuota(tx, userId, at),
        };
      }
      if (attempt?.lease_expires_at && attempt.lease_expires_at > at)
        throw pending();
      const quota = await repo.readQuota(tx, userId, at);
      if (quota.remaining === 0)
        throw new AppError(
          "RATE_LIMIT",
          429,
          "No move retakes are available yet.",
        );
      const context = await repo.readContext(tx, caseId, eventId, source);
      if (!context) throw unavailable();
      if (!answer || answer === context.before.answer.trim()) {
        throw new AppError(
          "VALIDATION",
          400,
          "Write a new answer to retake this move.",
        );
      }
      // Failed generations release their quota slot. The existing rate limiter still caps repeated provider spend.
      await consumeRateLimit(
        tx,
        repo.retakeAttemptKey(userId),
        repo.RETAKE_ATTEMPT_LIMIT,
        repo.RETAKE_WINDOW_MS,
        at,
      );
      if (
        !(await repo.reserve(tx, {
          eventId,
          caseId,
          userId,
          answer,
          token,
          expiresAt: new Date(at.getTime() + LEASE_MS),
          now: at,
        }))
      )
        throw pending();
      return { context };
    });
    if ("result" in started && started.result)
      return { ...started.quota, status: "completed", result: started.result };

    try {
      const { context } = started;
      const options = { caseId, userId, timeoutMs: 25_000 };
      // Independent requests keep optional comparison feedback off the buyer's prompt.
      const [reaction, feedback] = await Promise.all([
        llm.run(
          "persona.reply",
          context.personaInput(answer, token),
          Reaction,
          options,
        ),
        llm
          .run("practice.feedback", context.feedbackInput(answer), Feedback, {
            ...options,
            timeoutMs: 10_000,
          })
          .catch(() => null),
      ]);
      const result: RetakeResult = {
        personaName: context.personaName,
        criterionTitle: context.criterionTitle,
        before: context.before,
        after: { answer, reaction: reaction.data.reply },
        feedback: feedback?.data.feedback ?? null,
      };
      const quota = await db.transaction(async (tx) => {
        await repo.lockQuota(tx, userId);
        const at = now();
        if (!(await repo.publish(tx, eventId, token, result, at)))
          throw pending();
        return repo.readQuota(tx, userId, at);
      });
      return { ...quota, status: "completed", result };
    } catch (error) {
      await repo.release(db, eventId, token);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "LLM_FAILED",
        502,
        "The practice reaction could not be generated. You can try again.",
      );
    }
  }

  return { status, submit };
}
