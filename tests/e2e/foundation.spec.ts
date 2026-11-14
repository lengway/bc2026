import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.setTimeout(90_000);
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Work or personal email").fill("alex@example.com");
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await page.getByRole("button", { name: "Open preview sign-in link" }).click();
  await expect(
    page.getByRole("heading", { name: "Your practice", exact: true }),
  ).toBeVisible();
}
async function start(page: Page) {
  await page.getByRole("button", { name: "Start daily case" }).click();
  await expect(
    page.getByRole("button", { name: "Start case", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("I understand what is recorded in this workspace.")
    .check();
  await page.getByRole("button", { name: "Start case", exact: true }).click();
  await expect(page.getByLabel("Message Dana")).toBeEditable();
}
async function send(page: Page, text: string) {
  await page.getByLabel("Message Dana").fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Message Dana")).toBeEnabled();
  await expect(page.getByLabel("Message Dana")).toHaveValue("");
}
async function submit(page: Page) {
  await page.getByRole("button", { name: "Submit case", exact: true }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await expect(page).toHaveURL(/\/review\//);
  await expect(
    page.getByRole("heading", { name: "Observed assistance", exact: true }),
  ).toBeVisible();
}
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(
    result.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("onboarding, three moves, twist, evidence review and matching limited certificate", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await accessible(page);
  await page.screenshot({ path: "../frontend-landing.png", fullPage: true });
  await signIn(page);
  await page.getByRole("link", { name: "Set up your practice" }).click();
  await page.getByLabel("Beginner", { exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("Your role, experience and what feels difficult")
    .fill("I work in sales, 3 years. Renewal conversations are difficult.");
  await page.getByRole("button", { name: "Review my profile" }).click();
  await expect(
    page.getByText("Sales · Account management · 3 years", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit my answer" }).click();
  await page
    .getByLabel("Your role, experience and what feels difficult")
    .fill("I work in sales, 4 years. Renewal conversations are difficult.");
  await page.getByRole("button", { name: "Review my profile" }).click();
  await expect(
    page.getByText("Sales · Account management · 4 years", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Looks right, prepare my case" })
    .click();
  await page.getByText("How scoring works", { exact: true }).click();
  await expect(
    page.getByText("pointsSum / maxPoints × 100", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("I understand what is recorded in this workspace.")
    .check();
  await page.getByRole("button", { name: "Start case", exact: true }).click();
  await expect(page.getByLabel("Message Dana")).toBeEditable();
  await accessible(page);
  await send(page, "What needs to change for the dispatch team?");
  await send(page, "How much time does duplicate entry take each day?");
  await expect(
    page.getByRole("button", { name: /Dispatch lead.*update/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Dispatch lead.*update/ }).click();
  await expect(page.getByText(/roughly 45 minutes/)).toBeVisible();
  await send(
    page,
    "Let us run a two-week pilot with two dispatchers and compare the time spent.",
  );
  await page.screenshot({ path: "../frontend-workspace.png", fullPage: true });
  await submit(page);
  await page.getByText("Why this score?", { exact: true }).click();
  await expect(page.getByText("240 / 300", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View message" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await accessible(page);
  await page.screenshot({ path: "../frontend-review.png", fullPage: true });
  await page
    .getByRole("button", { name: "Share certificate", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Certificate of recorded practice" }),
  ).toBeVisible();
  await expect(page.getByText("80%", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("Activity observations", { exact: true }),
  ).toHaveCount(0);
  await accessible(page);
  await page.screenshot({
    path: "../frontend-certificate.png",
    fullPage: true,
  });
  await page.goto("/path");
  await expect(
    page.getByRole("link", { name: /A renewal at risk/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("weekly paywall restores keyboard focus and compares plans", async ({
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
  await trigger.click();
  await page.getByRole("link", { name: "Compare plans" }).click();
  await expect(page).toHaveURL(/\/pricing/);
  await page.getByRole("button", { name: /Yearly/ }).click();
  await expect(page.getByRole("button", { name: /Yearly/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("mobile documents, Copilot insertion, keyboard entry and accessible workspace", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await start(page);
  await accessible(page);
  await page.getByLabel("Message Dana").evaluate((element) => {
    const text = "My own draft: let us discuss the renewal.";
    const data = new DataTransfer();
    data.setData("text/plain", text);
    element.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData: data }),
    );
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(element, text);
    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertFromPaste",
        data: text,
      }),
    );
  });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Message Dana")).toHaveValue("");
  await page.getByRole("button", { name: "Documents", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Brightline account", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText("10%", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Copilot", exact: true }).click();
  await page
    .getByLabel("Ask Copilot", { exact: true })
    .filter({ visible: true })
    .fill("What should I check before discussing pricing?");
  await page
    .getByRole("button", { name: "Ask Copilot", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "Insert into reply", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByLabel("Message Dana")).toBeFocused();
  await expect(page.getByLabel("Message Dana")).toHaveValue(
    /Check the account record/,
  );
  await page
    .getByLabel("Message Dana")
    .fill(
      (await page.getByLabel("Message Dana").inputValue()).replace(
        "30%",
        "10%",
      ),
    );
  await page.getByLabel("Message Dana").press("End");
  await page.getByLabel("Message Dana").press("Shift+Enter");
  await page
    .getByLabel("Message Dana")
    .pressSequentially("The approved discount ceiling is 10%.");
  await page.screenshot({ path: "../frontend-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByLabel("Message Dana")).toHaveValue("");
  await submit(page);
  await expect(
    page.getByText("Observation coverage:", { exact: false }).first(),
  ).toContainText("available");
  await expect(page.getByText("Copilot trap: Caught")).toBeVisible();
  await page.getByText("verify pricing", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "View document" }),
  ).toBeVisible();
  await accessible(page);
});
test("reload keeps messages and server deadline without inventing telemetry coverage", async ({
  page,
}) => {
  await signIn(page);
  await start(page);
  await send(page, "Please explain the workflow.");
  await page.reload();
  await expect(
    page.getByText("Please explain the workflow.", { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByLabel("Message Dana")).toBeEditable();
  await submit(page);
  await expect(page.getByText(/Observation coverage:/).first()).toContainText(
    "unavailable",
  );
});
test("expired server deadline submits once and disables writing", async ({
  page,
}) => {
  await signIn(page);
  await start(page);
  await page.evaluate(() => {
    const key = "bc2026.preview.cases.v2";
    const stored = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    for (const item of stored) {
      if (item.view.status === "in_progress")
        item.view.startedAt = new Date(
          Date.now() - item.view.brief.timeLimitSec * 1000 - 1000,
        ).toISOString();
    }
    sessionStorage.setItem(key, JSON.stringify(stored));
  });
  await page.reload();
  await expect(page).toHaveURL(/\/review\//);
  await expect(
    page.getByRole("heading", { name: "Observed assistance", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Message Dana")).toHaveCount(0);
  await expect(page.getByText("Not enough evidence").first()).toBeVisible();
  const count = await page.evaluate(() => {
    const stored = JSON.parse(
      sessionStorage.getItem("bc2026.preview.cases.v2") ?? "[]",
    );
    return stored
      .flatMap((item: { events: { type: string }[] }) => item.events)
      .filter((event: { type: string }) => event.type === "submit").length;
  });
  expect(count).toBe(1);
});
test("a counterpart leaving ends the case and opens the review", async ({
  page,
}) => {
  await signIn(page);
  await page.evaluate(() =>
    sessionStorage.setItem("bc2026.preview.scenario", "left"),
  );
  await start(page);
  await page.getByLabel("Message Dana").fill("Can we discuss the renewal?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page).toHaveURL(/\/review\//);
  await expect(
    page.getByRole("heading", { name: "Observed assistance", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Message Dana")).toHaveCount(0);
});
test("public SSR certificate and full transcript exclude private diagnostics", async ({
  page,
  request,
}) => {
  const response = await request.get("/c/preview-certificate");
  expect(response.status()).toBe(200);
  const html = await response.text();
  for (const key of [
    "processObservations",
    "editor_events",
    "webdriverReported",
    "realMotive",
  ])
    expect(html).not.toContain(key);
  expect(html).toContain("Not enough evidence");
  await page.goto("/c/sample-full");
  await page
    .getByRole("button", { name: "Read full review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Public conversation transcript" }),
  ).toBeVisible();
  await expect(
    page.getByText("Activity observations", { exact: true }),
  ).toHaveCount(0);
  await accessible(page);
  const imageUrl = await page
    .locator('meta[property="og:image"]')
    .getAttribute("content");
  expect(imageUrl).toBeTruthy();
  const og = await request.get(new URL(imageUrl!).pathname);
  expect(og.status()).toBe(200);
  expect(og.headers()["content-type"]).toContain("image/png");
});
test("checkout preview and cancellation never claim a paid subscription", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/pricing");
  await page.getByRole("button", { name: /Yearly/ }).click();
  await page.getByRole("button", { name: /Upgrade to Pro/ }).click();
  await expect(page).toHaveURL(/\/billing\/success/);
  await expect(
    page.getByText(
      "No payment was collected. Your preview account is unchanged.",
    ),
  ).toBeVisible();
  await page.goto("/billing/cancel");
  await expect(page.getByRole("link", { name: "View plans" })).toBeVisible();
});
test("logout prevents reopening a protected preview page", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Work or personal email")).toBeVisible();
});
test("designer gallery retains its independent layout", async ({ page }) => {
  await page.goto("/design");
  await expect(
    page.getByRole("heading", { name: "Component gallery", exact: true }),
  ).toHaveCSS("font-size", "48px");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toHaveCount(0);
  await page.goto("/login");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
});

test("failed message survives in-app navigation and retries without duplication", async ({
  page,
}) => {
  await signIn(page);
  await start(page);
  await page.evaluate(() =>
    sessionStorage.setItem("bc2026.preview.scenario", "fail-next-move"),
  );
  await page
    .getByLabel("Message Dana")
    .fill("Please explain the dispatch workflow.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry message", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Practice", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue case", exact: true })
    .click();
  await expect(page.getByLabel("Message Dana")).toHaveValue(
    "Please explain the dispatch workflow.",
  );
  await page
    .getByRole("button", { name: "Retry message", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Message Dana")).toHaveValue("");
  await expect(
    page.getByText("Please explain the dispatch workflow.", { exact: true }),
  ).toHaveCount(1);
});
