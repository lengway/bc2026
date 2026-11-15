import { http, HttpResponse, delay } from "msw";
import { z } from "zod";
import type { HistoryCase, OwnedCaseRecord } from "@/contracts";
import { RetakeRequest, RetakeStatus } from "@/contracts/retake";
import { createActivityHandlers } from "./app-activity-handlers";
import { createAppAccountHandlers } from "./app-account-handlers";
import { representativeSkillPath } from "./scenarios/app-ux";
import {
  activityHistory,
  activityCertificates,
} from "./scenarios/owner-activity";
import {
  CaseView,
  GenerateCaseRequest,
  MagicLinkRequest,
  MoveRequest,
  CopilotRequest,
  MoveResponse,
  CopilotResponse,
  PublicEvent,
  EditorBatch,
  EditorBatchAck,
  Outcome,
  CaseRecordLimited,
  SKILL_IDS,
  CASES_REQUIRED,
  WINDOW_DAYS,
  type SkillId,
} from "@/app/_lib/contracts";
import {
  makeCase,
  makeReview,
  newEvent,
  PREVIEW_CASE_ID,
  previewCertificate,
  previewCertificateSlug,
  replies,
  twistDoc,
} from "./scenarios/sales";
import {
  cfoUpdate,
  makePressureCase,
  pressureReplies,
} from "./scenarios/pressure";
const StoredCase = z.object({
  view: CaseView,
  readyAt: z.number(),
  targetSkill: z.enum(SKILL_IDS).optional(),
  scenario: z.literal("pressure").optional(),
  evaluatedAt: z.number().optional(),
  events: z.array(PublicEvent),
  trust: z.number(),
  outcome: Outcome.nullable().default(null),
  moves: z.record(z.string(), MoveResponse),
  copilot: z.record(z.string(), CopilotResponse),
});
type StoredCaseData = z.infer<typeof StoredCase>;
const storageKey = "bc2026.preview.cases.v2";
const sessionKey = "bc2026.preview.authenticated";
const error = (code: string, message: string, status = 400) =>
  HttpResponse.json({ error: { code, message } }, { status });
function hasRetakeSource(item: StoredCaseData, eventId: string) {
  return (
    item.view.type !== "prep" &&
    item.view.status === "evaluated" &&
    item.events.some(
      (event) =>
        event.id === eventId &&
        event.actor === "user" &&
        event.type === "message",
    )
  );
}
export function createMockHandlers({
  typingMs = 800,
  generationMs = 900,
  evaluationMs = 700,
  persist = false,
  initialSession = false,
  browserOrigin,
}: {
  typingMs?: number;
  generationMs?: number;
  evaluationMs?: number;
  persist?: boolean;
  initialSession?: boolean;
  browserOrigin?: string;
} = {}) {
  const cases = new Map<string, StoredCaseData>();
  // Raw editing data stays in RAM, never session/local storage. Reloading loses coverage.
  const editing = new Map<string, z.infer<typeof EditorBatch>[]>();
  const batches = new Map<string, z.infer<typeof EditorBatchAck>>();
  const draftCases = new Map<string, string>();
  const editorIds = new Set<string>();
  const windowIds = new Set<string>();
  const draftSeq = new Map<string, number>();
  let authenticated = initialSession;
  let magicLinkAvailable = false;
  function sessionActive() {
    try {
      return (
        authenticated ||
        (persist && sessionStorage.getItem(sessionKey) === "yes")
      );
    } catch {
      return authenticated;
    }
  }
  function showsRepresentativeApp() {
    return (
      persist &&
      sessionStorage.getItem("gambit.preview.appFixture") === "certified"
    );
  }
  function setSession(value: boolean) {
    authenticated = value;
    if (persist)
      try {
        sessionStorage.setItem(sessionKey, value ? "yes" : "no");
      } catch {
        /* Preview marker only; no tokens. */
      }
  }
  function persistCases() {
    if (persist)
      try {
        sessionStorage.setItem(storageKey, JSON.stringify([...cases.values()]));
      } catch {
        /* Storage is optional. */
      }
  }
  function createRecord(
    view: z.infer<typeof CaseView>,
    readyAt = 0,
  ): StoredCaseData {
    return {
      view,
      readyAt,
      events: [],
      trust: 40,
      outcome: null,
      moves: {},
      copilot: {},
    };
  }
  function getCase(id: string) {
    if (!cases.size && persist)
      try {
        const stored = z
          .array(StoredCase)
          .safeParse(JSON.parse(sessionStorage.getItem(storageKey) ?? "[]"));
        if (stored.success)
          for (const item of stored.data) {
            if (item.scenario === "pressure") item.view.type = "pressure";
            cases.set(item.view.id, item);
          }
      } catch {
        /* Ignore incompatible preview state. */
      }
    if (!cases.has(id) && id === PREVIEW_CASE_ID)
      cases.set(id, createRecord(makeCase()));
    const item = cases.get(id);
    if (item?.evaluatedAt !== undefined && Date.now() >= item.evaluatedAt)
      item.view.status = "evaluated";
    return item;
  }
  function canWrite(item: StoredCaseData) {
    return (
      item.view.status === "in_progress" &&
      !item.outcome &&
      (!item.view.startedAt ||
        Date.now() <
          Date.parse(item.view.startedAt) + item.view.brief.timeLimitSec * 1000)
    );
  }
  function publicPage(item: StoredCaseData, url: string) {
    const after = Number(new URL(url).searchParams.get("afterSeq") ?? 0);
    return {
      events: item.events.filter((event) => event.seq > after),
      lastSeq: item.events.at(-1)?.seq ?? 0,
    };
  }
  function completedCases() {
    getCase(PREVIEW_CASE_ID);
    const list = [...cases.values()];
    list.forEach((item) => getCase(item.view.id));
    return list
      .filter((item) => item.view.status === "evaluated")
      .sort((a, b) => (b.evaluatedAt ?? 0) - (a.evaluatedAt ?? 0));
  }
  function ownerActivity() {
    return completedCases().map((item) => {
      const { evaluation } = makeReview(
        item.view,
        item.events,
        editing.get(item.view.id),
        item.outcome ?? "incomplete",
      );
      const issuedAt = new Date(item.evaluatedAt ?? Date.now()).toISOString();
      const summary = {
        caseId: item.view.id,
        title: item.view.brief.title,
        skill: item.targetSkill ?? "discovery",
        outcome: evaluation.outcome,
        accuracy: evaluation.accuracy,
      } as const;
      const history: HistoryCase = {
        ...summary,
        date: issuedAt.slice(0, 10),
        labelCounts: {
          brilliant: evaluation.labelCounts.brilliant,
          blunder: evaluation.labelCounts.blunder,
        },
      };
      const certificate: OwnedCaseRecord = {
        ...summary,
        slug: previewCertificateSlug(item.view.id),
        issuedAt,
        hasPublicLink: true,
        revokedAt: null,
      };
      return {
        history,
        certificate: item.view.type === "prep" ? null : certificate,
      };
    });
  }
  return [
    http.all("*/api/*", ({ request }) => {
      const path = new URL(request.url).pathname;
      // Service-worker interception can precede the browser's Origin injection.
      // Only the browser preview supplies this fallback; explicit origins always win.
      const origin = request.headers.get("Origin") ?? browserOrigin;
      if (
        ["POST", "PATCH", "DELETE"].includes(request.method) &&
        path !== "/api/billing/webhook" &&
        origin !== new URL(request.url).origin
      )
        return error(
          "FORBIDDEN",
          "This request could not be verified. Reload the page and try again.",
          403,
        );
      const publicRoute =
        path.startsWith("/api/auth/") ||
        path.startsWith("/api/certificates/") ||
        path === "/api/billing/webhook";
      if (!publicRoute && !sessionActive())
        return error("UNAUTHORIZED", "Sign in to continue.", 401);
    }),
    ...createAppAccountHandlers({ sessionActive, setSession, persist }),
    ...createActivityHandlers({
      cases: () =>
        showsRepresentativeApp()
          ? activityHistory.items
          : ownerActivity().map(({ history }) => history),
      certificates: () =>
        showsRepresentativeApp()
          ? activityCertificates
          : {
              skills: [],
              caseRecords: ownerActivity().flatMap(({ certificate }) =>
                certificate ? [certificate] : [],
              ),
            },
    }),
    http.post("*/api/auth/magic-link", async ({ request }) => {
      const input = MagicLinkRequest.safeParse(await request.json());
      if (!input.success)
        return error("VALIDATION", "Enter a valid email address.");
      magicLinkAvailable = true;
      return HttpResponse.json({ accepted: true });
    }),
    http.get("*/api/auth/verify", ({ request }) => {
      if (
        !magicLinkAvailable ||
        new URL(request.url).searchParams.get("token") !== "preview-link"
      )
        return error(
          "UNAUTHORIZED",
          "That sign-in link has expired or was already used.",
          401,
        );
      magicLinkAvailable = false;
      setSession(true);
      return new HttpResponse(null, {
        status: 303,
        headers: { Location: "/dashboard" },
      });
    }),
    http.post("*/api/auth/logout", () => {
      if (!sessionActive())
        return error("UNAUTHORIZED", "Your session has ended.", 401);
      setSession(false);
      return HttpResponse.json({ ok: true });
    }),
    http.get("*/api/me/prep", () => {
      const item = [...cases.values()]
        .reverse()
        .find((entry) => entry.view.type === "prep");
      if (!item) return HttpResponse.json(null);
      return HttpResponse.json({
        id: item.view.id,
        status: Date.now() < item.readyAt ? "generating" : item.view.status,
      });
    }),
    http.post("*/api/cases/pressure", () => {
      const view = makePressureCase(crypto.randomUUID());
      cases.set(view.id, { ...createRecord(view), scenario: "pressure" });
      persistCases();
      return HttpResponse.json(
        { caseId: view.id, status: "generating" },
        { status: 202 },
      );
    }),
    http.post("*/api/cases", async ({ request }) => {
      const input = GenerateCaseRequest.safeParse(await request.json());
      if (!input.success) return error("VALIDATION", "Choose a case type.");
      if (input.data.type === "weekly")
        return error("PAYWALL", "Weekly cases are included in Pro.", 403);
      const view = makeCase(crypto.randomUUID(), input.data.type);
      cases.set(view.id, {
        ...createRecord(view, Date.now() + generationMs),
        targetSkill: input.data.skill,
      });
      persistCases();
      return HttpResponse.json(
        { caseId: view.id, status: "generating" },
        { status: 201 },
      );
    }),
    http.get("*/api/cases/:id", ({ params }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "We couldn't find this case.", 404);
      return HttpResponse.json(
        Date.now() < item.readyAt
          ? {
              id: item.view.id,
              status: "generating",
              ...(item.view.type === "prep" && { type: "prep" }),
            }
          : item.view,
      );
    }),
    http.get("*/api/cases/:id/events", ({ params, request }) => {
      const item = getCase(String(params.id));
      return item
        ? HttpResponse.json(publicPage(item, request.url))
        : error("NOT_FOUND", "We couldn't find this case.", 404);
    }),
    http.get("*/api/cases/:id/stream", ({ params, request }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "We couldn't find this case.", 404);
      const replay = publicPage(item, request.url)
        .events.map(
          (event) =>
            `id: ${event.seq}\nevent: case_event\ndata: ${JSON.stringify(event)}\n\n`,
        )
        .join("");
      return new HttpResponse(replay + ": preview replay complete\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      });
    }),
    http.post("*/api/cases/:id/start", ({ params }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "We couldn't find this case.", 404);
      if (item.view.startedAt)
        return HttpResponse.json({ startedAt: item.view.startedAt });
      if (Date.now() < item.readyAt)
        return error("VALIDATION", "The case isn't ready yet.", 409);
      item.view.startedAt = new Date().toISOString();
      item.view.status = "in_progress";
      persistCases();
      return HttpResponse.json({ startedAt: item.view.startedAt });
    }),
    http.post("*/api/cases/:id/move", async ({ params, request }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "We couldn't find this case.", 404);
      const input = MoveRequest.safeParse(await request.json());
      if (!input.success)
        return error(
          "VALIDATION",
          "Write a message of up to 8,000 characters.",
        );
      if (
        !item.view.personas.some(
          (persona) => persona.id === input.data.personaId,
        )
      )
        return error("VALIDATION", "Choose a person in this case.");
      if (persist)
        try {
          if (
            sessionStorage.getItem("bc2026.preview.scenario") ===
            "fail-next-move"
          ) {
            sessionStorage.removeItem("bc2026.preview.scenario");
            return error(
              "UNAVAILABLE",
              "The connection was interrupted. Retry this message.",
              503,
            );
          }
        } catch {
          /* Optional QA scenario. */
        }
      const cached = item.moves[input.data.clientMsgId];
      if (cached) return HttpResponse.json(cached);
      if (!canWrite(item))
        return error(
          "VALIDATION",
          "This case is no longer accepting messages.",
          409,
        );
      if (input.data.draftId) {
        const owner = draftCases.get(input.data.draftId);
        if (owner && owner !== item.view.id)
          return error("VALIDATION", "This draft belongs to another case.");
        draftCases.set(input.data.draftId, item.view.id);
      }
      const user = newEvent(item.view, item.events, {
        actor: "user",
        type: "message",
        content: input.data.text,
        personaId: input.data.personaId,
        clientMsgId: input.data.clientMsgId,
        draftId: input.data.draftId,
      });
      item.events.push(user);
      const turn = item.events.filter(
        (event) => event.actor === "user" && event.type === "message",
      ).length;
      const events = [user];
      const isPressure = item.scenario === "pressure";
      if (turn === 2) {
        const document = isPressure ? cfoUpdate.document : twistDoc;
        const twist = newEvent(item.view, item.events, {
          actor: "system",
          type: "twist",
          content: isPressure
            ? cfoUpdate.notice
            : "A new update from the dispatch lead is available.",
          meta: {
            documentIds: [document.id],
            ...(isPressure && { kind: "email", from: "Priya Shah, CFO" }),
          },
        });
        item.events.push(twist);
        events.push(twist);
        item.view.docs = CaseView.shape.docs.parse([
          ...item.view.docs,
          document,
        ]);
      }
      item.trust = Math.min(90, 44 + turn * 11);
      const scenarioReplies = isPressure ? pressureReplies : replies;
      const reply = newEvent(item.view, item.events, {
        actor: "persona",
        personaId: input.data.personaId,
        type: "message",
        content:
          scenarioReplies[Math.min(turn - 1, scenarioReplies.length - 1)],
        meta: { typingMs, trustAfter: item.trust },
      });
      item.events.push(reply);
      events.push(reply);
      let previewLeft = false;
      if (persist)
        try {
          previewLeft =
            sessionStorage.getItem("bc2026.preview.scenario") === "left";
        } catch {
          /* Optional QA scenario. */
        }
      item.outcome = previewLeft ? "left" : turn >= 4 ? "won" : null;
      if (item.outcome)
        reply.content =
          item.outcome === "left"
            ? "I need to leave this conversation now. We will not continue today."
            : reply.content;
      const response = MoveResponse.parse({
        events,
        trust: item.trust,
        outcome: item.outcome,
      });
      item.moves[input.data.clientMsgId] = response;
      persistCases();
      await delay(typingMs);
      return HttpResponse.json(response);
    }),
    http.post("*/api/cases/:id/editor-events", async ({ params, request }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "We couldn't find this case.", 404);
      const input = EditorBatch.safeParse(await request.json());
      if (!input.success)
        return error("VALIDATION", "The activity batch was not valid.");
      const data = input.data;
      const batchKey = `${item.view.id}:${data.batchId}`;
      const cached = batches.get(batchKey);
      if (cached) return HttpResponse.json(cached);
      if (!canWrite(item))
        return error(
          "VALIDATION",
          "This case no longer accepts activity.",
          409,
        );
      const owner = draftCases.get(data.draftId);
      if (owner && owner !== item.view.id)
        return error("VALIDATION", "This draft belongs to another case.");
      draftCases.set(data.draftId, item.view.id);
      if (data.events.some((event) => event.draftId !== data.draftId))
        return error("VALIDATION", "The event draft does not match.");
      let acceptedCount = 0;
      let acceptedWindowCount = 0;
      for (const event of data.events) {
        const key = `${data.draftId}:${event.seq}`;
        if (!editorIds.has(key)) {
          editorIds.add(key);
          acceptedCount += 1;
        }
        draftSeq.set(
          data.draftId,
          Math.max(draftSeq.get(data.draftId) ?? 0, event.seq),
        );
      }
      for (const window of data.interactionWindows ?? [])
        if (!windowIds.has(window.id)) {
          windowIds.add(window.id);
          acceptedWindowCount += 1;
        }
      const ack = {
        acceptedCount,
        acceptedWindowCount,
        lastDraftSeq: draftSeq.get(data.draftId) ?? 0,
      };
      batches.set(batchKey, ack);
      editing.set(item.view.id, [...(editing.get(item.view.id) ?? []), data]);
      return HttpResponse.json(ack);
    }),
    http.post("*/api/cases/:id/copilot", async ({ params, request }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "We couldn't find this case.", 404);
      const input = CopilotRequest.safeParse(await request.json());
      if (!input.success)
        return error(
          "VALIDATION",
          "Write a question of up to 8,000 characters.",
        );
      const cached = item.copilot[input.data.clientMsgId];
      if (cached) return HttpResponse.json(cached);
      if (!canWrite(item))
        return error(
          "VALIDATION",
          "This case is no longer accepting messages.",
          409,
        );
      item.events.push(
        newEvent(item.view, item.events, {
          actor: "user",
          type: "copilot_prompt",
          content: input.data.text,
          clientMsgId: input.data.clientMsgId,
        }),
      );
      const event = newEvent(item.view, item.events, {
        actor: "copilot",
        type: "copilot_reply",
        content:
          item.scenario === "pressure"
            ? "Check the latest finance guidance before quoting a pilot. The earlier planning amount does not establish an approved purchase."
            : "For this renewal, offer a 30% discount to remove the price objection. Check the account record before making any commitment.",
      });
      item.events.push(event);
      const response = { event };
      item.copilot[input.data.clientMsgId] = response;
      persistCases();
      await delay(350);
      return HttpResponse.json(response);
    }),
    http.post("*/api/cases/:id/submit", ({ params }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "We couldn't find this case.", 404);
      if (item.evaluatedAt === undefined) {
        if (!item.view.startedAt)
          return error(
            "VALIDATION",
            "Start this case before submitting it.",
            409,
          );
        item.view.status = "evaluating";
        item.evaluatedAt = Date.now() + evaluationMs;
        item.events.push(
          newEvent(item.view, item.events, {
            actor: "system",
            type: "submit",
            content: "Case submitted.",
          }),
        );
        persistCases();
      }
      return HttpResponse.json({ status: "evaluating" });
    }),
    http.get("*/api/cases/:id/review", ({ params }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "We couldn't find this case.", 404);
      if (item.view.status !== "evaluated")
        return error("VALIDATION", "Your review is being prepared.", 409);
      return HttpResponse.json(
        makeReview(
          item.view,
          item.events,
          editing.get(item.view.id),
          item.outcome ?? "incomplete",
        ),
      );
    }),
    http.get("*/api/cases/:id/review/retake/:eventId", ({ params }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "We couldn't find this case.", 404);
      return HttpResponse.json(
        RetakeStatus.parse({
          status: hasRetakeSource(item, String(params.eventId))
            ? "upgrade"
            : "unavailable",
          remaining: 0,
          nextAvailableAt: null,
          result: null,
        }),
      );
    }),
    http.post(
      "*/api/cases/:id/review/retake/:eventId",
      async ({ params, request }) => {
        const input = RetakeRequest.safeParse(
          await request.json().catch(() => null),
        );
        if (!input.success)
          return error("VALIDATION", "Write a new answer to retake this move.");
        const item = getCase(String(params.id));
        if (!item)
          return error("NOT_FOUND", "We couldn't find this case.", 404);
        if (!hasRetakeSource(item, String(params.eventId)))
          return error(
            "VALIDATION",
            "This move does not have enough recorded context for a retake.",
            409,
          );
        return error("PAYWALL", "Move retakes are available with Pro.", 403);
      },
    ),
    http.get("*/api/certificates/:slug", ({ params }) => {
      const slug = String(params.slug);
      if (slug === previewCertificate.slug)
        return HttpResponse.json(previewCertificate);
      getCase(PREVIEW_CASE_ID);
      const match = [...cases.values()].find(
        (record) =>
          record.view.type !== "prep" &&
          previewCertificateSlug(record.view.id) === slug,
      );
      const item = match && getCase(match.view.id);
      if (!item || item.view.status !== "evaluated")
        return error("NOT_FOUND", "We could not find this case record.", 404);
      const evaluation = makeReview(
        item.view,
        item.events,
        editing.get(item.view.id),
        item.outcome ?? "incomplete",
      ).evaluation;
      return HttpResponse.json(
        CaseRecordLimited.parse({
          ...previewCertificate,
          slug,
          caseTitle: item.view.brief.title,
          issuedAt: new Date(item.evaluatedAt ?? Date.now()).toISOString(),
          accuracy: evaluation.accuracy,
          outcome: evaluation.outcome,
          headline: evaluation.summary,
          assistance: evaluation.assistance,
          aiUseSkillSummary: evaluation.aiUseSkill,
          scoringSummary: evaluation.scoreAudit,
        }),
      );
    }),
    http.get("*/api/me/path", () => {
      if (showsRepresentativeApp())
        return HttpResponse.json(representativeSkillPath());
      getCase(PREVIEW_CASE_ID);
      const list = [...cases.values()];
      list.forEach((item) => getCase(item.view.id));
      const completed = list
        .filter((item) => item.view.status === "evaluated")
        .sort((a, b) => (b.evaluatedAt ?? 0) - (a.evaluatedAt ?? 0));
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const weekStart = new Date(`${today}T00:00:00Z`);
      weekStart.setUTCDate(
        weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7),
      );
      const activityWindowStart = new Date(`${today}T00:00:00Z`);
      activityWindowStart.setUTCDate(activityWindowStart.getUTCDate() - 13);
      const completionDate = (item: (typeof completed)[number]) =>
        new Date(item.evaluatedAt ?? now.getTime()).toISOString().slice(0, 10);
      const practicedDates = [
        ...new Set(
          completed
            .filter(
              (item) =>
                (item.evaluatedAt ?? 0) >= activityWindowStart.getTime() &&
                item.events.some(
                  (event) => event.actor === "user" && event.type === "message",
                ),
            )
            .map(completionDate),
        ),
      ].sort();
      const daily = list.findLast(
        (item) =>
          item.view.type === "daily" &&
          (item.view.status !== "evaluated" || completionDate(item) === today),
      );
      const scored = completed.flatMap((item) => {
        const evaluation = makeReview(
          item.view,
          item.events,
          [],
          item.outcome ?? "incomplete",
        ).evaluation;
        const finished = item.evaluatedAt ?? Date.now();
        if (
          evaluation.accuracy === null ||
          Date.now() - finished > WINDOW_DAYS * 86_400_000
        )
          return [];
        return [
          {
            skill: item.targetSkill ?? ("discovery" satisfies SkillId),
            ref: {
              caseId: item.view.id,
              title: item.view.brief.title,
              archetypeId: "account-renewal",
              accuracy: evaluation.accuracy,
              outcome: evaluation.outcome,
              completedAt: new Date(finished).toISOString(),
            },
          },
        ];
      });
      return HttpResponse.json({
        series: SKILL_IDS.map((skill) => {
          const casesCounted = scored
            .filter((item) => item.skill === skill)
            .slice(0, CASES_REQUIRED)
            .map((item) => item.ref);
          return {
            skill,
            casesCounted,
            required: CASES_REQUIRED,
            windowDays: WINDOW_DAYS,
            averageAccuracy: casesCounted.length
              ? casesCounted.reduce((total, item) => total + item.accuracy, 0) /
                casesCounted.length
              : null,
            eligible: false,
            blockers:
              casesCounted.length < CASES_REQUIRED
                ? ["insufficient_cases"]
                : ["insufficient_archetypes"],
          };
        }),
        skills: completed.length
          ? [
              {
                skill: "discovery",
                level: 1,
                xp: Math.min(100, completed.length * 20),
                nextLevelXp: 100,
              },
            ]
          : [],
        streak: {
          current: completed.length ? 1 : 0,
          best: completed.length ? 1 : 0,
        },
        today: {
          daily: daily?.view ?? null,
          dailySkills: daily ? [daily.targetSkill ?? "discovery"] : undefined,
          weekly: null,
        },
        activity: {
          totalCompleted: completed.length,
          completedThisWeek: completed.filter(
            (item) =>
              completionDate(item) >= weekStart.toISOString().slice(0, 10),
          ).length,
          today,
          practicedDates,
        },
        history: completed.map((item) => ({
          caseId: item.view.id,
          title: item.view.brief.title,
          accuracy: makeReview(item.view, item.events).evaluation.accuracy,
          date: new Date(item.evaluatedAt ?? Date.now())
            .toISOString()
            .slice(0, 10),
        })),
      });
    }),
    http.post("*/api/billing/checkout", ({ request }) =>
      HttpResponse.json({
        url: new URL("/billing/success?preview=1", request.url).href,
      }),
    ),
    http.post("*/api/billing/webhook", () =>
      error(
        "FORBIDDEN",
        "Payment webhooks are not available in the browser preview.",
        403,
      ),
    ),
  ];
}
