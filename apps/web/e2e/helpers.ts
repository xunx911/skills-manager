import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const API_BASE_URL = `http://127.0.0.1:${process.env.SKILLHUB_E2E_API_PORT ?? 8021}`;
const CLEANUP_ACTORS = ["product-operator", "release-manager"];

export async function clearSkillCatalog(request: APIRequestContext) {
  const response = await request.get(`${API_BASE_URL}/api/skills`);
  const skills = (await response.json()) as Array<{ skill: { id: string } }>;
  for (const summary of skills) {
    for (const actor of CLEANUP_ACTORS) {
      const deleted = await request.delete(`${API_BASE_URL}/api/skills/${summary.skill.id}`, {
        headers: { "X-SkillHub-Actor": actor },
      });
      if (deleted.ok() || deleted.status() === 404) break;
    }
  }
}

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
  await mkdir(join(bundleDir, "references"));
  await writeFile(join(bundleDir, "references", "checklist.md"), "Check owner filters and secret logging.\n");

  try {
    await page.goto("/skills");
    const inspector = page.getByLabel("Inspector");
    await inspector.getByRole("button", { name: "导入 bundle", exact: true }).click();
    const form = inspector.locator(".inspectorForm");
    await expect(form.locator('input[name="owner_ref"]')).toBeFocused();

    await form.locator('input[name="owner_ref"]').fill("skillhub-e2e");
    await form.locator('input[name="tags"]').fill("codex, e2e");
    await form.locator('input[name="folder_files"]').setInputFiles(bundleDir);
    await expect(inspector.getByText(skillName)).toBeVisible();
    await inspector.getByRole("button", { name: "导入并创建 skill" }).click();

    await expect(page.getByRole("heading", { name: skillName })).toBeVisible();
    await expect(page.locator(".productHero")).toContainText("Review pull requests for authorization and data access regressions.");
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
}

export async function addEvalCase(page: Page, title: string) {
  await page.getByRole("tab", { name: "测评", exact: true }).click();
  await page.getByRole("button", { name: "添加 case" }).click();
  const form = page.getByLabel("Inspector").locator(".inspectorForm");
  await expect(form.locator('input[name="title"]')).toBeFocused();
  await form.locator('input[name="title"]').fill(title);
  await form.locator('textarea[name="input_text"]').fill("diff --git a/api.py b/api.py\n+return db.query(Project).all()");
  await form.locator('textarea[name="expected_output"]').fill("Must flag missing owner_id filter as a P1 issue.");
  await form.locator('textarea[name="notes"]').fill("Regression from customer review.");
  await form.getByRole("button", { name: "加入评测集", exact: true }).click();

  await expect(page.locator(".caseReviewCard").filter({ hasText: title })).toBeVisible();
}

export async function appendSkillBundleVersion(
  page: Page,
  skillName: string,
  options: { makeCurrent?: boolean } = {},
) {
  const bundleDir = await mkdtemp(join(tmpdir(), "skillhub-version-bundle-"));

  await writeFile(
    join(bundleDir, "SKILL.md"),
    [
      "---",
      `name: ${skillName}`,
      "description: Review pull requests for authorization and data access regressions.",
      "---",
      "",
      "# Security Reviewing",
      "Flag auth regressions first.",
      "Prioritize missing tenant filters.",
      "",
    ].join("\n"),
  );
  await writeFile(join(bundleDir, "new-checklist.md"), "Check tenant filters and audit logs.\n");

  try {
    const inspector = page.getByLabel("Inspector");
    await inspector.getByRole("button", { name: "追加版本" }).click();
    await inspector.locator('input[name="version_folder_files"]').setInputFiles(bundleDir);
    await inspector.getByPlaceholder("这次更新的收益").fill("Add tenant filter guidance and replace the checklist.");
    if (options.makeCurrent === false) {
      await inspector.locator('input[name="make_current"]').uncheck();
    }
    await inspector.getByRole("button", { name: "保存版本" }).click();
    await expect(page.getByText("Variant 版本已创建。")).toBeVisible();
  } finally {
    await rm(bundleDir, { force: true, recursive: true });
  }
}

export async function hideVolatileUi(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator(".linearMain").evaluateAll((elements) => {
    for (const element of elements) {
      element.scrollTop = 0;
    }
  });
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
      ".historyRunMain small { visibility: hidden !important; }",
      ".promotionScoreBox small { visibility: hidden !important; }",
      ".promotionBindingList b { visibility: hidden !important; }",
      ".runCompareScoreBox small { visibility: hidden !important; }",
      ".auditTrailRow time { visibility: hidden !important; }",
      ".auditExplorerEvent time { visibility: hidden !important; }",
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
