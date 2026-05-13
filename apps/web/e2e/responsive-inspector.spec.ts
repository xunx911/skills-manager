import { expect, test } from "@playwright/test";

import { clearSkillCatalog, importSkillBundle } from "./helpers";

test.beforeEach(async ({ request }) => {
  await clearSkillCatalog(request);
});

test("evidence modes use a compact inspector rail on medium desktop widths", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importSkillBundle(page, `responsive-rail-${Date.now()}`);

  const inspector = page.getByLabel("Inspector");
  const overviewInspectorBox = await inspector.boundingBox();
  const overviewMainBox = await page.locator(".linearMain").boundingBox();
  expect(overviewInspectorBox?.width).toBeGreaterThan(320);
  expect(overviewMainBox?.width).toBeLessThan(700);

  await page.getByRole("tab", { name: "历史", exact: true }).click();
  await expect(page.locator(".historyPane")).toBeVisible();

  const historyInspectorBox = await inspector.boundingBox();
  const historyMainBox = await page.locator(".linearMain").boundingBox();
  expect(historyInspectorBox?.width).toBeLessThanOrEqual(128);
  expect(historyMainBox?.width).toBeGreaterThan(850);
  await expect(inspector.locator(".inspectorEvidence")).toBeVisible();
  await expect(inspector.locator(".actionMenu")).toBeHidden();
  await expect(inspector.locator(".localSessionPanel")).toBeHidden();
});
