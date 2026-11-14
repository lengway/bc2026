import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Work or personal email").fill("alex@example.com");
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await page.getByRole("button", { name: "Open preview sign-in link" }).click();
  await expect(
    page.getByRole("heading", { name: "Your practice" }),
  ).toBeVisible();
}
test("preview signs in, restores a conversation and submits for review", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("link", { name: "Try the preview" }).click();
  await expect(page).toHaveURL(/\/login/);
  await signIn(page);
  await page.getByRole("button", { name: "Open practice case" }).click();
  await expect(
    page.getByRole("heading", { name: "A renewal at risk" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start case", exact: true }).click();
  await page
    .getByLabel("Message Dana")
    .fill("What is the main concern with renewing?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText(
      "Our dispatch team still has to update two systems. That's the part I need fixed.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByLabel("Message Dana")
    .fill("How does the duplicate entry affect your dispatchers?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("A new update from the dispatch lead is available.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("What is the main concern with renewing?", { exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByText("How does the duplicate entry affect your dispatchers?", {
      exact: true,
    }),
  ).toHaveCount(1);
  await page
    .getByLabel("Ask Copilot", { exact: true })
    .fill("What should I verify?");
  await page.getByRole("button", { name: "Ask Copilot", exact: true }).click();
  await expect(
    page.getByText(
      "Ask which part of dispatch's workflow takes the most time, then agree on a way to measure a pilot. Check the account record before discussing pricing.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page
      .getByRole("log", { name: "Copilot conversation" })
      .locator(".message")
      .first(),
  ).toContainText("What should I verify?");
  await page.screenshot({ path: "../f1-workspace.png", fullPage: true });
  await page.getByRole("button", { name: "Submit case", exact: true }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer next move" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("weekly paywall restores focus when closed by keyboard", async ({
  page,
}) => {
  await signIn(page);
  const trigger = page.getByRole("button", { name: "Open weekly case" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "More room to practice" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test("mobile shell stays within viewport and has no serious accessibility violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      (item) => item.impact === "critical" || item.impact === "serious",
    ),
  ).toEqual([]);
  await page.screenshot({ path: "../f1-mobile.png", fullPage: true });
});
test("public certificate has no owner diagnostics and preserves an unknown score", async ({
  request,
}) => {
  const response = await request.get("/c/preview-certificate");
  expect(response.status()).toBe(200);
  const html = await response.text();
  for (const forbidden of [
    "realMotive",
    "innerThought",
    "processObservations",
    "editor_events",
  ])
    expect(html).not.toContain(forbidden);
  expect(html).toContain("Practice certificate");
  expect(html).toContain("Not enough evidence");
  expect(html).toContain("Recorded simulation");
});
test("logout prevents reopening a protected preview page", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Work or personal email")).toBeVisible();
});
test("keeps the designer gallery and frontend route layouts independent", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/design");
  await expect(
    page.getByRole("heading", { name: "Component gallery", exact: true }),
  ).toHaveCSS("font-size", "48px");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Dark theme", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Light theme", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Light theme", exact: true }).click();
  await page.screenshot({ path: "../f1-design-gallery.png", fullPage: false });
  await page.goto("/login");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
