import { expect, test } from "@playwright/test";

test("mobile preview launches Pressure and can open the CFO email after reload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    sessionStorage.setItem("bc2026.preview.authenticated", "yes"),
  );
  await page.goto("/dashboard");
  await page.getByRole("link", { name: /Handle a CFO curveball/ }).click();
  await page.getByRole("button", { name: "Start Pressure case" }).click();
  await expect(page).toHaveURL(/\/case\/[^/?]+\?type=pressure$/);
  await expect(
    page.getByRole("heading", {
      name: "Northstar Clinics: the budget changed",
    }),
  ).toBeVisible();
  await expect(page.getByText("Case brief · Pressure · Sales")).toBeVisible();

  const path = new URL(page.url()).pathname;
  await page.evaluate((caseId) => {
    const key = "bc2026.preview.cases.v2";
    const cases: { view: { id: string; type: string } }[] = JSON.parse(
      sessionStorage.getItem(key) ?? "[]",
    );
    const saved = cases.find(({ view }) => view.id === caseId);
    if (!saved) throw new Error("Expected a saved Pressure case");
    saved.view.type = "onboarding";
    sessionStorage.setItem(key, JSON.stringify(cases));
  }, path.split("/").at(-1));
  await page.goto(`${path}?type=onboarding&source=bookmark#brief`);
  await expect(page.getByText("Case brief · Pressure · Sales")).toBeVisible();
  await expect(page).toHaveURL(`${path}?type=pressure&source=bookmark#brief`);

  await page
    .getByLabel("I understand what is recorded in this workspace.")
    .check();
  await page.getByRole("button", { name: "Start case", exact: true }).click();

  const message = page.getByRole("textbox", { name: /^Message / });
  const send = page.getByRole("button", { name: "Send message", exact: true });
  const notice = page.getByRole("status", {
    name: "New email from Priya Shah, CFO",
  });

  await message.fill("Who can approve the spend?");
  await send.click();
  await expect(page.getByText(/What would you want to measure/)).toBeVisible();
  await expect(notice).toHaveCount(0);

  await page.reload();
  await message.fill("Would a one-clinic pilot be feasible?");
  await send.click();
  await expect(notice).toContainText("$60,000");
  await notice.getByRole("button", { name: "Open" }).click();
  await expect(
    page.getByRole("dialog").getByText(/The approved first-year ceiling/),
  ).toBeVisible();
});
