import { expect, type Page } from "@playwright/test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export async function importSkillBundle(page: Page, skillName: string) {
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
    await page.getByRole("button", { name: "导入 bundle", exact: true }).click();

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

export async function addEvalCase(page: Page, title: string) {
  await page.getByRole("button", { name: "测评", exact: true }).click();
  await page.getByRole("button", { name: "添加 case" }).click();
  await page.getByPlaceholder("PR: 缺少 owner 校验").fill(title);
  await page.getByPlaceholder("输入：代码 diff、上下文、用户请求...").fill("diff --git a/api.py b/api.py\n+return db.query(Project).all()");
  await page.getByPlaceholder("期望输出：应该指出什么、避免什么...").fill("Must flag missing owner_id filter as a P1 issue.");
  await page.getByPlaceholder("来源、bad case、维护说明").fill("Regression from customer review.");
  await page.getByRole("button", { name: "加入评测集" }).click();

  await expect(page.locator(".caseReviewCard").filter({ hasText: title })).toBeVisible();
}

export async function hideVolatileUi(page: Page) {
  await page.addStyleTag({
    content: [
      '[aria-label="Open Next.js Dev Tools"] { display: none !important; }',
      '[aria-label*="Next.js"] { display: none !important; }',
      '[aria-label*="Dev Tools"] { display: none !important; }',
      "[data-nextjs-dev-tools-button] { display: none !important; }",
      "[data-nextjs-dev-overlay] { display: none !important; }",
      "[data-nextjs-toast] { display: none !important; }",
      "nextjs-portal { display: none !important; }",
      ".bindingList b { visibility: hidden !important; }",
    ].join("\n"),
  });
}

export function createStoredZip(entries: Array<{ path: string; content: string }>) {
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
