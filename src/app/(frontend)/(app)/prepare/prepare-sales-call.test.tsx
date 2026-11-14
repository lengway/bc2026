import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrepareSalesCall } from "./prepare-sales-call";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterAll(() => server.close());

it("sends the three details in the request body and opens the shared case wait page", async () => {
  push.mockClear();
  const caseId = "00000000-0000-4000-8000-000000000001";
  const prep = {
    offering: "Fleet maintenance software",
    buyer: "Operations director at a regional delivery fleet",
    objection: "Rollout would take vans off the road",
  };
  let received: unknown;
  server.use(
    http.get("*/api/me/prep", () => HttpResponse.json(null)),
    http.post("*/api/cases", async ({ request }) => {
      received = await request.json();
      return HttpResponse.json(
        { caseId, status: "generating" },
        { status: 202 },
      );
    }),
  );
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <PrepareSalesCall />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByLabelText("What do you sell?"), {
    target: { value: prep.offering },
  });
  fireEvent.change(screen.getByLabelText("Who is the buyer?"), {
    target: { value: prep.buyer },
  });
  fireEvent.change(screen.getByLabelText("What objection do you expect?"), {
    target: { value: prep.objection },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Prepare practice case" }),
  );
  await waitFor(() =>
    expect(push).toHaveBeenCalledWith(`/case/${caseId}?type=prep`),
  );
  expect(received).toEqual({ type: "prep", prep });
});

it("offers a private resume link while keeping the new prep form available", async () => {
  const caseId = "00000000-0000-4000-8000-000000000002";
  server.use(
    http.get("*/api/me/prep", () =>
      HttpResponse.json({ id: caseId, status: "ready" }),
    ),
  );
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <PrepareSalesCall />
    </QueryClientProvider>,
  );
  const resume = await screen.findByRole("link", {
    name: "Resume or review this case",
  });
  expect(resume).toHaveAttribute("href", `/case/${caseId}`);
  expect(
    screen.getByRole("button", { name: "Prepare practice case" }),
  ).toBeInTheDocument();
});
