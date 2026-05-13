import { expect, test } from "@playwright/test";

import { clearSkillCatalog } from "./helpers";

test.beforeEach(async ({ request }) => {
  await clearSkillCatalog(request);
});

test("mobile first-run keeps inspector actions collapsed until explicitly requested", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/skills");

  const inspector = page.getByLabel("Inspector");
  await expect(page.locator(".skillLaunchpad")).toBeVisible();
  await expect(page.locator(".skillLaunchpadForm")).toBeVisible();
  await expect(inspector.locator(".inspectorForm")).toBeHidden();
  await expect(inspector.getByRole("heading", { name: "导入标准 Skill" })).toHaveCount(0);

  await page.getByLabel("Skill catalog").getByRole("button", { name: "导入", exact: true }).click();

  await expect(inspector.getByRole("heading", { name: "导入标准 Skill" })).toBeVisible();
  await expect(inspector.locator('input[name="owner_ref"]')).toBeFocused();
});
