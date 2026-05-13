# 表单字段基础件第一阶段执行计划

> **给 agentic workers:** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行本计划。步骤使用 checkbox (`- [ ]`) 跟踪。

**目标:** 统一 SkillHub 高频写入表单的 label、hint、autocomplete 和 focus-visible 基础行为，先覆盖 `SkillLaunchpad` 与 `WorkbenchInspector`。

**架构:** 新增轻量 `WorkbenchField` 系列组件，只封装字段壳层，不改变业务 submit handler 或 FormData name。迁移高频表单后，用 E2E 验证 autocomplete、焦点交接和可见焦点；CSS 把相关局部 `:focus` 收敛到 `:focus-visible`。

**技术栈:** React client/server-safe components、HTML form controls、CSS `:focus-visible`、Playwright E2E、Next.js typecheck/build。

---

### Task 1: 写字段基础红灯测试

**Files:**
- Modify: `apps/web/e2e/accessibility-workbench.spec.ts`

- [x] **Step 1: 新增 E2E**

添加测试 `core write forms expose explicit autocomplete and visible field focus`：

```ts
test("core write forms expose explicit autocomplete and visible field focus", async ({ page }) => {
  await page.goto("/skills");

  const launchpadForm = page.locator(".skillLaunchpadForm");
  await expect(launchpadForm.locator('input[name="owner_ref"]')).toHaveAttribute("autocomplete", "off");
  await expect(launchpadForm.locator('input[name="tags"]')).toHaveAttribute("autocomplete", "off");
  await expect(launchpadForm.locator('input[name="variant_label"]')).toHaveAttribute("autocomplete", "off");

  await page.getByLabel("Skill 接入方式").getByRole("button", { name: "新建 skill" }).click();
  await expect(launchpadForm.locator('input[name="slug"]')).toHaveAttribute("autocomplete", "off");
  await expect(launchpadForm.locator('textarea[name="summary"]')).toHaveAttribute("autocomplete", "off");

  await page.getByLabel("Skill catalog").getByRole("button", { name: "导入", exact: true }).click();
  const inspectorOwner = page.getByLabel("Inspector").locator('input[name="owner_ref"]');
  await expect(inspectorOwner).toBeFocused();
  await expect(inspectorOwner).toHaveAttribute("autocomplete", "off");
  await expect(page.getByLabel("Inspector").locator('input[name="tags"]')).toHaveAttribute("autocomplete", "off");
  await expectVisibleFocusIndicator(inspectorOwner);
});
```

- [x] **Step 2: 验证红灯**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/accessibility-workbench.spec.ts --project=chromium -g "core write forms expose explicit autocomplete"
```

Expected: FAIL because core fields do not yet declare explicit autocomplete.

### Task 2: 新增共享字段组件

**Files:**
- Create: `apps/web/components/forms/workbench-field.tsx`

- [x] **Step 1: 创建组件**

新增 `TextField`、`TextAreaField`、`SelectField`、`FileField`。每个组件输出一个 `<label className="workbenchField">`，label 文案在 `<span>` 中，hint 使用 `<small className="workbenchFieldHint">` 并通过 `aria-describedby` 关联。

- [x] **Step 2: 默认 autocomplete**

`TextField` 和 `TextAreaField` 默认 `autoComplete="off"`，调用方可以覆盖。

### Task 3: 迁移高频表单

**Files:**
- Modify: `apps/web/components/skills/skill-launchpad.tsx`
- Modify: `apps/web/components/inspector/workbench-inspector.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 迁移 SkillLaunchpad**

导入共享字段组件，并替换 import/create 两组表单里的 text、textarea、file fields。保留字段 `name`、`placeholder`、`defaultValue`、`required` 和 existing form handlers。

- [x] **Step 2: 迁移 WorkbenchInspector**

替换 skill/new-skill/import-skill/new-variant/new-version/new-case/edit-case 中的 text、textarea、select、file fields。checkbox 保留原生 label，不纳入本轮。

- [x] **Step 3: CSS 收敛**

新增 `.workbenchField` 与 `.workbenchFieldHint` 样式；把 command menu、search box、inline case form、inspector form 的局部 `:focus` 改为 `:focus-visible`。

- [x] **Step 4: 验证绿色**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/accessibility-workbench.spec.ts --project=chromium -g "core write forms expose explicit autocomplete"
```

Expected: 1 passed.

### Task 4: 文档和完整验证

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Create: `.agent/tasks/TASK-044.json`
- Modify: `.agent/tasks.json`
- Modify: `.agent/logs/LOG.md`

- [x] **Step 1: 更新文档**

记录表单字段基础件第一阶段已覆盖 Launchpad 和 Inspector；剩余表单批次留给后续。

- [x] **Step 2: 完整验证**

Run:

```bash
cd apps/web && npm run test:unit
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && npm audit --omit=dev
cd apps/api && uv run pytest
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
jq empty .agent/tasks.json .agent/tasks/TASK-044.json
```

Expected: all pass.
