import { expect, test } from "@playwright/test";

import { addEvalCase, appendSkillBundleVersion, clearSkillCatalog, hideVolatileUi, importSkillBundle } from "./helpers";

test.beforeEach(async ({ request }) => {
  await clearSkillCatalog(request);
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

test("visual baseline: variants workspace composers", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importSkillBundle(page, "visual-variants-workspace");
  await page.getByRole("tab", { name: "变体", exact: true }).click();
  await hideVolatileUi(page);

  await expect(page.locator(".linearWorkbench")).toHaveScreenshot("variants-workspace-composers.png", {
    animations: "disabled",
  });
});

test("visual baseline: skill access panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importSkillBundle(page, "visual-access-control");
  await hideVolatileUi(page);

  const panel = page.locator(".skillAccessPanel");
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toHaveScreenshot("skill-access-panel.png", {
    animations: "disabled",
  });
});

test("visual baseline: local session panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/skills");
  await hideVolatileUi(page);

  const panel = page.locator(".localSessionPanel");
  await expect(panel).toHaveScreenshot("local-session-panel.png", {
    animations: "disabled",
  });
});

test("visual baseline: skill governance panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importSkillBundle(page, "visual-governance");
  await hideVolatileUi(page);

  const panel = page.locator(".skillGovernancePanel");
  await panel.scrollIntoViewIfNeeded();
  await expect(panel).toHaveScreenshot("skill-governance-panel.png", {
    animations: "disabled",
  });
});

test("visual baseline: skill audit explorer", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importSkillBundle(page, "visual-audit-explorer");
  const accessPanel = page.locator(".skillAccessPanel");
  await accessPanel.getByPlaceholder("qa-reviewer").fill("qa-reviewer");
  await accessPanel.getByLabel("Access role").selectOption("evaluator");
  await accessPanel.getByRole("button", { name: "添加成员" }).click();
  await page.locator(".skillGovernancePanel").getByRole("button", { name: "查看全部审计" }).click();
  await page.locator(".auditExplorerEvent").filter({ hasText: "product-operator -> owner" }).click();
  await hideVolatileUi(page);

  await expect(page.locator(".skillAuditExplorer")).toHaveScreenshot("skill-audit-explorer.png", {
    animations: "disabled",
  });
});

test("visual baseline: promotion review", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importSkillBundle(page, "visual-promotion-reviewing");
  await addEvalCase(page, "PR: promotion visual tenant guard");
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: promotion visual tenant guard" })
    .getByRole("button", { name: "不通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();

  await appendSkillBundleVersion(page, "visual-promotion-reviewing", { makeCurrent: false });
  await page.getByRole("tab", { name: "测评", exact: true }).click();
  const targetVersion = await page
    .getByLabel("测评目标版本")
    .locator("option")
    .filter({ hasText: "v2" })
    .first()
    .getAttribute("value");
  expect(targetVersion).toBeTruthy();
  await page.getByLabel("测评目标版本").selectOption(targetVersion ?? "");
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: promotion visual tenant guard" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await page.getByRole("tab", { name: "变体", exact: true }).click();
  await page
    .locator(".variantVersionRow")
    .filter({ hasText: "v2" })
    .getByRole("button", { name: "设为当前版本评审" })
    .click();
  await expect(page.getByRole("heading", { name: "设为当前版本评审" })).toBeVisible();
  await hideVolatileUi(page);

  await expect(page.locator(".linearWorkbench")).toHaveScreenshot("promotion-review-ready.png", {
    animations: "disabled",
  });
});

test("visual baseline: run comparison", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await importSkillBundle(page, "visual-run-comparison");
  await addEvalCase(page, "PR: comparison visual tenant guard");
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: comparison visual tenant guard" })
    .getByRole("button", { name: "不通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: comparison visual tenant guard" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await page.getByLabel("Workbench modes").getByRole("tab", { name: "历史" }).click();
  await page.locator(".historyRunRow").filter({ hasText: "0/1" }).getByRole("button", { name: "对照" }).click();
  await page.locator(".historyRunRow").filter({ hasText: "1/1" }).getByRole("button", { name: "候选" }).click();
  await expect(page.getByTestId("run-comparison-panel")).toBeVisible();
  await hideVolatileUi(page);

  await expect(page.locator(".linearWorkbench")).toHaveScreenshot("run-comparison-ready.png", {
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
