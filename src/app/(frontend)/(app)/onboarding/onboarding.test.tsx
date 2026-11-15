import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Onboarding } from "./onboarding";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => vi.unstubAllGlobals());

function showOnboarding() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Onboarding />
    </QueryClientProvider>,
  );
}

it("sends the numeric start of the selected experience range", async () => {
  const fetchMock = vi.fn(async (_url: URL, init: RequestInit) => {
    const input = JSON.parse(String(init.body));
    return Response.json({
      userId: "253d92c2-660d-467a-a51b-0f1a7b52b0cc",
      field: "sales",
      subfield: "account_executive",
      level: "intermediate",
      years: input.years ?? null,
      intakeText: input.text,
      pains: [],
      goals: [],
      updatedAt: "2026-11-15T10:00:00.000Z",
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  showOnboarding();
  fireEvent.click(screen.getByRole("radio", { name: /Account executive/ }));
  fireEvent.click(screen.getByRole("radio", { name: "3–5 years" }));
  fireEvent.click(
    within(
      screen.getByRole("group", { name: "What you want to practice" }),
    ).getByRole("button", { name: "Competitor deals" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Review my profile" }));

  expect(await screen.findByText(/· 3 years/)).toBeVisible();
  expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
    years: 3,
  });
});

it("keeps both focus selections when clicks are batched", () => {
  showOnboarding();
  const chips = within(
    screen.getByRole("group", { name: "What you want to practice" }),
  );
  const pricing = chips.getByRole<HTMLButtonElement>("button", {
    name: "Price and discount pressure",
  });
  const competition = chips.getByRole<HTMLButtonElement>("button", {
    name: "Competitor deals",
  });

  act(() => {
    pricing.click();
    competition.click();
  });

  expect(pricing).toHaveAttribute("aria-pressed", "true");
  expect(competition).toHaveAttribute("aria-pressed", "true");
});
