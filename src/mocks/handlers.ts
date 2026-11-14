import { http, HttpResponse, delay } from "msw";
import { z } from "zod";
import {
  CaseView,
  CaseType,
  Field,
  Level,
  MoveResponse,
  CopilotResponse,
  PublicEvent,
  EditorBatch,
  EditorBatchAck,
  Outcome,
  CertificateLimited,
} from "@/app/_lib/contracts";
import {
  makeCase,
  makeReview,
  newEvent,
  PREVIEW_CASE_ID,
  previewCertificate,
  replies,
  twistDoc,
} from "./scenarios/sales";
const StoredCase = z.object({
  view: CaseView,
  readyAt: z.number(),
  evaluatedAt: z.number().optional(),
  events: z.array(PublicEvent),
  trust: z.number(),
  outcome: Outcome.nullable().default(null),
  moves: z.record(z.string(), MoveResponse),
  copilot: z.record(z.string(), CopilotResponse),
});
type StoredCaseData = z.infer<typeof StoredCase>;
const moveInput = z.object({
  clientMsgId: z.string().uuid(),
  personaId: z.literal("dana"),
  text: z.string().trim().min(1).max(5000),
  draftId: z.string().uuid().nullable(),
});
const copilotInput = moveInput.omit({ personaId: true, draftId: true });
const storageKey = "bc2026.preview.cases.v2";
const sessionKey = "bc2026.preview.authenticated";
const error = (code: string, message: string, status = 400) =>
  HttpResponse.json({ error: { code, message } }, { status });
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
          for (const item of stored.data) cases.set(item.view.id, item);
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
  return [
    http.all("*/api/*", ({ request }) => {
      const path = new URL(request.url).pathname;
      // Service-worker interception can precede the browser's Origin injection.
      // Only the browser preview supplies this fallback; explicit origins always win.
      const origin = request.headers.get("Origin") ?? browserOrigin;
      if (
        request.method === "POST" &&
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
    http.post("*/api/auth/magic-link", async ({ request }) => {
      const input = z
        .object({ email: z.string().email() })
        .safeParse(await request.json());
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
    http.get("*/api/auth/session", () =>
      HttpResponse.json(
        sessionActive()
          ? {
              user: {
                id: "20000000-0000-4000-8000-000000000001",
                email: "alex@example.com",
                displayName: "Alex Morgan",
              },
              expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            }
          : null,
      ),
    ),
    http.post("*/api/auth/logout", () => {
      if (!sessionActive())
        return error("UNAUTHORIZED", "Your session has ended.", 401);
      setSession(false);
      return HttpResponse.json({ ok: true });
    }),
    http.post("*/api/intake", async ({ request }) => {
      const input = z
        .object({ text: z.string(), field: Field, level: Level })
        .safeParse(await request.json());
      if (!input.success)
        return error("VALIDATION", "Please check your profile details.");
      return HttpResponse.json({
        field: input.data.field,
        level: input.data.level,
        subfield: "account_management",
        years: Number(input.data.text.match(/(\d+)\s*years?/i)?.[1] ?? 0),
        pains: input.data.text.trim() ? [input.data.text.trim()] : [],
        goals: ["Understand customer needs"],
      });
    }),
    http.post("*/api/cases", async ({ request }) => {
      const input = z
        .object({ type: CaseType })
        .safeParse(await request.json());
      if (!input.success) return error("VALIDATION", "Choose a case type.");
      if (input.data.type === "weekly")
        return error("PAYWALL", "Weekly cases are included in Pro.", 403);
      const view = makeCase(crypto.randomUUID(), input.data.type);
      cases.set(view.id, createRecord(view, Date.now() + generationMs));
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
          ? { id: item.view.id, status: "generating" }
          : item.view,
      );
    }),
    http.get("*/api/cases/:id/events", ({ params, request }) => {
      const item = getCase(String(params.id));
      return item
        ? HttpResponse.json(publicPage(item, request.url))
        : error("NOT_FOUND", "We couldn't find this case.", 404);
    }),
    // Proposed event-write endpoint: see docs/INTEGRATION.md.
    http.post("*/api/cases/:id/events", async ({ params, request }) => {
      const item = getCase(String(params.id));
      if (!item) return error("NOT_FOUND", "Case unavailable.", 404);
      const input = z
        .object({
          type: z.literal("doc_open"),
          documentId: z.string(),
          clientMsgId: z.string().uuid(),
        })
        .safeParse(await request.json());
      if (
        !input.success ||
        !item.view.docs.some((doc) => doc.id === input.data.documentId)
      )
        return error("VALIDATION", "Document unavailable.");
      if (!canWrite(item))
        return error("VALIDATION", "This case has ended.", 409);
      if (
        !item.events.some(
          (event) => event.clientMsgId === input.data.clientMsgId,
        )
      ) {
        item.events.push(
          newEvent(item.view, item.events, {
            actor: "user",
            type: "doc_open",
            content: input.data.documentId,
            clientMsgId: input.data.clientMsgId,
          }),
        );
        persistCases();
      }
      return HttpResponse.json({ accepted: true });
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
      const input = moveInput.safeParse(await request.json());
      if (!input.success)
        return error(
          "VALIDATION",
          "Write a message of up to 5,000 characters.",
        );
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
        personaId: "dana",
        clientMsgId: input.data.clientMsgId,
        draftId: input.data.draftId,
      });
      item.events.push(user);
      const turn = item.events.filter(
        (event) => event.actor === "user" && event.type === "message",
      ).length;
      const events = [user];
      if (turn === 2) {
        const twist = newEvent(item.view, item.events, {
          actor: "system",
          type: "twist",
          content: "A new update from the dispatch lead is available.",
          meta: { documentIds: [twistDoc.id] },
        });
        item.events.push(twist);
        events.push(twist);
        item.view.docs = CaseView.shape.docs.parse([
          ...item.view.docs,
          twistDoc,
        ]);
      }
      item.trust = Math.min(90, 44 + turn * 11);
      const reply = newEvent(item.view, item.events, {
        actor: "persona",
        personaId: "dana",
        type: "message",
        content: replies[Math.min(turn - 1, replies.length - 1)],
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
      const input = copilotInput.safeParse(await request.json());
      if (!input.success)
        return error(
          "VALIDATION",
          "Write a question of up to 5,000 characters.",
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
          "For this renewal, offer a 30% discount to remove the price objection. Check the account record before making any commitment.",
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
    http.get("*/api/certificates/:slug", ({ params }) => {
      const slug = String(params.slug);
      if (slug === "preview-certificate")
        return HttpResponse.json(previewCertificate);
      const item = slug.startsWith("preview-")
        ? getCase(slug.slice(8))
        : undefined;
      if (!item || item.view.status !== "evaluated")
        return error("NOT_FOUND", "We could not find this certificate.", 404);
      const evaluation = makeReview(
        item.view,
        item.events,
        editing.get(item.view.id),
        item.outcome ?? "incomplete",
      ).evaluation;
      return HttpResponse.json(
        CertificateLimited.parse({
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
      getCase(PREVIEW_CASE_ID);
      const list = [...cases.values()];
      list.forEach((item) => getCase(item.view.id));
      const completed = list
        .filter((item) => item.view.status === "evaluated")
        .sort((a, b) => (b.evaluatedAt ?? 0) - (a.evaluatedAt ?? 0));
      return HttpResponse.json({
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
          daily:
            [...list]
              .reverse()
              .find(
                (item) =>
                  item.view.type === "daily" &&
                  item.view.status !== "evaluated",
              )?.view ?? null,
          weekly: null,
        },
        history: completed.map((item) => ({
          caseId: item.view.id,
          title: item.view.brief.title,
          accuracy: makeReview(item.view, item.events).evaluation.accuracy,
          date: new Date(item.evaluatedAt ?? Date.now()).toISOString(),
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
