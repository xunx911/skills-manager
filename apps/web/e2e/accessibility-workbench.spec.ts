import { expect, test, type Locator } from "@playwright/test";

import { importSkillBundle } from "./helpers";

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

test("command menu exposes combobox listbox semantics", async ({ page }) => {
  await page.goto("/skills");

  await page.getByRole("button", { name: "Open command menu" }).first().click();
  const combobox = page.getByRole("combobox", { name: "Search" });
  await expect(combobox).toBeFocused();

  const listboxId = await combobox.getAttribute("aria-controls");
  expect(listboxId).toBeTruthy();
  await expect(page.locator(`#${listboxId}`)).toHaveAttribute("role", "listbox");

  const initialActiveId = await combobox.getAttribute("aria-activedescendant");
  expect(initialActiveId).toBeTruthy();
  await expect(page.locator(`#${initialActiveId}`)).toHaveAttribute("role", "option");
  await expect(page.locator(`#${initialActiveId}`)).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowDown");
  const nextActiveId = await combobox.getAttribute("aria-activedescendant");
  expect(nextActiveId).toBeTruthy();
  expect(nextActiveId).not.toBe(initialActiveId);
  await expect(page.locator(`#${nextActiveId}`)).toHaveAttribute("aria-selected", "true");
});

test("command menu traps tab focus and restores focus on close", async ({ page }) => {
  await page.goto("/skills");

  const trigger = page.getByRole("button", { name: "Open command menu" }).first();
  await trigger.focus();
  await page.keyboard.press("Enter");

  const combobox = page.getByRole("combobox", { name: "Search" });
  const closeButton = page.getByRole("button", { name: "关闭命令菜单" });
  await expect(combobox).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(combobox).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Command menu" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("catalog action moves focus into the inspector form", async ({ page }) => {
  await page.goto("/skills");

  await page.getByLabel("Skill catalog").getByRole("button", { name: "导入", exact: true }).click();

  await expect(page.getByLabel("Inspector").locator('input[name="owner_ref"]')).toBeFocused();
});

test("command menu action moves focus into the inspector form", async ({ page }) => {
  await importSkillBundle(page, `focus-handoff-${Date.now()}`);

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await page.getByRole("combobox", { name: "Search" }).fill("添加 case");
  await page.keyboard.press("Enter");

  await expect(page.getByLabel("Inspector").locator('input[name="title"]')).toBeFocused();
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
