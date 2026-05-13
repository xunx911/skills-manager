import { expect, test } from "@playwright/test";

import { addEvalCase, appendSkillBundleVersion, clearSkillCatalog, importSkillBundle } from "./helpers";

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

test("workbench restores diff pair, selected diff file, eval target, and selected case from URL", async ({ page }) => {
  const slug = `url-deep-diff-${Date.now()}`;
  await importSkillBundle(page, slug);
  await addEvalCase(page, "URL case: first guard");
  await addEvalCase(page, "URL case: second guard");
  await appendSkillBundleVersion(page, slug, { makeCurrent: false });

  await page.locator(".caseReviewCard").filter({ hasText: "URL case: second guard" }).click();
  await expect(page).toHaveURL(/[?&]mode=evals(?:&|$)/);
  await expect(page).toHaveURL(/[?&]eval_target=[^&]+/);
  await expect(page).toHaveURL(/[?&]case=[^&]+/);

  await page.reload();
  await expect(page.getByRole("tab", { name: "测评", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".evalTargetBar")).toContainText("candidate");
  await expect(page.locator(".caseReviewCardActive")).toContainText("URL case: second guard");

  await page.getByRole("tab", { name: "差异", exact: true }).click();
  await expect(page.locator(".diffFileRow").filter({ hasText: "new-checklist.md" })).toBeVisible();
  await page.locator(".diffFilterBar").getByRole("button", { name: "新增" }).click();
  await page.locator(".diffFileRow").filter({ hasText: "new-checklist.md" }).click();

  await expect(page).toHaveURL(/[?&]mode=diff(?:&|$)/);
  await expect(page).toHaveURL(/[?&]diff_left=[^&]+/);
  await expect(page).toHaveURL(/[?&]diff_right=[^&]+/);
  await expect(page).toHaveURL(/[?&]diff_filter=added(?:&|$)/);
  await expect(page).toHaveURL(/[?&]diff_file=new-checklist\.md(?:&|$)/);

  await page.reload();
  await expect(page.getByRole("tab", { name: "差异", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".diffFilterBar .diffFilterActive")).toContainText("新增");
  await expect(page.locator(".diffFileRowActive")).toContainText("new-checklist.md");
});

test("workbench restores history comparison and promotion review from URL", async ({ page }) => {
  const slug = `url-deep-history-${Date.now()}`;
  await importSkillBundle(page, slug);
  await addEvalCase(page, "URL case: tenant regression");

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "URL case: tenant regression" })
    .getByRole("button", { name: "不通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();

  await appendSkillBundleVersion(page, slug, { makeCurrent: false });
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "URL case: tenant regression" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await page.getByRole("button", { name: "进入设为当前版本评审" }).click();
  await expect(page.locator(".promotionReadiness").getByText("可设为当前版本")).toBeVisible();
  await expect(page).toHaveURL(/[?&]mode=promotion(?:&|$)/);
  await expect(page).toHaveURL(/[?&]promotion_variant=[^&]+/);
  await expect(page).toHaveURL(/[?&]promotion_candidate=[^&]+/);
  await expect(page).toHaveURL(/[?&]promotion_eval_set=[^&]+/);

  await page.reload();
  await expect(page.getByRole("tab", { name: "评审", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".promotionReadiness").getByText("可设为当前版本")).toBeVisible();

  await page.getByRole("tab", { name: "历史", exact: true }).click();
  await page.getByLabel("Status filter").selectOption("finished");
  await page.locator(".historyRunRow").filter({ hasText: "0/1" }).getByRole("button", { name: "对照" }).click();
  await page.locator(".historyRunRow").filter({ hasText: "1/1" }).getByRole("button", { name: "候选" }).click();
  await page.getByLabel("Matrix impact filter").selectOption("fixed");

  await expect(page).toHaveURL(/[?&]mode=history(?:&|$)/);
  await expect(page).toHaveURL(/[?&]run_status=finished(?:&|$)/);
  await expect(page).toHaveURL(/[?&]run=[^&]+/);
  await expect(page).toHaveURL(/[?&]compare_base=[^&]+/);
  await expect(page).toHaveURL(/[?&]compare_candidate=[^&]+/);
  await expect(page).toHaveURL(/[?&]matrix_impact=fixed(?:&|$)/);

  await page.reload();
  await expect(page.getByRole("tab", { name: "历史", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Status filter")).toHaveValue("finished");
  await expect(page.getByLabel("Matrix impact filter")).toHaveValue("fixed");
  await expect(page.getByTestId("run-comparison-panel")).toContainText("修复 1");
});
