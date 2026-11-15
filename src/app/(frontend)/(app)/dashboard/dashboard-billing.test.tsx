import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { Dashboard } from "./dashboard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

it("keeps the weekly upsell on the dashboard when checkout fails and can retry", async () => {
  const checkout = vi.fn(async () =>
    Response.json(
      { error: { code: "VALIDATION", message: "API_REQUEST_FAILED" } },
      { status: 500 },
    ),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => {
      switch (url.pathname) {
        case "/api/me/path":
          return Response.json({
            skills: [],
            streak: { current: 0, best: 0 },
            today: { daily: null, weekly: null },
            history: [],
          });
        case "/api/me/history":
          return Response.json({ items: [], hasMore: false });
        case "/api/billing/summary":
          return Response.json({
            plan: "free",
            periodEnd: null,
            freeDailyRemaining: 1,
            canManage: false,
          });
        case "/api/intake":
          return Response.json(null);
        case "/api/billing/checkout":
          return checkout();
        default:
          throw new Error(`Unexpected request ${url.pathname}`);
      }
    }),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>,
  );
  const weekly = within(
    (await screen.findByRole("heading", { name: "Weekly simulation" })).closest(
      "article",
    )!,
  );
  const user = userEvent.setup();
  await user.click(weekly.getByRole("button", { name: "Upgrade to Pro" }));
  const alert = await weekly.findByRole("alert");
  expect(alert).toHaveTextContent(
    "Billing is temporarily unavailable. Try again in a minute.",
  );
  await user.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(checkout).toHaveBeenCalledTimes(2);
});
