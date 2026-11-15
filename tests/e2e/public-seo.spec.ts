import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicPaths = ["/", "/pricing", "/terms", "/challenge", "/help"];

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
    description: await page
      .locator('head meta[name="description"]')
      .getAttribute("content"),
    inLanguage: "en",
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

test("terms has a distinct canonical and renders without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({ baseURL, javaScriptEnabled: false });
  const response = await page.goto("/terms?utm_source=example");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "Terms of use" }),
  ).toBeVisible();
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gambit.lengway.me/terms",
  );
  await page.close();
});

test("signed-out visitors can read Help without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({ baseURL, javaScriptEnabled: false });
  const response = await page.goto("/help");

  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-robots-tag"]).toBeUndefined();
  await expect(page).toHaveURL(/\/help$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Help" }),
  ).toBeVisible();
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gambit.lengway.me/help",
  );
  await page.close();
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
  page,
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow: \/\s*$/);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain("<loc>");

  for (const path of publicPaths) {
    await page.goto(path);
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  }
});

test("internal links and in-page targets on public pages resolve", async ({
  browser,
  baseURL,
  request,
}) => {
  const page = await browser.newPage({ baseURL, javaScriptEnabled: false });
  const discovered = new Map<string, Set<string>>();

  for (const path of publicPaths) {
    expect((await page.goto(path))?.status(), path).toBe(200);
    const current = new URL(page.url());
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((anchors) =>
        anchors.map((anchor) => (anchor as HTMLAnchorElement).href),
      );
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== current.origin) continue;

      if (url.hash && current.pathname === url.pathname) {
        const target = decodeURIComponent(url.hash.slice(1));
        expect(
          await page.evaluate(
            (id) => Boolean(document.getElementById(id)),
            target,
          ),
          `${path} links to missing target ${url.hash}`,
        ).toBe(true);
      }
      const destination = url.pathname + url.search;
      const sources = discovered.get(destination) ?? new Set<string>();
      sources.add(path);
      discovered.set(destination, sources);
    }
  }

  for (const expected of ["/pricing", "/terms", "/challenge", "/s/sample"]) {
    expect(
      discovered.get(expected),
      `Home should link to ${expected}`,
    ).toContain("/");
  }
  for (const [destination, sources] of discovered) {
    const response = await request.get(destination);
    expect(
      response.status(),
      `${[...sources].join(", ")} link to ${destination}`,
    ).toBe(200);
  }
  await page.close();
});

for (const path of [...publicPaths, "/s/sample"]) {
  test(`${path} has an ordered heading hierarchy and named images`, async ({
    page,
  }) => {
    expect((await page.goto(path))?.status()).toBe(200);
    const headings = await page
      .getByRole("heading")
      .evaluateAll((elements) =>
        elements.map((element) => Number(element.tagName.slice(1))),
      );

    expect(headings[0]).toBe(1);
    expect(headings.filter((level) => level === 1)).toHaveLength(1);
    for (let index = 1; index < headings.length; index += 1) {
      expect(headings[index]).toBeLessThanOrEqual(headings[index - 1] + 1);
    }

    const { violations } = await new AxeBuilder({ page })
      .withRules(["image-alt", "svg-img-alt", "role-img-alt"])
      .analyze();
    expect(violations).toEqual([]);
  });
}

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
