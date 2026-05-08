import { expect, test } from "@playwright/test";

import { addEvalCase, hideVolatileUi, importSkillBundle } from "./helpers";

const API_BASE_URL = `http://127.0.0.1:${process.env.SKILLHUB_E2E_API_PORT ?? 8021}`;

test.beforeEach(async ({ request }) => {
  const response = await request.get(`${API_BASE_URL}/api/skills`);
  const skills = (await response.json()) as Array<{ skill: { id: string } }>;
  await Promise.all(skills.map((summary) => request.delete(`${API_BASE_URL}/api/skills/${summary.skill.id}`)));
});

test("visual baseline: empty skill workbench", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/skills");
  await hideVolatileUi(page);

  await expect(page.locator(".linearWorkbench")).toHaveScreenshot("empty-skill-workbench.png", {
    animations: "disabled",
  });
});

test("visual baseline: imported skill overview and eval review", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importSkillBundle(page, "visual-reviewing");
  await hideVolatileUi(page);

  await expect(page.locator(".linearWorkbench")).toHaveScreenshot("imported-skill-overview.png", {
    animations: "disabled",
  });

  await addEvalCase(page, "PR: visual missing tenant guard");
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: visual missing tenant guard" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await hideVolatileUi(page);

  await expect(page.locator(".linearWorkbench")).toHaveScreenshot("manual-eval-review.png", {
    animations: "disabled",
  });
});

test("visual baseline: mobile empty workbench", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/skills");
  await hideVolatileUi(page);

  await expect(page.locator(".linearWorkbench")).toHaveScreenshot("mobile-empty-workbench.png", {
    animations: "disabled",
  });
});
