import { expect, test, type Locator } from "@playwright/test";

test("keyboard users can skip chrome and move focus to main content", async ({ page }) => {
  await page.goto("/skills");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "跳到主要内容" });
  await expect(skipLink).toBeFocused();
  await expectVisibleFocusIndicator(skipLink);

  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("primary controls expose a visible keyboard focus indicator", async ({ page }) => {
  await page.goto("/skills");

  const commandButton = page.getByRole("button", { name: "Open command menu" }).first();
  await commandButton.focus();

  await expectVisibleFocusIndicator(commandButton);
});

test("reduced motion preference suppresses non-essential transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/skills");

  const commandButton = page.getByRole("button", { name: "Open command menu" }).first();
  const maxTransitionMs = await maxTransitionDurationMs(commandButton);

  expect(maxTransitionMs).toBeLessThanOrEqual(0.01);
});

test("async workbench notices are exposed as polite status updates", async ({ page }) => {
  await page.goto("/skills");

  const sessionPanel = page.locator(".localSessionPanel");
  await sessionPanel.getByPlaceholder("release-manager").fill("accessibility-operator");
  await sessionPanel.getByRole("button", { name: "切换 actor" }).click();

  await expect(page.getByRole("status")).toContainText("Actor 已切换。");
});

async function maxTransitionDurationMs(locator: Locator) {
  return locator.evaluate((element) => {
    function toMs(duration: string) {
      if (duration.endsWith("ms")) return Number(duration.slice(0, -2));
      if (duration.endsWith("s")) return Number(duration.slice(0, -1)) * 1000;
      return Number(duration) || 0;
    }

    const durations = getComputedStyle(element).transitionDuration.split(",");
    return Math.max(...durations.map((duration) => toMs(duration.trim())));
  });
}

async function expectVisibleFocusIndicator(locator: Locator) {
  const indicator = await locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const outlineWidth = Number.parseFloat(style.outlineWidth || "0");
    const hasOutline = style.outlineStyle !== "none" && outlineWidth >= 2;
    const hasShadow = style.boxShadow !== "none" && style.boxShadow.trim().length > 0;
    return hasOutline || hasShadow;
  });
  expect(indicator).toBe(true);
}
