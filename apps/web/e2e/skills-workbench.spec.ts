import { expect, type Page, test } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("invalid skill folders show a blocking import preview", async ({ page }) => {
  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-invalid-bundle-"));

  await writeFile(join(bundleDir, "README.md"), "# Missing skill contract\n");

  try {
    await page.goto("/skills");
    await page.getByRole("button", { name: "导入 bundle" }).click();
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
    await page.getByRole("button", { name: "导入 bundle" }).click();
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

  await page.getByRole("button", { name: "新建 skill" }).focus();
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

async function importSkillBundle(page: Page, skillName: string) {
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
    await page.getByRole("button", { name: "导入 bundle" }).click();

    await page.getByPlaceholder("skillhub-lab").fill("skillhub-e2e");
    await page.getByPlaceholder("codex, gpt5.4").fill("codex, e2e");
    await page.locator('input[name="folder_files"]').setInputFiles(bundleDir);
    await expect(page.getByText(skillName)).toBeVisible();
    await page.getByRole("button", { name: "导入并创建 skill" }).click();

    await expect(page.getByRole("heading", { name: skillName })).toBeVisible();
    await expect(page.getByText("Review pull requests for authorization and data access regressions.", { exact: true })).toBeVisible();
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
}

async function addEvalCase(page: Page, title: string) {
  await page.getByRole("button", { name: "测评", exact: true }).click();
  await page.getByRole("button", { name: "添加 case" }).click();
  await page.getByPlaceholder("PR: 缺少 owner 校验").fill(title);
  await page.getByPlaceholder("输入：代码 diff、上下文、用户请求...").fill("diff --git a/api.py b/api.py\n+return db.query(Project).all()");
  await page.getByPlaceholder("期望输出：应该指出什么、避免什么...").fill("Must flag missing owner_id filter as a P1 issue.");
  await page.getByPlaceholder("来源、bad case、维护说明").fill("Regression from customer review.");
  await page.getByRole("button", { name: "加入评测集" }).click();

  await expect(page.getByText(title)).toBeVisible();
}

function createStoredZip(entries: Array<{ path: string; content: string }>) {
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const data = Buffer.from(entry.content, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    localChunks.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralChunks.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralStart = offset;
  const centralSize = centralChunks.reduce((total, chunk) => total + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, ...centralChunks, end]);
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
