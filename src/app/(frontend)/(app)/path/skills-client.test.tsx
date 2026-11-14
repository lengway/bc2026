import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { SkillsClient } from "./skills-client";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const caseId = "8a0c5f54-e7ba-45fa-b282-911fb8e2c637";
const payloads: unknown[] = [];
const server = setupServer(
  http.get("*/api/me/path", () =>
    HttpResponse.json({
      skills: [],
      series: [],
      streak: { current: 0, best: 0 },
      today: { daily: null, weekly: null },
      history: [],
    }),
  ),
  http.get("*/api/me/history", () =>
    HttpResponse.json({ items: [], hasMore: false }),
  ),
  http.get("*/api/me/certificates", () =>
    HttpResponse.json({ skills: [], caseRecords: [] }),
  ),
  http.post("*/api/cases", async ({ request }) => {
    payloads.push(await request.json());
    return HttpResponse.json({ caseId, status: "generating" });
  }),
);

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

it("creates a daily case for the selected skill and navigates with the target intact", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SkillsClient skill="objection_handling" />
    </QueryClientProvider>,
  );

  fireEvent.click(
    await screen.findByRole("button", { name: "Practice this skill" }),
  );

  await waitFor(() =>
    expect(push).toHaveBeenCalledWith(
      `/case/${caseId}?type=daily&skill=objection_handling`,
    ),
  );
  expect(payloads).toEqual([{ type: "daily", skill: "objection_handling" }]);
});

it("requests all history and certificate pages for the current skill", async () => {
  server.use(
    http.get("*/api/me/history", ({ request }) => {
      const { searchParams } = new URL(request.url);
      if (searchParams.get("skill") !== "closing") {
        return HttpResponse.json(null, { status: 400 });
      }
      const next = searchParams.get("page") === "2";
      return HttpResponse.json({
        items: [
          {
            caseId: next ? "05b07ca5-0572-4c76-8a78-5775cd1f5f6a" : caseId,
            title: next ? "Confirm security review" : "Schedule the pilot",
            skill: "closing",
            accuracy: 76,
            outcome: "won",
            date: "2026-11-14",
            labelCounts: { brilliant: 0, blunder: 0 },
          },
        ],
        hasMore: !next,
      });
    }),
    http.get("*/api/me/certificates", ({ request }) => {
      if (new URL(request.url).searchParams.get("skill") !== "closing") {
        return HttpResponse.json(null, { status: 400 });
      }
      return HttpResponse.json({
        skills: [
          {
            slug: "Sample0001",
            skill: "closing",
            level: 1,
            averageAccuracy: 76,
            issuedAt: "2026-11-14T12:00:00.000Z",
            supersededBy: "Sample0002",
            hasPublicLink: false,
            revokedAt: "2026-11-15T12:00:00.000Z",
          },
        ],
        caseRecords: [],
      });
    }),
  );

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <SkillsClient skill="closing" />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("link", { name: "Schedule the pilot" }),
  ).toBeVisible();
  expect(await screen.findByText("Superseded")).toBeVisible();
  expect(screen.getByText("Public link disabled")).toBeVisible();
  expect(screen.queryByRole("link", { name: /open closing/i })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(
    await screen.findByRole("link", { name: "Confirm security review" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
});
