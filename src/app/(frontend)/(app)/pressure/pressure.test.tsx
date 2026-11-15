import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { makePressureCase } from "@/mocks/scenarios/pressure";
import { makeCase } from "@/mocks/scenarios/sales";
import { CasePreview } from "../case/[id]/case-preview";
import PressurePage from "./page";

const router = { push: vi.fn(), replace: vi.fn() };
let params = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => params,
}));

const caseId = "6f5e6aa8-0efb-4bc2-a038-0db5c682a8d2";

function renderPage(page: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(<QueryClientProvider client={client}>{page}</QueryClientProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("opens a newly launched Pressure case at the Pressure URL", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ caseId, status: "generating" }, { status: 202 }),
  );
  vi.stubGlobal("fetch", fetch);
  renderPage(<PressurePage />);

  fireEvent.click(screen.getByRole("button", { name: "Start Pressure case" }));

  await waitFor(() =>
    expect(router.push).toHaveBeenCalledWith(`/case/${caseId}?type=pressure`),
  );
  expect(fetch).toHaveBeenCalledWith(
    new URL("/api/cases/pressure", window.location.origin),
    expect.objectContaining({ method: "POST" }),
  );
});

it("labels a Pressure brief and corrects an old onboarding link", async () => {
  params = new URLSearchParams("type=onboarding&source=bookmark");
  vi.stubGlobal("fetch", async () => Response.json(makePressureCase(caseId)));
  renderPage(<CasePreview id={caseId} />);

  await screen.findByRole("heading", {
    name: "Northstar Clinics: the budget changed",
  });
  expect(screen.getByText("Case brief · Pressure · Sales")).toBeVisible();
  expect(router.replace).toHaveBeenCalledWith(
    `/case/${caseId}?type=pressure&source=bookmark`,
    { scroll: false },
  );
});

it("labels an onboarding case from its response even with a Pressure URL", async () => {
  params = new URLSearchParams("type=pressure");
  const view = makeCase(caseId);
  vi.stubGlobal("fetch", async () => Response.json(view));
  renderPage(<CasePreview id={caseId} />);

  expect(
    await screen.findByText("Case brief · onboarding · Sales"),
  ).toBeVisible();
  expect(router.replace).not.toHaveBeenCalled();
});
