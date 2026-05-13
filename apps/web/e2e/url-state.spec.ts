import { expect, test } from "@playwright/test";

import { clearSkillCatalog, importSkillBundle } from "./helpers";

test.beforeEach(async ({ request }) => {
  await clearSkillCatalog(request);
});

test("workbench opens the requested skill and mode from URL state", async ({ page }) => {
  const stamp = Date.now();
  const alpha = `url-alpha-${stamp}`;
  const beta = `url-beta-${stamp}`;
  await importSkillBundle(page, alpha);
  await importSkillBundle(page, beta);

  await page.goto(`/skills?skill=${encodeURIComponent(beta)}&mode=history`);

  await expect(page.getByRole("heading", { name: beta })).toBeVisible();
  await expect(page.getByRole("tab", { name: "历史", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".historyPane")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: beta })).toBeVisible();
  await expect(page.getByRole("tab", { name: "历史", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("workbench keeps selected skill and mode in the URL", async ({ page }) => {
  const slug = `url-sync-${Date.now()}`;
  await importSkillBundle(page, slug);

  await page.getByRole("tab", { name: "历史", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`[?&]skill=${slug}(?:&|$)`));
  await expect(page).toHaveURL(/[?&]mode=history(?:&|$)/);

  await page.getByRole("tab", { name: "概览", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`[?&]skill=${slug}(?:&|$)`));
  await expect(page).not.toHaveURL(/[?&]mode=history(?:&|$)/);

  await page.goBack();
  await expect(page.getByRole("tab", { name: "历史", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".historyPane")).toBeVisible();
});
