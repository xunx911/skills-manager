import { expect, test } from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { addEvalCase, clearSkillCatalog, gotoSkills, importSkillBundle } from "./helpers";

test("launchpad required fields show an error summary and focus recovery links", async ({ page, request }) => {
  await clearSkillCatalog(request);
  await gotoSkills(page);

  await page.getByLabel("Skill 接入方式").getByRole("button", { name: "新建 skill" }).click();
  await page.locator(".skillLaunchpadForm").getByRole("button", { name: "创建 skill" }).click();

  const summary = page.locator(".skillLaunchpadForm .formErrorSummary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("6 个字段需要修正。修正后再提交。");
  await expect(summary).toContainText("填写 Skill ID");
  await expect(page.locator(".skillLaunchpadForm").locator('input[name="slug"]')).toHaveAttribute("aria-invalid", "true");

  await summary.getByRole("link", { name: "填写 Skill ID" }).click();
  await expect(page.locator(".skillLaunchpadForm").locator('input[name="slug"]')).toBeFocused();
});

test("server field errors map to the matching inspector field", async ({ page, request }) => {
  await clearSkillCatalog(request);
  const skillName = `duplicate-field-${Date.now()}`;
  await importSkillBundle(page, skillName);

  const inspector = page.getByLabel("Inspector");
  await inspector.getByRole("button", { name: "新建 skill" }).click();
  const form = inspector.locator(".inspectorForm");
  await form.locator('input[name="slug"]').fill(skillName);
  await form.locator('input[name="owner_ref"]').fill("skillhub-e2e");
  await form.locator('input[name="variant_label"]').fill("Baseline");
  await form.locator('input[name="tags"]').fill("codex, e2e");
  await form.locator('textarea[name="summary"]').fill("Duplicate slug should stay on the field.");
  await form.locator('textarea[name="change_summary"]').fill("Attempt duplicate slug.");
  await form.getByRole("button", { name: "创建", exact: true }).click();

  const summary = form.locator(".formErrorSummary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Skill ID 已存在");
  await expect(form.locator('input[name="slug"]')).toHaveAttribute("aria-invalid", "true");

  await summary.getByRole("link", { name: /Skill ID 已存在/ }).click();
  await expect(form.locator('input[name="slug"]')).toBeFocused();
});

test("server format errors map to the matching launchpad field", async ({ page, request }) => {
  await clearSkillCatalog(request);
  await gotoSkills(page);
  await page.getByLabel("Skill 接入方式").getByRole("button", { name: "新建 skill" }).click();

  const form = page.locator(".skillLaunchpadForm");
  await form.locator('input[name="slug"]').fill("Bad Skill");
  await form.locator('input[name="owner_ref"]').fill("skillhub-e2e");
  await form.locator('input[name="variant_label"]').fill("Baseline");
  await form.locator('input[name="tags"]').fill("codex, e2e");
  await form.locator('textarea[name="summary"]').fill("Invalid slug should stay on the field.");
  await form.locator('textarea[name="change_summary"]').fill("Attempt invalid slug.");
  await form.getByRole("button", { name: "创建 skill" }).click();

  const summary = form.locator(".formErrorSummary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("Skill ID 只能使用小写字母");
  await expect(form.locator('input[name="slug"]')).toHaveAttribute("aria-invalid", "true");
});

test("identity reference format errors map to low-frequency admin fields", async ({ page }) => {
  await importSkillBundle(page, `identity-field-errors-${Date.now()}`);

  const settingsPanel = page.locator(".skillSettingsPanel");
  await settingsPanel.getByLabel("归属").fill("platform team");
  await settingsPanel.getByRole("button", { name: "保存 skill 设置" }).click();

  const settingsSummary = settingsPanel.locator(".formErrorSummary");
  await expect(settingsSummary).toBeVisible();
  await expect(settingsSummary).toBeFocused();
  await expect(settingsSummary).toContainText("归属只能使用");
  await expect(settingsPanel.locator('input[name="owner_ref"]')).toHaveAttribute("aria-invalid", "true");

  const accessPanel = page.locator(".skillAccessPanel");
  await accessPanel.getByLabel("成员").fill("qa reviewer");
  await accessPanel.getByRole("button", { name: "添加成员" }).click();

  const accessSummary = accessPanel.locator(".formErrorSummary");
  await expect(accessSummary).toBeVisible();
  await expect(accessSummary).toBeFocused();
  await expect(accessSummary).toContainText("成员只能使用");
  await expect(accessPanel.locator('input[name="subject_id"]')).toHaveAttribute("aria-invalid", "true");
});

test("variant workspace field errors stay on their fields", async ({ page }) => {
  await importSkillBundle(page, `variant-workspace-errors-${Date.now()}`);
  await page.getByRole("tab", { name: "变体", exact: true }).click();

  const variantComposer = page.locator(".variantCreationComposer");
  await variantComposer.getByRole("button", { name: "新建约束 variant" }).click();
  await variantComposer.locator('input[name="label"]').fill("Strict reviewer");
  await variantComposer.locator('input[name="tags"]').fill("codex, strict");
  await variantComposer.locator('textarea[name="summary"]').fill("x".repeat(1001));
  await variantComposer.locator('textarea[name="change_summary"]').fill("Add stricter variant.");
  await variantComposer.getByRole("button", { name: "创建约束 variant" }).click();

  const variantSummary = variantComposer.locator(".formErrorSummary");
  await expect(variantSummary).toBeVisible();
  await expect(variantSummary).toBeFocused();
  await expect(variantSummary).toContainText("说明最多 1000 个字符。");
  await expect(variantComposer.locator('textarea[name="summary"]')).toHaveAttribute("aria-invalid", "true");

  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-version-field-errors-"));
  await writeFile(
    join(bundleDir, "SKILL.md"),
    [
      "---",
      "name: variant-workspace-errors",
      "description: Candidate version with an overlong change summary.",
      "---",
      "",
      "# Candidate",
    ].join("\n"),
  );

  try {
    const versionComposer = page.locator(".workspaceVersionComposer");
    await versionComposer.locator('input[name="version_folder_files"]').setInputFiles(bundleDir);
    await versionComposer.locator('textarea[name="change_summary"]').fill("x".repeat(1001));
    await versionComposer.getByRole("button", { name: "追加候选版本" }).click();

    const versionSummary = versionComposer.locator(".formErrorSummary");
    await expect(versionSummary).toBeVisible();
    await expect(versionSummary).toBeFocused();
    await expect(versionSummary).toContainText("版本说明最多 1000 个字符。");
    await expect(versionComposer.locator('textarea[name="change_summary"]')).toHaveAttribute("aria-invalid", "true");
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
});

test("limited textareas expose character count hints", async ({ page }) => {
  await importSkillBundle(page, `textarea-count-${Date.now()}`);
  await page.getByRole("tab", { name: "变体", exact: true }).click();

  const variantComposer = page.locator(".variantCreationComposer");
  await variantComposer.getByRole("button", { name: "新建约束 variant" }).click();

  const summaryInput = variantComposer.locator('textarea[name="summary"]');
  const summaryField = summaryInput.locator("xpath=ancestor::label[1]");
  await expect(summaryField).toContainText("还可输入 1000 个字符");

  await summaryInput.fill("x".repeat(1001));
  await expect(summaryField).toContainText("已超出 1 个字符");
  await expect(summaryInput).toHaveAttribute("aria-describedby", /character-count/);
});

test("quick case required fields show a focused error summary", async ({ page }) => {
  await importSkillBundle(page, `quick-case-errors-${Date.now()}`);

  await page.getByRole("tab", { name: "测评", exact: true }).click();
  await page.locator(".quickCaseGrid").getByRole("button", { name: "快速加入" }).click();

  const summary = page.locator(".quickCaseGrid .formErrorSummary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("填写 标题");
  await expect(summary).toContainText("填写 Input");
  await expect(summary).toContainText("填写 Expected output");
  await expect(page.locator(".quickCaseGrid").locator('input[name="quick_title"]')).toHaveAttribute("aria-invalid", "true");
});

test("skill bundle frontmatter errors map to the folder upload field", async ({ page, request }) => {
  await clearSkillCatalog(request);
  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-invalid-bundle-"));

  await writeFile(
    join(bundleDir, "SKILL.md"),
    [
      "---",
      "name: Bad Skill",
      "description: Invalid name should be reported against the selected bundle.",
      "---",
      "",
      "# Invalid name",
    ].join("\n"),
  );

  try {
    await gotoSkills(page);
    const form = page.locator(".skillLaunchpadForm");
    await form.locator('input[name="owner_ref"]').fill("skillhub-e2e");
    await form.locator('input[name="tags"]').fill("codex, e2e");
    await form.locator('input[name="folder_files"]').setInputFiles(bundleDir);
    await form.getByRole("button", { name: "导入并创建 skill" }).click();

    const summary = form.locator(".formErrorSummary");
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary).toContainText("SKILL.md frontmatter name 只能使用小写字母");
    await expect(form.locator('input[name="folder_files"]')).toHaveAttribute("aria-invalid", "true");
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
});

test("batch case row errors block submit and focus the batch field", async ({ page }) => {
  await importSkillBundle(page, `batch-errors-${Date.now()}`);

  await page.getByRole("tab", { name: "测评", exact: true }).click();
  await page.getByRole("button", { name: "批量", exact: true }).click();
  await page.getByLabel("批量 case 文本").fill(
    [
      "PR: missing tenant scope | Project.all() | Flag missing tenant scope.",
      "PR: token logging | console.log(token)",
    ].join("\n"),
  );
  await expect(page.locator(".quickCaseBatchTable")).toContainText("PR: missing tenant scope");
  await expect(page.locator(".quickCaseBatchTable")).toContainText("需修正");
  await page.getByRole("button", { name: "批量加入评测集" }).click();

  const summary = page.locator(".quickCaseBatch").locator(".formErrorSummary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("第 2 行缺少 Expected output。");
  await expect(page.getByLabel("批量 case 文本")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".caseReviewCard").filter({ hasText: "PR: missing tenant scope" })).toHaveCount(0);
});

test("saved run view duplicate names map to the saved view name field", async ({ page }) => {
  await importSkillBundle(page, `saved-view-field-errors-${Date.now()}`);

  await page.getByRole("tab", { name: "历史", exact: true }).click();
  await page.getByLabel("保存视图名称").fill("候选版本通过记录");
  await page.getByRole("button", { name: "保存当前视图" }).click();
  await expect(page.getByText("保存视图已创建。")).toBeVisible();

  await page.getByLabel("保存视图名称").fill("候选版本通过记录");
  await page.getByRole("button", { name: "保存当前视图" }).click();

  const summary = page.locator(".savedRunViews .formErrorSummary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("保存视图名称已存在。");
  await expect(page.getByLabel("保存视图名称")).toHaveAttribute("aria-invalid", "true");

  await summary.getByRole("link", { name: "保存视图名称已存在。" }).click();
  await expect(page.getByLabel("保存视图名称")).toBeFocused();
});

test("accepted verification note length errors map to the note field", async ({ page }) => {
  await importSkillBundle(page, `accepted-note-field-errors-${Date.now()}`);
  await addEvalCase(page, "PR: verification pointer");
  const caseCard = page.locator(".caseReviewCard").filter({ hasText: "PR: verification pointer" });

  await caseCard.getByRole("button", { name: "不通过", exact: true }).click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();

  await caseCard.getByRole("button", { name: "通过", exact: true }).click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await page.getByRole("tab", { name: "历史", exact: true }).click();
  await page.locator(".historyRunRow").filter({ hasText: "0/1" }).getByRole("button", { name: "对照" }).click();
  await page.locator(".historyRunRow").filter({ hasText: "1/1" }).getByRole("button", { name: "候选" }).click();
  await expect(page.getByTestId("run-comparison-panel")).toContainText("+100%");

  await page.getByLabel("Accepted verification note").fill("x".repeat(1001));
  await page.getByRole("button", { name: "接受为验证依据" }).click();

  const summary = page.locator(".runCompareAcceptBar .formErrorSummary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("验证说明最多 1000 个字符。");
  await expect(page.getByLabel("Accepted verification note")).toHaveAttribute("aria-invalid", "true");

  await summary.getByRole("link", { name: "验证说明最多 1000 个字符。" }).click();
  await expect(page.getByLabel("Accepted verification note")).toBeFocused();
});
