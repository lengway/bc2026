import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { Toaster } from "sonner";
import { History } from "./history";
import { OwnedSkillCertificateCard } from "@/ui/owned-certificate-card";

vi.mock("@/app/_components/start-case-button", () => ({
  StartCaseButton: ({ label }: { label: string }) => <button>{label}</button>,
}));

afterEach(() => vi.unstubAllGlobals());

it("sends every selected filter and starts over on page one after paging", async () => {
  const user = userEvent.setup();
  const urls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: URL) => {
      urls.push(url);
      return Response.json({
        items: [
          {
            caseId: "11111111-1111-4111-8111-111111111111",
            title: "Renewal at risk",
            skill: "value_articulation",
            accuracy: 83,
            date: "2026-11-14",
            outcome: "won",
            labelCounts: { brilliant: 1, blunder: 0 },
          },
        ],
        hasMore: true,
      });
    }),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <History />
    </QueryClientProvider>,
  );

  expect(
    await screen.findByRole("link", { name: "Renewal at risk" }),
  ).toHaveAttribute("href", "/review/11111111-1111-4111-8111-111111111111");
  await user.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(urls.at(-1)?.searchParams.get("page")).toBe("2"));
  await user.selectOptions(
    screen.getByLabelText("Skill"),
    "value_articulation",
  );
  await user.selectOptions(screen.getByLabelText("Outcome"), "won");
  await user.selectOptions(screen.getByLabelText("Period"), "30");
  await user.selectOptions(screen.getByLabelText("Sort by"), "accuracy-desc");

  await waitFor(() =>
    expect(Object.fromEntries(urls.at(-1)!.searchParams)).toMatchObject({
      page: "1",
      skill: "value_articulation",
      outcome: "won",
      period: "30",
      sort: "accuracy-desc",
    }),
  );
});

it("copies the full certificate URL and announces success", async () => {
  const user = userEvent.setup();
  render(
    <>
      <Toaster />
      <OwnedSkillCertificateCard
        certificate={{
          slug: "abcd123456",
          skill: "discovery",
          level: 2,
          averageAccuracy: 84,
          issuedAt: "2026-11-14T12:00:00.000Z",
          supersededBy: null,
          hasPublicLink: true,
          revokedAt: null,
        }}
      />
    </>,
  );
  await user.click(screen.getByRole("button", { name: "Copy link" }));

  expect(await navigator.clipboard.readText()).toBe(
    new URL("/s/abcd123456", window.location.origin).href,
  );
  expect(await screen.findByText("Link copied")).toBeInTheDocument();
});

it("shows a start action when the account has no completed cases", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ items: [], hasMore: false })),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <History />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByText("Your completed cases will appear here."),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Start a case" })).toBeVisible();
});

it("keeps a superseded certificate visible after its public link is disabled", () => {
  render(
    <OwnedSkillCertificateCard
      certificate={{
        slug: "abcd123456",
        skill: "discovery",
        level: 1,
        averageAccuracy: 74,
        issuedAt: "2026-11-14T12:00:00.000Z",
        supersededBy: "abcd123457",
        hasPublicLink: false,
        revokedAt: "2026-11-15T12:00:00.000Z",
      }}
    />,
  );
  expect(screen.getByText("Superseded")).toBeVisible();
  expect(screen.getByText("Public link disabled")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();
});
