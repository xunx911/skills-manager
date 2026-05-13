# Run Matrix Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Run matrix 支持 impact 过滤、按 impact 分组、分数显示控制，并把这些视图偏好保存到 saved views。

**Architecture:** 不改 `GET /api/skills/{skill_id}/eval-run-matrix` 的事实数据结构；前端根据现有 cells 计算 impact、过滤和分组。后端只扩展 `saved_views.config` 允许 matrix 控制键，仍然把配置作为轻量 JSON 存储。

**Tech Stack:** FastAPI repository、Next.js client components、Playwright E2E。

---

### Task 1: 红色 API 测试

**Files:**
- Modify: `apps/api/tests/test_api_commands.py`

- [x] **Step 1: 扩展 saved view config 测试**

在 saved view API 测试中提交 config：

```json
{
  "variant_version_id": "version-a",
  "matrix_group_by": "impact",
  "matrix_impact": "fixed",
  "matrix_show_score": "false"
}
```

断言返回和 list 结果保留三个 matrix key。

- [x] **Step 2: 验证红灯**

Run:

```bash
cd apps/api && uv run pytest tests/test_api_commands.py -k "saved_view"
```

Expected: FAIL，因为 repository 目前会丢弃 matrix keys。

### Task 2: Saved View 后端配置

**Files:**
- Modify: `apps/api/skillhub/infrastructure/db/repositories.py`
- Modify: `apps/api/skillhub/api/main.py`
- Modify: `apps/web/lib/types.ts`

- [x] **Step 1: 放宽 payload 类型**

`CreateSavedViewPayload.config` 改为 `dict[str, str]` 保持不变；不需要支持复杂对象。

- [x] **Step 2: 扩展 allowlist**

`_saved_view_config` 允许 `matrix_group_by`、`matrix_impact`、`matrix_show_score`，继续丢弃空值和 `"all"`。

- [x] **Step 3: 更新前端类型**

`SavedView.config` 增加 matrix 控制键。

### Task 3: 红色 E2E

**Files:**
- Modify: `apps/web/e2e/skills-workbench.spec.ts`

- [x] **Step 1: 扩展 run matrix 测试**

在 `operator can inspect run matrix across eval runs` 中，选择对照/候选后：

```ts
await page.getByLabel("Matrix group by").selectOption("impact");
await expect(page.locator(".runMatrixGroupRow").filter({ hasText: "修复 · 1 case" })).toBeVisible();
await page.getByLabel("Matrix impact filter").selectOption("fixed");
await expect(page.locator(".runMatrixCaseTitle", { hasText: "PR: missing tenant scope" })).toBeVisible();
await expect(page.locator(".runMatrixCaseTitle", { hasText: "PR: token logging" })).toHaveCount(0);
```

- [x] **Step 2: 扩展 saved view 测试**

在保存视图测试里设置 group by impact、hide score，保存后改回默认，再应用保存视图，断言控件恢复。

- [x] **Step 3: 验证红灯**

Run:

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- --grep "run matrix|saved run"
```

Expected: FAIL，因为 controls 尚不存在。

### Task 4: 前端实现

**Files:**
- Modify: `apps/web/components/run-matrix/run-matrix-panel.tsx`
- Modify: `apps/web/components/decision-workbench.tsx`
- Modify: `apps/web/app/globals.css`

- [x] **Step 1: 增加 matrix controls state**

在 `DecisionWorkbench` 中新增：

```ts
type RunMatrixControls = {
  matrix_group_by: "none" | "impact";
  matrix_impact: "all" | MatrixImpact;
  matrix_show_score: "true" | "false";
};
```

- [x] **Step 2: saved views 读写 controls**

保存视图时合并 `runFilterConfig(runFilters)` 和 `runMatrixControlConfig(runMatrixControls)`；应用视图时恢复 run filters 和 matrix controls。

- [x] **Step 3: RunMatrixPanel 渲染 controls**

添加 select/checkbox 控件，计算 filtered cases 和 grouped cases，插入 group row；`show_score=false` 时隐藏 header pass rate。

- [x] **Step 4: 样式**

新增 `.runMatrixControls`、`.runMatrixGroupRow`、`.runMatrixEmptyView` 样式，保持紧凑表格工具栏风格。

### Task 5: 文档、视觉和验证

**Files:**
- Modify: `README.md`
- Modify: `docs/product-ux-review.md`
- Modify: `docs/product-completion-audit-2026-05-08.md`
- Modify: `.agent/logs/LOG.md`
- Modify: `.agent/tasks.json`
- Create: `.agent/tasks/TASK-019.json`
- Modify: `apps/web/e2e/visual-workbench.spec.ts-snapshots/run-comparison-ready-chromium-darwin.png`

- [x] **Step 1: 更新视觉基线**

Run:

```bash
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e -- --grep "visual baseline: run comparison" --update-snapshots
```

- [x] **Step 2: 完整验证**

Run:

```bash
cd apps/api && uv run pytest
cd apps/web && npm run typecheck
cd apps/web && npm run build
cd apps/web && UV_CACHE_DIR=/Users/xx/Documents/code/skills-manager/.uv-cache npm run e2e
git diff --check
```

Expected: 全部通过。

- [x] **Step 3: 提交**

设置 TASK-019 complete / passes true，提交 `feat: add run matrix controls`。
