import { expect, test, type Page } from "@playwright/test";
import type { BillingSummary, CaseView, RetakeStatus } from "@/contracts";
import { representativeSkillPath } from "@/mocks/scenarios/app-ux";
import { makeCase, newEvent } from "@/mocks/scenarios/sales";
import { sampleSkillCertificate } from "@/mocks/scenarios/skill-certificate";

test.setTimeout(90_000);

type PreviewResponse = { body: unknown; status?: number };
type PreviewRequest = { path: string; method: string; body: string | null };

// The preview worker covers the regular app traffic. Override only scenario
// endpoints before fetch reaches that worker so the rest of the browser flow
// still exercises the normal UI and preview fixtures.
async function stubPreviewApi(
  page: Page,
  respond: (request: PreviewRequest) => PreviewResponse | null,
) {
  await page.exposeFunction("releasePathResponse", respond);
  await page.addInitScript(() => {
    const preview = window as Window & {
      releasePathResponse?: (
        request: PreviewRequest,
      ) => Promise<PreviewResponse | null>;
    };
    const fetchNormally = window.fetch.bind(window);
    window.fetch = async (input, options) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.href,
      );
      if (
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/")
      ) {
        const response = await preview.releasePathResponse?.({
          path: url.pathname,
          method: options?.method ?? "GET",
          body: typeof options?.body === "string" ? options.body : null,
        });
        if (response)
          return Response.json(response.body, { status: response.status });
      }
      return fetchNormally(input, options);
    };
  });
}

async function signedInPreview(
  page: Page,
  records: { view: CaseView; events?: ReturnType<typeof newEvent>[] }[] = [],
) {
  await page.addInitScript((cases) => {
    sessionStorage.setItem("bc2026.preview.authenticated", "yes");
    const key = "bc2026.preview.cases.v2";
    if (cases.length && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(
        key,
        JSON.stringify(
          cases.map(({ view, events }) => ({
            view,
            events: events ?? [],
            readyAt: 0,
            trust: 40,
            moves: {},
            copilot: {},
          })),
        ),
      );
    }
  }, records);
}

async function startCase(page: Page) {
  await page
    .getByLabel("I understand what is recorded in this workspace.")
    .check();
  await page.getByRole("button", { name: "Start case", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /^Message / })).toBeEditable();
}

async function sendMove(page: Page, text?: string) {
  const editor = page.getByRole("textbox", { name: /^Message / });
  if (text !== undefined) await editor.fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(editor).toHaveValue("");
  await expect(editor).toBeEnabled();
}

async function submitCase(page: Page) {
  await page.getByRole("button", { name: "Submit case", exact: true }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/\/review\//);
  await expect(
    page.getByRole("heading", { name: "Conversation", exact: true }),
  ).toBeVisible();
}

test("a checkout return stays Free until billing confirms Pro, then weekly practice opens", async ({
  page,
}) => {
  const weekly = makeCase("2413f291-9091-45fe-8a68-67bf8338140e", "weekly");
  let subscriptionConfirmed = false;
  let generationRequest: unknown;
  await signedInPreview(page, [{ view: weekly }]);
  await stubPreviewApi(page, ({ path, method, body }) => {
    if (path === "/api/billing/summary" && subscriptionConfirmed) {
      return {
        body: {
          plan: "pro",
          periodEnd: "2027-01-01T00:00:00.000Z",
          freeDailyRemaining: 0,
          canManage: true,
        } satisfies BillingSummary,
      };
    }
    if (path === "/api/cases" && method === "POST") {
      generationRequest = JSON.parse(body ?? "null");
      return { body: { caseId: weekly.id, status: "generating" }, status: 202 };
    }
    return null;
  });

  await page.goto("/settings/billing");
  await page
    .getByRole("button", { name: "Upgrade to Pro", exact: true })
    .click();
  await expect(page).toHaveURL(/\/billing\/success/);
  await page.getByRole("link", { name: "Back to practice" }).click();
  await expect(page.getByRole("link", { name: "See plans" })).toBeVisible();

  // A stubbed server entitlement stands in for payment processing here.
  subscriptionConfirmed = true;
  await page.reload();
  await page.getByRole("button", { name: "Start weekly simulation" }).click();
  await expect(page).toHaveURL(`/case/${weekly.id}?type=weekly`);
  expect(generationRequest).toEqual({ type: "weekly" });
  await startCase(page);
  await sendMove(
    page,
    "Who will approve the rollout and when can we meet together?",
  );
  await submitCase(page);
  await expect(page).toHaveURL(`/review/${weekly.id}`);
});

test("the browser shows the original move beside a completed Pro retake", async ({
  page,
}) => {
  const view = {
    ...makeCase("3413f291-9091-45fe-8a68-67bf8338140e"),
    status: "evaluated",
  } satisfies CaseView;
  const original = newEvent(view, [], {
    actor: "user",
    type: "message",
    content: "Can you sign the renewal today?",
    personaId: "dana",
  });
  const reaction = newEvent(view, [original], {
    actor: "persona",
    type: "message",
    content: "I need to understand what changes for our team first.",
    personaId: "dana",
  });
  const answer =
    "Which dispatch task would you need to make faster before renewing?";
  let retake: RetakeStatus = {
    status: "available",
    remaining: 3,
    nextAvailableAt: null,
    result: null,
  };
  let submitted: unknown;
  await signedInPreview(page, [{ view, events: [original, reaction] }]);
  await stubPreviewApi(page, ({ path, method, body }) => {
    if (path !== `/api/cases/${view.id}/review/retake/${original.id}`)
      return null;
    if (method === "POST") {
      submitted = JSON.parse(body ?? "null");
      retake = {
        ...retake,
        status: "completed",
        remaining: 2,
        result: {
          personaName: "Dana Whitfield",
          criterionTitle: "Customer discovery",
          before: { answer: original.content, reaction: reaction.content },
          after: {
            answer,
            reaction: "Duplicate job entry remains our biggest issue.",
          },
          feedback:
            "The retake makes it easier to name the buyer’s constraint.",
        },
      };
    }
    return { body: retake };
  });

  await page.goto(`/review/${view.id}`);
  const panel = page.getByRole("region", { name: "Retake this move" });
  await expect(panel.getByText("3 of 3 retakes available")).toBeVisible();
  await panel.getByRole("button", { name: "Retake this move" }).click();
  await panel.getByRole("textbox", { name: "Your new answer" }).fill(answer);
  await panel.getByRole("button", { name: "Send practice answer" }).click();
  await expect(
    panel.getByRole("region", { name: "Original move" }),
  ).toContainText(original.content);
  await expect(
    panel.getByRole("region", { name: "Practice retake" }),
  ).toContainText(answer);
  await expect(panel.getByText("2 of 3 retakes available")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Retake this move" }),
  ).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Result" })).toContainText(
    "80%",
  );
  await expect(
    page.getByRole("list", { name: "Recorded conversation" }),
  ).not.toContainText(answer);
  expect(submitted).toEqual({ text: answer });
});

test("a confirmed three-case series links to the public skill evidence", async ({
  page,
}) => {
  const complete = representativeSkillPath();
  const series = complete.series.find(
    (item) => item.skill === sampleSkillCertificate.skill,
  )!;
  const third = series.casesCounted[2];
  const view = makeCase(third.caseId, "daily");
  view.brief.title = third.title;
  let seriesConfirmed = false;
  let generationRequest: unknown;
  await signedInPreview(page, [{ view }]);
  await stubPreviewApi(page, ({ path, method, body }) => {
    if (path === "/api/me/path") {
      return {
        body: seriesConfirmed
          ? complete
          : {
              ...complete,
              series: complete.series.map((item) =>
                item === series
                  ? {
                      ...item,
                      casesCounted: item.casesCounted.slice(0, 2),
                      eligible: false,
                      blockers: ["insufficient_cases"],
                      certificate: undefined,
                    }
                  : item,
              ),
            },
      };
    }
    if (path === "/api/cases" && method === "POST") {
      generationRequest = JSON.parse(body ?? "null");
      return { body: { caseId: view.id, status: "generating" }, status: 202 };
    }
    return null;
  });

  await page.goto("/path");
  const card = page.getByRole("article").filter({
    has: page.getByRole("link", { name: "Objection handling", exact: true }),
  });
  await expect(card.getByText("2 of 3 cases", { exact: true })).toBeVisible();
  await expect(
    card.getByRole("link", { name: "View certificate" }),
  ).toHaveCount(0);
  await card.getByRole("button", { name: "Practice", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/case/${view.id}`));
  expect(generationRequest).toEqual({
    type: "daily",
    skill: sampleSkillCertificate.skill,
  });
  await startCase(page);
  await sendMove(page, "What would make a smaller rollout work for your team?");
  await submitCase(page);

  // The entitlement and evidence come from the service, represented by the fixture.
  seriesConfirmed = true;
  await page.goto("/path");
  await expect(card.getByText("3 of 3 cases", { exact: true })).toBeVisible();
  await card.getByRole("link", { name: "View certificate" }).click();
  await expect(page).toHaveURL(`/s/${sampleSkillCertificate.slug}`);
  await expect(
    page.getByRole("heading", { name: "Skill evidence across three cases" }),
  ).toBeVisible();
  for (const evidence of sampleSkillCertificate.cases) {
    await expect(page.getByText(evidence.title, { exact: true })).toBeVisible();
  }
});

test("call prep sends the three details, resumes the draft and keeps the review private", async ({
  page,
}) => {
  const prep = {
    offering: "Fleet maintenance software",
    buyer: "An operations director at a regional delivery business",
    objection: "Taking vans off the road could delay deliveries",
  };
  let recoverableCaseId: string | null = null;
  let submitted: unknown;
  await signedInPreview(page);
  await stubPreviewApi(page, ({ path, method, body }) => {
    if (path === "/api/cases" && method === "POST")
      submitted = JSON.parse(body ?? "null");
    if (path === "/api/me/prep" && recoverableCaseId) {
      return { body: { id: recoverableCaseId, status: "in_progress" } };
    }
    return null;
  });

  await page.goto("/prepare");
  await page.getByLabel("What do you sell?").fill(prep.offering);
  await page.getByLabel("Who is the buyer?").fill(prep.buyer);
  await page.getByLabel("What objection do you expect?").fill(prep.objection);
  await page.getByRole("button", { name: "Prepare practice case" }).click();
  await expect(page).toHaveURL(/\/case\/[^?]+\?type=prep/);
  recoverableCaseId = new URL(page.url()).pathname.split("/").at(-1) ?? null;
  expect(submitted).toEqual({ type: "prep", prep });
  await startCase(page);
  const firstMove = "Which routes must stay available during a phased rollout?";
  await sendMove(page, firstMove);

  await page.goto("/prepare");
  await page.getByRole("link", { name: "Resume or review this case" }).click();
  await expect(page).toHaveURL(`/case/${recoverableCaseId}`);
  await expect(page.getByText(firstMove, { exact: true })).toBeVisible();
  await submitCase(page);
  await expect(
    page.getByText(/this practice and its review are private/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share case record" }),
  ).toHaveCount(0);
});

test("sending the whole Copilot reply exposes its retained share on the case record", async ({
  page,
}) => {
  await signedInPreview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: "Start practice case", exact: true })
    .click();
  await startCase(page);
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  const prompt = page
    .getByLabel("Ask Copilot", { exact: true })
    .filter({ visible: true });
  await prompt.fill("What discount should I offer for the renewal?");
  await prompt.press("Enter");
  await page
    .getByRole("button", { name: "Insert into reply", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("textbox", { name: /^Message / })).toHaveValue(
    /offer a 30% discount/,
  );
  await sendMove(page);
  await submitCase(page);
  await expect(page.getByRole("region", { name: "Result" })).toContainText(
    "Copilot trap missed",
  );
  await page
    .getByRole("button", { name: "Share case record", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Case record" }),
  ).toBeVisible();

  const assistance = page.getByRole("region", { name: "Observed assistance" });
  await expect(
    assistance.getByText("Text retained from observed Copilot insertions", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(assistance.getByText("100%", { exact: true })).toBeVisible();
});
