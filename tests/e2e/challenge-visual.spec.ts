import { expect, test } from "@playwright/test";

test("challenge highlights a wrong answer and keeps score actions inside the card", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/challenge");

  const choices = page.getByRole("group", { name: "Choose your reply" });
  const wrongChoice = choices.getByRole("button", { name: /reassure them/i });
  const unselectedBackground = await choices
    .getByRole("button")
    .last()
    .evaluate((button) => getComputedStyle(button).backgroundColor);
  await wrongChoice.click();
  await expect(wrongChoice).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() =>
      wrongChoice.evaluate(
        (button) => getComputedStyle(button).backgroundColor,
      ),
    )
    .not.toBe(unselectedBackground);

  await page.getByRole("button", { name: "Next exercise" }).click();
  await choices.getByRole("button").first().click();
  await page.getByRole("button", { name: "Next exercise" }).click();
  await choices.getByRole("button").first().click();
  await page.getByRole("button", { name: "See results" }).click();

  const results = page.getByRole("region", { name: "Your challenge score" });
  const continueLink = results.getByRole("link", {
    name: "Continue to full practice",
  });
  for (const width of [320, 640]) {
    await page.setViewportSize({ width, height: 720 });
    const card = (await results.boundingBox())!;
    const action = (await continueLink.boundingBox())!;
    expect(action.x + action.width).toBeLessThanOrEqual(
      card.x + card.width - 24,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
});
