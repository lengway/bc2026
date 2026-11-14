import { expect, test } from "@playwright/test";

test("preview account registration, confirmation, password sign-in and settings", async ({
  page,
}) => {
  const email = "maya@example.com";
  const password = "a fictional password";
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Maya Rivera");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox", { name: /I agree/ }).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your inbox" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Open preview confirmation link" })
    .click();
  await page.getByRole("button", { name: "Confirm email" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Your email is confirmed.",
  );
  await page.getByRole("button", { name: "Continue to Gambit" }).click();
  const profile = page.getByRole("button", { name: "Profile menu" });
  await profile.focus();
  await profile.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: "Account", exact: true }),
  ).toBeVisible();
  const appearance = page.getByRole("menuitem", { name: "Appearance" });
  await appearance.focus();
  await appearance.press("ArrowRight");
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  await profile.click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Password", { exact: true }).press("Enter");
  await profile.click();
  await page.getByRole("menuitem", { name: "My learning" }).click();
  await expect(page).toHaveURL(/\/settings\/learning$/);

  await page
    .getByRole("group", { name: "Practice focus" })
    .getByRole("button", { name: "Competitor deals" })
    .click();
  await page.getByRole("radio", { name: "3 cases" }).check();
  const intake = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/intake") && request.method() === "POST",
  );
  await page.getByRole("button", { name: "Save preferences" }).click();
  expect((await intake).postDataJSON()).toMatchObject({
    text: expect.stringContaining("Competitor deals"),
    dailyGoal: 3,
  });
  await expect(
    page.getByText(/Your next cases will focus on.*competitor deals/),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Settings sections" })
    .getByRole("link", { name: "Account", exact: true })
    .click();
  const passwordSection = page
    .getByRole("heading", { name: "Password", exact: true })
    .locator("xpath=../..");
  await passwordSection
    .getByLabel("Current password", { exact: true })
    .fill(password);
  const newPassword = "another fictional password";
  await passwordSection
    .getByLabel("New password", { exact: true })
    .fill(newPassword);
  const changed = page.waitForRequest((request) =>
    request.url().endsWith("/api/auth/change-password"),
  );
  await passwordSection
    .getByRole("button", { name: "Change password" })
    .click();
  expect((await changed).postDataJSON()).toEqual({
    currentPassword: password,
    password: newPassword,
  });
  await expect(page.getByText("Password updated.")).toBeVisible();

  await page
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Permanently delete account" }),
  ).toBeDisabled();
  await dialog.getByLabel("Confirm your email").fill(email);
  await dialog.getByLabel("Current password").fill(newPassword);
  const deleted = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/account") && request.method() === "DELETE",
  );
  await dialog
    .getByRole("button", { name: "Permanently delete account" })
    .click();
  expect((await deleted).postDataJSON()).toEqual({
    confirm: "DELETE",
    currentPassword: newPassword,
  });
  await expect(page).toHaveURL(/\/login/);
});

test("email-link sign-in ignores external return URLs", async ({ page }) => {
  await page.goto("/login?next=https%3A%2F%2Funtrusted.example%2F");
  await page.getByRole("tab", { name: "Email link" }).click();
  await page.getByLabel("Email", { exact: true }).fill("alex@example.com");
  const sent = page.waitForRequest((request) =>
    request.url().endsWith("/api/auth/magic-link"),
  );
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  expect((await sent).postDataJSON()).toMatchObject({ next: "/dashboard" });
  await page.getByRole("button", { name: "Open preview sign-in link" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
