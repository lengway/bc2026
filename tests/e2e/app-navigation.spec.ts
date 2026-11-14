import { expect, test } from "@playwright/test";

const destinations = [
  ["Home", "/dashboard"],
  ["Skills", "/path"],
  ["History", "/history"],
  ["Certificates", "/certificates"],
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("bc2026.preview.authenticated", "yes"),
  );
});

for (const viewport of [1440, 390]) {
  test(`authenticated navigation at ${viewport}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport, height: 844 });
    await page.goto("/dashboard");
    const desktop = viewport >= 1024;
    const nav = page.getByRole("navigation", {
      name: desktop ? "Main navigation" : "Mobile navigation",
    });
    await expect(nav).toBeVisible();
    await expect(
      page.getByRole("navigation", {
        name: desktop ? "Mobile navigation" : "Main navigation",
      }),
    ).toHaveCount(0);

    for (const [label, href] of destinations) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await link.click();
      await expect(page).toHaveURL(href);
      await expect(link).toHaveAttribute("aria-current", "page");
      if (desktop) {
        await expect(
          page.getByRole("navigation", { name: "Breadcrumb" }),
        ).toContainText(label);
      } else {
        await expect(nav).toBeInViewport();
      }
    }
  });
}

test("desktop remembers its sidebar and shows the skill breadcrumb", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 844 });
  await page.goto("/path/objection_handling");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const aside = page.locator("aside").filter({ has: nav });
  const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(aside).toHaveCSS("width", "240px");
  await expect(
    breadcrumbs.getByRole("link", { name: "Skills" }),
  ).toHaveAttribute("href", "/path");
  await expect(breadcrumbs.getByText("Objection handling")).toBeVisible();
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(aside).toHaveCSS("width", "64px");
  await page.reload();
  await expect(aside).toHaveCSS("width", "64px");
  await expect(nav.getByRole("link", { name: "Skills" })).toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar" }).click();
  await expect(aside).toHaveCSS("width", "240px");
});
