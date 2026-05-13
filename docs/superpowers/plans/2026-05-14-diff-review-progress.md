# Diff / Promotion review 文件查看进度执行计划

> **给 agentic workers:** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行本计划。步骤使用 checkbox (`- [ ]`) 跟踪。

**目标:** 在 bundle diff 和 promotion review 中提供文件级 viewed progress，让用户知道哪些文件已经审过、还剩多少文件没有看。

**架构:** 新增共享 `useFileReviewProgress` hook，按 diff pair key 维护会话级 viewed file set；`WorkbenchDiffPane` 和 `PromotionDiffViewer` 复用同一 hook，但不改变后端数据模型或 promotion 门禁。

**技术栈:** React hooks、TypeScript、CSS、Playwright E2E、Next.js typecheck/build。

---

### Task 1: 写 reviewed progress 红灯 E2E

**Files:**
- Modify: `apps/web/e2e/skills-workbench.spec.ts`

- [x] **Step 1: 扩展 diff 页测试**

在 `operator can compare standard bundle versions` 中追加断言：

```ts
await expect(page.locator(".diffSummary")).toContainText("Reviewed");
await expect(page.locator(".diffSummary")).toContainText("0/3");
await page.getByLabel("已查看此 diff 文件").check();
await expect(page.locator(".diffSummary")).toContainText("1/3");
await expect(page.locator(".diffFileRow").filter({ hasText: "SKILL.md" })).toContainText("已查看");
```

- [x] **Step 2: 扩展 promotion review 测试**

在 `operator can review a candidate version before promoting it` 的 promotion diff 断言后追加：

```ts
await expect(page.locator(".promotionDiffPanel")).toContainText("0/3 reviewed");
await page.getByLabel("已查看此 promotion diff 文件").check();
await expect(page.locator(".promotionDiffPanel")).toContainText("1/3 reviewed");
```

- [x] **Step 3: 验证红灯**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/skills-workbench.spec.ts --project=chromium -g "compare standard bundle versions|review a candidate version before promoting"
```

Expected: FAIL because reviewed progress UI does not exist.

### Task 2: 实现共享 progress hook 和 diff 页 UI

**Files:**
- Create: `apps/web/components/diff/use-file-review-progress.ts`
- Modify: `apps/web/components/diff/workbench-diff-pane.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 创建 hook**

实现 `useFileReviewProgress(files, reviewKey)`。当 `reviewKey` 改变时清空 `viewedPaths`；按当前 files 过滤 viewed count，避免旧 path 残留。

- [x] **Step 2: 接入 WorkbenchDiffPane**

用 `reviewKey = diff ? `${diff.left.variant_version_id}:${diff.right.variant_version_id}:${diff.right.content_digest}` : "empty"` 初始化 hook。summary 增加 `Metric label="Reviewed" value={`${viewedCount}/${totalCount}`}`。

- [x] **Step 3: 增加文件状态和 header checkbox**

文件 rail row 的 small 文案从单一 status 变成 `status · 已查看/未看`；详情 header 右侧增加 checkbox label，`aria-label="已查看此 diff 文件"`。

### Task 3: 接入 PromotionDiffViewer

**Files:**
- Modify: `apps/web/components/promotion-review/promotion-diff-viewer.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 复用 hook**

用同样的 diff pair key 初始化 `useFileReviewProgress`。

- [x] **Step 2: Header 显示 progress**

在 `promotionDiffStats` 前或内部显示 `x/y reviewed`，文案必须和 E2E 匹配。

- [x] **Step 3: 当前文件 checkbox**

在代码面板顶部增加 `aria-label="已查看此 promotion diff 文件"` 的 checkbox；勾选后当前 file row 显示 `已查看`。

- [x] **Step 4: 验证绿色**

Run:

```bash
cd apps/web
UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npx playwright test e2e/skills-workbench.spec.ts --project=chromium -g "compare standard bundle versions|review a candidate version before promoting"
```

Expected: both targeted tests pass.

### Task 4: 文档和完整验证

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-ux-friction-audit-2026-05-14.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Create: `.agent/tasks/TASK-046.json`
- Modify: `.agent/tasks.json`
- Modify: `.agent/logs/LOG.md`

- [x] **Step 1: 更新产品文档**

记录 Diff / Promotion review 文件 viewed progress 第一阶段已完成；服务端持久化、自动 collapse、reviewed gate 和 hunk-to-case 关联留到后续。

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
jq empty .agent/tasks.json .agent/tasks/TASK-046.json
```

Expected: all pass.
