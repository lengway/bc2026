import { expect, test } from "@playwright/test";
import { makeCase, newEvent } from "../../src/mocks/scenarios/sales";

test.use({ isMobile: true, hasTouch: true });

const review = { ...makeCase(), status: "evaluated" as const };
const firstMove = newEvent(review, [], {
  actor: "user",
  type: "message",
  content: "Which part of the daily dispatch workflow takes longest?",
  personaId: "dana",
});
const reply = newEvent(review, [firstMove], {
  actor: "persona",
  type: "message",
  content: "Our dispatchers have to enter the same information twice.",
  personaId: "dana",
  meta: { trustAfter: 55 },
});

const screens = [
  "/dashboard",
  "/path",
  "/path/objection_handling",
  "/history",
  "/certificates",
  "/settings",
  "/settings/account",
  "/settings/learning",
  "/settings/billing",
  "/settings/privacy",
  "/prepare",
  "/pressure",
  `/review/${review.id}`,
];

for (const width of [320, 375, 390]) {
  test(`populated dashboard keeps horizontal scrolling inside its cards at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.addInitScript(() => {
      sessionStorage.setItem("bc2026.preview.authenticated", "yes");
      sessionStorage.setItem("gambit.preview.appFixture", "certified");
    });
    await page.goto("/dashboard");
    await expect(
      page.getByRole("table", { name: "Case results" }).getByRole("rowheader"),
    ).toHaveCount(3);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });

    const statistics = page.getByRole("region", {
      name: "Practice statistics cards",
    });
    const skills = page.getByRole("region", { name: "Skill cards" });
    await expect(
      statistics.getByRole("link", { name: "View certificates", exact: true }),
    ).toHaveAttribute("href", "/certificates");

    for (const colorScheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme });
      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${colorScheme}\\b`),
      );
      expect(
        await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        })),
        colorScheme,
      ).toEqual({ scrollWidth: width, clientWidth: width });
    }

    for (const region of [statistics, skills]) {
      await region.press("ArrowRight");
      await expect
        .poll(() => region.evaluate((element) => element.scrollLeft))
        .toBeGreaterThan(0);
    }
  });

  test(`authenticated pages and all mobile tabs fit at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      (storedReview) => {
        sessionStorage.setItem("bc2026.preview.authenticated", "yes");
        sessionStorage.setItem("gambit.preview.appFixture", "certified");
        sessionStorage.setItem(
          "bc2026.preview.cases.v2",
          JSON.stringify([storedReview]),
        );
      },
      {
        view: review,
        readyAt: 0,
        evaluatedAt: Date.now(),
        events: [firstMove, reply],
        trust: 55,
        outcome: "incomplete",
        moves: {},
        copilot: {},
      },
    );

    const navigation = page.getByRole("navigation", {
      name: "Mobile navigation",
    });
    for (const path of screens) {
      await page.goto(path);
      await expect(page).toHaveURL(path);
      await expect(
        page.getByRole("main").getByRole("heading", { level: 1 }),
      ).toBeVisible();
      await expect(page.locator("main [aria-busy=true]")).toHaveCount(0);
      if (path.startsWith("/review/")) {
        await expect(
          page.getByRole("heading", { name: "Conversation", exact: true }),
        ).toBeVisible();
      }
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      await expect(navigation).toBeInViewport({ ratio: 1 });
      await expect(navigation.getByRole("link")).toHaveCount(4);
      for (const link of await navigation.getByRole("link").all()) {
        await expect(link).toBeInViewport({ ratio: 1 });
      }
      expect(
        await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        })),
        path,
      ).toEqual({ scrollWidth: width, clientWidth: width });
    }
  });
}
