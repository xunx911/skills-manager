import { expect, test, type APIRequestContext } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addEvalCase, appendSkillBundleVersion, createStoredZip, importSkillBundle } from "./helpers";

const API_BASE_URL = `http://127.0.0.1:${process.env.SKILLHUB_E2E_API_PORT ?? 8021}`;

async function clearSkillCatalog(request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/api/skills`);
  const skills = (await response.json()) as Array<{ skill: { id: string } }>;
  await Promise.all(skills.map((summary) => request.delete(`${API_BASE_URL}/api/skills/${summary.skill.id}`)));
}

test("invalid skill folders show a blocking import preview", async ({ page }) => {
  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-invalid-bundle-"));

  await writeFile(join(bundleDir, "README.md"), "# Missing skill contract\n");

  try {
    await page.goto("/skills");
    const inspector = page.getByLabel("Inspector");
    await inspector.getByRole("button", { name: "导入 bundle", exact: true }).click();
    await inspector.getByPlaceholder("skillhub-lab").fill("skillhub-e2e");
    await inspector.getByPlaceholder("codex, gpt5.4").fill("codex, e2e");
    await inspector.locator('input[name="folder_files"]').setInputFiles(bundleDir);

    await expect(inspector.getByText("缺少 SKILL.md")).toBeVisible();
    await expect(inspector.getByRole("button", { name: "导入并创建 skill" })).toBeDisabled();
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
});

test("operator can import a skill from the workspace launchpad", async ({ page, request }) => {
  await clearSkillCatalog(request);
  const skillName = `launchpad-import-${Date.now()}`;
  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-launchpad-import-"));

  await writeFile(
    join(bundleDir, "SKILL.md"),
    [
      "---",
      `name: ${skillName}`,
      "description: Review pull requests from the first-run launchpad.",
      "---",
      "",
      "# Launchpad Reviewing",
      "Flag missing tenant filters before style comments.",
      "",
    ].join("\n"),
  );

  try {
    await page.goto("/skills");
    const launchpad = page.locator(".skillLaunchpad");
    await launchpad.getByPlaceholder("skillhub-lab").fill("skillhub-launchpad");
    await launchpad.getByPlaceholder("codex, gpt5.4").fill("codex, launchpad");
    await launchpad.locator('input[name="folder_files"]').setInputFiles(bundleDir);

    await expect(launchpad).toContainText(skillName);
    await launchpad.getByRole("button", { name: "导入并创建 skill" }).click();

    await expect(page.getByRole("heading", { name: skillName })).toBeVisible();
    await expect(page.locator(".productHero")).toContainText("Review pull requests from the first-run launchpad.");
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
});

test("operator can create a blank skill from the workspace launchpad", async ({ page, request }) => {
  await clearSkillCatalog(request);
  const slug = `launchpad-blank-${Date.now()}`;

  await page.goto("/skills");
  const launchpad = page.locator(".skillLaunchpad");
  await launchpad.getByRole("button", { name: "新建 skill" }).click();
  await launchpad.getByPlaceholder("security-reviewer").fill(slug);
  await launchpad.getByPlaceholder("skillhub-lab").fill("skillhub-launchpad");
  await launchpad.getByPlaceholder("Baseline").fill("Launchpad baseline");
  await launchpad.getByPlaceholder("codex, gpt5.4").fill("codex, launchpad");
  await launchpad.getByPlaceholder("这个 skill 解决什么问题").fill("Create a draft skill directly from the workspace.");
  await launchpad.getByPlaceholder("初始版本说明").fill("Create the first workspace-managed baseline.");
  await launchpad.getByRole("button", { name: "创建 skill" }).click();

  await expect(page.getByRole("heading", { name: slug })).toBeVisible();
  await expect(page.locator(".productHero")).toContainText("Launchpad baseline");
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
  await expect(page.locator(".variantMapCard").filter({ hasText: "Strict reviewer" })).toBeVisible();

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
    await expect(page.locator(".productHero")).toContainText("Review zipped skills through the same import path.");
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
});

test("operator can create a variant from the variants workspace", async ({ page }) => {
  const skillName = `workspace-variant-${Date.now()}`;
  await importSkillBundle(page, skillName);

  await page.getByRole("button", { name: "变体", exact: true }).click();

  const composer = page.locator(".variantCreationComposer");
  await composer.getByRole("button", { name: "新建约束 variant" }).click();
  await composer.getByPlaceholder("Codex + stricter auth").fill("Workspace reviewer");
  await composer.getByPlaceholder("codex, strict-auth").fill("codex, strict-auth");
  await composer.getByPlaceholder("这个约束组合下的最优解说明").fill("Use stricter criteria for authorization-sensitive diffs.");
  await composer.getByPlaceholder("为什么要创建这个 variant").fill("Create a stricter workspace-managed reviewer.");
  await composer.getByRole("button", { name: "创建约束 variant" }).click();

  const variantCard = page.locator(".variantMapCard").filter({ hasText: "Workspace reviewer" });
  await expect(variantCard).toBeVisible();
  await expect(variantCard).toContainText("v1");
});

test("operator can edit skill identity and default variant from workspace skill settings", async ({ page }) => {
  const skillName = `workspace-settings-${Date.now()}`;
  const renamedSkill = `${skillName}-renamed`;
  await importSkillBundle(page, skillName);

  await page.getByRole("button", { name: "变体", exact: true }).click();
  const composer = page.locator(".variantCreationComposer");
  await composer.getByRole("button", { name: "新建约束 variant" }).click();
  await composer.getByPlaceholder("Codex + stricter auth").fill("Workspace default reviewer");
  await composer.getByPlaceholder("codex, strict-auth").fill("codex, strict-default");
  await composer.getByPlaceholder("这个约束组合下的最优解说明").fill("Use stricter criteria as the default distribution.");
  await composer.getByPlaceholder("为什么要创建这个 variant").fill("Expose default variant switching from the skill workspace.");
  await composer.getByRole("button", { name: "创建约束 variant" }).click();

  await page.getByRole("button", { name: "概览", exact: true }).click();
  const settings = page.locator(".skillSettingsPanel");
  await settings.getByLabel("Skill ID").fill(renamedSkill);
  await settings.getByLabel("归属").fill("platform-review");
  const strictOption = await settings
    .getByLabel("默认分发 variant")
    .locator("option")
    .filter({ hasText: "Workspace default reviewer" })
    .getAttribute("value");
  expect(strictOption).toBeTruthy();
  await settings.getByLabel("默认分发 variant").selectOption(strictOption ?? "");
  await settings.getByRole("button", { name: "保存 skill 设置" }).click();

  await expect(page.getByRole("heading", { name: renamedSkill })).toBeVisible();
  await expect(page.locator(".linearHeader")).toContainText("platform-review");
  await expect(page.locator(".linearSkillItemActive")).toContainText("platform-review");
  await expect(page.locator(".linearSkillItemActive")).toContainText("codex + strict-default");
  await expect(page.locator(".productHero")).toContainText("Workspace default reviewer");
  await expect(page.locator(".productHero")).toContainText("Use stricter criteria as the default distribution.");
});

test("operator can manage skill access roles from overview", async ({ page }) => {
  await importSkillBundle(page, `access-roles-${Date.now()}`);

  const panel = page.locator(".skillAccessPanel");
  await expect(panel).toContainText("product-operator");
  await expect(panel).toContainText("Owner");

  await panel.getByPlaceholder("qa-reviewer").fill("qa-reviewer");
  await panel.getByLabel("Access role").selectOption("evaluator");
  await panel.getByRole("button", { name: "添加成员" }).click();
  await expect(panel.locator(".skillAccessRow").filter({ hasText: "qa-reviewer" })).toContainText("Evaluator");

  await panel.locator(".skillAccessRow").filter({ hasText: "qa-reviewer" }).getByRole("button", { name: "移除" }).click();
  await expect(panel.locator(".skillAccessRow").filter({ hasText: "qa-reviewer" })).toHaveCount(0);
});

test("operator can archive a skill from the governance danger zone", async ({ page, request }) => {
  await clearSkillCatalog(request);
  const skillName = `governance-${Date.now()}`;
  await importSkillBundle(page, skillName);

  const panel = page.locator(".skillGovernancePanel");
  await expect(panel).toContainText("治理与审计");
  await expect(panel).toContainText("role.assigned");

  await panel.getByLabel("确认 Skill ID").fill("wrong-skill");
  await expect(panel.getByRole("button", { name: "归档 skill" })).toBeDisabled();

  await panel.getByLabel("确认 Skill ID").fill(skillName);
  await panel.getByRole("button", { name: "归档 skill" }).click();

  await expect(page.getByText("Skill 已归档，历史版本和测评记录仍保留。")).toBeVisible();
  await expect(page.locator(".skillLaunchpad")).toBeVisible();
  await expect(page.locator(".linearCatalogEmpty")).toContainText("还没有 skill");
});

test("imported skill is guided into its first verification run", async ({ page }) => {
  await importSkillBundle(page, `first-verification-${Date.now()}`);

  await expect(page.getByText("验证清单")).toBeVisible();
  await expect(page.locator(".verificationStep").filter({ hasText: "补齐评测集" })).toContainText("待处理");

  await page.getByRole("button", { name: "添加首批 case" }).click();
  await page.getByPlaceholder("PR: 缺少 owner 校验").fill("PR: first verification path");
  await page.getByPlaceholder("输入：代码 diff、上下文、用户请求...").fill("diff --git a/api.py b/api.py\n+return Project.all()");
  await page.getByPlaceholder("期望输出：应该指出什么、避免什么...").fill("Must flag missing tenant scope.");
  await page.getByPlaceholder("来源、bad case、维护说明").fill("Imported skill first verification.");
  await page.getByRole("button", { name: "加入评测集" }).click();

  await expect(page.getByRole("button", { name: "测评", exact: true })).toHaveClass(/linearTabActive/);
  await expect(page.locator(".caseReviewCard").filter({ hasText: "PR: first verification path" })).toBeVisible();
  await expect(page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" })).toBeDisabled();

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: first verification path" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await page.getByRole("button", { name: "概览", exact: true }).click();
  await expect(page.locator(".verificationStep").filter({ hasText: "记录首轮测评" })).toContainText("首轮测评完成");
  await page.getByRole("button", { name: "查看证据历史" }).click();
  await expect(page.getByRole("button", { name: "历史", exact: true })).toHaveClass(/linearTabActive/);
  await expect(page.locator(".historyRunRow")).toHaveCount(1);
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

test("operator can open command menu and jump to add case", async ({ page }) => {
  await importSkillBundle(page, `command-menu-${Date.now()}`);

  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await expect(page.getByRole("dialog", { name: "Command menu" })).toBeVisible();
  await page.getByPlaceholder("搜索命令、页面或动作").fill("添加 case");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "添加测试用例" })).toBeVisible();

  await page.getByRole("button", { name: "Open command menu" }).click();
  await expect(page.getByRole("dialog", { name: "Command menu" })).toBeVisible();
});

test("operator can batch paste eval cases and record a run", async ({ page }) => {
  await importSkillBundle(page, `batch-cases-${Date.now()}`);

  await page.getByRole("button", { name: "测评", exact: true }).click();
  await page.getByRole("button", { name: "批量", exact: true }).click();
  await page.getByLabel("批量 case 文本").fill(
    [
      "PR: missing tenant scope | Project.all() | Flag missing tenant scope.",
      "PR: token logging | console.log(token) | Flag token logging.",
    ].join("\n"),
  );
  await expect(page.getByText("可导入 2 条")).toBeVisible();
  await page.getByRole("button", { name: "批量加入评测集" }).click();

  await expect(page.locator(".caseReviewCard").filter({ hasText: "PR: missing tenant scope" })).toBeVisible();
  await expect(page.locator(".caseReviewCard").filter({ hasText: "PR: token logging" })).toBeVisible();
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: token logging" })
    .getByRole("button", { name: "不通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/2 通过。")).toBeVisible();
});

test("manual eval queue filters unresolved cases and bulk-passes remaining cases", async ({ page }) => {
  await importSkillBundle(page, `manual-eval-queue-${Date.now()}`);

  await page.getByRole("button", { name: "测评", exact: true }).click();
  await page.getByRole("button", { name: "批量", exact: true }).click();
  await page.getByLabel("批量 case 文本").fill(
    [
      "PR: missing tenant scope | Project.all() | Flag missing tenant scope.",
      "PR: token logging | console.log(token) | Flag token logging.",
      "PR: broad update | Project.update_all({ archived: true }) | Flag broad update without where clause.",
    ].join("\n"),
  );
  await page.getByRole("button", { name: "批量加入评测集" }).click();

  await page.getByRole("button", { name: "未确认 3" }).click();
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "通过", exact: true })
    .click();

  await expect(page.locator(".caseReviewCardActive").filter({ hasText: "PR: token logging" })).toBeVisible();
  await page.getByRole("button", { name: "未确认标为通过" }).click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 3/3 通过。")).toBeVisible();
});

test("manual eval queue supports keyboard pass and fail", async ({ page }) => {
  await importSkillBundle(page, `manual-eval-keyboard-${Date.now()}`);

  await page.getByRole("button", { name: "测评", exact: true }).click();
  await page.getByRole("button", { name: "批量", exact: true }).click();
  await page.getByLabel("批量 case 文本").fill(
    [
      "PR: missing tenant scope | Project.all() | Flag missing tenant scope.",
      "PR: token logging | console.log(token) | Flag token logging.",
    ].join("\n"),
  );
  await page.getByRole("button", { name: "批量加入评测集" }).click();

  await page.locator(".caseReviewCard").filter({ hasText: "PR: missing tenant scope" }).click();
  await page.keyboard.press("p");
  await expect(page.locator(".caseReviewCardActive").filter({ hasText: "PR: token logging" })).toBeVisible();
  await page.keyboard.press("f");

  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/2 通过。")).toBeVisible();
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

test("operator can edit the selected eval case inline", async ({ page }) => {
  await importSkillBundle(page, `inline-case-editing-${Date.now()}`);
  await addEvalCase(page, "PR: stale inline title");

  await page.locator(".evalCaseDetailPanel").getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("详情内标题").fill("PR: inline edited owner filter");
  await page.getByLabel("详情内 input").fill("diff --git a/service.py b/service.py\n+return Project.find_many()");
  await page.getByLabel("详情内 expected output").fill("Must flag missing tenant or owner scope.");
  await page.getByLabel("详情内 notes").fill("Inline edit keeps the operator in review context.");
  await page.getByRole("button", { name: "保存为新版本" }).click();

  await expect(page.locator(".caseReviewCard").filter({ hasText: "PR: inline edited owner filter" })).toBeVisible();
  await expect(page.locator(".evalCaseDetailPanel")).toContainText("diff --git a/service.py b/service.py");
  await expect(page.locator(".evalCaseDetailPanel")).toContainText("Must flag missing tenant or owner scope.");
});

test("operator can compare standard bundle versions", async ({ page }) => {
  const skillName = `diff-reviewing-${Date.now()}`;
  await importSkillBundle(page, skillName);
  await appendSkillBundleVersion(page, skillName);

  await page.getByRole("button", { name: "比较版本" }).click();

  await expect(page.getByText("v1 -> v2")).toBeVisible();
  await expect(page.locator(".diffFileRow").filter({ hasText: "SKILL.md" })).toBeVisible();
  await expect(page.locator(".diffFileRow").filter({ hasText: "references/checklist.md" })).toBeVisible();
  await expect(page.locator(".diffFileRow").filter({ hasText: "new-checklist.md" })).toBeVisible();
  await expect(page.getByText("Prioritize missing tenant filters.")).toBeVisible();
});

test("operator can append a candidate version from the variants workspace", async ({ page }) => {
  const skillName = `workspace-version-${Date.now()}`;
  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-workspace-version-"));
  await importSkillBundle(page, skillName);

  await writeFile(
    join(bundleDir, "SKILL.md"),
    [
      "---",
      `name: ${skillName}`,
      "description: Review pull requests for authorization and data access regressions.",
      "---",
      "",
      "# Security Reviewing",
      "Prioritize tenant filters before owner filters.",
      "",
    ].join("\n"),
  );

  try {
    await page.getByRole("button", { name: "变体", exact: true }).click();
    await page.locator(".workspaceVersionComposer").locator('input[name="version_folder_files"]').setInputFiles(bundleDir);
    await page.locator(".workspaceVersionComposer").getByPlaceholder("这次更新解决了什么").fill("Add tenant-first review guidance.");
    await page.locator(".workspaceVersionComposer").locator('input[name="make_current"]').uncheck();
    await page.locator(".workspaceVersionComposer").getByRole("button", { name: "追加候选版本" }).click();

    await expect(page.getByRole("button", { name: "测评", exact: true })).toHaveClass(/linearTabActive/);
    await expect(page.locator(".candidateVerificationBanner")).toContainText("v2");
    await expect(page.getByLabel("测评目标版本")).toHaveValue(/varver_/);
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
});

test("candidate version handoff selects the new version for verification", async ({ page }) => {
  const skillName = `candidate-handoff-${Date.now()}`;
  await importSkillBundle(page, skillName);
  await addEvalCase(page, "PR: missing tenant scope");

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "不通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();

  await appendSkillBundleVersion(page, skillName, { makeCurrent: false });

  await expect(page.getByRole("button", { name: "测评", exact: true })).toHaveClass(/linearTabActive/);
  await expect(page.getByLabel("测评目标版本")).toHaveValue(/varver_/);
  await expect(page.locator(".candidateVerificationBanner")).toContainText("v2");
  await expect(page.getByRole("button", { name: "进入设为当前版本评审" })).toBeVisible();
  await expect(page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" })).toBeDisabled();

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await page.getByRole("button", { name: "进入设为当前版本评审" }).click();
  await expect(page.getByRole("heading", { name: "设为当前版本评审" })).toBeVisible();
  await expect(page.locator(".promotionReadiness").getByText("可设为当前版本")).toBeVisible();
});

test("operator can review a candidate version before promoting it", async ({ page }) => {
  const skillName = `promotion-reviewing-${Date.now()}`;
  await importSkillBundle(page, skillName);
  await addEvalCase(page, "PR: missing tenant scope");

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "不通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();

  await appendSkillBundleVersion(page, skillName, { makeCurrent: false });

  await page.getByRole("button", { name: "测评", exact: true }).click();
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
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await page.getByRole("button", { name: "变体", exact: true }).click();
  await expect(
    page.locator(".variantVersionRow").filter({ hasText: "v2" }).getByRole("button", { name: "设为当前版本评审" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "差异", exact: true }).click();
  await expect(page.locator(".diffPane").getByText("v1 -> v2")).toBeVisible();
  await page.locator(".diffSelectors").getByRole("button", { name: "设为当前版本评审" }).click();

  await expect(page.getByRole("heading", { name: "设为当前版本评审" })).toBeVisible();
  await expect(page.locator(".promotionReadiness").getByText("可设为当前版本")).toBeVisible();
  await expect(page.locator(".promotionCaseList").getByText("修复", { exact: true })).toBeVisible();
  await expect(page.locator(".promotionDiffPanel").getByText("SKILL.md")).toBeVisible();

  await page.getByRole("button", { name: "设为当前版本", exact: true }).click();
  await expect(page.getByText("已设为当前版本。")).toBeVisible();
  await expect(page.locator(".variantVersionRow").filter({ hasText: "v2" }).getByText("Current")).toBeVisible();
});

test("risky promotion requires a decision note before promoting", async ({ page }) => {
  const skillName = `risky-promotion-${Date.now()}`;
  await importSkillBundle(page, skillName);
  await addEvalCase(page, "PR: tenant scope regresses");

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: tenant scope regresses" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await appendSkillBundleVersion(page, skillName, { makeCurrent: false });

  await page.getByRole("button", { name: "测评", exact: true }).click();
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
    .filter({ hasText: "PR: tenant scope regresses" })
    .getByRole("button", { name: "不通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();

  await page.getByRole("button", { name: "变体", exact: true }).click();
  await page
    .locator(".variantVersionRow")
    .filter({ hasText: "v2" })
    .getByRole("button", { name: "设为当前版本评审" })
    .click();

  await expect(page.locator(".promotionReadiness").getByText("有风险")).toBeVisible();
  await expect(page.locator(".promotionCaseList").getByText("回退", { exact: true })).toBeVisible();
  const promoteButton = page.getByRole("button", { name: "接受风险并设为当前版本" });
  await expect(promoteButton).toBeDisabled();
  await page.getByLabel("设为当前版本说明").fill("候选版本包含必要文件变更，先接受风险并补充后续 case。");
  await expect(promoteButton).toBeEnabled();
  await promoteButton.click();
  await expect(page.getByText("已设为当前版本。")).toBeVisible();
  await expect(page.locator(".variantVersionRow").filter({ hasText: "v2" }).getByText("Current")).toBeVisible();
});

test("operator can review eval run history with filters", async ({ page }) => {
  const skillName = `history-reviewing-${Date.now()}`;
  await importSkillBundle(page, skillName);
  await addEvalCase(page, "PR: missing tenant scope");
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "不通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();

  await page.getByLabel("Workbench modes").getByRole("button", { name: "历史" }).click();

  await expect(page.locator(".historyRunRow")).toHaveCount(2);
  await expect(page.locator(".historyRunRow").filter({ hasText: "0/1" })).toBeVisible();
  await page.getByLabel("Strategy filter").selectOption("manual_pass_fail");
  await expect(page.locator(".historyRunRow")).toHaveCount(2);
  await expect(page.locator(".historyCaseResults").getByText("PR: missing tenant scope")).toBeVisible();
});

test("operator can inspect run matrix across eval runs", async ({ page }) => {
  const skillName = `run-matrix-${Date.now()}`;
  await importSkillBundle(page, skillName);

  await page.getByRole("button", { name: "测评", exact: true }).click();
  await page.getByRole("button", { name: "批量", exact: true }).click();
  await page.getByLabel("批量 case 文本").fill(
    [
      "PR: missing tenant scope | Project.all() | Flag missing tenant scope.",
      "PR: token logging | console.log(token) | Flag token logging.",
    ].join("\n"),
  );
  await page.getByRole("button", { name: "批量加入评测集" }).click();
  await page.locator(".caseReviewCard").filter({ hasText: "PR: missing tenant scope" }).getByRole("button", { name: "不通过", exact: true }).click();
  await page.locator(".caseReviewCard").filter({ hasText: "PR: token logging" }).getByRole("button", { name: "通过", exact: true }).click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/2 通过。")).toBeVisible();

  await appendSkillBundleVersion(page, skillName, { makeCurrent: false });
  await page.locator(".caseReviewCard").filter({ hasText: "PR: missing tenant scope" }).getByRole("button", { name: "通过", exact: true }).click();
  await page.locator(".caseReviewCard").filter({ hasText: "PR: token logging" }).getByRole("button", { name: "通过", exact: true }).click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 2/2 通过。")).toBeVisible();

  await page.getByLabel("Workbench modes").getByRole("button", { name: "历史" }).click();

  await expect(page.getByTestId("run-matrix-panel")).toBeVisible();
  await expect(page.locator(".runMatrixRunHeader")).toHaveCount(2);
  await expect(page.locator(".runMatrixCaseTitle", { hasText: "PR: missing tenant scope" })).toBeVisible();
  await expect(page.locator(".runMatrixCaseTitle", { hasText: "PR: token logging" })).toBeVisible();
  await expect(page.locator(".runMatrixCellFail")).toHaveCount(1);
  await expect(page.locator(".runMatrixCellPass")).toHaveCount(3);

  await page.locator(".historyRunRow").filter({ hasText: "1/2" }).getByRole("button", { name: "对照" }).click();
  await page.locator(".historyRunRow").filter({ hasText: "2/2" }).getByRole("button", { name: "候选" }).click();
  await expect(page.locator(".runMatrixImpactFixed")).toHaveCount(1);
  await expect(page.locator(".runMatrixImpactStablePass")).toHaveCount(1);

  await page.getByLabel("Matrix group by").selectOption("impact");
  await expect(page.locator(".runMatrixGroupRow").filter({ hasText: "修复 · 1 case" })).toBeVisible();
  await expect(page.locator(".runMatrixGroupRow").filter({ hasText: "稳定通过 · 1 case" })).toBeVisible();
  await page.getByLabel("Matrix impact filter").selectOption("fixed");
  await expect(page.locator(".runMatrixCaseTitle", { hasText: "PR: missing tenant scope" })).toBeVisible();
  await expect(page.locator(".runMatrixCaseTitle", { hasText: "PR: token logging" })).toHaveCount(0);
});

test("operator can save and reapply an eval run history view", async ({ page }) => {
  const skillName = `saved-run-view-${Date.now()}`;
  await importSkillBundle(page, skillName);
  await addEvalCase(page, "PR: missing tenant scope");

  await page.locator(".caseReviewCard").filter({ hasText: "PR: missing tenant scope" }).getByRole("button", { name: "不通过", exact: true }).click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();

  await appendSkillBundleVersion(page, skillName, { makeCurrent: false });
  await page.locator(".caseReviewCard").filter({ hasText: "PR: missing tenant scope" }).getByRole("button", { name: "通过", exact: true }).click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await page.getByLabel("Workbench modes").getByRole("button", { name: "历史" }).click();
  await expect(page.locator(".historyRunRow")).toHaveCount(2);

  const variantFilter = page.getByLabel("Variant version filter");
  const candidateVersionId = await variantFilter.locator("option", { hasText: "v2" }).getAttribute("value");
  expect(candidateVersionId).toBeTruthy();
  await variantFilter.selectOption(candidateVersionId!);
  await expect(page.locator(".historyRunRow")).toHaveCount(1);
  await expect(page.locator(".runMatrixRunHeader")).toHaveCount(1);
  await page.getByLabel("Matrix group by").selectOption("impact");
  await page.getByLabel("Show matrix score").uncheck();

  await page.getByLabel("保存视图名称").fill("候选版本通过记录");
  await page.getByRole("button", { name: "保存当前视图" }).click();
  await expect(page.getByLabel("Saved run view")).toContainText("候选版本通过记录");

  await variantFilter.selectOption("all");
  await page.getByLabel("Matrix group by").selectOption("none");
  await page.getByLabel("Show matrix score").check();
  await expect(page.locator(".historyRunRow")).toHaveCount(2);
  await page.getByLabel("Saved run view").selectOption({ label: "候选版本通过记录" });
  await expect(variantFilter).toHaveValue(candidateVersionId!);
  await expect(page.getByLabel("Matrix group by")).toHaveValue("impact");
  await expect(page.getByLabel("Show matrix score")).not.toBeChecked();
  await expect(page.locator(".historyRunRow")).toHaveCount(1);

  await page.getByRole("button", { name: "删除视图" }).click();
  await expect(page.getByLabel("Saved run view")).not.toContainText("候选版本通过记录");
});

test("operator can compare eval runs and accept a verification pointer", async ({ page }) => {
  await importSkillBundle(page, `run-compare-${Date.now()}`);
  await addEvalCase(page, "PR: missing tenant scope");
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "不通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 0/1 通过。")).toBeVisible();
  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: missing tenant scope" })
    .getByRole("button", { name: "通过", exact: true })
    .click();
  await page.getByTestId("eval-run-bar").getByRole("button", { name: "记录本次测评" }).click();
  await expect(page.getByText("已记录 1/1 通过。")).toBeVisible();

  await page.getByLabel("Workbench modes").getByRole("button", { name: "历史" }).click();
  await page.locator(".historyRunRow").filter({ hasText: "0/1" }).getByRole("button", { name: "对照" }).click();
  await page.locator(".historyRunRow").filter({ hasText: "1/1" }).getByRole("button", { name: "候选" }).click();

  await expect(page.getByTestId("run-comparison-panel")).toBeVisible();
  await expect(page.getByTestId("run-comparison-panel").getByText("+100%", { exact: true })).toBeVisible();
  await expect(page.getByTestId("run-comparison-panel").getByText("修复 1")).toBeVisible();

  await page.getByLabel("Accepted verification note").fill("Accepted as Primary verification.");
  await page.getByRole("button", { name: "接受为验证依据" }).click();
  await expect(page.getByText("候选 run 已接受为验证依据。")).toBeVisible();
  await expect(page.locator(".historyRunRow").filter({ hasText: "1/1" }).getByText("Accepted")).toBeVisible();
});

test("operator can inspect eval case version history", async ({ page }) => {
  await importSkillBundle(page, `case-history-${Date.now()}`);
  await addEvalCase(page, "PR: stale case wording");
  await page.getByLabel("Inspector").getByRole("button", { name: "编辑 case" }).click();
  await page.getByPlaceholder("新标题").fill("PR: edited case wording");
  await page.getByPlaceholder("新的 input").fill("diff --git a/service.py b/service.py\n+return Project.find_many({})");
  await page.getByPlaceholder("新的 expected output").fill("Must flag missing tenant scope.");
  await page.getByPlaceholder("为什么更新").fill("Clarified tenant-scope expected result.");
  await page.getByRole("button", { name: "保存 case version" }).click();

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: edited case wording" })
    .getByRole("button", { name: "历史" })
    .click();

  await expect(page.getByText("Case version history")).toBeVisible();
  await expect(page.locator(".caseHistoryVersion")).toHaveCount(2);
  await expect(page.locator(".caseHistoryVersion").filter({ hasText: "Clarified tenant-scope expected result." })).toBeVisible();
  await expect(page.locator(".caseHistoryVersion").filter({ hasText: "Must flag missing tenant scope." })).toBeVisible();

  await page.locator(".evalCaseDetailPanel").getByRole("button", { name: "查看当前" }).click();
  await expect(page.locator(".evalCaseDetailPanel")).toContainText("diff --git a/service.py b/service.py");
  await expect(page.locator(".evalCaseDetailPanel")).toContainText("Must flag missing tenant scope.");
});

test("operator can restore an older eval case version", async ({ page }) => {
  await importSkillBundle(page, `case-restore-${Date.now()}`);
  await addEvalCase(page, "PR: restore case wording");
  await page.getByLabel("Inspector").getByRole("button", { name: "编辑 case" }).click();
  await page.getByPlaceholder("新标题").fill("PR: restore case wording");
  await page.getByPlaceholder("新的 input").fill("diff --git a/service.py b/service.py\n+return Project.find_many({})");
  await page.getByPlaceholder("新的 expected output").fill("Bad edited expectation.");
  await page.getByPlaceholder("为什么更新").fill("Accidental edit.");
  await page.getByRole("button", { name: "保存 case version" }).click();

  await page
    .locator(".caseReviewCard")
    .filter({ hasText: "PR: restore case wording" })
    .getByRole("button", { name: "历史" })
    .click();
  await expect(page.locator(".caseHistoryVersion")).toHaveCount(2);
  await page
    .locator(".caseHistoryVersion")
    .filter({ hasText: "Must flag missing owner_id filter as a P1 issue." })
    .getByRole("button", { name: "恢复此版本" })
    .click();

  await expect(page.getByText("已从 case v1 恢复为新版本。")).toBeVisible();
  await expect(page.locator(".caseHistoryVersion")).toHaveCount(3);
  await expect(page.locator(".caseHistoryVersion").first()).toContainText("Must flag missing owner_id filter as a P1 issue.");
  const currentVersion = page.locator(".caseHistoryVersion").filter({ hasText: "当前版本" });
  await expect(currentVersion).toHaveCount(1);
  await expect(currentVersion).toContainText("Must flag missing owner_id filter as a P1 issue.");
});

test("workbench keeps the primary content within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/skills");

  const workbench = page.locator(".linearWorkbench");
  await expect(workbench).toBeVisible();
  const box = await workbench.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
});
