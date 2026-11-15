import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.setTimeout(90_000);
async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByRole("tab", { name: "Email link" }).click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("alex@example.com");
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await page.getByRole("button", { name: "Open preview sign-in link" }).click();
  await expect(
    page.getByRole("heading", { name: /^Good (morning|afternoon|evening)/ }),
  ).toBeVisible();
}
async function start(page: Page) {
  await page
    .getByRole("button", { name: "Start practice case", exact: true })
    .click();
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
    page.getByRole("heading", { name: "Conversation", exact: true }),
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

test("review replay stays readable in both themes with reachable mobile controls", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design/review");
  await expect(page.getByRole("status", { name: "Move position" })).toHaveText(
    "5 / 9",
  );
  for (const dark of [false, true]) {
    await page.evaluate(
      (value) => document.documentElement.classList.toggle("dark", value),
      dark,
    );
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.getByRole("button", { name: "First move", exact: true }).click();
    await accessible(page);
    await page.screenshot({
      path: `../review-${dark ? "dark" : "light"}-desktop.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-selected="true"]').scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("navigation", { name: "Replay controls" }),
    ).toBeInViewport();
    await page.getByRole("button", { name: "Next move", exact: true }).click();
    await expect(
      page.getByRole("status", { name: "Move position" }),
    ).toHaveText("2 / 9");
    await accessible(page);
    await page.screenshot({
      path: `../review-${dark ? "dark" : "light"}-mobile.png`,
      fullPage: false,
    });
  }
});

test("onboarding, three moves, twist, evidence review and matching limited case record", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await accessible(page);
  await page.screenshot({ path: "../frontend-landing.png", fullPage: true });
  await signIn(page);
  await page.goto("/onboarding");
  await page.getByRole("radio", { name: /Account manager/ }).check();
  await page.getByRole("radio", { name: "3–5 years", exact: true }).check();
  await page
    .getByRole("group", { name: "What you want to practice" })
    .getByRole("button", { name: "Renewals and churn risk", exact: true })
    .click();
  await page
    .getByLabel("Anything else we should know", { exact: false })
    .fill("I work in sales, 5 years. Renewal conversations are difficult.");
  await page.getByRole("button", { name: "Review my profile" }).click();
  await expect(
    page.getByText("Sales · Account management · 5 years", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit my answers" }).click();
  await page.getByRole("radio", { name: "6+ years", exact: true }).check();
  await page
    .getByLabel("Anything else we should know", { exact: false })
    .fill("I work in sales, 6 years. Renewal conversations are difficult.");
  await page.getByRole("button", { name: "Review my profile" }).click();
  await expect(
    page.getByText("Sales · Account management · 6 years", { exact: true }),
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
  await page.getByText("How this was scored", { exact: true }).click();
  await expect(
    page.getByText(
      "Messages without enough evidence to judge are not counted.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(page.getByRole("status", { name: "Move position" })).toHaveText(
    "3 / 3",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("status", { name: "Move position" })).toHaveText(
    "2 / 3",
  );
  await expect(
    page.getByRole("list", { name: "Recorded conversation" }),
  ).toContainText("How much time does duplicate entry take each day?");
  await accessible(page);
  await page.screenshot({ path: "../frontend-review.png", fullPage: true });
  await expect(
    page.getByRole("link", { name: "Discovery · 1 of 3 cases" }),
  ).toHaveAttribute("href", "/path/discovery");
  await page
    .getByRole("button", { name: "Share case record", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Case record" }),
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
  const discovery = page.getByRole("article").filter({
    has: page.getByRole("link", { name: "Discovery", exact: true }),
  });
  await expect(
    discovery.getByText("1 of 3 cases", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("weekly practice on Free links to plan information", async ({ page }) => {
  await signIn(page);
  await expect(
    page.getByText("Included in Pro", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "See plans", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/billing/);
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
  const copilotInput = page
    .getByLabel("Ask Copilot", { exact: true })
    .filter({ visible: true });
  await copilotInput.press("End");
  await copilotInput.press("Shift+Enter");
  await expect(copilotInput).toHaveValue(
    "What should I check before discussing pricing?\n",
  );
  await expect(
    page
      .getByRole("button", { name: "Insert into reply", exact: true })
      .filter({ visible: true }),
  ).toHaveCount(0);
  await copilotInput.press("Enter");
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
  await expect(page.getByRole("region", { name: "Result" })).toContainText(
    "Copilot trap caught",
  );
  await expect(
    page.getByText("Observation coverage:", { exact: false }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "All moves", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "All moves" })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("list", { name: "Moves" })
    .getByRole("button")
    .last()
    .click();
  await expect(page.getByRole("status", { name: "Move position" })).toHaveText(
    "2 / 2",
  );
  await expect(
    page.getByRole("button", { name: "All moves", exact: true }),
  ).toBeFocused();
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
  await expect(page.getByText(/Observation coverage:/)).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Recorded conversation" }),
  ).toContainText("Please explain the workflow.");
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
    page.getByRole("heading", { name: "Conversation", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Message Dana")).toHaveCount(0);
  await expect(
    page.getByText(
      "We couldn’t score this case. Your conversation is saved below.",
    ),
  ).toBeVisible();
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
    page.getByRole("heading", { name: "Conversation", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Message Dana")).toHaveCount(0);
});
test("public SSR case record and full transcript exclude private diagnostics", async ({
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
  await page.getByRole("button", { name: "Profile menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("tab", { name: "Password" })).toBeVisible();
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
  await expect(page.getByRole("tab", { name: "Password" })).toBeVisible();
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
  await page.getByRole("button", { name: "Leave case", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Leave this case?" })
    .getByRole("link", { name: "Leave case", exact: true })
    .click();
  await page.getByRole("link", { name: "Continue", exact: true }).click();
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

test("the landing page opens the free challenge at phone and desktop widths", async ({
  page,
}) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const trial = page.getByRole("link", { name: "Try the free challenge" });
    await expect(trial).toBeInViewport();
    await trial.click();
    await expect(page).toHaveURL("/challenge");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
