import { expect, test } from "@playwright/test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { clearSkillCatalog, importSkillBundle } from "./helpers";

test("launchpad required fields show an error summary and focus recovery links", async ({ page, request }) => {
  await clearSkillCatalog(request);
  await page.goto("/skills");

  await page.getByLabel("Skill 接入方式").getByRole("button", { name: "新建 skill" }).click();
  await page.locator(".skillLaunchpadForm").getByRole("button", { name: "创建 skill" }).click();

  const summary = page.locator(".skillLaunchpadForm .formErrorSummary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
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
  await page.goto("/skills");
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
    await page.goto("/skills");
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
  await page.getByRole("button", { name: "批量加入评测集" }).click();

  const summary = page.locator(".quickCaseBatch").locator(".formErrorSummary");
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary).toContainText("第 2 行缺少 Expected output。");
  await expect(page.getByLabel("批量 case 文本")).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator(".caseReviewCard").filter({ hasText: "PR: missing tenant scope" })).toHaveCount(0);
});
