import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addEvalCase, createStoredZip, importSkillBundle } from "./helpers";

test("invalid skill folders show a blocking import preview", async ({ page }) => {
  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-invalid-bundle-"));

  await writeFile(join(bundleDir, "README.md"), "# Missing skill contract\n");

  try {
    await page.goto("/skills");
    await page.getByRole("button", { name: "导入 bundle", exact: true }).click();
    await page.getByPlaceholder("skillhub-lab").fill("skillhub-e2e");
    await page.getByPlaceholder("codex, gpt5.4").fill("codex, e2e");
    await page.locator('input[name="folder_files"]').setInputFiles(bundleDir);

    await expect(page.getByText("缺少 SKILL.md")).toBeVisible();
    await expect(page.getByRole("button", { name: "导入并创建 skill" })).toBeDisabled();
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
});

test("operator can import a skill, add a variant, add a case, and record manual eval", async ({ page }) => {
  const skillName = `security-reviewing-${Date.now()}`;

  await importSkillBundle(page, skillName);

  await page.getByRole("button", { name: "新建 variant" }).click();
  await page.getByPlaceholder("Codex + long-context").fill("Strict reviewer");
  await page.getByPlaceholder("codex, long-context").fill("codex, strict");
  await page.getByPlaceholder("这个约束下的最优解说明").fill("Use stricter review criteria for authorization-sensitive diffs.");
  await page.getByPlaceholder("初始版本说明").fill("Add stricter variant for auth-sensitive reviews.");
  await page.getByRole("button", { name: "创建 variant" }).click();
  await expect(page.getByText("Strict reviewer")).toBeVisible();

  await addEvalCase(page, "PR: missing owner filter");
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing owner filter" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();
});

test("operator can import a zipped standard skill bundle", async ({ page }) => {
  const skillName = `zip-reviewing-${Date.now()}`;
  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-zip-bundle-"));
  const zipPath = join(bundleDir, "zip-reviewing.zip");

  await writeFile(
    zipPath,
    createStoredZip([
      {
        path: "zip-reviewing/SKILL.md",
        content: [
          "---",
          `name: ${skillName}`,
          "description: Review zipped skills through the same import path.",
          "---",
          "",
          "# Zip Reviewing",
          "Use this skill to verify zipped bundle import.",
          "",
        ].join("\n"),
      },
      {
        path: "zip-reviewing/references/checklist.md",
        content: "Check archive import and file tree normalization.\n",
      },
    ]),
  );

  try {
    await page.goto("/skills");
    await page.getByRole("button", { name: "导入 bundle", exact: true }).click();
    await page.getByPlaceholder("skillhub-lab").fill("skillhub-e2e");
    await page.getByPlaceholder("codex, gpt5.4").fill("codex, zip");
    await page.locator('input[name="zip_file"]').setInputFiles(zipPath);

    await expect(page.getByText("zip-reviewing.zip")).toBeVisible();
    await page.getByRole("button", { name: "导入并创建 skill" }).click();

    await expect(page.getByRole("heading", { name: skillName })).toBeVisible();
    await expect(page.getByText("Review zipped skills through the same import path.", { exact: true })).toBeVisible();
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
});

test("keyboard users can open primary inspector actions", async ({ page }) => {
  await page.goto("/skills");

  await page.getByRole("button", { name: "导入", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "导入标准 Skill" })).toBeVisible();

  await page.getByRole("button", { name: "新建 skill", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "添加 skill" })).toBeVisible();
});

test("operator can edit and archive eval cases", async ({ page }) => {
  await importSkillBundle(page, `case-management-${Date.now()}`);
  await addEvalCase(page, "PR: stale title");

  await page.getByLabel("Inspector").getByRole("button", { name: "编辑 case" }).click();
  await page.getByPlaceholder("新标题").fill("PR: edited owner filter");
  await page.getByPlaceholder("新的 input").fill("diff --git a/service.py b/service.py\n+return Project.find_many()");
  await page.getByPlaceholder("新的 expected output").fill("Must flag missing tenant or owner scope.");
  await page.getByPlaceholder("为什么更新").fill("Clarify expected owner-scope finding.");
  await page.getByRole("button", { name: "保存 case version" }).click();
  await expect(page.locator(".caseReviewCard").filter({ hasText: "PR: edited owner filter" })).toBeVisible();

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: edited owner filter" })
    .getByRole("button", { name: "归档" })
    .click();
  await expect(page.getByText("还没有测试用例。先从右侧添加一个 case。")).toBeVisible();
});

test("workbench keeps the primary content within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/skills");

  const workbench = page.locator(".linearWorkbench");
  await expect(workbench).toBeVisible();
  const box = await workbench.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
});
