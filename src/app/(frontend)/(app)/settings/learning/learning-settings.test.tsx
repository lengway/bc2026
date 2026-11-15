import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { learningProfileKey } from "@/app/_hooks/use-learning-profile";
import type { Profile } from "@/contracts";
import { LearningSettings } from "./learning-settings";

const profile = {
  userId: "253d92c2-660d-467a-a51b-0f1a7b52b0cc",
  field: "sales",
  subfield: "account_executive",
  level: "intermediate",
  years: 3,
  intakeText:
    "Role: Account executive (account_executive).\nExperience: 3–5 years.\nWants to practice: Competitor deals.\nIn their own words: Keep this first note.\nKeep this second line.",
  pains: [],
  goals: [],
  updatedAt: "2026-11-15T10:00:00.000Z",
  dailyGoal: 1,
} satisfies Profile;

afterEach(() => vi.unstubAllGlobals());

function showLearning(initial: Profile | null, fetchMock: typeof fetch) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient();
  client.setQueryData(learningProfileKey, initial);
  render(
    <QueryClientProvider client={client}>
      <LearningSettings />
    </QueryClientProvider>,
  );
}

it("restores onboarding notes when the fresh profile replaces a cached empty profile", async () => {
  let releaseFetch!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => {
    releaseFetch = resolve;
  });
  showLearning(
    null,
    vi.fn(() => pending),
  );
  expect(screen.getByLabelText("Practice notes")).toHaveValue("");

  releaseFetch(Response.json(profile));

  await waitFor(() =>
    expect(screen.getByLabelText("Practice notes")).toHaveValue(
      "Keep this first note.\nKeep this second line.",
    ),
  );
});

it("keeps both practice selections when clicks are batched", () => {
  showLearning(
    null,
    vi.fn(async () => Response.json(null)),
  );
  const chips = within(screen.getByRole("group", { name: "Practice focus" }));
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

it("keeps an existing exact experience value when an unrelated preference changes", async () => {
  const saved = { ...profile, years: 5 };
  const fetchMock = vi.fn(
    async (_input: URL | RequestInfo, init?: RequestInit) => {
      const input = init?.body ? JSON.parse(String(init.body)) : undefined;
      return Response.json({ ...saved, years: input?.years ?? saved.years });
    },
  );
  showLearning(saved, fetchMock);
  fireEvent.change(screen.getByLabelText("Practice notes"), {
    target: { value: "Keep these updated notes." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

  await screen.findByText("Learning preferences saved.");
  const submitted = fetchMock.mock.calls.find(
    ([, init]) => init?.method === "POST",
  );
  expect(JSON.parse(String(submitted?.[1]?.body))).toMatchObject({ years: 5 });
});
