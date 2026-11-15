import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { RetakePanel } from "../retake-panel";

afterEach(() => vi.unstubAllGlobals());

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <RetakePanel caseId="case-1" eventId="move-2" />
    </QueryClientProvider>,
  );
}
const base = { remaining: 3, nextAvailableAt: null, result: null };

it("submits a new answer and compares the original and practice exchanges", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ ...base, status: "available" }))
    .mockResolvedValueOnce(
      Response.json({
        ...base,
        status: "completed",
        remaining: 2,
        result: {
          personaName: "Maya",
          criterionTitle: "Discovery",
          before: { answer: "We can help.", reaction: "How?" },
          after: {
            answer: "What is slowing approvals?",
            reaction: "Our budget review.",
          },
          feedback: "The new question uncovers a concrete obstacle.",
        },
      }),
    );
  vi.stubGlobal("fetch", fetch);
  mount();
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole("button", { name: "Retake this move" }),
  );
  await user.type(
    screen.getByRole("textbox", { name: "Your new answer" }),
    "What is slowing approvals?",
  );
  await user.click(
    screen.getByRole("button", { name: "Send practice answer" }),
  );
  expect(
    await screen.findByText("The new question uncovers a concrete obstacle."),
  ).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Original move" })).getByText(
      "How?",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("region", { name: "Practice retake" })).getByText(
      "Our budget review.",
    ),
  ).toBeVisible();
  expect(screen.getByText("2 of 3 retakes available")).toBeVisible();
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: "POST",
    body: JSON.stringify({ text: "What is slowing approvals?" }),
  });
});

it("offers an upgrade when the server denies Free access", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...base, status: "upgrade", remaining: 0 }),
      ),
  );
  mount();
  expect(
    await screen.findByRole("link", { name: "See plans" }),
  ).toHaveAttribute("href", "/settings/billing");
  expect(
    screen.queryByRole("button", { name: "Retake this move" }),
  ).not.toBeInTheDocument();
});

it("keeps the review open and retries a failed Pro checkout", async () => {
  const checkout = vi.fn(async () => Response.json({ error: { code: "VALIDATION", message: "Billing is temporarily unavailable." } }, { status: 503 }));
  vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
    if (url.pathname === "/api/billing/checkout") return checkout();
    return Response.json({ ...base, status: "upgrade", remaining: 0 });
  }));
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Upgrade to Pro" }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Billing is temporarily unavailable. Try again in a minute.");
  await user.click(within(alert).getByRole("button", { name: "Try again" }));
  expect(checkout).toHaveBeenCalledTimes(2);
});
