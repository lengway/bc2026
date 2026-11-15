import { act, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { makeQueryClient } from "@/app/_lib/query-client";
import { caseView, review, skillPath } from "@/mocks/fixtures";
import { ReviewPreview } from "./review-preview";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const caseUrl = `/api/cases/${caseView.id}`;

function renderReview() {
  const client = makeQueryClient(() => {});
  render(
    <QueryClientProvider client={client}>
      <ReviewPreview id={caseView.id} />
    </QueryClientProvider>,
  );
  return client;
}

it("shows a late review after a temporary status outage and stops polling", async () => {
  vi.useFakeTimers();
  let evaluated = false;
  let failures = 0;
  let caseRequests = 0;
  let reviewRequests = 0;
  vi.stubGlobal("fetch", async (url: URL) => {
    if (url.pathname === caseUrl) {
      caseRequests++;
      if (evaluated && failures < 2) {
        failures++;
        return Response.json(
          { error: { code: "UNAVAILABLE", message: "Please try again." } },
          { status: 503 },
        );
      }
      return Response.json({
        ...caseView,
        status: evaluated ? "evaluated" : "evaluating",
      });
    }
    if (url.pathname === `${caseUrl}/review`) {
      reviewRequests++;
      return Response.json(review);
    }
    if (url.pathname === "/api/me/path") return Response.json(skillPath);
    if (url.pathname.startsWith(`${caseUrl}/review/retake/`)) {
      return Response.json({ status: "unavailable" });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  renderReview();

  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(
    screen.getByRole("heading", { name: "Analyzing your moves…" }),
  ).toBeInTheDocument();
  await act(async () => vi.advanceTimersByTimeAsync(60_001));
  expect(
    screen.getByRole("button", { name: "Check again" }),
  ).toBeInTheDocument();
  expect(reviewRequests).toBe(0);

  evaluated = true;
  await act(async () => vi.advanceTimersByTimeAsync(12_000));
  expect(failures).toBe(2);
  expect(
    screen.getByRole("heading", { name: "Analyzing your moves…" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();

  await act(async () => vi.advanceTimersByTimeAsync(18_000));
  expect(screen.getByRole("region", { name: "Result" })).toHaveTextContent(
    "75%",
  );
  expect(reviewRequests).toBe(1);

  const requestCount = caseRequests;
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(caseRequests).toBe(requestCount);
  expect(reviewRequests).toBe(1);
});

it("renders a completed review when the service comes back after several failures", async () => {
  vi.useFakeTimers();
  let reviewRequests = 0;
  vi.stubGlobal("fetch", async (url: URL) => {
    if (url.pathname === caseUrl) {
      return Response.json({ ...caseView, status: "evaluated" });
    }
    if (url.pathname === `${caseUrl}/review`) {
      reviewRequests++;
      if (reviewRequests <= 2) throw new TypeError("Network unavailable");
      if (reviewRequests === 3) {
        return Response.json(
          {
            error: {
              code: "VALIDATION",
              message: "The request could not be completed.",
            },
          },
          { status: 500 },
        );
      }
      return Response.json(review);
    }
    if (url.pathname === "/api/me/path") return Response.json(skillPath);
    if (url.pathname.startsWith(`${caseUrl}/review/retake/`)) {
      return Response.json({ status: "unavailable" });
    }
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  renderReview();

  await act(async () => vi.advanceTimersByTimeAsync(1));
  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  expect(reviewRequests).toBe(2);
  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(screen.getByRole("region", { name: "Result" })).toHaveTextContent(
    "75%",
  );
  expect(reviewRequests).toBe(4);

  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(reviewRequests).toBe(4);
});

it.each([
  [401, "UNAUTHORIZED", "Sign in to continue."],
  [404, "NOT_FOUND", "Review not found."],
] as const)(
  "keeps cached results through an outage and surfaces a permanent HTTP %i",
  async (status, code, message) => {
    vi.useFakeTimers();
    let reviewResponse = () => Response.json(review);
    vi.stubGlobal("fetch", async (url: URL) => {
      if (url.pathname === caseUrl) {
        return Response.json({ ...caseView, status: "evaluated" });
      }
      if (url.pathname === `${caseUrl}/review`) return reviewResponse();
      if (url.pathname === "/api/me/path") return Response.json(skillPath);
      if (url.pathname.startsWith(`${caseUrl}/review/retake/`)) {
        return Response.json({ status: "unavailable" });
      }
      throw new Error(`Unexpected request ${url.pathname}`);
    });
    const client = renderReview();
    await act(async () => vi.advanceTimersByTimeAsync(1));
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByRole("region", { name: "Result" })).toHaveTextContent(
      "75%",
    );

    reviewResponse = () => {
      throw new TypeError("Network unavailable");
    };
    await act(async () => {
      void client.invalidateQueries({ queryKey: ["review", caseView.id] });
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByRole("region", { name: "Result" })).toHaveTextContent(
      "75%",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    reviewResponse = () =>
      Response.json({ error: { code, message } }, { status });
    await act(async () => {
      void client.invalidateQueries({ queryKey: ["review", caseView.id] });
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(
      screen.queryByRole("region", { name: "Result" }),
    ).not.toBeInTheDocument();
  },
);
