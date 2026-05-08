import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("operator can import a skill, add a variant, add a case, and record manual eval", async ({ page }) => {
  const unique = Date.now();
  const skillName = `security-reviewing-${unique}`;
  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-bundle-"));

  await writeFile(
    join(bundleDir, "SKILL.md"),
    [
      "---",
      `name: ${skillName}`,
      "description: Review pull requests for authorization and data access regressions.",
      "---",
      "",
      "# Security Reviewing",
      "Flag missing owner checks and leaked secrets first.",
      "",
    ].join("\n"),
  );
  await writeFile(join(bundleDir, "checklist.md"), "Check owner filters and secret logging.\n");

  try {
    await page.goto("/skills");
    await expect(page.getByText("还没有 skill。先导入 bundle 或新建一个。")).toBeVisible();

    await page.getByPlaceholder("skillhub-lab").fill("skillhub-e2e");
    await page.getByPlaceholder("codex, gpt5.4").fill("codex, e2e");
    await page.locator('input[name="folder_files"]').setInputFiles(bundleDir);
    await expect(page.getByText(skillName)).toBeVisible();
    await page.getByRole("button", { name: "导入并创建 skill" }).click();

    await expect(page.getByRole("heading", { name: skillName })).toBeVisible();
    await expect(page.getByText("Review pull requests for authorization and data access regressions.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "新建 variant" }).click();
    await page.getByPlaceholder("Codex + long-context").fill("Strict reviewer");
    await page.getByPlaceholder("codex, long-context").fill("codex, strict");
    await page.getByPlaceholder("这个约束下的最优解说明").fill("Use stricter review criteria for authorization-sensitive diffs.");
    await page.getByPlaceholder("初始版本说明").fill("Add stricter variant for auth-sensitive reviews.");
    await page.getByRole("button", { name: "创建 variant" }).click();
    await expect(page.getByText("Strict reviewer")).toBeVisible();

    await page.getByRole("button", { name: "测评", exact: true }).click();
    await page.getByRole("button", { name: "添加 case" }).click();
    await page.getByPlaceholder("PR: 缺少 owner 校验").fill("PR: missing owner filter");
    await page.getByPlaceholder("输入：代码 diff、上下文、用户请求...").fill("diff --git a/api.py b/api.py\n+return db.query(Project).all()");
    await page.getByPlaceholder("期望输出：应该指出什么、避免什么...").fill("Must flag missing owner_id filter as a P1 issue.");
    await page.getByPlaceholder("来源、bad case、维护说明").fill("Regression from customer review.");
    await page.getByRole("button", { name: "加入评测集" }).click();

    await expect(page.getByText("PR: missing owner filter")).toBeVisible();
    await page
      .locator(".caseReviewCard")
      .filter({ hasText: "PR: missing owner filter" })
      .getByRole("button", { name: "通过", exact: true })
      .click();
    await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
    await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
});
