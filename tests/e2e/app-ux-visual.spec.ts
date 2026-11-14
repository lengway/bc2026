import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const routes = [
  { slug: "home", path: "/dashboard" },
  { slug: "skills", path: "/path" },
  { slug: "skill", path: "/path/objection_handling" },
  { slug: "history", path: "/history" },
  { slug: "certificates", path: "/certificates" },
  { slug: "learning", path: "/settings/learning" },
  { slug: "account", path: "/settings/account" },
  { slug: "billing", path: "/settings/billing" },
  { slug: "privacy", path: "/settings/privacy" },
  { slug: "help", path: "/help" },
  { slug: "login", path: "/login" },
  { slug: "signup", path: "/signup" },
  { slug: "forgot-password", path: "/forgot-password" },
  {
    slug: "reset-password",
    path: "/reset-password?token=preview-password-reset-token",
  },
  {
    slug: "verify-email",
    path: "/verify-email?token=preview-verification-token",
  },
] as const;

async function openScreen(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("main").getByRole("heading", { level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /couldn.t|went wrong/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("main").getByRole("status", { name: /^Loading/i }),
  ).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("bc2026.preview.authenticated", "yes");
    sessionStorage.setItem("gambit.preview.appFixture", "certified");
    localStorage.setItem("theme", "system");
  });
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 1024, 390] as const) {
    test(`application layout at ${width}px in ${theme} theme`, async ({
      page,
    }, info) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      for (const { slug, path } of routes) {
        await openScreen(page, path);
        await expect(page.locator("html")).toHaveClass(
          new RegExp(`\\b${theme}\\b`),
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        const image = info.outputPath(`${slug}-${theme}-${width}.png`);
        await page.screenshot({
          path: image,
          fullPage: true,
          animations: "disabled",
        });
        await info.attach(`${slug}-${theme}-${width}`, {
          path: image,
          contentType: "image/png",
        });
        if (
          width === 1440 &&
          routes.slice(0, 5).some((item) => item.slug === slug)
        ) {
          const report = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();
          expect(
            report.violations.map(({ id, nodes }) => ({
              id,
              targets: nodes.map(({ target }) => target),
            })),
            path,
          ).toEqual([]);
        }
      }
    });
  }
}
