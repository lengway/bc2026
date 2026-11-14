import { expect, test } from "@playwright/test";

test("landing serves canonical metadata and content with JavaScript disabled", async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({ baseURL, javaScriptEnabled: false });
  const response = await page.goto("/?utm_source=example");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gambit.lengway.me/",
  );
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute(
    "content",
    /realistic work conversations/i,
  );
  const structuredData = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ??
      "",
  );
  expect(structuredData).toMatchObject({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Gambit",
    url: "https://gambit.lengway.me/",
  });
  await page.close();
});

test("pricing serves its plan headings and distinct canonical without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({ baseURL, javaScriptEnabled: false });
  const response = await page.goto("/pricing?utm_source=example");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 2, name: "Free" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Pro" }),
  ).toBeVisible();
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gambit.lengway.me/pricing",
  );
  await page.close();
});

test("the challenge's share variants canonicalize to the main challenge", async ({
  page,
}) => {
  const response = await page.goto("/challenge?score=3");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gambit.lengway.me/challenge",
  );
});

test("missing pages return HTTP 404 and link home", async ({
  page,
  request,
}) => {
  for (const url of [
    "/missing-gambit-page",
    "/c/invalid",
    "/s/not-a-valid-certificate",
  ]) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "We could not find that page" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to home" }),
    ).toHaveAttribute("href", "/");
    expect((await request.head(url)).status()).toBe(404);
  }
});

test("existing URL normalization preserves a permanent redirect", async ({
  request,
}) => {
  const response = await request.get("/pricing/?utm_source=example", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe("/pricing?utm_source=example");
});

test("private routes, design galleries and unlisted records send a noindex header", async ({
  request,
}) => {
  for (const url of [
    "/login",
    "/prepare",
    "/pressure",
    "/design",
    "/c/sample",
    "/s/sample",
  ]) {
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    expect(response.headers()["x-robots-tag"]).toMatch(/noindex/);
  }
});

test("the mock preview does not advertise indexable routes", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow: \/\s*$/);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain("<loc>");
});

test("public page links resolve within the public route set", async ({
  browser,
  baseURL,
  request,
}) => {
  const publicPaths = new Set(["/", "/pricing", "/terms", "/challenge"]);
  const page = await browser.newPage({ baseURL });
  const discovered = new Set<string>();

  for (const path of publicPaths) {
    await page.goto(path);
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
      );
    for (const href of hrefs) {
      const url = new URL(href);
      if (
        url.origin === new URL(baseURL!).origin &&
        publicPaths.has(url.pathname)
      ) {
        discovered.add(url.pathname);
      }
    }
  }

  expect(discovered.size).toBeGreaterThan(0);
  for (const path of discovered) {
    expect((await request.get(path)).status(), `${path} should resolve`).toBe(
      200,
    );
  }
  await page.close();
});

test("public pages fit a narrow mobile viewport without horizontal overflow", async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  for (const path of ["/", "/pricing", "/challenge"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      body: document.body.scrollWidth,
      viewport: document.documentElement.clientWidth,
    }));
    expect(
      dimensions.body,
      `${path} should fit the viewport`,
    ).toBeLessThanOrEqual(dimensions.viewport);
  }
  await page.close();
});

test("challenge supports an answer and reveals the source record", async ({
  page,
}) => {
  await page.goto("/challenge");
  await page
    .getByRole("button", { name: /reassure them that net 60 is fine/i })
    .click();
  await expect(
    page.getByRole("region", { name: "What the record says" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Net 30 from invoice date/i).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next exercise" }),
  ).toBeVisible();
});

test("challenge content is server rendered without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({ baseURL, javaScriptEnabled: false });
  const response = await page.goto("/challenge");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Spot the mismatch" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /the terms don't match/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /reassure them that net 60 is fine/i }),
  ).toBeVisible();
  await page.close();
});
