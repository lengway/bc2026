import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { BillingSettings } from "./billing-settings";

afterEach(() => vi.unstubAllGlobals());

it.each([
  {
    route: "checkout",
    button: "Upgrade to Pro",
    pending: "Opening checkout…",
    region: "Pro plan",
  },
  {
    route: "portal",
    button: "Manage subscription",
    pending: "Opening billing…",
    region: null,
  },
])(
  "shows loading, the billing failure and retry for $route",
  async ({ route, button, pending, region }) => {
    let complete: ((value: Response) => void) | undefined;
    const unavailable = () =>
      Response.json(
        {
          error: {
            code: "VALIDATION",
            message: "Billing is temporarily unavailable.",
          },
        },
        { status: 503 },
      );
    const post = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      )
      .mockImplementation(async () => unavailable());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) => {
        if (url.pathname === "/api/billing/summary")
          return Response.json({
            plan: "free",
            periodEnd: null,
            freeDailyRemaining: 1,
            canManage: true,
          });
        if (url.pathname === "/api/auth/session") return Response.json(null);
        if (url.pathname === `/api/billing/${route}`) return post();
        throw new Error(`Unexpected request ${url.pathname}`);
      }),
    );
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <BillingSettings />
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    const area = region
      ? within(await screen.findByRole("region", { name: region }))
      : screen;
    await area.findByRole("button", { name: button });
    await user.click(area.getByRole("button", { name: button }));
    expect(await area.findByRole("button", { name: pending })).toBeDisabled();
    complete?.(unavailable());
    const alert = await area.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Billing is temporarily unavailable. Try again in a minute.",
    );
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  },
);
